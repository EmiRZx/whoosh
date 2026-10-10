import { describe, expect, it } from "vitest";
import { AUDIENCE_PRESETS } from "@/lib/audience/audience";
import { generations } from "./generations";

const wedding = AUDIENCE_PRESETS.find((p) => p.id === "wedding")!.ageMix;
const college = AUDIENCE_PRESETS.find((p) => p.id === "college")!.ageMix;

describe("generations", () => {
  it("splits a mixed room so the grandparents and the cousins can disagree", () => {
    const age = { "24_and_younger": -0.4, "25_to_29": -0.3, "30_to_34": -0.1, "35_to_44": 0, "45_to_54": 0.2, "55_and_older": 0.56 };
    const g = generations(age, wedding);
    expect(g.map((x) => x.label)).toEqual(["Under 30", "30–54", "55+"]);
    expect(g[0].feeling).toBe("cool");
    expect(g[2].feeling).toBe("big fans");
  });

  it("stays quiet for a room that is mostly one generation", () => {
    expect(generations({ "24_and_younger": 0.2, "55_and_older": -0.5 }, college)).toEqual([]);
  });
});
