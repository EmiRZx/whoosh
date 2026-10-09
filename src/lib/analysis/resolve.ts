import { search, type EntityType, type QlooEntity } from "../qloo/api";
import type { QlooClient } from "../qloo/client";
import type { ExtractedReference } from "./extract";
import type { EntitySummary } from "./types";

// Where to look for each kind, best type first. Fallbacks cover entities Qloo
// files elsewhere: Blockbuster is only a place, Pokémon is a brand, and
// neighborhoods are localities rather than destinations.
export const KIND_TYPES: Record<Exclude<ExtractedReference["kind"], "other">, EntityType[]> = {
  movie: ["urn:entity:movie"],
  tv_show: ["urn:entity:tv_show"],
  artist: ["urn:entity:artist"],
  // Some public figures only carry data under another role: Steve Jobs as a
  // person has no popularity, Steve Jobs the author does.
  person: ["urn:entity:person", "urn:entity:actor", "urn:entity:author", "urn:entity:director"],
  brand: ["urn:entity:brand", "urn:entity:place"],
  book: ["urn:entity:book", "urn:entity:author"],
  video_game: ["urn:entity:videogame", "urn:entity:brand"],
  podcast: ["urn:entity:podcast"],
  place: ["urn:entity:place", "urn:entity:brand"],
  destination: ["urn:entity:locality", "urn:entity:destination"],
};

export const normalizeName = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/^the\s+/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export function toSummary(e: QlooEntity): EntitySummary {
  return {
    id: e.id,
    name: e.name,
    type: e.types[0] ?? "unknown",
    imageUrl: e.imageUrl,
    description: e.description ?? e.disambiguation,
    releaseYear: e.releaseYear,
    popularity: e.popularity,
  };
}

// Searches the preferred type first. Fallback types are searched separately
// (and only when needed) so their results can't crowd out the preferred type:
// a combined brand+place search for "Apple" ranks Apple Store branches above
// the brand.
export async function findCandidates(client: QlooClient, ref: ExtractedReference): Promise<QlooEntity[]> {
  if (ref.kind === "other") return [];
  const [primary, ...fallbacks] = KIND_TYPES[ref.kind];
  const found = await search(client, ref.name, { types: [primary], take: 6 });
  const settled = found.some((e) => normalizeName(e.name) === normalizeName(ref.name) && e.popularity !== undefined);
  if (settled || !fallbacks.length) return found;
  const more = await search(client, ref.name, { types: fallbacks, take: 4 });
  return [...found, ...more];
}

export type Pick =
  | { status: "resolved"; entity: QlooEntity }
  | { status: "ambiguous"; candidates: QlooEntity[] }
  | { status: "not_found" };

// Only an exact name match in the preferred type settles it; among several
// (three shows called "Love Island") the most popular wins. An exact match in
// a fallback type is often a single location sharing the name (a "Costco"
// warehouse, a restaurant called "Canvas"), so it goes back as ambiguous,
// listed first, for the model or the user to accept or reject.
export function pickCandidate(ref: ExtractedReference, candidates: QlooEntity[]): Pick {
  if (!candidates.length || ref.kind === "other") return { status: "not_found" };
  const wanted = normalizeName(ref.name);
  const [primary] = KIND_TYPES[ref.kind];
  const isExact = (e: QlooEntity) => normalizeName(e.name) === wanted;
  const byPopularity = (a: QlooEntity, b: QlooEntity) => (b.popularity ?? 0) - (a.popularity ?? 0);

  const exactPrimary = candidates.filter((e) => isExact(e) && e.types.includes(primary)).sort(byPopularity);
  // For people, the same name under another role is the same person.
  const exactRole =
    ref.kind === "person"
      ? candidates.filter((e) => isExact(e) && e.popularity !== undefined && KIND_TYPES.person.some((t) => e.types.includes(t))).sort(byPopularity)
      : [];
  if (exactPrimary[0]?.popularity !== undefined) return { status: "resolved", entity: exactPrimary[0] };
  if (exactRole.length) return { status: "resolved", entity: exactRole[0] };
  // A match with no data still beats a guess: it's the right entity, Qloo
  // just knows little about it today.
  if (exactPrimary.length) return { status: "resolved", entity: exactPrimary[0] };

  const ordered = [...candidates.filter(isExact).sort(byPopularity), ...candidates.filter((e) => !isExact(e))];
  return { status: "ambiguous", candidates: ordered.slice(0, 6) };
}
