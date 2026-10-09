export const AGENT_MODEL = "claude-opus-5-5";

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
export interface LlmOptions {
  signal?: AbortSignal;
  onUsage?: (step: string, usage: TokenUsage) => void;
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
