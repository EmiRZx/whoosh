import { describe, expect, it, vi } from "vitest";

// A Redis that's configured but refuses every write (out of space).
vi.mock("./store/redis", () => ({
  hasRedis: true,
  pipeline: () => Promise.reject(new Error("Redis error: ERR DB capacity quota exceeded")),
}));

describe("rate limits", () => {
  it("keep counting in memory when Redis refuses writes", async () => {
    const { takeLiveSlot } = await import("./limits");
    const results = [];
    for (let i = 0; i < 10; i++) results.push((await takeLiveSlot("203.0.113.7")).ok);
    expect(results.slice(0, 8).every(Boolean)).toBe(true);
    expect(results.slice(8)).toEqual([false, false]);
  });
});
