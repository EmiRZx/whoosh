import { z } from "zod";
import { runAnalysis, UserFacingError } from "@/lib/analysis/run";
import type { AnalysisEvent } from "@/lib/analysis/types";

// An analysis makes many rate-limited Qloo calls plus model turns.
export const maxDuration = 300;

const RequestSchema = z.object({
  text: z.string().trim().min(1).max(8000),
  presetId: z.string().max(40),
  cities: z.array(z.string().trim().min(1).max(80)).max(6),
});

export async function POST(request: Request) {
  const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Send a script (up to 8,000 characters), a room and up to six cities." }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // One JSON event per line (NDJSON).
      const send = (event: AnalysisEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        await runAnalysis(parsed.data, send);
      } catch (err) {
        if (!(err instanceof UserFacingError)) console.error("analysis failed", err);
        send({
          type: "error",
          message: err instanceof UserFacingError ? err.message : "Something went wrong while reading the room. Please try again.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
