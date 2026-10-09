import type { LocalHooks } from "@/lib/analysis/types";

function Chips({ label, items }: { label: string; items: { id: string; name: string }[] }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">{label}</p>
      <ul className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <li key={item.id} className="rounded-full bg-paper-sunk px-3 py-1 text-sm">
            {item.name}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LocalHooksPanel({ hooks, room }: { hooks: LocalHooks[]; room: string }) {
  if (!hooks.length) return null;
  return (
    <section className="rounded-2xl border border-rule bg-paper-raised p-5 sm:p-7">
      <h2 className="font-display text-2xl">Local hooks</h2>
      <p className="mt-1 text-sm text-ink-soft">
        What {room.toLowerCase()} audiences like in each city, from Qloo. Open with one of these.
      </p>
      <div className="mt-5 grid gap-6 md:grid-cols-2">
        {hooks.map((h) => (
          <div key={h.city} className="flex flex-col gap-3">
            <p className="font-medium">{h.city}</p>
            <Chips label="Places" items={h.places} />
            <Chips label="Local artists" items={h.artists} />
          </div>
        ))}
      </div>
    </section>
  );
}
