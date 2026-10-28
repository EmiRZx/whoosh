import { describe, expect, it } from "vitest";
import { judge, tier } from "./verdict";

const profile = (age: Record<string, number>) => ({ age, gender: {} });

// Values below are real measurements of the example scripts' references.
describe("judge", () => {
  it("lands a household name the room is merely cooler on (Netflix, corporate room)", () => {
    expect(judge({ recognition: 1, roomIndex: -0.28 }, "urn:entity:brand", "punchline").verdict).toBe("lands");
  });

  it("calls a household name the room is cold on risky, not dead (Spotify, retirement room)", () => {
    const r = judge({ recognition: 1, roomIndex: -0.62, profile: profile({ "25_to_29": 0.3 }) }, "urn:entity:brand", "setup");
    expect(r.verdict).toBe("risky");
    expect(r.reasons.join(" ")).toMatch(/62% less/);
    expect(r.reasons.join(" ")).toMatch(/biggest fans are 25–29s/);
    expect(r.reasons.join(" ")).toMatch(/They'll know it/);
  });

  it("uses a tighter margin for well-known but not universal references", () => {
    expect(judge({ recognition: 0.94, roomIndex: -0.19 }, "urn:entity:brand", "color").verdict).toBe("lands");
    expect(judge({ recognition: 0.94, roomIndex: -0.21 }, "urn:entity:brand", "color").verdict).toBe("risky");
  });

  it("fails faded references the room isn't into (Regis Philbin, college room)", () => {
    expect(judge({ recognition: 0.35, roomIndex: -0.05 }, "urn:entity:person", "color").verdict).toBe("dead");
    expect(judge({ recognition: 0.35 }, "urn:entity:person", "color").verdict).toBe("dead");
  });

  it("keeps a faded reference the room still likes as risky (Deal or No Deal)", () => {
    expect(judge({ recognition: 0.28, roomIndex: 0.02 }, "urn:entity:tv_show", "setup").verdict).toBe("risky");
  });

  it("needs warmth for a less famous reference", () => {
    expect(judge({ recognition: 0.7, roomIndex: 0.25 }, "urn:entity:brand", "color").verdict).toBe("lands");
    expect(judge({ recognition: 0.7, roomIndex: -0.1 }, "urn:entity:brand", "color").verdict).toBe("risky");
    expect(judge({ recognition: 0.7, roomIndex: -0.4 }, "urn:entity:brand", "color").verdict).toBe("dead");
  });

  it("is cautious, not certain, when Qloo has no data", () => {
    const r = judge({}, "urn:entity:tv_show", "setup");
    expect(r.verdict).toBe("risky");
    expect(r.reasons[0]).toMatch(/no popularity data/);
  });
});

describe("tier", () => {
  it.each([
    [undefined, "faded"],
    [0.3, "faded"],
    [0.6, "mid"],
    [0.9, "known"],
    [0.99, "universal"],
  ] as const)("%s -> %s", (pop, t) => expect(tier(pop)).toBe(t));
});

describe("judge on faded references", () => {
  it("lets a faded reference land with the room that is its audience", () => {
    const age = { "55_and_older": 0.4 };
    expect(judge({ recognition: 0.2, roomIndex: 0.35, profile: { age, gender: {} } }, "urn:entity:tv_show", "setup").verdict).toBe("lands");
    expect(judge({ recognition: 0.2, roomIndex: 0.1, profile: { age, gender: {} } }, "urn:entity:tv_show", "setup").verdict).toBe("risky");
    expect(judge({ recognition: 0.2, roomIndex: -0.1, profile: { age, gender: {} } }, "urn:entity:tv_show", "setup").verdict).toBe("dead");
  });
});

describe("city verdicts", () => {
  const city = (name: string, rank: number, of = 26) => ({ name, rank, of });

  it("moves a regional chain up where it's a favorite and down where it's a cold spot (Whataburger, college room)", () => {
    const r = judge(
      { recognition: 0.94, roomIndex: 0.3, cities: [city("Ann Arbor, MI", 23), city("Austin, TX", 1)] },
      "urn:entity:brand",
      "punchline",
    );
    expect(r.cityVerdicts).toEqual({ "Ann Arbor, MI": "risky", "Austin, TX": "lands" });
    // The first city is the room's verdict.
    expect(r.verdict).toBe("risky");
    expect(r.reasons.join(" ")).toMatch(/cold spot for it: #23 of 26 big cities in Ann Arbor/);
    expect(r.reasons.join(" ")).toMatch(/local favorite: #1 of 26 big cities in Austin/);
  });

  it("lifts a faded reference one step where it's local (Skyline Chili-style)", () => {
    const r = judge({ recognition: 0.4, roomIndex: -0.1, cities: [city("Cincinnati, OH", 1)] }, "urn:entity:brand", "setup");
    expect(r.verdict).toBe("risky");
  });

  it("never marks down a household name for a city", () => {
    const r = judge({ recognition: 1, roomIndex: 0.1, cities: [city("Birmingham, AL", 26)] }, "urn:entity:brand", "color");
    expect(r.verdict).toBe("lands");
  });

  it("ignores the bottom of a short ranking", () => {
    const r = judge({ recognition: 0.9, roomIndex: 0, cities: [city("Lagos", 6, 6)] }, "urn:entity:artist", "color");
    expect(r.verdict).toBe("lands");
  });
});

describe("weakest", () => {
  it("is the worst verdict anywhere on the tour", async () => {
    const { weakest } = await import("./verdict");
    expect(weakest({ verdict: "lands", cityVerdicts: { A: "lands", B: "risky" } })).toBe("risky");
    expect(weakest({ verdict: "risky", cityVerdicts: { A: "dead" } })).toBe("dead");
    expect(weakest({ verdict: "unchecked" })).toBe("unchecked");
  });
});

describe("withHomeCity", () => {
  it("lands the name of the city you're playing in that city", async () => {
    const { withHomeCity, judge } = await import("./verdict");
    const cities = [{ name: "St. Louis, MO" }, { name: "Atlanta, GA" }];
    const judged = judge({ recognition: 0.4, roomIndex: -0.1, cities: [{ name: "St. Louis, MO", rank: 20, of: 24 }, { name: "Atlanta, GA", rank: 12, of: 24 }] }, "urn:entity:destination", "color");
    const r = withHomeCity(judged, { name: "St. Louis", types: ["urn:entity:destination"] }, cities);
    expect(r.verdict).toBe("lands");
    expect(r.cityVerdicts?.["St. Louis, MO"]).toBe("lands");
    expect(r.cityVerdicts?.["Atlanta, GA"]).toBe(judged.cityVerdicts?.["Atlanta, GA"]);
    expect(r.reasons.at(-1)).toMatch(/where you're playing/);
  });

  it("leaves other places and other kinds alone", async () => {
    const { withHomeCity } = await import("./verdict");
    const judged = { verdict: "dead" as const, reasons: [] };
    expect(withHomeCity(judged, { name: "Los Angeles", types: ["urn:entity:destination"] }, [{ name: "St. Louis, MO" }])).toBe(judged);
    expect(withHomeCity(judged, { name: "St. Louis", types: ["urn:entity:brand"] }, [{ name: "St. Louis, MO" }])).toBe(judged);
  });
});
