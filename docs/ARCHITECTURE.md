# Architecture

Whoosh checks the cultural references in a piece of writing (a stand-up set, a speech, a talk, ad copy) against a specific audience, using Qloo's taste graph, and repairs the ones that won't land.

## Flow

```
text + audience
   │
   ▼
1. Extract      LLM finds each reference (span, likely type, the job it does in the line)
2. Resolve      Qloo /search per reference in the expected type, with fallback types;
                an exact name match in the expected type is accepted, anything else
                goes to the LLM, which picks a candidate, accepts a stand-in, or
                declines (an unchecked reference beats measuring the wrong thing)
3. Measure      Qloo signals per resolved entity (deterministic code, no LLM):
                  presence today ← popularity percentile within its type
                  room index     ← urn:demographics age index, weighted by the room's age mix
                  cities         ← one urn:heatmap call per entity over boxes on the tour
                                   cities plus a panel of big metros; heatmap values are
                                   relative within a response, so cities are ranked
4. Verdict      code turns presence and room index into LANDS / RISKY / DEAD with
                reasons; thresholds were calibrated on the example scripts
5. Repair       agent loop (LLM + Qloo tools) for RISKY/DEAD references: find candidates
                that do the same job for this audience, score them with step 3,
                check the role fit, rewrite the line
6. Local hooks  things this city's audience over-indexes on vs. the national baseline
```

The LLM does language work (understanding the text, choosing between candidates, judging whether a swap keeps the joke's meaning, rewriting). Every number shown to the user comes from Qloo through deterministic code.

## Layout

```
src/lib/qloo/      Qloo HTTP client: auth, rate limiting (5 req/s), retries, response cache
src/lib/audience/  audience model: cities, age mix presets, performer-derived audiences
src/lib/analysis/  extract, resolve, measure, verdict, repair, local hooks
src/lib/llm/       Claude client behind an interface (live / replay)
src/app/api/       route handlers; analysis streams progress events to the UI
src/app/           UI
```

## Data handling

- Qloo and Anthropic keys live in server-side environment variables only.
- Qloo responses are cached on the server (`.cache/`, never committed: the hackathon API terms forbid storing Qloo data in a public repository).
- Nothing about an individual is sent to Qloo. Audiences are described in aggregate (city, age mix), and results are presented as aggregate affinity, not as predictions about a person.
