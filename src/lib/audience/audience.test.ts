import { describe, expect, it } from "vitest";
import { AGE_BUCKETS } from "../qloo/api";
import { AUDIENCE_PRESETS, ageMixFromProfile, presetById, roomIndex } from "./audience";

describe("presets", () => {
  it("each sums to 1", () => {
    for (const p of AUDIENCE_PRESETS) {
      expect(AGE_BUCKETS.reduce((s, b) => s + p.ageMix[b], 0)).toBeCloseTo(1, 10);
    }
  });
});

describe("roomIndex", () => {
  const youngSkew = { age: { "24_and_younger": 0.4, "25_to_29": 0.2, "55_and_older": -0.5 }, gender: {} };

  it("is positive for a young room and negative for an old one", () => {
    expect(roomIndex(youngSkew, presetById("college")!.ageMix)!).toBeGreaterThan(0.3);
    expect(roomIndex(youngSkew, presetById("retirement")!.ageMix)!).toBeLessThan(-0.4);
  });

  it("returns null when no bucket overlaps", () => {
    expect(roomIndex({ age: {}, gender: {} }, presetById("general")!.ageMix)).toBeNull();
  });
});

describe("ageMixFromProfile", () => {
  it("shifts weight toward the buckets a performer over-indexes in", () => {
    const base = presetById("general")!.ageMix;
    const derived = ageMixFromProfile({ age: { "25_to_29": 0.39, "55_and_older": -0.27 }, gender: {} });
    expect(derived["25_to_29"]).toBeGreaterThan(base["25_to_29"]);
    expect(derived["55_and_older"]).toBeLessThan(base["55_and_older"]);
    expect(AGE_BUCKETS.reduce((s, b) => s + derived[b], 0)).toBeCloseTo(1, 10);
  });
});
