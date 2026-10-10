import { ENTITY_ID, performerRoom } from "@/lib/audience/performer";
import { clientIp, takeLookupSlot } from "@/lib/limits";
import { getQlooClient } from "@/lib/qloo/server";

// A performer's crowd as a room: Qloo's age mix for their fans, and the big
// metros where those fans are most concentrated.
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!ENTITY_ID.test(id)) return Response.json({ error: "Unknown performer." }, { status: 400 });
  const qloo = getQlooClient();
  if (!qloo) return Response.json({ error: "Qloo isn't connected." }, { status: 503 });
  if (!(await takeLookupSlot(clientIp(request)))) return Response.json({ error: "Too many searches. Try again in a bit." }, { status: 429 });
  try {
    const room = await performerRoom(qloo, id);
    if (!room) return Response.json({ error: "Qloo has no audience data for this one. Try another." }, { status: 404 });
    return Response.json(room);
  } catch (err) {
    console.error("performer room failed", err);
    return Response.json({ error: "Couldn't reach Qloo right now." }, { status: 502 });
  }
}
