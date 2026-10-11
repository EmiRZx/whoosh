import { z } from "zod";
import { REFERENCE_KINDS } from "@/lib/analysis/extract";
import { runSwapSearch, UserFacingError } from "@/lib/analysis/run";
import type { AnalyzedReference } from "@/lib/analysis/types";
import { ENTITY_ID } from "@/lib/audience/performer";
import { clientIp, takeSwapSlot } from "@/lib/limits";

// One swap search for one weak reference of a live analysis. It runs as its
// own request so it has the host's full time limit, not what the analysis
// left over.
export const maxDuration = 300;

const ReferenceSchema = z.object({
  key: z.string().max(200),
  extracted: z.object({
    name: z.string().max(200),
    kind: z.enum(REFERENCE_KINDS),
    disambiguation: z.string().max(300).nullable(),
    quotes: z.array(z.string().max(300)).max(20),
    role: z.string().max(500),
    weight: z.enum(["punchline", "setup", "color"]),
    checkable: z.boolean(),
  }),
  spans: z.array(z.object({ quote: z.string().max(300), start: z.number().int().min(0), end: z.number().int().min(0) })).min(1).max(20),
  resolution: z.object({
    status: z.literal("resolved"),
    entity: z.object({ id: z.string().regex(ENTITY_ID), name: z.string().max(200), type: z.string().max(60) }),
    standIn: z.string().max(300).optional(),
  }),
  signals: z.object({ recognition: z.number().optional(), roomIndex: z.number().optional() }).optional(),
  verdict: z.enum(["risky", "dead"]),
  reasons: z.array(z.string().max(300)).max(10),
});

const RequestSchema = z.object({
  text: z.string().trim().min(1).max(8000),
  presetId: z.string().max(40),
  cities: z.array(z.string().trim().min(1).max(80)).max(6),
  performerId: z.string().regex(ENTITY_ID).optional(),
  reference: ReferenceSchema,
  others: z.array(z.string().max(200)).max(80),
});

export async function POST(request: Request) {
  const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Not a swap request this server understands." }, { status: 400 });
  const slot = await takeSwapSlot(clientIp(request));
  if (!slot.ok) return Response.json({ error: slot.message }, { status: 429 });
  try {
    const { reference, ...rest } = parsed.data;
    const result = await runSwapSearch({ ...rest, reference: { ...reference, swaps: [] } as AnalyzedReference }, { signal: request.signal });
    return Response.json(result);
  } catch (err) {
    if (!(err instanceof UserFacingError)) console.error("swap search failed", err);
    return Response.json({ error: err instanceof UserFacingError ? err.message : "The swap search failed." }, { status: 500 });
  }
}
