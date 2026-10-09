// Local hooks: what this room's age group likes in a specific city, so a
// performer can open with something local. Places come from a location
// filter. Artists come from a location signal and are kept only when they
// score clearly higher here than in two far-away metros scored on the same
// scale: national stars top every city's list, local acts don't.
import type { AgeMix } from "../audience/audience";
import { AGE_BUCKETS, insightEntities, type QlooEntity } from "../qloo/api";
import type { QlooClient } from "../qloo/client";
import { toSummary } from "./resolve";
import type { City, LocalHooks } from "./types";

// Infrastructure and event venues top the place results without being
// anything to joke about.
const NOT_A_HOOK =
  /airport|hospital|medical|clinic|station|terminal|interstate|parking|university|college|school|hotel|\binn\b|suites|marriott|hilton|hyatt|sheraton|westin|\bmall\b|convention|expo\b|fairground|cemetery|welcome center|visitor center|\btours?\b|gift shop|\bstore\b/i;

// Entity names are user-generated in places; never show a slur on stage notes.
const OFFENSIVE = /n[i1]gg|f[a@]gg|\bretard|\bwhore|\bslut/i;

// How much higher an artist must score here than elsewhere to count as local.
export const LOCAL_LIFT = 0.02;

const METROS = {
  losAngeles: { lat: 34.0522, lon: -118.2437 },
  newYork: { lat: 40.7128, lon: -74.006 },
  chicago: { lat: 41.8781, lon: -87.6298 },
  dallas: { lat: 32.7767, lon: -96.797 },
};

// One metro on the other coast and one inland, never the city itself.
function baselinesFor(c: { lat: number; lon: number }) {
  const coast = c.lon > -100 ? METROS.losAngeles : METROS.newYork;
  const nearChicago = Math.abs(c.lat - METROS.chicago.lat) + Math.abs(c.lon - METROS.chicago.lon) < 6;
  return [coast, nearChicago ? METROS.dallas : METROS.chicago];
}

const point = (c: { lat: number; lon: number }) => `POINT(${c.lon} ${c.lat})`;
const clean = (e: QlooEntity) => !OFFENSIVE.test(e.name);

async function localArtists(client: QlooClient, here: { lat: number; lon: number }, age: string): Promise<QlooEntity[]> {
  const local = (
    await insightEntities(client, {
      "filter.type": "urn:entity:artist",
      "signal.location": point(here),
      "signal.demographics.age": age,
      take: 20,
    }).catch(() => [])
  ).filter(clean);
  if (!local.length) return [];

  const ids = local.map((a) => a.id).join(",");
  const elsewhere = await Promise.all(
    baselinesFor(here).map((b) =>
      insightEntities(client, {
        "filter.type": "urn:entity:artist",
        "filter.results.entities": ids,
        "signal.location": point(b),
        "signal.demographics.age": age,
        take: local.length,
      }).catch(() => []),
    ),
  );
  return local
    .map((artist) => {
      const others = elsewhere.flatMap((list) => list.filter((x) => x.id === artist.id).map((x) => x.affinity ?? 0));
      const lift = others.length ? (artist.affinity ?? 0) - Math.max(...others) : undefined;
      return { artist, lift };
    })
    .filter((x): x is { artist: QlooEntity; lift: number } => x.lift !== undefined && x.lift >= LOCAL_LIFT)
    .sort((a, b) => b.lift - a.lift)
    .map((x) => x.artist);
}

export async function localHooks(client: QlooClient, city: City, ageMix: AgeMix): Promise<LocalHooks | undefined> {
  if (city.lat === undefined || city.lon === undefined) return undefined;
  const here = { lat: city.lat, lon: city.lon };
  const age = [...AGE_BUCKETS].sort((a, b) => ageMix[b] - ageMix[a])[0];

  const [places, artists] = await Promise.all([
    insightEntities(client, {
      "filter.type": "urn:entity:place",
      "filter.location": point(here),
      "filter.location.radius": 15000,
      "signal.demographics.age": age,
      take: 15,
    }).catch(() => []),
    localArtists(client, here, age),
  ]);

  const hooks = {
    city: city.name,
    places: places.filter((p) => clean(p) && !NOT_A_HOOK.test(p.name)).slice(0, 6).map(toSummary),
    artists: artists.slice(0, 6).map(toSummary),
  };
  return hooks.places.length || hooks.artists.length ? hooks : undefined;
}
