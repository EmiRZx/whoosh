// MCP endpoint (Streamable HTTP) an agent can test a script on its crowd before it
// writes or delivers it. It runs the same pipeline as the web app.
import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { runAnalysis, UserFacingError } from "@/lib/analysis/run";
import type { Analysis, AnalysisEvent } from "@/lib/analysis/types";
import { AUDIENCE_PRESETS } from "@/lib/audience/audience";
import { AGE_BUCKETS } from "@/lib/qloo/api";

export const maxDuration = 300;

const ROOM_IDS = AUDIENCE_PRESETS.map((p) => p.id) as [string, ...string[]];

function summarize(analysis: Analysis) {
  return {
    room: analysis.audience.label,
    cities: analysis.audience.cities.map((c) => c.name),
    references: analysis.references.map((r) => ({
      name: r.extracted.name,
      kind: r.extracted.kind,
      quotes: r.extracted.quotes,
      role: r.extracted.role,
      weight: r.extracted.weight,
      verdict: r.verdict,
      reasons: r.reasons,
      swaps: r.swaps.map((s) => ({ name: s.entity.name, verdict: s.verdict, rewrite: s.rewrite, why: s.why })),
    })),
  };
}

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "check_script",
      {
        title: "Whoosh",
        description:
          "Check the cultural references in a script that will be said out loud (stand-up set, speech, toast, talk, ad copy) against a specific audience, using Qloo's taste graph. Returns each reference with the job it does in the line, a verdict for this room (lands, risky, dead, unchecked), the reasons, and substitutes for references that won't land. Use it before delivering or finalizing writing for an audience.",
        inputSchema: z.object({
          text: z.string().min(1).max(8000).describe("The script to check"),
          room: z.enum(ROOM_IDS).describe("Who is in the room; see list_rooms"),
          cities: z.array(z.string().max(80)).max(6).optional().describe('Cities where it will be performed, e.g. "Austin, TX"'),
        }),
      },
      async ({ text, room, cities }) => {
        const events: AnalysisEvent[] = [];
        try {
          await runAnalysis({ text, presetId: room, cities: cities ?? [] }, (e) => events.push(e));
        } catch (err) {
          const message = err instanceof UserFacingError ? err.message : "The analysis failed. Please try again.";
          return { isError: true, content: [{ type: "text", text: message }] };
        }
        const done = events.find((e): e is Extract<AnalysisEvent, { type: "done" }> => e.type === "done");
        if (!done) return { isError: true, content: [{ type: "text", text: "The analysis did not complete." }] };
        const notes = events.flatMap((e) => (e.type === "status" ? [e.message] : []));
        return {
          content: [{ type: "text", text: JSON.stringify({ ...summarize(done.analysis), log: notes }, null, 2) }],
        };
      },
    );

    server.registerTool(
      "list_rooms",
      {
        title: "List rooms",
        description: "List the audience types check_script understands, with each one's age mix.",
        inputSchema: z.object({}),
      },
      async () => ({
        content: [
          {
            type: "text",
            text: JSON.stringify(
              AUDIENCE_PRESETS.map((p) => ({
                id: p.id,
                label: p.label,
                description: p.description,
                ageMix: Object.fromEntries(AGE_BUCKETS.map((b) => [b, Math.round(p.ageMix[b] * 100) / 100])),
              })),
              null,
              2,
            ),
          },
        ],
      }),
    );
  },
  { serverInfo: { name: "whoosh", version: "0.1.0" } },
);

export { handler as GET, handler as POST };
