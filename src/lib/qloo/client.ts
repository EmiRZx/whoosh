import type { ResponseCache } from "./cache";

export const HACKATHON_BASE_URL = "https://hackathon.api.qloo.com";

export type QueryParams = Record<string, string | number | boolean | undefined>;

export class QlooError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "QlooError";
  }
}

export interface QlooClientOptions {
  apiKey: string;
  baseUrl?: string;
  cache?: ResponseCache;
  fetch?: typeof fetch;
  // The hackathon key allows about 5 requests a second.
  minIntervalMs?: number;
  timeoutMs?: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class QlooClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly minIntervalMs: number;
  private readonly timeoutMs: number;
  private nextSlot = 0;

  constructor(private readonly options: QlooClientOptions) {
    if (!options.apiKey) throw new QlooError("QLOO_API_KEY is not set", null, false);
    this.baseUrl = (options.baseUrl ?? HACKATHON_BASE_URL).replace(/\/+$/, "");
    this.fetchImpl = options.fetch ?? fetch;
    this.minIntervalMs = options.minIntervalMs ?? 220;
    this.timeoutMs = options.timeoutMs ?? 30_000;
  }

  // Sorted, undefined-free params give one cache key per logical request.
  static cacheKey(path: string, params: QueryParams) {
    const entries = Object.entries(params)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]): [string, string] => [k, String(v)])
      .sort(([a], [b]) => a.localeCompare(b));
    return `${path}?${new URLSearchParams(entries)}`;
  }

  async get(path: string, params: QueryParams = {}): Promise<unknown> {
    const key = QlooClient.cacheKey(path, params);
    const cached = await this.options.cache?.get(key);
    if (cached !== undefined) return cached;

    const body = await this.request(`${this.baseUrl}${key}`);
    await this.options.cache?.set(key, body);
    return body;
  }

  private async paced() {
    const wait = Math.max(0, this.nextSlot - Date.now());
    this.nextSlot = Date.now() + wait + this.minIntervalMs;
    if (wait) await sleep(wait);
  }

  private async request(url: string): Promise<unknown> {
    for (let attempt = 0; ; attempt++) {
      await this.paced();
      let res: Response;
      try {
        res = await this.fetchImpl(url, {
          headers: { "X-Api-Key": this.options.apiKey, Accept: "application/json" },
          signal: AbortSignal.timeout(this.timeoutMs),
        });
      } catch (err) {
        if (attempt < 1) continue;
        throw new QlooError(`Qloo request failed: ${(err as Error).message}`, null, true);
      }

      if (res.ok) return res.json();

      if (res.status === 429 && attempt < 3) {
        const retryAfter = Number(res.headers.get("retry-after"));
        await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1000 * (attempt + 1));
        continue;
      }
      if (res.status >= 500 && attempt < 1) {
        await sleep(800);
        continue;
      }

      const detail = (await res.text().catch(() => "")).slice(0, 300);
      if (res.status === 401) {
        throw new QlooError(
          "Qloo rejected the key (401). Hackathon keys only work on https://hackathon.api.qloo.com with the X-Api-Key header.",
          401,
          false,
        );
      }
      throw new QlooError(`Qloo returned ${res.status}: ${detail}`, res.status, res.status === 429 || res.status >= 500);
    }
  }
}
