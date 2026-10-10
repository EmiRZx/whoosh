import { describe, expect, it } from "vitest";
import type { ExtractedReference } from "./extract";
import { buildReferences, segmentText } from "./references";

const ref = (name: string, quotes: string[], weight: ExtractedReference["weight"] = "punchline"): ExtractedReference => ({
  name,
  kind: "brand",
  disambiguation: null,
  quotes,
  role: "test",
  weight,
  checkable: true,
  swappable: true,
});

describe("buildReferences", () => {
  const text = "I'm a Ross looking for a Rachel. She asked if Ross was a store.";

  it("never highlights the same occurrence twice, and the punchline wins", () => {
    const refs = buildReferences(text, {
      references: [ref("Friends", ["Ross", "Rachel"], "setup"), ref("Ross Dress for Less", ["Ross"], "punchline")],
    });
    const friends = refs.find((r) => r.key === "friends")!;
    const store = refs.find((r) => r.key === "ross-dress-for-less")!;
    expect(store.spans.map((s) => s.start)).toEqual([text.indexOf("Ross")]);
    expect(friends.spans.map((s) => s.start)).toEqual([text.indexOf("Rachel"), text.lastIndexOf("Ross")]);
  });

  it("orders references by first appearance and marks non-checkable ones", () => {
    const refs = buildReferences(text, {
      references: [{ ...ref("Store", ["store"]), checkable: false }, ref("Rachel", ["Rachel"])],
    });
    expect(refs.map((r) => r.key)).toEqual(["rachel", "store"]);
    expect(refs[1].resolution.status).toBe("not_checkable");
  });
});

describe("segmentText", () => {
  it("reassembles the original text exactly", () => {
    const text = "Pokémon and Spotify and Pokémon.";
    const refs = buildReferences(text, { references: [ref("Pokémon", ["Pokémon", "Pokémon"]), ref("Spotify", ["Spotify"])] });
    const segments = segmentText(text, refs);
    expect(segments.map((s) => s.text).join("")).toBe(text);
    expect(segments.filter((s) => s.refKey).map((s) => s.refKey)).toEqual(["pokemon", "spotify", "pokemon"]);
  });
});
