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
    expect(r.reasons[0]).toMatch(/almost no current audience/);
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
