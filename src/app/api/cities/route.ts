import { suggestCities } from "@/lib/geo/cities";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.slice(0, 80) ?? "";
  const cities = suggestCities(q, 8).map((c) => ({ label: c.label, population: c.population }));
  return Response.json({ cities }, { headers: { "Cache-Control": "public, max-age=86400" } });
}
