// Structured output that survives a provider which doesn't enforce the JSON
// schema: the format is still requested, but the reply is parsed leniently
// (code fences stripped, a bare list wrapped in its object) and validated
// with the same schema before anything uses it.
import type Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { MessageCreateParamsNonStreaming as BetaMessageCreateParamsNonStreaming } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { z } from "zod";
import { LlmError, type LlmOptions } from "./config";

// Pulls the JSON value out of a reply: plain JSON, fenced JSON, or the first
// object or list in surrounding text.
export function extractJson(text: string): unknown {
  const attempts = [text.trim()];
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) attempts.push(fenced[1].trim());
  const start = text.search(/[[{]/);
  if (start >= 0) attempts.push(text.slice(start, Math.max(text.lastIndexOf("}"), text.lastIndexOf("]")) + 1));
  for (const a of attempts) {
    try {
      return JSON.parse(a);
    } catch {}
  }
  return undefined;
}

// Validates a reply against the schema; a bare list becomes { [listKey]: list }.
export function parseLenient<T>(text: string, schema: z.ZodType<T>, listKey?: string): T | undefined {
  let value = extractJson(text);
  if (Array.isArray(value) && listKey) value = { [listKey]: value };
  const result = schema.safeParse(value);
  return result.success ? result.data : undefined;
}

type Params = Omit<BetaMessageCreateParamsNonStreaming, "output_config"> & { output_config?: { effort?: "low" | "medium" | "high" | "xhigh" | "max" } };

export async function structuredCall<T>(
  client: Anthropic,
  params: Params,
  schema: z.ZodType<T>,
  opts: LlmOptions & { step: string; listKey?: string; refusal: string },
): Promise<T> {
  // Spelled out too, for providers that don't enforce output_config.format.
  const system = `${typeof params.system === "string" ? params.system : ""}

Reply with a single JSON object that matches this JSON schema, and nothing else:
${JSON.stringify(z.toJSONSchema(schema))}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await client.beta.messages.create(
      { ...params, system, output_config: { ...params.output_config, format: betaZodOutputFormat(schema as never) } } as BetaMessageCreateParamsNonStreaming,
      { signal: opts.signal },
    );
    opts.onUsage?.(opts.step, response.usage);
    if (response.stop_reason === "refusal") throw new LlmError(opts.refusal);
    const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    const parsed = parseLenient(text, schema, opts.listKey);
    if (parsed !== undefined) return parsed;
  }
  throw new LlmError(`The ${opts.step} step did not return valid output.`);
}
