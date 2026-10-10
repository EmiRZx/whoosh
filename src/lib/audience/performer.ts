// A room made from a performer's own audience: Qloo's age profile for the
// people who like them becomes the room's age mix, and their taste becomes an
// extra signal for swaps and local hooks.
import { demographics, getEntities, search, type EntityType } from "../qloo/api";
import type { QlooClient } from "../qloo/client";
import { topMetros } from "../analysis/measure";
import { toSummary } from "../analysis/resolve";
import type { EntitySummary } from "../analysis/types";
import { ageMixFromProfile, type AgeMix } from "./audience";

export const PERFORMER_TYPES: EntityType[] = ["urn:entity:person", "urn:entity:artist", "urn:entity:tv_show", "urn:entity:podcast"];

// Qloo entity ids are UUIDs.
export const ENTITY_ID = /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/;

export const performerLabel = (name: string) => `Fans of ${name}`;

// Not a room anyone should be asked to pick.
const ADULT = /pornograph|erotic|stripper|adult film/i;

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// How well a name answers the query: the whole name, its start, every word.
function nameMatch(name: string, query: string): number {
  const n = norm(name);
  const q = norm(query);
  if (n === q) return 3;
  if (n.startsWith(q)) return 2;
  return q.split(" ").every((w) => n.split(" ").some((x) => x.startsWith(w))) ? 1 : 0;
}

// Names that match the query first, then the most popular, since a short
// query ("cedric") matches footballers and chefs before the comedian and a
// long one ("cedric the entertainer") pulls in "Teni the Entertainer". One
// entry per name, so a comedian listed as both a person and a music artist
// shows up once.
export async function searchPerformers(client: QlooClient, query: string, take = 6): Promise<EntitySummary[]> {
  const hits = await search(client, query, { types: PERFORMER_TYPES, take: 15 });
  const seen = new Set<string>();
  return hits
    .filter((e) => e.popularity !== undefined && !e.tags.some((t) => ADULT.test(t.name ?? "")))
    .map((e) => ({ e, match: nameMatch(e.name, query) }))
    .sort((a, b) => b.match - a.match || b.e.popularity! - a.e.popularity!)
    .map(({ e }) => e)
    .filter((e) => {
      const key = norm(e.name);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, take)
    .map(toSummary);
}

export interface PerformerRoom {
  performer: EntitySummary;
  // The entity whose audience data is used: the performer, or a same-name
  // twin that has it. Taste signals use this id.
  audienceId: string;
  ageMix: AgeMix;
  // Big US metros where their fans are most concentrated, best first.
  cities: string[];
}

// Null when Qloo has no audience profile for the entity.
export async function performerRoom(client: QlooClient, id: string): Promise<PerformerRoom | null> {
  if (!ENTITY_ID.test(id)) return null;
  const [entity] = await getEntities(client, [id]);
  if (!entity) return null;
  // Qloo sometimes holds the audience under a same-name twin (the music
  // artist rather than the person), so fall back to one of those.
  let source = entity;
  let profile = await demographics(client, id);
  if (!profile?.age || !Object.keys(profile.age).length) {
    const twins = (await search(client, entity.name, { types: PERFORMER_TYPES, take: 10 })).filter(
      (e) => e.id !== id && norm(e.name) === norm(entity.name),
    );
    profile = null;
    for (const twin of twins) {
      const p = await demographics(client, twin.id);
      if (p && Object.keys(p.age).length) {
        source = twin;
        profile = p;
        break;
      }
    }
  }
  if (!profile) return null;
  const cities = await topMetros(client, source.id, 3).catch(() => []);
  return { performer: toSummary(entity), audienceId: source.id, ageMix: ageMixFromProfile(profile), cities };
}
