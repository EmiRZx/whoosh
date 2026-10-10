import { describe, expect, it } from "vitest";
import { isHookPlace } from "./hooks";

describe("isHookPlace", () => {
  it("keeps places a crowd would know and drops infrastructure and adult venues", () => {
    expect(isHookPlace("Paschal's Restaurant & Bar")).toBe(true);
    expect(isHookPlace("Lincoln Memorial")).toBe(true);
    expect(isHookPlace("Hartsfield-Jackson Atlanta International Airport")).toBe(false);
    expect(isHookPlace("Platinum Gentleman's Club Atlanta")).toBe(false);
    expect(isHookPlace("Hilton Garden Inn")).toBe(false);
  });
});
