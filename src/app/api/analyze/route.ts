import { z } from "zod";
import { isExample, runAnalysis, UserFacingError } from "@/lib/analysis/run";
import { ENTITY_ID } from "@/lib/audience/performer";
import type { AnalysisEvent } from "@/lib/analysis/types";
import { clientIp, takeLiveSlot } from "@/lib/limits";

// An analysis makes many rate-limited Qloo calls plus model turns.
export const maxDuration = 300;

const RequestSchema = z.object({
  text: z.string().trim().min(1).max(8000),
  presetId: z.string().max(40),
  cities: z.array(z.string().trim().min(1).max(80)).max(6),
  performerId: z.string().regex(ENTITY_ID).optional(),
});

export async function POST(request: Request) {
  const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Send a script (up to 8,000 characters), a room and up to six cities." }, { status: 400 });
  }

  // Only live runs call Claude, so only they count against the limits.
  if (!isExample(parsed.data.text) && process.env.ANTHROPIC_API_KEY) {
    const slot = await takeLiveSlot(clientIp(request));
    if (!slot.ok) return Response.json({ error: slot.message }, { status: 429 });
  }

  // Stop paying for model calls once the visitor has gone.
  const abort = new AbortController();
  request.signal.addEventListener("abort", () => abort.abort(), { once: true });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let open = true;
      // One JSON event per line (NDJSON).
      const send = (event: AnalysisEvent) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          open = false;
        }
      };
      try {
        await runAnalysis(parsed.data, send, { signal: abort.signal });
      } catch (err) {
        if (!abort.signal.aborted) {
          if (!(err instanceof UserFacingError)) console.error("analysis failed", err);
          send({
            type: "error",
            message: err instanceof UserFacingError ? err.message : "Something went wrong while reading the room. Please try again.",
          });
        }
      } finally {
        open = false;
        try {
          controller.close();
        } catch {}
      }
    },
    cancel() {
      abort.abort();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
