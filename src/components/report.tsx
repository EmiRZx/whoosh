import type { AnalyzedReference, LocalHooks } from "@/lib/analysis/types";
import { gutRows } from "@/lib/ui/gut";
import { signed, VERDICT_LABEL } from "./labels";

// Fixed light colors: the printout ignores the screen theme.
const MARK: Record<AnalyzedReference["verdict"], { glyph: string; color: string }> = {
  lands: { glyph: "✓", color: "#0a6a0a" },
  risky: { glyph: "!", color: "#8a5a00" },
  dead: { glyph: "✕", color: "#a32020" },
  unchecked: { glyph: "–", color: "#52514e" },
};

interface Props {
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

// The printable "set notes": shown only when printing (or saving as PDF).
export function Report({ title, room, cities, references, accepted, score, projected, hooks, revised, changed }: Props) {
  const pct = (x?: number) => (x === undefined ? "–" : `${Math.round(x * 100)}%`);
  const gut = gutRows(references);
  return (
    <article className="hidden bg-white font-sans text-[11pt] text-[#0b0b0b] print:block">
      <header className="border-b-2 border-black pb-3">
        <p className="text-[9pt] uppercase tracking-[0.2em] text-[#52514e]">Whoosh · set notes</p>
        <h1 className="mt-1 text-[20pt] font-semibold leading-tight">{title}</h1>
        <p className="mt-1 text-[10pt] text-[#52514e]">
          {room}
          {cities.length > 0 && ` · ${cities.join(" / ")}`}
        </p>
      </header>

      <section className="mt-4 flex gap-8">
        <div>
          <p className="text-[9pt] text-[#52514e]">Room read</p>
          <p className="text-[24pt] font-semibold leading-none">{pct(score)}</p>
        </div>
        {changed && projected !== undefined && (
          <div>
            <p className="text-[9pt] text-[#52514e]">With your swaps</p>
            <p className="text-[24pt] font-semibold leading-none">{pct(projected)}</p>
          </div>
        )}
        <div className="text-[10pt]">
          {changed && <p className="text-[9pt] text-[#52514e]">As written</p>}
          {(["lands", "risky", "dead", "unchecked"] as const).map((v) => (
            <p key={v}>
              <span style={{ color: MARK[v].color }}>{MARK[v].glyph}</span> {VERDICT_LABEL[v]}:{" "}
              {references.filter((r) => r.verdict === v).length}
            </p>
          ))}
        </div>
      </section>

      {gut.length > 0 && (
        <p className="mt-3 text-[10pt] text-[#52514e]">
          Gut vs. data: Claude&apos;s blind guess matched Qloo on {gut.filter((g) => g.same).length} of {gut.length} calls.
        </p>
      )}

      <h2 className="mt-6 text-[12pt] font-semibold">References</h2>
      <table className="mt-2 w-full border-collapse text-[9.5pt]">
        <thead>
          <tr className="border-b border-[#c3c2b7] text-left text-[#52514e]">
            <th className="py-1 pr-2 font-medium">Reference</th>
            <th className="py-1 pr-2 font-medium">Verdict</th>
            <th className="py-1 pr-2 font-medium">Room vs. avg</th>
            <th className="py-1 pr-2 font-medium">Gut guess</th>
            <th className="py-1 font-medium">Why</th>
          </tr>
        </thead>
        <tbody>
          {references.map((r) => (
            <tr key={r.key} className="break-inside-avoid border-b border-[#e1e0d9] align-top">
              <td className="py-1 pr-2 font-medium">{r.extracted.name}</td>
              <td className="whitespace-nowrap py-1 pr-2" style={{ color: MARK[r.verdict].color }}>
                {MARK[r.verdict].glyph} {VERDICT_LABEL[r.verdict]}
              </td>
              <td className="py-1 pr-2 tabular-nums">{r.signals?.roomIndex === undefined ? "–" : signed(r.signals.roomIndex)}</td>
              <td className="whitespace-nowrap py-1 pr-2 tabular-nums text-[#52514e]">
                {r.gut ? `${MARK[r.gut.verdict].glyph} ${signed(r.gut.roomIndex)}` : "–"}
              </td>
              <td className="py-1 text-[#52514e]">{r.reasons[0] ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {references.some((r) => r.swaps.length) && (
        <>
          <h2 className="mt-6 text-[12pt] font-semibold">Swaps</h2>
          {references
            .filter((r) => r.swaps.length)
            .map((r) => (
              <div key={r.key} className="mt-2 break-inside-avoid">
                <p className="font-medium">{r.extracted.name}</p>
                <ul className="ml-4 list-disc text-[10pt]">
                  {r.swaps.map((s, i) => (
                    <li key={s.entity.id}>
                      <span className="font-medium">{s.entity.name}</span>
                      {accepted[r.key] === i && " (used)"}: {s.why}
                      <p className="font-serif italic text-[#52514e]">{s.rewrite}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
        </>
      )}

      {hooks.length > 0 && (
        <>
          <h2 className="mt-6 text-[12pt] font-semibold">Local hooks</h2>
          {hooks.map((h) => (
            <p key={h.city} className="mt-1 text-[10pt]">
              <span className="font-medium">{h.city}:</span> {[...h.places, ...h.artists].map((e) => e.name).join(", ")}
            </p>
          ))}
        </>
      )}

      {/* The script itself always prints: it's what goes on stage. */}
      <section className="break-before-page">
        <h2 className="mt-6 text-[12pt] font-semibold">{changed ? "Revised script" : "Your script"}</h2>
        <p className="mt-2 whitespace-pre-wrap font-serif text-[12pt] leading-relaxed">{revised}</p>
      </section>

      <p className="mt-6 border-t border-[#c3c2b7] pt-2 text-[8.5pt] text-[#898781]">
        Numbers from Qloo&apos;s taste graph, describing audiences in aggregate, never individuals.
      </p>
    </article>
  );
}
