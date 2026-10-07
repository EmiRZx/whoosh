import { AGE_BUCKETS, type AgeBucket, type DemographicProfile } from "../qloo/api";

export type AgeMix = Record<AgeBucket, number>;

export interface AudiencePreset {
  id: string;
  label: string;
  description: string;
  ageMix: AgeMix;
}

const mix = (...weights: number[]): AgeMix => {
  const total = weights.reduce((a, b) => a + b, 0);
  return Object.fromEntries(AGE_BUCKETS.map((b, i) => [b, weights[i] / total])) as AgeMix;
};

// Weights over Qloo's age buckets: 24-, 25-29, 30-34, 35-44, 45-54, 55+.
// "general" approximates the US adult population; the rest are typical rooms.
export const AUDIENCE_PRESETS: AudiencePreset[] = [
  { id: "general", label: "General adult crowd", description: "Roughly the US adult population", ageMix: mix(12, 8.5, 9, 17, 15.5, 38) },
  { id: "college", label: "College crowd", description: "Campus show, mostly undergrads", ageMix: mix(78, 12, 4, 3, 2, 1) },
  { id: "comedy-club", label: "Comedy club", description: "Weekend club audience", ageMix: mix(14, 22, 20, 24, 12, 8) },
  { id: "corporate", label: "Corporate event", description: "Conference or company offsite", ageMix: mix(6, 16, 18, 30, 20, 10) },
  { id: "wedding", label: "Wedding reception", description: "Couple's friends plus both families", ageMix: mix(10, 22, 18, 14, 14, 22) },
  { id: "retirement", label: "Retirement community", description: "Senior living or 55+ crowd", ageMix: mix(0, 0, 0, 2, 8, 90) },
];

export const presetById = (id: string) => AUDIENCE_PRESETS.find((p) => p.id === id);

// How much more (or less) this room likes an entity than Qloo's baseline:
// the entity's per-bucket index weighted by the room's age mix. Buckets Qloo
// didn't report are left out and the remaining weights renormalized.
export function roomIndex(profile: DemographicProfile, ageMix: AgeMix): number | null {
  let weighted = 0;
  let weight = 0;
  for (const bucket of AGE_BUCKETS) {
    const index = profile.age[bucket];
    if (index === undefined) continue;
    weighted += index * ageMix[bucket];
    weight += ageMix[bucket];
  }
  return weight > 0 ? weighted / weight : null;
}

// Turns a performer's own audience profile (over/under-index per bucket) into
// an age mix, by reweighting the general population.
export function ageMixFromProfile(profile: DemographicProfile, base: AgeMix = AUDIENCE_PRESETS[0].ageMix): AgeMix {
  const raw = AGE_BUCKETS.map((b) => base[b] * Math.max(0, 1 + (profile.age[b] ?? 0)));
  return mix(...raw);
}
