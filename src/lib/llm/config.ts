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
