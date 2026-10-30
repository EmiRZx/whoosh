import { describe, expect, it } from "vitest";
import { RedisCache } from "./cache";

function memoryStore() {
  const data = new Map<string, string>();
  return {
    data,
    get: async (key: string) => data.get(key) ?? null,
    set: async (key: string, value: string) => void data.set(key, value),
  };
}

describe("RedisCache", () => {
  it("stores responses gzipped and reads them back", async () => {
    const store = memoryStore();
    const cache = new RedisCache(store);
    const value = { results: Array.from({ length: 50 }, (_, i) => ({ name: `Entity ${i}`, popularity: 0.9, tags: ["comedy", "sitcom"] })) };
    await cache.set("search:friends", value);
    const [raw] = [...store.data.values()];
    expect(raw.startsWith("gz:")).toBe(true);
    expect(raw.length).toBeLessThan(JSON.stringify(value).length / 3);
    expect(await cache.get("search:friends")).toEqual(value);
  });

  it("still reads entries written as plain JSON", async () => {
    const store = memoryStore();
    const cache = new RedisCache(store);
    await cache.set("k", { a: 1 });
    const [key] = [...store.data.keys()];
    store.data.set(key, JSON.stringify({ a: 2 }));
    expect(await cache.get("k")).toEqual({ a: 2 });
  });
});
