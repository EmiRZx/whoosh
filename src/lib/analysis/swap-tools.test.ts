import { describe, expect, it } from "vitest";
import { presetById } from "../audience/audience";
import { sentenceAround } from "./references";
import { validateSubmission, type SwapContext } from "./swap-tools";

const ctx = (): SwapContext => ({
  original: {
    id: "REGIS",
    name: "Regis Philbin",
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
    HARVEY: { id: "HARVEY", name: "Steve Harvey", type: "urn:entity:person", verdict: "lands" },
    COLD: { id: "COLD", name: "Alex Trebek", type: "urn:entity:person", verdict: "risky" },
  },
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
