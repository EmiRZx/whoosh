"use client";

import { MapPin, Plus, X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { AUDIENCE_PRESETS, type AgeMix } from "@/lib/audience/audience";
import { AGE_BUCKETS } from "@/lib/qloo/api";
import { AGE_LABELS, AGE_SHORT } from "./labels";

const MAX_CITIES = 6;

// The room's age mix as six small bars, youngest to oldest.
export function AgeHistogram({ mix, className = "h-8", labels = false }: { mix: AgeMix; className?: string; labels?: boolean }) {
  const max = Math.max(...AGE_BUCKETS.map((b) => mix[b]));
  return (
    <div>
      <div className={`flex items-end gap-[3px] ${className}`} aria-hidden>
        {AGE_BUCKETS.map((bucket) => (
          <span
            key={bucket}
            className="flex-1 rounded-t-[3px] bg-ink/70"
            style={{ height: `${Math.max(4, (mix[bucket] / max) * 100)}%` }}
          />
        ))}
      </div>
      {labels && (
        <div className="mt-1 flex gap-[3px] text-[9.5px] text-ink-faint" aria-hidden>
          {AGE_SHORT.map((l) => (
            <span key={l} className="flex-1 text-center">
              {l}
            </span>
          ))}
        </div>
      )}
      <span className="sr-only">{AGE_BUCKETS.map((b, i) => `${AGE_LABELS[i]}: ${Math.round(mix[b] * 100)}%`).join(", ")}</span>
    </div>
  );
}

function CityInput({ cities, onAdd }: { cities: string[]; onAdd: (city: string) => void }) {
  const [draft, setDraft] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const full = cities.length >= MAX_CITIES;

  useEffect(() => {
    const q = draft.trim();
    if (q.length < 2) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/cities?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((res) => res.json())
        .then((body: { cities: { label: string }[] }) => {
          setSuggestions(body.cities.map((c) => c.label).filter((c) => !cities.includes(c)));
          setActive(0);
        })
        .catch(() => {});
    }, 120);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [draft, cities]);

  const visible = open && draft.trim().length >= 2 ? suggestions.slice(0, 6) : [];

  const commit = (value: string) => {
    const name = value.trim();
    if (!name || full) return;
    onAdd(name);
    setDraft("");
    setSuggestions([]);
    setOpen(false);
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-xl border border-line bg-card px-3 focus-within:border-focus">
        <MapPin className="size-4 shrink-0 text-ink-faint" aria-hidden />
        <input
          id="city-input"
          role="combobox"
          aria-expanded={visible.length > 0}
          aria-controls={listId}
          aria-activedescendant={visible.length ? `${listId}-${active}` : undefined}
          aria-autocomplete="list"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setOpen(true);
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
            } else if (e.key === "Enter") {
              e.preventDefault();
              commit(visible[active] ?? draft);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder={full ? `Up to ${MAX_CITIES} cities` : "Add a city, e.g. Austin"}
          autoComplete="off"
          maxLength={80}
          disabled={full}
          className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none placeholder:text-ink-faint disabled:opacity-50"
        />
        <button
          type="button"
          onClick={() => commit(draft)}
          disabled={!draft.trim() || full}
          aria-label="Add city"
          className="grid size-7 place-items-center rounded-lg text-ink-soft hover:bg-sunk hover:text-ink disabled:opacity-30"
        >
          <Plus className="size-4" aria-hidden />
        </button>
      </div>
      {visible.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-30 mt-1.5 overflow-hidden rounded-xl border border-card-border bg-bg p-1 shadow-xl"
        >
          {visible.map((s, i) => (
            <li
              key={s}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                commit(s);
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm ${i === active ? "bg-sunk" : ""}`}
            >
              <MapPin className="size-3.5 text-ink-faint" aria-hidden />
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface Props {
  presetId: string;
  onPresetChange: (id: string) => void;
  cities: string[];
  onCitiesChange: (cities: string[]) => void;
}

export function RoomPicker({ presetId, onPresetChange, cities, onCitiesChange }: Props) {
  return (
    <div className="flex flex-col gap-6">
      <fieldset>
        <legend className="mb-3 text-sm font-semibold">Who&apos;s in the room?</legend>
        <div className="grid grid-cols-2 gap-2">
          {AUDIENCE_PRESETS.map((preset) => {
            const active = preset.id === presetId;
            return (
              <label
                key={preset.id}
                className={`flex cursor-pointer flex-col gap-2.5 rounded-xl border p-3 transition-all has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus ${
                  active ? "border-accent-glow bg-card shadow-[0_0_0_1px_var(--accent-glow)]" : "border-line hover:border-ink-faint"
                }`}
              >
                <input
                  type="radio"
                  name="room"
                  value={preset.id}
                  checked={active}
                  onChange={() => onPresetChange(preset.id)}
                  className="sr-only"
                />
                <span>
                  <span className="block text-sm font-medium leading-tight">{preset.label}</span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-ink-faint">{preset.description}</span>
                </span>
                <AgeHistogram mix={preset.ageMix} className="h-6" />
              </label>
            );
          })}
        </div>
        <div className="mt-1.5 flex justify-between text-[10px] uppercase tracking-wider text-ink-faint" aria-hidden>
          <span>Bars: younger → older</span>
        </div>
      </fieldset>

      <div>
        <label htmlFor="city-input" className="mb-1 block text-sm font-semibold">
          Where are you playing?
        </label>
        <p className="mb-2.5 text-xs text-ink-soft">Add up to {MAX_CITIES} cities to compare a tour, or leave it empty.</p>
        <CityInput
          cities={cities}
          onAdd={(name) => {
            if (!cities.some((c) => c.toLowerCase() === name.toLowerCase())) onCitiesChange([...cities, name]);
          }}
        />
        {cities.length > 0 && (
          <ul className="mt-2.5 flex flex-wrap gap-1.5">
            {cities.map((city) => (
              <li key={city} className="flex items-center gap-1 rounded-full bg-sunk py-1 pl-3 pr-1 text-sm">
                {city}
                <button
                  type="button"
                  onClick={() => onCitiesChange(cities.filter((c) => c !== city))}
                  aria-label={`Remove ${city}`}
                  className="grid size-5 place-items-center rounded-full text-ink-soft hover:bg-line hover:text-ink"
                >
                  <X className="size-3" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
