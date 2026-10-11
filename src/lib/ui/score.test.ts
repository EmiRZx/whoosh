import { describe, expect, it } from "vitest";
import { lightOnReferences, roomScore } from "./score";

describe("roomScore", () => {
  it("weighs punchlines over color and counts risky as half", () => {
    expect(roomScore([{ verdict: "lands", weight: "punchline" }, { verdict: "dead", weight: "color" }])).toBe(0.75);
    expect(roomScore([{ verdict: "risky", weight: "setup" }])).toBe(0.5);
  });

  it("is undefined until something is measured", () => {
    expect(roomScore([{ verdict: "unchecked", weight: "punchline" }])).toBeUndefined();
  });
});

describe("lightOnReferences", () => {
  const words = (n: number) => "word ".repeat(n);

  it("flags a script with nothing to check", () => {
    expect(lightOnReferences(0, words(10))).toBe(true);
  });

  it("flags a few references spread over a long bit", () => {
    expect(lightOnReferences(4, words(300))).toBe(true);
  });

  it("leaves a short, dense toast alone", () => {
    expect(lightOnReferences(3, words(60))).toBe(false);
  });

  it("leaves a long set with plenty of references alone", () => {
    expect(lightOnReferences(13, words(1300))).toBe(false);
  });
});
