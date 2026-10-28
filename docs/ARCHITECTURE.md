# How Whoosh is put together

Whoosh takes a script and a room, and returns every name the script leans on with a call for that room (and for each city on the tour), the Qloo numbers behind the call, and stand-ins for the names that would miss. Claude handles language. Qloo supplies every number. Plain code sits between them and makes the calls.

## The pipeline

```
script + room (a preset age mix or a performer's fans) + cities
   │
   ▼
1. Read       Claude (structured output) lists each name: the words that carry it,
              its kind, the job it does in the line, and how much the line leans on
              it (punchline, setup, color). Songs become artists, catchphrases and
              characters become shows, teams become brands. Events, eras and
              politicians are listed but left unmeasured.
2. Pin        Qloo /search in the expected kind, then fallback kinds. An exact name
              in the expected kind is taken; anything else goes back to Claude with
              the candidates, and Claude picks one, accepts a stand-in it can name,
              or declines. Qloo's own tags catch politicians the reading missed.
3. Measure    per entity, no model involved:
                presence      popularity percentile within its kind
                room index    Qloo's age-group index (urn:demographics), weighted by
                              the room's age mix
                cities        one urn:heatmap request over small boxes on the tour
                              cities plus 24 big US metros; heatmap values only mean
                              something within one response, so cities are ranked
4. Call       presence tier × room index → lands / risky / won't land, then one
              step up in a city's top three and one step down in its bottom four
              (household names excepted). Thresholds were set by measuring the
              examples' references in five rooms.
5. Stand-ins  a Claude tool loop per weak name (worst call anywhere on the tour):
                find_candidates  similar entities this room's main age group likes,
                                 and, for a performer's room, that their fans like
                lookup           a specific idea, by name
                find_tags        genre and descriptor tags to narrow the search
                check            the same measurement and call as step 3, plus
                                 whether it clearly beats the original here
                submit_swaps     up to three that beat it, each with the rewritten
                                 line; a validator rejects anything unchecked,
                                 anything that doesn't beat the original, and
                                 rewrites that drop the stand-in's name
              From the tenth turn (or late in the time budget) searches stop and
              the agent is told to submit what it has checked.
6. Local      places and artists this room's crowd favors in each city, against
              the national baseline
```

Claude also makes a blind call on every name before any Qloo data comes back. The page shows it next to Qloo's, so it's visible where the two disagree.

## Where it runs

- The site, `/api/analyze` and `/api/swap` run on Vercel. An analysis streams its progress as NDJSON. Live stand-in searches run as separate requests, one per name, so each gets the host's full time limit.
- `/api/mcp` serves the same pipeline to agents over Streamable HTTP.
- The Google Docs sidebar is a page of the site (`/addon`) framed by an Apps Script sidebar, which relays a handful of document operations over `postMessage` and only to the expected origins.
- The examples replay recorded model output (`src/content/extractions/`, written by `scripts/record-example.ts`) and measure everything again on Qloo, so they cost no model calls and always show current numbers.

## Code map

```
src/lib/qloo/      HTTP client: auth, pacing under Qloo's rate limit, retries, a two-tier cache (memory + Redis)
src/lib/audience/  preset rooms, rooms made of a performer's fans, age-mix math
src/lib/analysis/  read, pin, measure, call, stand-in agent and tools, local hooks, the run itself
src/lib/llm/       Claude client settings, structured output with a lenient fallback
src/lib/ui/        tracked changes, room score, city tables, notes export, Docs operations
src/app/api/       route handlers
src/components/    the interface
```

## Data handling

- The Qloo and Anthropic keys stay in server-side environment variables.
- Qloo responses are kept in a server-side cache and never committed; the hackathon terms don't allow Qloo data in a public repository. The examples' recordings hold names and model output only.
- Nothing about an individual goes to Qloo. A room is a set of cities and an age mix (or a performer whose fans it is), and every result describes a crowd, not a person.
