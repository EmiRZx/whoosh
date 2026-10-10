import type Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { AGENT_MODEL, FALLBACK_BETA, type LlmOptions } from "../llm/config";
import { AGE_BUCKETS } from "../qloo/api";
import type { QlooClient } from "../qloo/client";
import {
  check,
  CheckInput,
  findCandidates,
  FindCandidatesInput,
  FindTagsInput,
  findTagIds,
  lookup,
  LookupInput,
  SubmitInput,
  validateSubmission,
  type Checked,
  type SwapContext,
} from "./swap-tools";
import { AGE_LABEL } from "./verdict";

export const SWAP_SYSTEM_PROMPT = `You help a performer fix one cultural reference that won't land with tonight's audience. You get the line, the paragraph around it, the reference, the job it does in the line, who is in the room, and Qloo's reading of why the reference is weak there. Find up to three substitutes that do the same job for this audience, and rewrite the line for each. Read the paragraph: a reference often depends on something said just before or after it, and a substitute has to keep that link.

How to work:
- find_candidates searches Qloo's taste graph for things similar to the original that this room's main age group likes. Narrow it when the job calls for it: tags from find_tags (a sitcom for a sitcom, fast food for fast food), another type, or a release year. lookup finds a specific substitute you already have in mind.
- Check every substitute with check before proposing it; it measures the substitute exactly the way the original was measured. Only substitutes whose check says beats_original: true can be submitted: they land and are clearly a better fit for this room than the original. When the room has cities, prefer substitutes that rank well there.
- Judge the fit yourself. A substitute has to do the same job in the line: same role, tone and status (a dated gadget for a dated gadget, a cheesy boy band for a cheesy boy band, a cheap comfort chain for a cheap comfort chain). A popular substitute that does a different job is worse than none.
- Don't reuse something the script already mentions elsewhere; the performer would be repeating themselves.
- Change only the words that carry the reference. Keep the performer's voice, rhythm and punchline, and adjust nearby words only when grammar or sense requires it. Don't write new jokes.
- Never change who said or did something real. If the line quotes a real person, or states a fact about them, that reference can't be swapped: submit an empty list and say so in the note.
- Match the occasion's tone: a wedding toast or a classroom needs swaps that are warm and clean, not edgy.
- Finish by calling submit_swaps. If nothing both fits the job and lands, submit an empty list with a one-sentence note; that is a useful answer.
- Write each why and the note for the performer, in plain words: say "this room likes it 30% more than average", never raw index values like "room index 0.30".

You have about ten tool calls.`;

const pct = (x: number) => `${Math.round(x * 100)}%`;

export function describeSwapTask(ctx: SwapContext): string {
  const o = ctx.original;
  const ages = AGE_BUCKETS.filter((b) => ctx.audience.ageMix[b] >= 0.05)
    .map((b) => `${AGE_LABEL[b]} ${pct(ctx.audience.ageMix[b])}`)
    .join(", ");
  const cities = ctx.audience.cities.map((c) => c.name).join(", ");
  return [
    o.context && o.context !== o.line ? `<paragraph>${o.context}</paragraph>` : "",
    `<line>${o.line}</line>`,
    `<reference>\nname: ${o.name}\nmeasured as: ${o.entity_name} (${o.type.replace("urn:entity:", "")}, id ${o.id})${o.stand_in ? `, a stand-in: ${o.stand_in}` : ""}\nwords in the line: ${o.quotes.map((q) => `"${q}"`).join(", ")}\njob in the line: ${o.role}\nweight: ${o.weight}\nQloo verdict for this room: ${o.verdict}${o.room_index === undefined ? "" : ` (room index ${o.room_index.toFixed(2)})`}\n${o.reasons.map((r) => `- ${r}`).join("\n")}\n</reference>`,
    `<room>\n${ctx.audience.label}: ${ages}${cities ? `\ncities: ${cities}` : ""}${
      ctx.audience.performer ? `\nfind_candidates also weighs what fans of ${ctx.audience.performer.name} like.` : ""
    }\n</room>`,
    ctx.others.length ? `<already_in_the_script>\n${ctx.others.join(", ")}\n</already_in_the_script>` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export interface SwapResult {
  swaps: { checked: Checked; rewrite: string; why: string }[];
  note: string;
}

export async function runSwapAgent(anthropic: Anthropic, qloo: QlooClient, ctx: SwapContext, opts: LlmOptions = {}): Promise<SwapResult> {
  let submitted: SwapResult | undefined;
  // Tool errors go back to the model as text so it can adjust, rather than
  // aborting the run.
  const safely = async (fn: () => Promise<unknown>) => {
    try {
      return JSON.stringify(await fn());
    } catch (err) {
      return `Error: ${(err as Error).message}`;
    }
  };

  const tools = [
    betaZodTool({
      name: "find_candidates",
      description:
        "Search Qloo for substitutes similar to the original (or to another entity) that this room's main age group likes, and, when the room is a performer's crowd, that their fans like.",
      inputSchema: FindCandidatesInput,
      run: (input) => safely(() => findCandidates(qloo, ctx, input)),
    }),
    betaZodTool({
      name: "lookup",
      description: "Find a specific substitute by name in Qloo, to get its id.",
      inputSchema: LookupInput,
      run: (input) => safely(() => lookup(qloo, input)),
    }),
    betaZodTool({
      name: "find_tags",
      description: "Find Qloo tag ids for a genre or descriptor, to narrow find_candidates.",
      inputSchema: FindTagsInput,
      run: (input) => safely(() => findTagIds(qloo, input)),
    }),
    betaZodTool({
      name: "check",
      description:
        "Measure substitutes against this room exactly as the original was measured: presence today, room index, biggest fans, city ranks, a verdict, and whether it beats the original for this room.",
      inputSchema: CheckInput,
      run: (input) => safely(() => check(qloo, ctx, input)),
    }),
    betaZodTool({
      name: "submit_swaps",
      description: "Submit up to three substitutes whose check says beats_original: true, each with the rewritten line. Submit an empty list if none fit.",
      inputSchema: SubmitInput,
      run: async (input) => {
        const problems = validateSubmission(ctx, input);
        if (problems.length) return `Not accepted:\n- ${problems.join("\n- ")}`;
        submitted = {
          swaps: input.swaps.map((s) => ({ checked: ctx.checked[s.id], rewrite: s.rewrite, why: s.why })),
          note: input.note,
        };
        return "Accepted.";
      },
    }),
  ];

  const runner = anthropic.beta.messages.toolRunner(
    {
    model: AGENT_MODEL,
    max_tokens: 16000,
    max_iterations: 14,
    betas: [FALLBACK_BETA],
    fallbacks: "default",
    thinking: { type: "adaptive" },
    output_config: { effort: opts.effort ?? "high" },
    system: SWAP_SYSTEM_PROMPT,
    tools,
    // Each turn resends the conversation so far; caching its prefix makes
    // the later turns cheap without changing what the model sees.
    cache_control: { type: "ephemeral" },
    messages: [{ role: "user", content: describeSwapTask(ctx) }],
    },
    { signal: opts.signal },
  );
  const started = Date.now();
  let turns = 0;
  for await (const message of runner) {
    turns++;
    opts.onUsage?.("swap", message.usage);
    if (submitted || message.stop_reason === "refusal") break;
  }
  console.info(`[swap] ${ctx.original.name}: ${turns} turns in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  return submitted ?? { swaps: [], note: "No substitute was confirmed for this room." };
}
