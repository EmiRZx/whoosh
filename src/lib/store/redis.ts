// A minimal client for a Redis REST endpoint (Upstash, or Upstash through the
// Vercel Marketplace). Optional: without the env vars everything falls back to
// per-process memory.

const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;

export const hasRedis = Boolean(url && token);

type Command = (string | number)[];

export async function redis<T = unknown>(command: Command): Promise<T> {
  const [result] = await pipeline<[T]>([command]);
  return result;
}

export async function pipeline<T extends unknown[]>(commands: Command[]): Promise<T> {
  if (!hasRedis) throw new Error("Redis is not configured");
  const res = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
    signal: AbortSignal.timeout(5000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Redis returned ${res.status}`);
  const body = (await res.json()) as { result?: unknown; error?: string }[];
  return body.map((r) => {
    if (r.error) throw new Error(`Redis error: ${r.error}`);
    return r.result;
  }) as T;
}
