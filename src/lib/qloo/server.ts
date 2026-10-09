import path from "node:path";
import { FileCache, MemoryCache, TieredCache } from "./cache";
import { QlooClient } from "./client";

let client: QlooClient | null | undefined;

// One client per server process so pacing and the cache are shared across
// requests. Returns null when no key is configured.
export function getQlooClient(): QlooClient | null {
  if (client !== undefined) return client;
  const apiKey = process.env.QLOO_API_KEY;
  client = apiKey
    ? new QlooClient({
        apiKey,
        baseUrl: process.env.QLOO_BASE_URL || undefined,
        cache: new TieredCache([new MemoryCache(), new FileCache(path.resolve(process.env.QLOO_CACHE_DIR ?? ".cache/qloo"))]),
      })
    : null;
  return client;
}
