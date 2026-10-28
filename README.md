# Whoosh

**A cultural reference check for anything you say out loud.**

Bring a stand-up set, a speech, a wedding toast or a lecture, choose the room (a college crowd in Birmingham, a corporate offsite in San Francisco, or the fans of the comic you're opening for), and Whoosh tells you which of your references that audience will actually get, and which will fly over their heads. It's built on [Qloo](https://qloo.com)'s taste graph for the Qloo Agentic Hackathon.

**Live:** https://whoosh-check.vercel.app · the site opens on a real check of an example script.

## Why

Every comedian, speaker and teacher has watched a reference die in front of a room. Comics research each city before a show; universities publish lists of what incoming students have never heard of so professors stop making dated jokes. A language model can tell you what a reference *is*, but not whether 19-year-olds in Alabama care about it, whether it's fading, whether it's a local thing in Atlanta and a blank in St. Louis, or what would do the same job for that crowd. That takes taste data.

## How it works

1. **Find every reference.** An agent reads the script and returns each movie, show, artist, public figure, brand, team, place and game it mentions, mapped to the entity a taste graph holds (a song becomes its artist, a character or catchphrase becomes its show, "Central Perk" becomes *Friends*), with the exact words to highlight and the job the reference does in its line.
2. **Ask the taste graph.** Each reference is matched to its Qloo entity (exact matches automatically; look-alikes such as a restaurant called "Canvas" go to the model, which may decline rather than measure the wrong thing). Then Qloo describes the room: how present the reference is in culture today, how each age group in the room over- or under-indexes on it, and where each city on the tour ranks among two dozen big metros.
3. **Call it, city by city.** Deterministic rules turn those signals into a verdict. Qloo's age index measures how much a group *likes* something, not whether it has heard of it, so a household name the room is cool on is "risky" (they'll get it, it isn't theirs) and "won't land" is kept for faded or niche references the room doesn't care about. In a city's top three a reference plays one step better there; near the bottom, one step worse, so Waffle House lands in Atlanta and a regional chain from the other coast doesn't.
4. **Fix what won't land.** For weak references, an agent searches Qloo with its own tools for substitutes that do the same job for this audience, checks each one with the same signals, and rewrites the line. It keeps a reference when the joke is that the room won't know it, and it never changes a fact.

The language model handles language: reading the script, choosing between candidates, judging whether a swap keeps the joke. Every number comes from Qloo through deterministic code. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## What you get

- **The script, marked up.** Every reference is highlighted by verdict (lands, risky, won't land, not measured), each with an icon and a label, and a mark on the ones with a swap ready. Click one for the details.
- **Swaps you can use.** Substitutes that do the same job and beat the original for this room, first thing in the details. Accept one and the line is rewritten in place as a tracked change, and the room score updates.
- **Why, in numbers.** How much this room likes it compared with the average adult, how present it is in culture today, how each age group feels about it, and where it ranks in each tour city.
- **Any performer's crowd as the room.** Pick a comedian, musician, show or podcast and the room becomes their fans: Qloo's age profile for that audience sets the mix, their taste steers the swap search and the local hooks, and the cities where their fans are concentrated are suggested for the tour.
- **A tour.** Read the script for each city on the tour, see every reference against every city, and the city where the set plays best.
- **Local hooks.** Places and artists that this crowd likes in each city.
- **Gut vs. data.** Before seeing any numbers, the model makes its own call on each reference; the page shows where it and Qloo disagree.
- **Notes to take away.** Copy the revised script, copy the notes as Markdown, or print them to PDF.

Light and dark themes; it works on a phone.

## Use it from an agent (MCP)

The same pipeline is an MCP server over Streamable HTTP at `/api/mcp`:

| Tool | What it does |
|---|---|
| `check_script` | Every reference in a script, judged for a room and each of its cities, with the room score. Fast by default; `find_swaps: true` also searches for substitutes. |
| `compare_rooms` | Reads a script once and checks it against up to four rooms at once, naming the references they disagree on. |
| `find_swaps` | Runs the swap agent for one reference: substitutes that do the same job, checked and written into the line. |
| `score_reference` | One name for one room, no script: presence, room index, city ranks, verdict. No model involved. |
| `fans_of` | A performer's fans as Qloo measures them: age mix and the cities where they're concentrated. |
| `crowd_hooks` | Local places and artists a crowd favors in one city. |
| `list_rooms` | The preset rooms and their age mixes. |

```bash
claude mcp add --transport http whoosh https://whoosh-check.vercel.app/api/mcp
```

```json
{ "mcpServers": { "whoosh": { "url": "https://whoosh-check.vercel.app/api/mcp" } } }
```

For stdio-only clients, wrap it with `npx -y mcp-remote https://whoosh-check.vercel.app/api/mcp`.

## Use it in Google Docs

A Google Docs sidebar ([`addons/google-docs`](addons/google-docs)) checks the script where it's written: it marks each reference in the document with its verdict, jumps to a reference when you click it, and puts the swap you pick into the document. It runs as a script bound to a document, so a copy of a document that carries it is all anyone needs: [make a copy of the template](https://docs.google.com/document/d/1OQeF2oHjghGVVpGxqt1NRmLSRXUbn5_6-zBSXhIcIYE/copy), then choose **Whoosh → Check this room**. The folder's README has the setup for your own document.

## Run it locally

Requires Node.js 20+.

```bash
npm install
cp .env.example .env.local   # add your keys; the built-in examples run without a model key
npm run dev                  # http://localhost:3000
```

| Variable | Purpose |
|---|---|
| `QLOO_API_KEY` | Qloo hackathon key. Only valid on `https://hackathon.api.qloo.com`. |
| `ANTHROPIC_API_KEY` | Claude key for analyzing your own scripts. The built-in examples replay recorded model output and don't need it. |
| `ANTHROPIC_BASE_URL` | Optional: an Anthropic-compatible endpoint instead of the Claude API. |
| `LLM_MODEL` | Optional: the model for every agent step. Defaults to `claude-opus-5-5`. |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Optional: a Redis REST store (Upstash). Makes the Qloo response cache shared and durable, and backs the rate limits. |
| `LIVE_PER_IP_PER_HOUR`, `LIVE_PER_DAY` | Optional: limits on live analyses (defaults 8 and 150). The examples are never limited. |

Keys stay on the server; nothing is sent to the browser.

```bash
npm test             # unit tests
npm run typecheck
npx tsx evals/extraction/run.ts <run-dir> [effort]   # run live extraction on the gold-set texts
npx tsx evals/extraction/score.ts <run-dir>          # score it against the gold set
npx tsx --env-file=.env.local evals/gut/compare.ts   # how often the model's gut call matches Qloo
npx tsx scripts/record-example.ts <sample-id>        # record an example's model output so it replays
```

## Project layout

```
src/app/            UI, the Google Docs panel (/addon) and route handlers (/api/analyze, /api/swap, /api/cities, /api/mcp)
src/components/     UI components
src/lib/analysis/   extraction, reference spans, the analysis pipeline, the swap agent and its tools
src/lib/ui/         applying swaps to the script, the room score, city tables, exported notes
src/lib/audience/   room presets, performers' fans and the age-mix math
src/lib/qloo/       Qloo client: rate limiting, retries, caching, response normalization
src/lib/geo/        city lookup
src/content/        example scripts, their recorded model output, city data
evals/              gold annotations and scorers for extraction, gut calls, real-world scripts
scripts/            data build and recording scripts
addons/google-docs/ the Google Docs sidebar (Apps Script)
```

## Data and privacy

- Qloo results describe aggregate audiences. Whoosh never sends anything about an individual to Qloo, and presents results as audience-level affinity, not predictions about a person.
- Qloo responses are cached on the server only and never committed (`.cache/` is git-ignored). The examples' recordings hold model output and names, not Qloo data; they're measured again on every run.
- City data comes from [GeoNames](https://www.geonames.org), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), via `scripts/build_cities.py`.
- Examples 01–04 and 07 are original writing for this project. Example 05 is an excerpt of a President's public remarks (a U.S. Government work, in the public domain). Example 06 is a set of anonymous one-liners that circulate freely online.

## License

[MIT](LICENSE)
