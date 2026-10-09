import { describe, expect, it } from "vitest";
import { presetById } from "../audience/audience";
import { sentenceAround } from "./references";
import { beatsOriginal, validateSubmission, type SwapContext } from "./swap-tools";

const ctx = (): SwapContext => ({
  original: {
    id: "REGIS",
    name: "Regis Philbin",
    entity_name: "Regis Philbin",
    type: "urn:entity:person",
    kind: "person",
    role: "the familiar host",
    weight: "color",
    quotes: ["Regis Philbin"],
    line: "Regis Philbin asks a contestant a question with four options.",
    verdict: "dead",
    reasons: [],
  },
  audience: { label: "College crowd", ageMix: presetById("college")!.ageMix, cities: [] },
  checked: {
    HARVEY: { id: "HARVEY", name: "Steve Harvey", type: "urn:entity:person", verdict: "lands", room_index: 0.05 },
    COLD: { id: "COLD", name: "Alex Trebek", type: "urn:entity:person", verdict: "risky", room_index: -0.3 },
    LUKEWARM: { id: "LUKEWARM", name: "Drew Carey", type: "urn:entity:person", verdict: "lands", room_index: -0.12 },
  },
});

describe("beatsOriginal", () => {
  it("needs a margin over the original's room index", () => {
    expect(beatsOriginal({ verdict: "lands", room_index: -0.1 }, { room_index: -0.2 })).toBe(true);
    expect(beatsOriginal({ verdict: "lands", room_index: -0.17 }, { room_index: -0.2 })).toBe(false);
  });
  it("never accepts a cold substitute, however cold the original", () => {
    expect(beatsOriginal({ verdict: "lands", room_index: -0.3 }, { room_index: -0.62 })).toBe(false);
    expect(beatsOriginal({ verdict: "lands", room_index: -0.2 }, { room_index: -0.62 })).toBe(true);
  });
  it("uses a floor when the original has no age data", () => {
    expect(beatsOriginal({ verdict: "lands", room_index: -0.08 }, {})).toBe(true);
    expect(beatsOriginal({ verdict: "lands", room_index: -0.12 }, {})).toBe(false);
    expect(beatsOriginal({ verdict: "lands" }, {})).toBe(false);
  });
});

describe("validateSubmission", () => {
  it("accepts checked substitutes that land", () => {
    const swaps = [{ id: "HARVEY", rewrite: "Steve Harvey asks a contestant a question with four options.", why: "a host they know" }];
    expect(validateSubmission(ctx(), { swaps, note: "" })).toEqual([]);
  });

  it("accepts an honest empty answer", () => {
    expect(validateSubmission(ctx(), { swaps: [], note: "Nothing fits." })).toEqual([]);
  });

  it("rejects substitutes that were never checked or don't land", () => {
    const problems = validateSubmission(ctx(), {
      swaps: [
        { id: "NEVER", rewrite: "Somebody asks a question.", why: "" },
        { id: "COLD", rewrite: "Alex Trebek asks a contestant a question.", why: "" },
      ],
      note: "",
    });
    expect(problems.join(" ")).toMatch(/never checked/);
    expect(problems.join(" ")).toMatch(/checks as "risky"/);
  });

  it("rejects a substitute that lands but isn't better for this room", () => {
    const swaps = [{ id: "LUKEWARM", rewrite: "Drew Carey asks a contestant a question with four options.", why: "" }];
    expect(validateSubmission(ctx(), { swaps, note: "" }).join(" ")).toMatch(/isn't clearly a better fit/);
  });

  it("rejects a rewrite that doesn't use the substitute or repeats the line", () => {
    const original = ctx().original.line;
    const problems = validateSubmission(ctx(), { swaps: [{ id: "HARVEY", rewrite: original, why: "" }], note: "" });
    expect(problems.join(" ")).toMatch(/doesn't seem to mention/);
    expect(problems.join(" ")).toMatch(/identical/);
  });
});

describe("sentenceAround", () => {
  const text = `Think about it. Regis Philbin asks a contestant a question with four options. She has no idea.\n\nNew paragraph, "with Pret." here.`;

  it("returns the sentence holding the span", () => {
    const start = text.indexOf("Regis");
    expect(sentenceAround(text, start, start + 13)).toBe("Regis Philbin asks a contestant a question with four options.");
  });

  it("stops at a paragraph break and strips a leading quote", () => {
    const start = text.indexOf("Pret");
    expect(sentenceAround(text, start, start + 4)).toBe('New paragraph, "with Pret.');
  });
});
