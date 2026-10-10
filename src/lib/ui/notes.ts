// "Set notes": the analysis as Markdown, to paste into a doc or a message.

import type { AnalyzedReference, LocalHooks, Swap } from "@/lib/analysis/types";
import { cityTable } from "./cities";
import { gutRows } from "./gut";

const VERDICT: Record<AnalyzedReference["verdict"], string> = {
  lands: "✓ Lands",
  risky: "! Risky",
  dead: "✕ Won't land",
  unchecked: "– Not measured",
};

const pct = (x?: number) => (x === undefined ? "–" : `${Math.round(x * 100)}%`);
const signed = (x?: number) => {
  if (x === undefined) return "–";
  const n = Math.round(Math.abs(x) * 100);
  return n === 0 ? "0%" : `${x > 0 ? "+" : "−"}${n}%`;
};
const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");

export interface NotesInput {
  title: string;
  room: string;
  cities: string[];
  references: AnalyzedReference[];
  accepted: Record<string, number>;
  score?: number;
  projected?: number;
  hooks: LocalHooks[];
  revised: string;
  changed: boolean;
}

export function setNotes(input: NotesInput): string {
  const { references, accepted } = input;
  const lines: string[] = [];
  lines.push(`# Set notes: ${input.title}`, "");
  lines.push(`**Room:** ${input.room}${input.cities.length ? ` · ${input.cities.join(" / ")}` : ""}  `);
  const scoreLine =
    input.projected !== undefined && input.changed
      ? `${pct(input.score)} as written, ${pct(input.projected)} with the swaps below`
      : pct(input.score);
  lines.push(`**Room read:** ${scoreLine}  `);
  const gut = gutRows(references);
  if (gut.length) lines.push(`**Gut vs. data:** Claude's blind guess matched Qloo on ${gut.filter((g) => g.same).length} of ${gut.length} calls`);
  lines.push("");

  // The gut column only when there are gut calls (examples in another room have none).
  const withGut = references.some((r) => r.gut);
  lines.push("## References", "");
  lines.push(`| Reference | Verdict | This room vs. average | Presence |${withGut ? " Claude's gut |" : ""} Why |`);
  lines.push(`|---|---|---|---|${withGut ? "---|" : ""}---|`);
  for (const r of references) {
    const presence = r.signals?.recognition === undefined ? "–" : `${Math.round(r.signals.recognition * 100)}/100`;
    const gutCell = withGut ? ` ${r.gut ? `${VERDICT[r.gut.verdict]}, ${signed(r.gut.roomIndex)}` : "–"} |` : "";
    lines.push(`| ${cell(r.extracted.name)} | ${VERDICT[r.verdict]} | ${signed(r.signals?.roomIndex)} | ${presence} |${gutCell} ${cell(r.reasons[0] ?? "")} |`);
  }

  const table = cityTable(references);
  if (table) {
    lines.push("", "## City by city", "");
    if (table.best >= 0) lines.push(`Plays best in **${table.cities[table.best]}** (typical rank #${table.typical[table.best]} of ${table.panel}).`, "");
    lines.push(`Where each reference is liked most by people in general, ranked among ${table.panel} big US metros (#1 = likes it most).`, "");
    lines.push(`| Reference | ${table.cities.map(cell).join(" | ")} |`, `|---|${table.cities.map(() => "---").join("|")}|`);
    for (const r of table.rows) {
      lines.push(`| ${cell(r.extracted.name)} | ${table.cities.map((c) => (table.rank(r, c) ? `#${table.rank(r, c)!.rank}` : "–")).join(" | ")} |`);
    }
    lines.push(`| *Typical rank* | ${table.typical.map((t) => `#${t}`).join(" | ")} |`);
  }

  const withSwaps = references.filter((r) => r.swaps.length);
  if (withSwaps.length) {
    lines.push("", "## Swaps", "");
    for (const r of withSwaps) {
      lines.push(`**${r.extracted.name}** (${VERDICT[r.verdict].slice(2).toLowerCase()})`);
      r.swaps.forEach((s: Swap, i) => {
        const used = accepted[r.key] === i ? " **(used)**" : "";
        lines.push(`- ${s.entity.name}${used}: ${s.why}`, `  > ${s.rewrite}`);
      });
      lines.push("");
    }
  }

  if (input.hooks.length) {
    lines.push("## Local hooks", "");
    for (const h of input.hooks) {
      const parts = [
        h.places.length ? `places: ${h.places.slice(0, 5).map((p) => p.name).join(", ")}` : "",
        h.artists.length ? `local favorites: ${h.artists.map((a) => a.name).join(", ")}` : "",
      ].filter(Boolean);
      lines.push(`- **${h.city}**: ${parts.join("; ")}`);
    }
    lines.push("");
  }

  lines.push(input.changed ? "## Revised script" : "## Your script", "", input.revised.trim(), "");
  lines.push("---", "Numbers from Qloo's taste graph, describing audiences in aggregate. Made with Whoosh.");
  return lines.join("\n");
}
