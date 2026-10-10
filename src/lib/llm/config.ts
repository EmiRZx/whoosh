import Anthropic from "@anthropic-ai/sdk";

// The model behind every agent step. LLM_MODEL overrides it (e.g. a cheaper
// model while developing); the SDK reads ANTHROPIC_API_KEY and, for an
// Anthropic-compatible gateway, ANTHROPIC_BASE_URL.
export const AGENT_MODEL = process.env.LLM_MODEL || "claude-opus-5-5";

// Gateways and keys cap concurrent requests; past the cap they queue and then
// fail. Requests from this server wait their turn here instead, which also
// covers the swap agents' tool loops.
const MAX_CONCURRENT = Number(process.env.LLM_CONCURRENCY) || 3;
let active = 0;
const waiting: (() => void)[] = [];

const limitedFetch: typeof fetch = async (input, init) => {
  if (active >= MAX_CONCURRENT) await new Promise<void>((resolve) => waiting.push(resolve));
  active++;
  try {
    return await fetch(input, init);
  } finally {
    active--;
    waiting.shift()?.();
  }
};

// Null when no key is configured: only the built-in examples run then.
export function getAnthropic(): Anthropic | null {
  return process.env.ANTHROPIC_API_KEY ? new Anthropic({ fetch: limitedFetch, maxRetries: 3 }) : null;
}


// Server-side refusal fallback: if the primary model declines, the API re-runs
// the request on a model chosen by refusal category within the same call.
export const FALLBACK_BETA = "server-side-fallback-2026-07-01";

export class LlmError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmError";
  }
}

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}

// Per-analysis plumbing for model calls: stop when the visitor leaves, and
// count tokens so a run's cost shows up in the server log.
export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export interface LlmOptions {
  signal?: AbortSignal;
  onUsage?: (step: string, usage: TokenUsage) => void;
  // Overrides a step's effort, for evals.
  effort?: Effort;
}

export class UsageMeter {
  private totals = new Map<string, { calls: number; input: number; output: number; cacheWrite: number; cacheRead: number }>();

  record = (step: string, usage: TokenUsage) => {
    const t = this.totals.get(step) ?? { calls: 0, input: 0, output: 0, cacheWrite: 0, cacheRead: 0 };
    t.calls++;
    t.input += usage.input_tokens;
    t.output += usage.output_tokens;
    t.cacheWrite += usage.cache_creation_input_tokens ?? 0;
    t.cacheRead += usage.cache_read_input_tokens ?? 0;
    this.totals.set(step, t);
  };

  get empty() {
    return this.totals.size === 0;
  }

  summary() {
    return Object.fromEntries(this.totals);
  }
}
