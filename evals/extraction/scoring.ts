// Scores one extraction against a gold annotation: which required references
// were found, which extra ones were invented, and per-reference checks.
import { locateQuotes, type ExtractedReference } from "../../src/lib/analysis/extract";

export interface GoldItem {
  name: string;
  aliases?: string[];
  kinds: string[];
}
export interface GoldSample {
  required: GoldItem[];
  optional: GoldItem[];
  forbidden: string[];
}

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/^the\s+/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const names = (g: GoldItem) => [g.name, ...(g.aliases ?? [])].map(norm);

function matches(ref: ExtractedReference, g: GoldItem) {
  const n = norm(ref.name);
  return names(g).includes(n) || ref.quotes.some((q) => names(g).includes(norm(q)));
}

export function scoreExtraction(text: string, refs: ExtractedReference[], gold: GoldSample) {
  const matchedRequired = new Set<number>();
  const report = { misses: [] as string[], unexpected: [] as string[], forbidden: [] as string[], kindErrors: [] as string[], checkableErrors: [] as string[], missingQuotes: [] as string[], duplicates: [] as string[] };
  let optionalHits = 0;

  for (const ref of refs) {
    const r = gold.required.findIndex((g, i) => !matchedRequired.has(i) && matches(ref, g));
    const already = gold.required.findIndex((g, i) => matchedRequired.has(i) && matches(ref, g));
    const o = gold.optional.find((g) => matches(ref, g));
    const label = `${ref.name} [${ref.kind}]`;

    if (r >= 0) {
      matchedRequired.add(r);
      if (!gold.required[r].kinds.includes(ref.kind)) report.kindErrors.push(`${label}, expected ${gold.required[r].kinds.join("|")}`);
    } else if (o) {
      optionalHits++;
    } else if (already >= 0) {
      report.duplicates.push(label);
    } else if (gold.forbidden.some((f) => norm(f) === norm(ref.name) || ref.quotes.some((q) => norm(q) === norm(f)))) {
      report.forbidden.push(label);
    } else {
      report.unexpected.push(label);
    }

    if ((ref.kind === "other") === ref.checkable) report.checkableErrors.push(`${label} checkable=${ref.checkable}`);
    const { missing } = locateQuotes(text, ref.quotes);
    report.missingQuotes.push(...missing.map((q) => `${ref.name}: "${q}"`));
  }
  gold.required.forEach((g, i) => !matchedRequired.has(i) && report.misses.push(g.name));

  const precisionDenominator = refs.length - report.duplicates.length;
  return {
    refs: refs.length,
    recall: matchedRequired.size / gold.required.length,
    precision: precisionDenominator ? (matchedRequired.size + optionalHits) / precisionDenominator : 1,
    ...report,
  };
}

