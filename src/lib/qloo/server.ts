import path from "node:path";
import { hasRedis, redis } from "../store/redis";
import { FileCache, MemoryCache, RedisCache, TieredCache, type ResponseCache } from "./cache";
import { QlooClient } from "./client";

let client: QlooClient | null | undefined;

function sharedTier(): ResponseCache {
  if (hasRedis) {
    return new RedisCache({
      get: (key) => redis<string | null>(["GET", key]),
      set: async (key, value, ttl) => {
        await redis(["SET", key, value, "EX", ttl]);
      },
    });
  }
  // Serverless hosts only allow writes under /tmp.
  const dir = process.env.QLOO_CACHE_DIR ?? (process.env.VERCEL ? "/tmp/qloo" : ".cache/qloo");
  return new FileCache(path.resolve(/*turbopackIgnore: true*/ dir));
}

// One client per server process so pacing and the cache are shared across
// requests. Returns null when no key is configured.
export function getQlooClient(): QlooClient | null {
  if (client !== undefined) return client;
  const apiKey = process.env.QLOO_API_KEY;
  client = apiKey
    ? new QlooClient({
        apiKey,
        baseUrl: process.env.QLOO_BASE_URL || undefined,
        cache: new TieredCache([new MemoryCache(), sharedTier()]),
      })
    : null;
  return client;
}
