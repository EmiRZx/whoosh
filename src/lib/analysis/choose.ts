import type Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { QlooEntity } from "../qloo/api";
import { AGENT_MODEL, FALLBACK_BETA, LlmError, type LlmOptions } from "../llm/config";
import type { ExtractedReference } from "./extract";

export interface ChoiceRequest {
  id: string;
  reference: ExtractedReference;
  candidates: QlooEntity[];
}

export const ChoiceSchema = z.object({
  picks: z.array(
    z.object({
      id: z.string(),
      choice: z.number().int().nullable().describe("Index of the matching candidate, or null if none matches"),
      stand_in: z.boolean().describe("true when the chosen candidate stands in for the reference rather than being it"),
      note: z.string().describe("A few words on what the chosen candidate is, or why none matches"),
    }),
  ),
});
export type Choices = z.infer<typeof ChoiceSchema>;

export const CHOOSE_SYSTEM_PROMPT = `You match references from a script to entries in Qloo's taste graph. Each reference comes with the name the writer used, what kind of thing it is, the job it does in the line, and the candidates a Qloo search returned. Pick the candidate that is the thing the speaker meant, so the system can measure how a specific audience feels about it.

- The same entity under a slightly different name is a match: "Apple Inc" for Apple, "Tupperware Brands" for Tupperware, "Total Request Live" for TRL.
- A stand-in is acceptable only when it would draw essentially the same audience as the reference: a product's renamed successor ("Microsoft 365" for Microsoft Office), or a single location that has become the cultural symbol of the brand (the last Blockbuster store for Blockbuster). Set stand_in to true and say in the note what it is.
- An ordinary branch, an unrelated business with the same name, or a different product with a similar name is not a match: one YMCA branch, a restaurant called Canvas, Canva for Canvas. Return null.
- When unsure, return null. An unchecked reference is better than a confident measurement of the wrong thing.`;

export function describeChoices(requests: ChoiceRequest[]): string {
  return requests
    .map((r) => {
      const ref = r.reference;
      const head = `<reference id="${r.id}">\nname: ${ref.name}\nkind: ${ref.kind}${ref.disambiguation ? `\nmeans: ${ref.disambiguation}` : ""}\nin the script: ${ref.quotes.map((q) => `"${q}"`).join(", ")}\njob in the line: ${ref.role}`;
      const cands = r.candidates
        .map((c, i) => {
          const facts = [
            c.types[0]?.replace("urn:entity:", ""),
            c.disambiguation,
            c.releaseYear,
            c.popularity !== undefined ? `popularity ${c.popularity.toFixed(2)}` : "no popularity data",
          ].filter(Boolean);
          const about = c.description ? ` - ${c.description.slice(0, 160)}` : "";
          return `  [${i}] ${c.name} (${facts.join(", ")})${about}`;
        })
        .join("\n");
      return `${head}\ncandidates:\n${cands}\n</reference>`;
    })
    .join("\n\n");
}

export async function chooseCandidates(client: Anthropic, requests: ChoiceRequest[], opts: LlmOptions = {}): Promise<Choices> {
  if (!requests.length) return { picks: [] };
  const response = await client.beta.messages.parse(
    {
    model: AGENT_MODEL,
    max_tokens: 8000,
    betas: [FALLBACK_BETA],
    fallbacks: "default",
    thinking: { type: "adaptive" },
    output_config: { effort: "medium", format: betaZodOutputFormat(ChoiceSchema) },
    system: CHOOSE_SYSTEM_PROMPT,
    messages: [{ role: "user", content: describeChoices(requests) }],
    },
    { signal: opts.signal },
  );
  opts.onUsage?.("choose", response.usage);
  if (response.stop_reason === "refusal") throw new LlmError("The model declined to match references.");
  if (!response.parsed_output) throw new LlmError(`Matching did not return valid output (${response.stop_reason}).`);
  return response.parsed_output;
}
