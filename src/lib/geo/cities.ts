// City list derived from GeoNames (https://www.geonames.org, CC BY 4.0) by
// scripts/build_cities.py: US cities over 100k people, cities worldwide over
// 1M, and national capitals.
import rawCities from "@/content/cities.json";

export interface CityRecord {
  label: string;
  name: string;
  ascii: string;
  country: string;
  lat: number;
  lon: number;
  population: number;
}

export const CITIES = rawCities as CityRecord[];

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9,]+/g, " ")
    .replace(/\s*,\s*/g, ",")
    .trim();

const indexed = CITIES.map((city) => ({
  city,
  label: fold(city.label),
  name: fold(city.name),
  ascii: fold(city.ascii),
}));

// "Austin, TX", "austin tx", "Istanbul" and "Ann Arbor, Michigan"-style input.
// The list is sorted by population, so the first match is the biggest city.
export function findCity(query: string): CityRecord | undefined {
  const q = fold(query);
  if (!q) return undefined;
  const [namePart, regionPart] = q.split(",").map((s) => s.trim());

  const exact = indexed.find((c) => c.label === q);
  if (exact) return exact.city;

  const byName = indexed.filter((c) => c.name === namePart || c.ascii === namePart);
  if (regionPart) {
    const inRegion = byName.find((c) => c.label.endsWith(`,${regionPart}`) || c.label.split(",")[1]?.startsWith(regionPart));
    if (inRegion) return inRegion.city;
  }
  if (byName.length) return byName[0].city;

  // "austin tx" without a comma: try splitting off the last word as a region.
  const words = q.split(" ");
  if (!regionPart && words.length > 1) {
    const region = words.pop()!;
    const match = indexed.find((c) => (c.name === words.join(" ") || c.ascii === words.join(" ")) && c.label.endsWith(`,${region}`));
    if (match) return match.city;
  }
  return undefined;
}

export function suggestCities(query: string, limit = 8): CityRecord[] {
  const q = fold(query);
  if (!q) return [];
  const results: CityRecord[] = [];
  for (const c of indexed) {
    if (c.label.startsWith(q) || c.ascii.startsWith(q) || c.label.includes(` ${q}`)) {
      results.push(c.city);
      if (results.length >= limit) break;
    }
  }
  return results;
}
