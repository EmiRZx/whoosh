import { describe, expect, it } from "vitest";
import { CITIES, findCity, suggestCities } from "./cities";

describe("findCity", () => {
  it.each([
    ["Austin, TX", "Austin, TX"],
    ["austin tx", "Austin, TX"],
    ["Birmingham, AL", "Birmingham, AL"],
    ["Birmingham", "Birmingham, United Kingdom"],
    ["Portland, OR", "Portland, OR"],
    ["istanbul", "Istanbul, Turkey"],
    ["São Paulo", "São Paulo, Brazil"],
    ["Sao Paulo", "São Paulo, Brazil"],
  ])("%s -> %s", (query, label) => {
    expect(findCity(query)?.label).toBe(label);
  });

  it("returns undefined for unknown places", () => {
    expect(findCity("Atlantis")).toBeUndefined();
    expect(findCity("")).toBeUndefined();
  });
});

describe("suggestCities", () => {
  it("suggests by prefix, biggest first", () => {
    const labels = suggestCities("san").map((c) => c.label);
    expect(labels.length).toBeGreaterThan(3);
    const pops = suggestCities("san").map((c) => c.population);
    expect([...pops].sort((a, b) => b - a)).toEqual(pops);
  });
});

describe("data", () => {
  it("has plausible coordinates", () => {
    for (const c of CITIES) {
      expect(Math.abs(c.lat)).toBeLessThanOrEqual(90);
      expect(Math.abs(c.lon)).toBeLessThanOrEqual(180);
    }
  });
});
