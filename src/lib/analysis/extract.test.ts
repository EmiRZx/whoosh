import { describe, expect, it } from "vitest";
import { ExtractionSchema, locateQuotes } from "./extract";

describe("locateQuotes", () => {
  const text = "My profile says I'm “a Ross looking for a Rachel.” She asked if Ross was a store.";

  it("finds exact quotes and assigns repeats to successive occurrences", () => {
    const { spans, missing } = locateQuotes(text, ["Ross", "Rachel", "Ross"]);
    expect(missing).toEqual([]);
    expect(spans.map((s) => s.start)).toEqual([text.indexOf("Ross"), text.indexOf("Rachel"), text.lastIndexOf("Ross")]);
  });

  it("tolerates case, curly quotes and whitespace differences", () => {
    const { spans, missing } = locateQuotes(text, ['"a ross looking  for a rachel."']);
    expect(missing).toEqual([]);
    expect(spans[0].quote).toBe("“a Ross looking for a Rachel.”");
  });

  it("reports quotes that are not in the text", () => {
    expect(locateQuotes(text, ["Monica"]).missing).toEqual(["Monica"]);
  });
});

describe("ExtractionSchema", () => {
  it("accepts a well-formed extraction", () => {
    const parsed = ExtractionSchema.safeParse({
      references: [
        {
          name: "Friends",
          kind: "tv_show",
          disambiguation: "US sitcom 1994-2004",
          quotes: ["a Ross looking for a Rachel"],
          role: "a shorthand for 90s TV romance",
          weight: "punchline",
          checkable: true,
        },
      ],
    });
    expect(parsed.success).toBe(true);
  });
});

describe("locateQuotes with quotation marks copied from the text", () => {
  it("finds a title quoted with its quotation marks when punctuation sits inside them", () => {
    const text = 'She left to host "CBS This Morning." Then she left.';
    const { spans, missing } = locateQuotes(text, ['"CBS This Morning"']);
    expect(missing).toEqual([]);
    expect(spans[0].quote).toBe("CBS This Morning");
  });
});
