"use client";

import { LoaderCircle, MapPin, Plus, Search, X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import type { EntitySummary } from "@/lib/analysis/types";
import type { AgeMix } from "@/lib/audience/audience";
import { EntityThumb } from "./entity-thumb";
import { shortCity } from "./labels";
import { AgeHistogram } from "./room-picker";

export interface PerformerRoomData {
  performer: EntitySummary;
  ageMix: AgeMix;
  cities: string[];
}

const TYPE_LABEL: Record<string, string> = {
  "urn:entity:person": "Person",
  "urn:entity:artist": "Music",
  "urn:entity:tv_show": "TV show",
  "urn:entity:podcast": "Podcast",
};

interface Props {
  room?: PerformerRoomData;
  onChange: (room?: PerformerRoomData) => void;
  cities: string[];
  onAddCity: (city: string) => void;
  canAddCity: boolean;
}

// The room made of one performer's fans, from Qloo.
export async function loadPerformerRoom(id: string): Promise<PerformerRoomData> {
  const res = await fetch(`/api/performers/room?id=${encodeURIComponent(id)}`);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? "Couldn't load that audience.");
  return body as PerformerRoomData;
}

// "Fans of ..." as a room: search Qloo for a comedian, musician, show or
// podcast, and use the age mix of the people who like them.
export function PerformerPicker({ room, onChange, cities, onAddCity, canAddCity }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EntitySummary[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const listId = useId();

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/performers?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((res) => res.json())
        .then((body: { performers?: EntitySummary[] }) => {
          setResults(body.performers ?? []);
          setActive(0);
        })
        .catch(() => {});
    }, 200);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query]);

  const visible = open && query.trim().length >= 2 ? results : [];

  // Keep the option picked with the arrow keys in view when the list scrolls.
  useEffect(() => {
    document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [listId, active]);

  const pick = async (entity: EntitySummary) => {
    setOpen(false);
    setQuery("");
    setLoading(true);
    setError(undefined);
    try {
      onChange(await loadPerformerRoom(entity.id));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (room) {
    const suggestions = room.cities.filter((c) => !cities.includes(c));
    return (
      <div className="rounded-xl border border-accent-glow p-3 shadow-[0_0_0_1px_var(--accent-glow)]">
        <div className="flex items-start gap-3">
          <EntityThumb src={room.performer.imageUrl} name={room.performer.name} className="size-11" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium leading-tight">Fans of {room.performer.name}</p>
            <p className="mt-0.5 line-clamp-1 text-[11px] text-ink-faint">Age mix from Qloo&apos;s audience data</p>
          </div>
          <button
            type="button"
            onClick={() => onChange(undefined)}
            aria-label="Use a preset room instead"
            className="grid size-6 shrink-0 place-items-center rounded-full text-ink-soft hover:bg-sunk hover:text-ink"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </div>
        <div className="mt-3">
          <AgeHistogram mix={room.ageMix} className="h-8" labels />
        </div>
        {suggestions.length > 0 && (
          <div className="mt-3 border-t border-line pt-2.5">
            <p className="text-[11px] text-ink-faint">Where their fans are concentrated</p>
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {suggestions.map((c) => (
                <li key={c}>
                  <button
                    type="button"
                    onClick={() => onAddCity(c)}
                    disabled={!canAddCity}
                    className="flex items-center gap-1 rounded-full bg-sunk px-2.5 py-1 text-xs hover:bg-line disabled:opacity-40"
                    title={`Add ${c} to the tour`}
                  >
                    <MapPin className="size-3 text-ink-faint" aria-hidden />
                    {shortCity(c)}
                    <Plus className="size-3 text-ink-faint" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-xl border border-dashed border-line bg-card px-3 focus-within:border-solid focus-within:border-focus">
        {loading ? (
          <LoaderCircle className="size-4 shrink-0 animate-spin text-ink-faint" aria-hidden />
        ) : (
          <Search className="size-4 shrink-0 text-ink-faint" aria-hidden />
        )}
        <input
          role="combobox"
          aria-label="A performer, show or podcast whose fans are the room"
          aria-expanded={visible.length > 0}
          aria-controls={listId}
          aria-activedescendant={visible.length ? `${listId}-${active}` : undefined}
          aria-autocomplete="list"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setError(undefined);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" && visible.length) {
              e.preventDefault();
              setActive((a) => (a + 1) % visible.length);
            } else if (e.key === "ArrowUp" && visible.length) {
              e.preventDefault();
              setActive((a) => (a - 1 + visible.length) % visible.length);
            } else if (e.key === "Enter" && visible[active]) {
              e.preventDefault();
              pick(visible[active]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder="Or play to someone's fans, e.g. Cedric the Entertainer"
          autoComplete="off"
          maxLength={80}
          className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none placeholder:text-ink-faint focus-visible:outline-none"
        />
      </div>
      {error && <p className="mt-1.5 text-xs text-dead-ink">{error}</p>}
      {visible.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-30 mt-1.5 max-h-72 overflow-y-auto overscroll-contain rounded-xl border border-card-border bg-bg p-1 shadow-xl [scrollbar-width:thin]"
        >
          {visible.map((p, i) => (
            <li
              key={p.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(p);
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 ${i === active ? "bg-sunk" : ""}`}
            >
              <EntityThumb src={p.imageUrl} name={p.name} className="size-8 rounded-lg" />
              <span className="min-w-0">
                <span className="block truncate text-sm">{p.name}</span>
                <span className="block truncate text-[11px] text-ink-faint">
                  {TYPE_LABEL[p.type] ?? "Entity"}
                  {p.description && ` · ${p.description}`}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
