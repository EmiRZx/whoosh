import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseLenient } from "./structured";

const Schema = z.object({ references: z.array(z.object({ name: z.string() })) });

describe("parseLenient", () => {
  it("reads plain JSON", () => {
    expect(parseLenient('{"references":[{"name":"Netflix"}]}', Schema)).toEqual({ references: [{ name: "Netflix" }] });
  });

  it("strips code fences and wraps a bare list", () => {
    const text = '```json\n[\n  {"name": "Google"}\n]\n```';
    expect(parseLenient(text, Schema, "references")).toEqual({ references: [{ name: "Google" }] });
  });

  it("finds JSON inside surrounding text", () => {
    expect(parseLenient('Here you go: {"references": []} Hope that helps.', Schema)).toEqual({ references: [] });
  });

  it("rejects output that doesn't match the schema", () => {
    expect(parseLenient('{"refs": []}', Schema)).toBeUndefined();
    expect(parseLenient("not json", Schema)).toBeUndefined();
  });
});
