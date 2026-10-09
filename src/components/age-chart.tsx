import type { AgeMix } from "@/lib/audience/audience";
import { AGE_BUCKETS, type AgeBucket } from "@/lib/qloo/api";
import { AGE_LABELS, AGE_SHORT, signed } from "./labels";

// A share of the room this large marks the age group as part of tonight's crowd.
const IN_ROOM = 0.15;

interface Props {
  age: Partial<Record<AgeBucket, number>>;
  mix?: AgeMix;
}

// Diverging bars from the average adult: blue likes it more, orange less.
export function AgeChart({ age, mix }: Props) {
  const max = Math.max(0.25, ...AGE_BUCKETS.map((b) => Math.abs(age[b] ?? 0)));
  return (
    <figure className="flex flex-col gap-1">
      <div className="mb-1 grid grid-cols-[3.25rem_1fr_2.75rem] gap-2 text-[10px] font-medium uppercase tracking-wider text-ink-faint">
        <span />
        <span className="flex justify-between">
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-sm bg-less" aria-hidden />
            Less
          </span>
          <span className="flex items-center gap-1">
            More
            <span className="size-2 rounded-sm bg-more" aria-hidden />
          </span>
        </span>
        <span />
      </div>
      {AGE_BUCKETS.map((bucket, i) => {
        const v = age[bucket];
        const width = v === undefined ? 0 : (Math.abs(v) / max) * 50;
        const share = mix?.[bucket] ?? 0;
        const inRoom = share >= IN_ROOM;
        const tip =
          v === undefined
            ? `${AGE_LABELS[i]}: no data`
            : `${AGE_LABELS[i]}: ${Math.round(Math.abs(v) * 100)}% ${v >= 0 ? "more" : "less"} than the average adult${
                mix ? ` · ${Math.round(share * 100)}% of your room` : ""
              }`;
        return (
          <div
            key={bucket}
            tabIndex={0}
            aria-label={tip}
            className="group relative grid grid-cols-[3.25rem_1fr_2.75rem] items-center gap-2 rounded-md py-0.5 text-xs outline-none hover:bg-sunk focus-visible:bg-sunk"
          >
            <span className={`flex items-center gap-1 ${inRoom ? "font-semibold text-ink" : "text-ink-soft"}`}>
              {AGE_SHORT[i]}
              {inRoom && <span className="size-1.5 rounded-full bg-accent-glow" aria-hidden />}
            </span>
            <span className="relative h-2.5">
              <span className="absolute inset-y-0 left-1/2 w-px bg-line" aria-hidden />
              {v !== undefined && (
                <span
                  className={`absolute inset-y-0 ${v >= 0 ? "rounded-r-[4px] bg-more" : "rounded-l-[4px] bg-less"}`}
                  style={v >= 0 ? { left: "50%", width: `${width}%` } : { right: "50%", width: `${width}%` }}
                />
              )}
            </span>
            <span className="text-right tabular-nums text-ink">{v === undefined ? "–" : signed(v)}</span>
            <span
              role="tooltip"
              className="pointer-events-none absolute -top-8 left-1/2 z-20 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[11px] text-bg shadow-lg group-hover:block group-focus-visible:block"
            >
              {tip}
            </span>
          </div>
        );
      })}
      {mix && (
        <figcaption className="mt-1 flex items-center gap-1 text-[11px] text-ink-faint">
          <span className="size-1.5 rounded-full bg-accent-glow" aria-hidden />
          Age groups that make up most of your room
        </figcaption>
      )}
    </figure>
  );
}
