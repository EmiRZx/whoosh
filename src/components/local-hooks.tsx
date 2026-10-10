import { MapPin, Music } from "lucide-react";
import type { LocalHooks } from "@/lib/analysis/types";
import { EntityThumb } from "./entity-thumb";
import { CardTitle } from "./summary";

// Some place names come back all lowercase ("franklin park conservatory").
const display = (name: string) =>
  name === name.toLowerCase() ? name.replace(/(^|[\s-])(\p{L})/gu, (_, before: string, c: string) => before + c.toUpperCase()) : name;

export function LocalHooksPanel({ hooks, room }: { hooks: LocalHooks[]; room: string }) {
  if (!hooks.length) return null;
  return (
    <section className="card rounded-2xl p-5 sm:p-6">
      <CardTitle>Local hooks</CardTitle>
      <h2 className="text-xl font-semibold tracking-tight">Open with something from their city</h2>
      <p className="mt-1 max-w-2xl text-sm text-ink-soft">
        What {room} like in each city, from Qloo: local places, and artists who do better there than nationally.
      </p>
      <div className={`mt-5 grid grid-cols-1 gap-4 ${hooks.length > 1 ? "md:grid-cols-2" : ""} ${hooks.length > 2 ? "xl:grid-cols-3" : ""}`}>
        {hooks.map((h) => (
          <div key={h.city} className="flex min-w-0 flex-col gap-3 rounded-xl bg-sunk p-4">
            <p className="flex items-center gap-1.5 font-medium">
              <MapPin className="size-4 text-accent" aria-hidden />
              {h.city}
            </p>
            {h.places.length > 0 && (
              <ul className="flex flex-col gap-2">
                {h.places.slice(0, 5).map((p) => (
                  <li key={p.id} className="flex items-center gap-2.5" title={p.description}>
                    <EntityThumb src={p.imageUrl} name={p.name} className="size-8 rounded-lg" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{display(p.name)}</span>
                      {p.description && <span className="block truncate text-[11px] text-ink-faint">{p.description}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {h.artists.length > 0 && (
              <div>
                <p className="mb-1.5 flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-ink-faint">
                  <Music className="size-3" aria-hidden />
                  Local favorites
                </p>
                <ul className="flex flex-wrap gap-1.5">
                  {h.artists.map((a) => (
                    <li key={a.id} className="rounded-full bg-card px-2.5 py-1 text-xs ring-1 ring-line">
                      {display(a.name)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
