import { AGE_BUCKETS, type AgeBucket } from "../qloo/api";
import type { ExtractedReference } from "./extract";
import type { CityRank, Measured } from "./measure";
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
  // Faded, but the room likes it this much more than average: it lands.
  lovedFaded: 0.25,
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
      // Faded overall, but this room is its audience (the morning show for
      // a crowd of retirees).
      return w >= THRESHOLDS.lovedFaded ? "lands" : w < 0 ? "dead" : "risky";
  }
}

// A city that ranks a reference this high among the big-city panel knows it
// better than the country does: one step up. One in the panel's bottom few
// knows it worse: one step down, unless everyone knows it anyway (Netflix
// plays everywhere). A short ranking says too little about the bottom.
export const LOCAL_FAVORITE_RANK = 3;
export const COLD_SPOT_FROM_BOTTOM = 4;
const MIN_PANEL_FOR_COLD = 12;

const UP: Record<Verdict, Verdict> = { dead: "risky", risky: "lands", lands: "lands", unchecked: "unchecked" };
const DOWN: Record<Verdict, Verdict> = { lands: "risky", risky: "dead", dead: "dead", unchecked: "unchecked" };

export type CityStanding = "favorite" | "cold" | "typical";

export function cityStanding(c: CityRank, t: Tier): CityStanding {
  if (c.rank <= LOCAL_FAVORITE_RANK) return "favorite";
  if (t !== "universal" && c.of >= MIN_PANEL_FOR_COLD && c.rank > c.of - COLD_SPOT_FROM_BOTTOM) return "cold";
  return "typical";
}

export function cityVerdict(base: Verdict, standing: CityStanding): Verdict {
  return standing === "favorite" ? UP[base] : standing === "cold" ? DOWN[base] : base;
}

export interface Judgement {
  // The verdict in the room's first city (the room as a whole without cities).
  verdict: Verdict;
  // The verdict in each city, when the room has cities Qloo could rank.
  cityVerdicts?: Record<string, Verdict>;
  reasons: string[];
}

export function judge(m: Measured, entityType: string, weight: ExtractedReference["weight"]): Judgement {
  const pop = m.recognition;
  const w = m.roomIndex;
  const t = tier(pop);
  const noun = TYPE_NOUN[entityType] ?? "things of its kind";
  const reasons: string[] = [];

  // "Top 1%", never "more than 100%".
  const top = (p: number) => `the top ${Math.max(1, Math.round((1 - p) * 100))}% of ${noun}`;
  if (pop === undefined) reasons.push("Qloo has no popularity data for it: it may have faded, or Qloo may just not track its audience.");
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

  const base = call(t, w, pop !== undefined);
  let cityVerdicts: Record<string, Verdict> | undefined;
  if (m.cities?.length) {
    cityVerdicts = {};
    for (const c of m.cities) {
      const standing = cityStanding(c, t);
      cityVerdicts[c.name] = cityVerdict(base, standing);
      const where = `#${c.rank} of ${c.of} big cities in ${c.name.split(",")[0]}`;
      if (standing === "favorite") reasons.push(`A local favorite: ${where}.`);
      else if (standing === "cold") reasons.push(`A cold spot for it: ${where}, so fewer people there know it.`);
    }
  }
  const verdict = (m.cities?.length && cityVerdicts?.[m.cities[0].name]) || base;
  if (verdict === "risky" && (t === "universal" || t === "known") && w !== undefined) {
    reasons.push(`They'll know it, but it isn't this room's thing${weight === "punchline" ? ", and the joke depends on it" : ""}.`);
  }
  if (verdict === "lands" && t === "faded") reasons.push("Faded overall, but this room is its audience.");
  // A cool number next to "lands" reads like a contradiction; say why it isn't.
  if (verdict === "lands" && w !== undefined && w <= -0.05) {
    reasons.push("Cooler than average, but well enough known that most of this room will still get it.");
  }
  return { verdict, cityVerdicts, reasons };
}

// The worst verdict a reference gets anywhere on the tour.
export function weakest(r: { verdict: Verdict; cityVerdicts?: Record<string, Verdict> }): Verdict {
  const all = [r.verdict, ...Object.values(r.cityVerdicts ?? {})];
  return all.includes("dead") ? "dead" : all.includes("risky") ? "risky" : r.verdict;
}
