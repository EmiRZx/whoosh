import { describe, expect, it, vi } from "vitest";
import { MemoryCache } from "./cache";
import { QlooClient, QlooError } from "./client";
import { demographics, search, toDemographics, toEntity } from "./api";

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

const client = (fetchImpl: typeof fetch, cache = new MemoryCache()) =>
  new QlooClient({ apiKey: "test-key", fetch: fetchImpl, cache, minIntervalMs: 0 });

describe("QlooClient", () => {
  it("sends the key in X-Api-Key and builds a stable query string", async () => {
    const fetchImpl = vi.fn(async () => json({ results: [] }));
    await client(fetchImpl as typeof fetch).get("/search", { take: 5, query: "Seinfeld", types: undefined });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://hackathon.api.qloo.com/search?query=Seinfeld&take=5");
    expect((init.headers as Record<string, string>)["X-Api-Key"]).toBe("test-key");
  });

  it("serves repeated requests from the cache", async () => {
    const fetchImpl = vi.fn(async () => json({ results: [] }));
    const c = client(fetchImpl as typeof fetch);
    await c.get("/search", { query: "a", take: 1 });
    await c.get("/search", { take: 1, query: "a" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("retries a 429 and then succeeds", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(json({}, 429, { "retry-after": "0.01" }))
      .mockResolvedValueOnce(json({ ok: true }));
    await expect(client(fetchImpl as typeof fetch).get("/v2/insights")).resolves.toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("explains a 401 instead of retrying", async () => {
    const fetchImpl = vi.fn(async () => json({}, 401));
    const err = (await client(fetchImpl as typeof fetch).get("/search").catch((e) => e)) as QlooError;
    expect(err).toBeInstanceOf(QlooError);
    expect(err.status).toBe(401);
    expect(err.retryable).toBe(false);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe("normalizers", () => {
  it("reads entities from search and insights shapes", () => {
    const e = toEntity({
      entity_id: "E1",
      name: "Seinfeld",
      types: ["urn:entity:tv_show"],
      popularity: 0.97,
      query: { affinity: 0.42 },
      properties: { release_year: 1989, short_description: "Sitcom", image: { url: "https://img" } },
      tags: [{ tag_id: "urn:tag:genre:media:sitcom", name: "Sitcom" }, { bad: true }],
    });
    expect(e).toMatchObject({
      id: "E1",
      types: ["urn:entity:tv_show"],
      popularity: 0.97,
      affinity: 0.42,
      releaseYear: 1989,
      description: "Sitcom",
      imageUrl: "https://img",
      tags: [{ id: "urn:tag:genre:media:sitcom", name: "Sitcom" }],
    });
    expect(toEntity({ name: "no id" })).toBeUndefined();
    // Insights results put the specific type in subtype.
    expect(toEntity({ entity_id: "E2", name: "Hoda Kotb", type: "urn:entity", subtype: "urn:entity:person" })?.types).toEqual([
      "urn:entity:person",
    ]);
  });

  it("reads demographics in nested or flat form", () => {
    expect(toDemographics({ age: { "25_to_29": 0.39, "55_and_older": -0.27 }, gender: { female: 0.13 } })).toEqual({
      age: { "25_to_29": 0.39, "55_and_older": -0.27 },
      gender: { male: undefined, female: 0.13 },
    });
    expect(toDemographics({ "24_and_younger": 0.25, male: -0.1 })?.age["24_and_younger"]).toBe(0.25);
    expect(toDemographics({ unrelated: 1 })).toBeNull();
  });

  it("parses search and demographics responses end to end", async () => {
    const fetchImpl = vi.fn(async (url: string) =>
      url.includes("/search")
        ? json({ results: [{ entity_id: "E1", name: "Seinfeld", types: ["urn:entity:tv_show"] }] })
        : json({ results: { demographics: [{ entity_id: "E1", query: { age: { "24_and_younger": -0.35 } } }] } }),
    );
    const c = client(fetchImpl as unknown as typeof fetch);
    expect((await search(c, "Seinfeld"))[0].name).toBe("Seinfeld");
    expect((await demographics(c, "E1"))?.age["24_and_younger"]).toBe(-0.35);
  });
});
