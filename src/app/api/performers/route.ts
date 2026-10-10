import { searchPerformers } from "@/lib/audience/performer";
import { clientIp, takeLookupSlot } from "@/lib/limits";
import { getQlooClient } from "@/lib/qloo/server";

// Performers, shows and podcasts whose fans can be the room.
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2 || q.length > 80) return Response.json({ performers: [] });
  const qloo = getQlooClient();
  if (!qloo) return Response.json({ error: "Qloo isn't connected." }, { status: 503 });
  if (!(await takeLookupSlot(clientIp(request)))) return Response.json({ error: "Too many searches. Try again in a bit." }, { status: 429 });
  try {
    return Response.json({ performers: await searchPerformers(qloo, q) });
  } catch (err) {
    console.error("performer search failed", err);
    return Response.json({ error: "Couldn't search Qloo right now." }, { status: 502 });
  }
}
