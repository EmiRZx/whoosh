import { describe, expect, it } from "vitest";
import type { AnalyzedReference } from "@/lib/analysis/types";
import { gutRows, topBucket } from "./gut";

const ref = (key: string, verdict: AnalyzedReference["verdict"], gut?: AnalyzedReference["gut"], roomIndex?: number): AnalyzedReference => ({
  key,
  extracted: { name: key, kind: "brand", disambiguation: null, quotes: [key], role: "", weight: "setup", checkable: true, swappable: true },
  spans: [],
  resolution: { status: "resolved" },
  signals: { roomIndex, age: { "24_and_younger": 0.1, "25_to_29": 0.3, "55_and_older": -0.4 } },
  gut,
  verdict,
  reasons: [],
  swaps: [],
});

describe("topBucket", () => {
  it("picks the age group that over-indexes most", () => {
    expect(topBucket({ "24_and_younger": -0.2, "45_to_54": 0.4, "55_and_older": 0.1 })).toBe("45_to_54");
    expect(topBucket(undefined)).toBeUndefined();
  });
});

describe("gutRows", () => {
  it("compares only measured references and puts the biggest misses first", () => {
    const rows = gutRows([
      ref("agree", "lands", { verdict: "lands", roomIndex: 0.1, fans: "25_to_29", reason: "" }, 0.05),
      ref("small-miss", "lands", { verdict: "risky", roomIndex: -0.1, fans: "55_and_older", reason: "" }, 0.05),
      ref("big-miss", "lands", { verdict: "risky", roomIndex: -0.5, fans: "55_and_older", reason: "" }, 0.6),
      ref("unmeasured", "unchecked", { verdict: "dead", roomIndex: -0.5, fans: "55_and_older", reason: "" }),
      ref("no-gut", "risky"),
    ]);
    expect(rows.map((r) => r.key)).toEqual(["big-miss", "small-miss", "agree"]);
    expect(rows[0].gap).toBeCloseTo(1.1);
    expect(rows[2].same).toBe(true);
    expect(rows[2].fans).toBe("25_to_29");
  });
});
