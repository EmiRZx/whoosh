import type { AgeMix } from "../audience/audience";
import { roomIndex } from "../audience/audience";
import { CITIES } from "../geo/cities";
import { demographics, heatmap, type DemographicProfile, type QlooEntity } from "../qloo/api";
import type { QlooClient } from "../qloo/client";
import type { City } from "./types";

export interface CityRank {
  name: string;
  rank: number;
  of: number;
}

export interface Measured {
  // Qloo popularity percentile within the entity's type. It tracks current
  // engagement, so long-faded references score low or have none.
  recognition?: number;
  // Over/under-index per age group against Qloo's baseline, and the same
  // weighted by the room's age mix.
  profile?: DemographicProfile;
  roomIndex?: number;
  // Each requested city ranked against a fixed panel of major metros.
  cities?: CityRank[];
}

export interface MeasureItem {
  key: string;
  entity: QlooEntity;
}

const PANEL_SIZE = 24;
const BOX = 0.03; // degrees of latitude, about two miles each way

// A small box on each city center. A city boundary as filter.location makes
// the API error out, and one box per city keeps the URL short.
function box(lat: number, lon: number) {
  const [w, e, s, n] = [lon - BOX * 1.3, lon + BOX * 1.3, lat - BOX, lat + BOX].map((v) => v.toFixed(3));
  return `((${w} ${s},${e} ${s},${e} ${n},${w} ${n},${w} ${s}))`;
}

// Heatmap affinities are relative within one response, so a city's number
// only means something next to other cities in the same call. Each request
// therefore includes a fixed panel of big metros (US ones for US cities) and
// reports the requested cities' ranks among them.
async function cityRanks(client: QlooClient, entityId: string, cities: City[]): Promise<CityRank[] | undefined> {
  const placed = cities.filter((c): c is City & { lat: number; lon: number } => c.lat !== undefined && c.lon !== undefined);
  if (!placed.length) return undefined;
  const usOnly = placed.every((c) => /, [A-Z]{2}$/.test(c.name));
  const panel = CITIES.filter((c) => (usOnly ? c.country === "US" : true))
    .filter((c) => !placed.some((p) => p.name === c.label))
    .slice(0, PANEL_SIZE)
    .map((c) => ({ name: c.label, lat: c.lat, lon: c.lon }));
  const all = [...placed, ...panel];

  const cells = await heatmap(client, {
    "signal.interests.entities": entityId,
    "filter.location": `MULTIPOLYGON(${all.map((c) => box(c.lat, c.lon)).join(",")})`,
  }).catch(() => []);
  if (!cells.length) return undefined;

  const ranked = all
    .map((c) => {
      const mine = cells.filter((cell) => Math.abs(cell.lat - c.lat) <= BOX + 0.01 && Math.abs(cell.lon - c.lon) <= BOX * 1.3 + 0.01);
      return { name: c.name, affinity: mine.length ? mine.reduce((s, cell) => s + cell.affinity, 0) / mine.length : undefined };
    })
    .filter((m): m is { name: string; affinity: number } => m.affinity !== undefined)
    .sort((a, b) => b.affinity - a.affinity);
  const out = placed.flatMap((c) => {
    const rank = ranked.findIndex((m) => m.name === c.name);
    return rank < 0 ? [] : [{ name: c.name, rank: rank + 1, of: ranked.length }];
  });
  return out.length ? out : undefined;
}

export async function measure(
  client: QlooClient,
  items: MeasureItem[],
  audience: { ageMix: AgeMix; cities: City[] },
): Promise<Map<string, Measured>> {
  const [profiles, cityResults] = await Promise.all([
    Promise.all(items.map((i) => demographics(client, i.entity.id).catch(() => null))),
    Promise.all(items.map((i) => (audience.cities.length ? cityRanks(client, i.entity.id, audience.cities) : undefined))),
  ]);

  const out = new Map<string, Measured>();
  items.forEach((item, i) => {
    const profile = profiles[i] ?? undefined;
    out.set(item.key, {
      recognition: item.entity.popularity,
      profile,
      roomIndex: profile ? (roomIndex(profile, audience.ageMix) ?? undefined) : undefined,
      cities: cityResults[i],
    });
  });
  return out;
}
