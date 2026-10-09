// The model's gut call on each reference for this room, made before it sees
// any Qloo data. Shown next to the measurement, it makes the point of the
// product visible: where intuition and taste data disagree.
import type Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { AGE_BUCKETS } from "../qloo/api";
import { AGENT_MODEL, FALLBACK_BETA, LlmError, type LlmOptions } from "../llm/config";
import type { ExtractedReference } from "./extract";
import type { AudienceSpec, GutCall } from "./types";

export const GutSchema = z.object({
  calls: z.array(
    z.object({
      id: z.string(),
      verdict: z.enum(["lands", "risky", "dead"]),
      room_vs_average: z.number().int().describe("How much this room likes it vs. the average US adult, in percent"),
      biggest_fans: z.enum(AGE_BUCKETS).describe("The age group that likes it most compared with the average adult"),
      reason: z.string().describe("Why, in at most 15 words"),
    }),
  ),
});
export type GutCalls = z.infer<typeof GutSchema>;
export type RawGutCall = GutCalls["calls"][number];

export const GUT_SYSTEM_PROMPT = `You are an experienced comedy writer and speechwriter. Before a show you read the script and make a quick gut call on each cultural reference: will this particular room get it and enjoy it? You go on what you know about the reference and about the people in the room, without looking anything up.

For each reference, give:
- verdict:
  - lands: most of this room knows it and likes it at least about as much as the average adult does.
  - risky: they'll know it, but it isn't their thing, or only part of the room will know it.
  - dead: it has faded or is too niche, and this room won't get it or won't care.
- room_vs_average: your estimate of how much this room likes it compared with the average US adult, as a whole percent. 30 means 30% more than the average adult, -40 means 40% less, 0 means about the same.
- biggest_fans: the age group that likes it most compared with the average adult. This is about who over-indexes on it, not which group is largest.
- reason: why, in at most 15 words.

Judge the reference for this room, not whether the joke is good. Commit to a call: if you think the room is cool on something, say so.`;

const AGE_NAMES: Record<(typeof AGE_BUCKETS)[number], string> = {
  "24_and_younger": "24 and under",
  "25_to_29": "25-29",
  "30_to_34": "30-34",
  "35_to_44": "35-44",
  "45_to_54": "45-54",
  "55_and_older": "55 and over",
};

export interface GutRequest {
  id: string;
  reference: ExtractedReference;
}

export function describeGutTask(text: string, audience: Pick<AudienceSpec, "label" | "ageMix">, description: string, requests: GutRequest[]): string {
  const ages = AGE_BUCKETS.map((b) => `${AGE_NAMES[b]} (${b}): ${Math.round(audience.ageMix[b] * 100)}%`).join(", ");
  const refs = requests
    .map(({ id, reference: r }) =>
      [
        `<reference id="${id}">`,
        `name: ${r.name}`,
        `kind: ${r.kind}`,
        r.disambiguation ? `means: ${r.disambiguation}` : "",
        `job in the line: ${r.role}`,
        `</reference>`,
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n");
  return `<room>\n${audience.label}: ${description}.\nAges: ${ages}\n</room>\n\n<script>\n${text}\n</script>\n\n<references>\n${refs}\n</references>\n\nGive a call for every reference id.`;
}

export function toGutCall(raw: RawGutCall): GutCall {
  return { verdict: raw.verdict, roomIndex: raw.room_vs_average / 100, fans: raw.biggest_fans, reason: raw.reason };
}

export async function gutCalls(
  client: Anthropic,
  text: string,
  audience: Pick<AudienceSpec, "label" | "ageMix">,
  description: string,
  requests: GutRequest[],
  opts: LlmOptions = {},
): Promise<GutCalls> {
  if (!requests.length) return { calls: [] };
  const response = await client.beta.messages.parse(
    {
    model: AGENT_MODEL,
    max_tokens: 8000,
    betas: [FALLBACK_BETA],
    fallbacks: "default",
    thinking: { type: "adaptive" },
    output_config: { effort: "medium", format: betaZodOutputFormat(GutSchema) },
    system: GUT_SYSTEM_PROMPT,
    messages: [{ role: "user", content: describeGutTask(text, audience, description, requests) }],
    },
    { signal: opts.signal },
  );
  opts.onUsage?.("gut", response.usage);
  if (response.stop_reason === "refusal") throw new LlmError("The model declined to make gut calls.");
  if (!response.parsed_output) throw new LlmError(`Gut calls did not return valid output (${response.stop_reason}).`);
  return response.parsed_output;
}
