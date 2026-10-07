"use client";

import { useState } from "react";
import { AUDIENCE_PRESETS, type AgeMix } from "@/lib/audience/audience";
import { AGE_BUCKETS } from "@/lib/qloo/api";
import { AGE_LABELS } from "./labels";

const MAX_CITIES = 6;

// Six shades from light (youngest) to dark (oldest).
const AGE_SHADES = ["#f2d39a", "#e9b45c", "#d58f34", "#a9682a", "#764824", "#3f2a18"];

export function AgeBar({ mix, className = "" }: { mix: AgeMix; className?: string }) {
  return (
    <div className={`flex h-1.5 overflow-hidden rounded-full ${className}`} aria-hidden>
      {AGE_BUCKETS.map((bucket, i) => (
        <div key={bucket} style={{ width: `${mix[bucket] * 100}%`, background: AGE_SHADES[i] }} />
      ))}
    </div>
  );
}

function ageSummary(mix: AgeMix) {
  return AGE_BUCKETS.map((b, i) => `${AGE_LABELS[i]}: ${Math.round(mix[b] * 100)}%`).join(", ");
}

interface Props {
  presetId: string;
  onPresetChange: (id: string) => void;
  cities: string[];
  onCitiesChange: (cities: string[]) => void;
}

export function RoomPicker({ presetId, onPresetChange, cities, onCitiesChange }: Props) {
  const [draft, setDraft] = useState("");

  const addCity = () => {
    const name = draft.trim();
    if (!name || cities.length >= MAX_CITIES) return;
    if (!cities.some((c) => c.toLowerCase() === name.toLowerCase())) onCitiesChange([...cities, name]);
    setDraft("");
  };

  return (
    <div className="flex flex-col gap-6">
      <fieldset>
        <legend className="mb-3 text-sm font-semibold tracking-wide text-ink">Who&apos;s in the room?</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {AUDIENCE_PRESETS.map((preset) => {
            const active = preset.id === presetId;
            return (
              <label
                key={preset.id}
                className={`flex cursor-pointer flex-col gap-2 rounded-lg border px-3 py-2.5 transition-colors ${
                  active ? "border-ink bg-paper-raised shadow-[0_1px_0_var(--rule)]" : "border-rule hover:border-ink-faint"
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
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">{preset.label}</span>
                </span>
                <span className="text-xs leading-snug text-ink-soft">{preset.description}</span>
                <AgeBar mix={preset.ageMix} />
                <span className="sr-only">{ageSummary(preset.ageMix)}</span>
              </label>
            );
          })}
        </div>
        <div className="mt-2 flex justify-between text-[10px] uppercase tracking-wider text-ink-faint" aria-hidden>
          <span>Younger</span>
          <span>Older</span>
        </div>
      </fieldset>

      <div>
        <label htmlFor="city-input" className="mb-1 block text-sm font-semibold tracking-wide">
          Where are you playing?
        </label>
        <p className="mb-3 text-xs text-ink-soft">Add up to {MAX_CITIES} cities to compare a tour, or leave it empty.</p>
        <div className="flex gap-2">
          <input
            id="city-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCity();
              }
            }}
            placeholder="e.g. Austin, TX"
            maxLength={80}
            disabled={cities.length >= MAX_CITIES}
            className="min-w-0 flex-1 rounded-md border border-rule bg-paper-raised px-3 py-2 text-sm outline-none placeholder:text-ink-faint focus:border-ink disabled:opacity-50"
          />
          <button
            type="button"
            onClick={addCity}
            disabled={!draft.trim() || cities.length >= MAX_CITIES}
            className="rounded-md border border-ink px-3 py-2 text-sm font-medium transition-colors hover:bg-ink hover:text-paper disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-ink"
          >
            Add
          </button>
        </div>
        {cities.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {cities.map((city) => (
              <li key={city} className="flex items-center gap-1 rounded-full bg-paper-sunk py-1 pl-3 pr-1 text-sm">
                {city}
                <button
                  type="button"
                  onClick={() => onCitiesChange(cities.filter((c) => c !== city))}
                  aria-label={`Remove ${city}`}
                  className="grid size-5 place-items-center rounded-full text-ink-soft hover:bg-rule hover:text-ink"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
