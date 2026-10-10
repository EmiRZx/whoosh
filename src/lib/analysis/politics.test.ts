import { describe, expect, it } from "vitest";
import { isPolitical } from "./politics";

const person = (...tags: string[]) => ({ types: ["urn:entity:person"], tags: tags.map((name) => ({ id: name, name })) });

describe("isPolitical", () => {
  it("catches office holders from their Qloo tags", () => {
    expect(isPolitical(person("20th-century Presidents Of The United States", "Politics"))).toBe(true);
    expect(isPolitical(person("United States Secretaries Of State", "Politician", "Diplomat"))).toBe(true);
    expect(isPolitical(person("First Ladies Of The United States", "Politics"))).toBe(true);
    expect(isPolitical(person("Biden Administration Cabinet Members", "Minister"))).toBe(true);
    expect(isPolitical(person("Politician", "Political Activist"))).toBe(true);
  });

  it("keeps entertainers and journalists, including actors who held office", () => {
    expect(isPolitical(person("Politician", "Actor", "Bodybuilder"))).toBe(false);
    expect(isPolitical(person("American Political Journalists", "Politics"))).toBe(false);
    expect(isPolitical(person("American Business Writers", "Actor"))).toBe(false);
    expect(isPolitical({ types: ["urn:entity:tv_show"], tags: [{ id: "x", name: "Politics" }] })).toBe(false);
  });
});
