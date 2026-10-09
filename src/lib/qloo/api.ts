// Typed helpers over the Qloo endpoints Whoosh uses. Response shapes are
// normalized defensively: the hackathon API silently ignores unsupported
// parameters, and some fields move between endpoints.
import type { QlooClient, QueryParams } from "./client";

// Types /search accepts (from the API's own validation message). Note
// "videogame": the hackathon guide's "video_game" is rejected with a 400.
export const ENTITY_TYPES = [
  "urn:entity:actor",
  "urn:entity:album",
  "urn:entity:artist",
  "urn:entity:author",
  "urn:entity:book",
  "urn:entity:brand",
  "urn:entity:destination",
  "urn:entity:director",
  "urn:entity:locality",
  "urn:entity:movie",
  "urn:entity:person",
  "urn:entity:place",
  "urn:entity:podcast",
  "urn:entity:tv_show",
  "urn:entity:videogame",
] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export const AGE_BUCKETS = [
  "24_and_younger",
  "25_to_29",
  "30_to_34",
  "35_to_44",
  "45_to_54",
  "55_and_older",
] as const;
export type AgeBucket = (typeof AGE_BUCKETS)[number];

export interface QlooTag {
  id: string;
  name: string;
  type?: string;
}

export interface QlooEntity {
  id: string;
  name: string;
  types: string[];
  subtype?: string;
  popularity?: number;
  // Only present on insights results, and only comparable within one response.
  affinity?: number;
  disambiguation?: string;
  description?: string;
  imageUrl?: string;
  releaseYear?: number;
  location?: { lat: number; lon: number };
  tags: QlooTag[];
}

// Index against Qloo's baseline: +0.39 means 39% more affinity than average.
export interface DemographicProfile {
  age: Partial<Record<AgeBucket, number>>;
  gender: { male?: number; female?: number };
}

export interface HeatmapCell {
  lat: number;
  lon: number;
  geohash?: string;
  affinity: number;
  popularity?: number;
  affinityRank?: number;
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);
const arr = (v: unknown) => (Array.isArray(v) ? v : []);

function toTag(raw: unknown): QlooTag | undefined {
  if (!isObj(raw)) return undefined;
  const id = str(raw.tag_id) ?? str(raw.id);
  const name = str(raw.name);
  return id && name ? { id, name, type: str(raw.type) } : undefined;
}

export function toEntity(raw: unknown): QlooEntity | undefined {
  if (!isObj(raw)) return undefined;
  const id = str(raw.entity_id) ?? str(raw.id);
  const name = str(raw.name);
  if (!id || !name) return undefined;
  const props = isObj(raw.properties) ? raw.properties : {};
  const query = isObj(raw.query) ? raw.query : {};
  const loc = isObj(raw.location) ? raw.location : undefined;
  const lat = num(loc?.lat) ?? num(loc?.latitude);
  const lon = num(loc?.lon) ?? num(loc?.longitude);
  const image = isObj(props.image) ? str(props.image.url) : undefined;
  const types = arr(raw.types).filter((t): t is string => typeof t === "string");
  if (!types.length && str(raw.type)) types.push(raw.type as string);
  return {
    id,
    name,
    types,
    subtype: str(raw.subtype),
    popularity: num(raw.popularity),
    affinity: num(query.affinity) ?? num(raw.affinity),
    disambiguation: str(raw.disambiguation),
    description: str(props.short_description) ?? str(props.description),
    imageUrl: image,
    releaseYear: num(props.release_year) ?? num(props.publication_year),
    location: lat !== undefined && lon !== undefined ? { lat, lon } : undefined,
    tags: arr(raw.tags).map(toTag).filter((t): t is QlooTag => !!t),
  };
}

const entities = (list: unknown) => arr(list).map(toEntity).filter((e): e is QlooEntity => !!e);

function results(body: unknown): unknown {
  return isObj(body) ? body.results : undefined;
}

export async function search(
  client: QlooClient,
  query: string,
  opts: { types?: EntityType[]; take?: number } = {},
): Promise<QlooEntity[]> {
  const body = await client.get("/search", {
    query,
    types: opts.types?.join(","),
    take: opts.take ?? 5,
  });
  const r = results(body);
  return entities(Array.isArray(r) ? r : isObj(r) ? r.entities : []);
}

export async function getEntities(client: QlooClient, ids: string[]): Promise<QlooEntity[]> {
  if (!ids.length) return [];
  const body = await client.get("/entities", { entity_ids: ids.join(",") });
  const r = results(body);
  return entities(Array.isArray(r) ? r : isObj(r) ? r.entities : []);
}

export async function insightEntities(client: QlooClient, params: QueryParams): Promise<QlooEntity[]> {
  const r = results(await client.get("/v2/insights", params));
  return entities(isObj(r) ? r.entities : []);
}

// Accepts either {age: {...}, gender: {...}} or a flat map of bucket → value.
export function toDemographics(raw: unknown): DemographicProfile | null {
  if (!isObj(raw)) return null;
  const ageSrc = isObj(raw.age) ? raw.age : raw;
  const genderSrc = isObj(raw.gender) ? raw.gender : raw;
  const age: DemographicProfile["age"] = {};
  for (const bucket of AGE_BUCKETS) {
    const v = num(ageSrc[bucket]);
    if (v !== undefined) age[bucket] = v;
  }
  const gender = { male: num(genderSrc.male), female: num(genderSrc.female) };
  if (!Object.keys(age).length && gender.male === undefined && gender.female === undefined) return null;
  return { age, gender };
}

export async function demographics(client: QlooClient, entityId: string): Promise<DemographicProfile | null> {
  const r = results(
    await client.get("/v2/insights", {
      "filter.type": "urn:demographics",
      "signal.interests.entities": entityId,
    }),
  );
  const first = isObj(r) ? arr(r.demographics)[0] : undefined;
  return toDemographics(isObj(first) ? (first.query ?? first) : undefined);
}

export async function heatmap(client: QlooClient, params: QueryParams): Promise<HeatmapCell[]> {
  const r = results(await client.get("/v2/insights", { "filter.type": "urn:heatmap", ...params }));
  return arr(isObj(r) ? r.heatmap : []).flatMap((cell) => {
    if (!isObj(cell)) return [];
    const loc = isObj(cell.location) ? cell.location : {};
    const q = isObj(cell.query) ? cell.query : {};
    const lat = num(loc.latitude) ?? num(loc.lat);
    const lon = num(loc.longitude) ?? num(loc.lon);
    const affinity = num(q.affinity);
    if (lat === undefined || lon === undefined || affinity === undefined) return [];
    return [{ lat, lon, geohash: str(loc.geohash), affinity, popularity: num(q.popularity), affinityRank: num(q.affinity_rank) }];
  });
}

export async function findTags(client: QlooClient, query: string, take = 10): Promise<QlooTag[]> {
  const r = results(await client.get("/v2/tags", { "filter.query": query, take }));
  return arr(isObj(r) ? r.tags : r).map(toTag).filter((t): t is QlooTag => !!t);
}

// Shape still to be confirmed against the live API; returned raw for now.
export async function trending(client: QlooClient, params: QueryParams): Promise<unknown> {
  return client.get("/v2/trending", params);
}
