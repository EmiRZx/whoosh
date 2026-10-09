"use client";

import { ArrowRight } from "lucide-react";
import { SAMPLES } from "@/content/samples";
import { presetById } from "@/lib/audience/audience";
import { RoomPicker } from "./room-picker";

export const MAX_CHARS = 8000;

interface Props {
  text: string;
  onTextChange: (text: string) => void;
  presetId: string;
  onPresetChange: (id: string) => void;
  cities: string[];
  onCitiesChange: (cities: string[]) => void;
  onLoadSample: (id: string) => void;
  onRun: () => void;
}

export function Composer(props: Props) {
  const { text, onTextChange, onLoadSample, onRun } = props;
  const canRun = text.trim().length > 0 && text.length <= MAX_CHARS;

  return (
    <div className="flex flex-col gap-10">
      <section className="max-w-3xl pt-6 sm:pt-12">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">A reference check for anything said out loud</p>
        <h1 className="mt-3 text-5xl font-semibold leading-[1.02] tracking-tight sm:text-7xl">
          Will they get the <span className="text-accent">reference</span>?
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-soft">
          Bring a tight five, a toast, a lecture or a keynote, and say who's listening. Whoosh checks every movie, show, song, brand and public
          figure against what that audience actually loves, using Qloo&apos;s taste graph, and finds swaps for the ones that
          won&apos;t land.
        </p>
      </section>

      <div className="card grid grid-cols-1 overflow-hidden rounded-3xl lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <section className="flex flex-col p-5 sm:p-7">
          <div className="mb-4">
            <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint">Try a real one</p>
            <div className="scrollbar-none -mx-5 flex gap-2 overflow-x-auto px-5 sm:mx-0 sm:flex-wrap sm:px-0">
              {SAMPLES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onLoadSample(s.id)}
                  className="shrink-0 rounded-xl border border-line px-3 py-2 text-left transition-colors hover:border-ink-faint hover:bg-sunk"
                >
                  <span className="block text-[11px] text-ink-faint">{s.format}</span>
                  <span className="block text-sm font-medium">{s.title}</span>
                  <span className="block text-[11px] text-ink-faint">
                    {presetById(s.presetId)?.label}
                    {s.cities.length > 0 && ` · ${s.cities.map((c) => c.split(",")[0]).join(", ")}`}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <label htmlFor="script" className="sr-only">
            Your script
          </label>
          <textarea
            id="script"
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            placeholder="Your script goes here: a tight five, a best man speech, a lecture, a keynote. Every name in it gets measured against the room."
            className="min-h-[22rem] w-full flex-1 resize-y rounded-2xl bg-sunk p-5 font-serif text-[17px] leading-[1.8] outline-none ring-focus/60 placeholder:text-ink-faint focus:ring-2"
          />
          <p className={`mt-2 text-right text-xs tabular-nums ${text.length > MAX_CHARS ? "text-dead-ink" : "text-ink-faint"}`}>
            {text.length.toLocaleString("en-US")} / {MAX_CHARS.toLocaleString("en-US")}
          </p>
        </section>

        <aside className="flex flex-col gap-6 border-t border-line p-5 sm:p-7 lg:border-l lg:border-t-0">
          <RoomPicker
            presetId={props.presetId}
            onPresetChange={props.onPresetChange}
            cities={props.cities}
            onCitiesChange={props.onCitiesChange}
          />
          <button
            type="button"
            disabled={!canRun}
            onClick={onRun}
            className="group mt-auto flex items-center justify-center gap-2 rounded-2xl bg-cta px-5 py-4 text-base font-semibold text-cta-ink shadow-[0_10px_30px_-12px_var(--accent-glow)] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none disabled:hover:translate-y-0"
          >
            Check the room
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </button>
        </aside>
      </div>
    </div>
  );
}
