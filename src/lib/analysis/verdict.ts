import { AGE_BUCKETS, type AgeBucket } from "../qloo/api";
import type { ExtractedReference } from "./extract";
import type { Measured } from "./measure";
import type { Verdict } from "./types";

export const AGE_LABEL: Record<AgeBucket, string> = {
  "24_and_younger": "people 24 and under",
  "25_to_29": "25–29s",
  "30_to_34": "30–34s",
  "35_to_44": "35–44s",
  "45_to_54": "45–54s",
  "55_and_older": "people 55 and over",
};

const TYPE_NOUN: Record<string, string> = {
  "urn:entity:movie": "movies",
  "urn:entity:tv_show": "TV shows",
  "urn:entity:artist": "musicians",
  "urn:entity:person": "public figures",
  "urn:entity:actor": "actors",
  "urn:entity:author": "authors",
  "urn:entity:director": "directors",
  "urn:entity:brand": "brands",
  "urn:entity:book": "books",
  "urn:entity:videogame": "video games",
  "urn:entity:podcast": "podcasts",
  "urn:entity:place": "places",
  "urn:entity:locality": "places",
  "urn:entity:destination": "destinations",
};

const pct = (x: number) => `${Math.round(Math.abs(x) * 100)}%`;

// Qloo's age index measures how much a group likes something, not whether it
// has heard of it: 45-year-olds under-index on Netflix and still know it. So
// "won't land" is kept for references the room probably doesn't know (faded
// or niche, and cold), and a famous reference the room is cool on is "risky":
// they'll get it, it just isn't theirs.
export type Tier = "universal" | "known" | "mid" | "faded";

export function tier(popularity: number | undefined): Tier {
  if (popularity === undefined || popularity < 0.5) return "faded";
  if (popularity >= 0.97) return "universal";
  if (popularity >= 0.85) return "known";
  return "mid";
}

// Set by measuring the example scripts' references in college, corporate,
// wedding and retirement rooms (October 2026 data).
export const THRESHOLDS = {
  coolUniversal: -0.35, // at or below: a household name this room is cool on
  coolKnown: -0.2,
  warmMid: 0.1, // a less famous reference needs this much warmth to land
  coldMid: -0.35, // at or below: a less famous reference this room won't know
};

function call(t: Tier, w: number | undefined, hasData: boolean): Verdict {
  if (w === undefined) {
    if (!hasData) return "risky";
    return t === "universal" || t === "known" ? "lands" : t === "mid" ? "risky" : "dead";
  }
  switch (t) {
    case "universal":
      return w > THRESHOLDS.coolUniversal ? "lands" : "risky";
    case "known":
      return w > THRESHOLDS.coolKnown ? "lands" : "risky";
    case "mid":
      return w >= THRESHOLDS.warmMid ? "lands" : w <= THRESHOLDS.coldMid ? "dead" : "risky";
    case "faded":
      return w < 0 ? "dead" : "risky";
  }
}

export function judge(m: Measured, entityType: string, weight: ExtractedReference["weight"]): { verdict: Verdict; reasons: string[] } {
  const pop = m.recognition;
  const w = m.roomIndex;
  const t = tier(pop);
  const noun = TYPE_NOUN[entityType] ?? "things of its kind";
  const reasons: string[] = [];

  // "Top 1%", never "more than 100%".
  const top = (p: number) => `the top ${Math.max(1, Math.round((1 - p) * 100))}% of ${noun}`;
  if (pop === undefined) reasons.push("Qloo sees almost no current audience for it, which usually means it has faded.");
  else if (t === "universal") reasons.push(`A household name: in ${top(pop)} today.`);
  else if (t !== "faded") reasons.push(`Known, but not everywhere: in ${top(pop)} today.`);
  else reasons.push(`Fading: less present today than ${pct(1 - pop)} of ${noun}.`);

  if (w !== undefined) {
    reasons.push(
      Math.abs(w) < 0.03
        ? "This room likes it about as much as the average adult."
        : `This room likes it ${pct(w)} ${w > 0 ? "more" : "less"} than the average adult.`,
    );
    const fans = AGE_BUCKETS.filter((b) => m.profile?.age[b] !== undefined).sort((a, b) => m.profile!.age[b]! - m.profile!.age[a]!)[0];
    const lift = fans ? m.profile!.age[fans]! : 0;
    if (fans && lift > 0.05) reasons.push(`Its biggest fans are ${AGE_LABEL[fans]} (+${pct(lift)}).`);
  }

  const verdict = call(t, w, pop !== undefined);
  if (verdict === "risky" && (t === "universal" || t === "known") && w !== undefined) {
    reasons.push(`They'll know it, but it isn't this room's thing${weight === "punchline" ? ", and the joke depends on it" : ""}.`);
  }
  return { verdict, reasons };
}
