# Whoosh

**A cultural reference check for anything you say out loud.**

Bring a stand-up set, a speech, a wedding toast or a lecture, choose the room (a college crowd in Birmingham, a corporate offsite in San Francisco), and Whoosh tells you which of your references that audience will actually get. It's built on [Qloo](https://qloo.com)'s taste graph for the Qloo Agentic Hackathon.

> Status: in active development. Reference extraction, the UI, city lookup and the MCP server work today; the Qloo-backed verdicts and the swap agent are being built now.

## Why

Every comedian, speaker and teacher has watched a reference die in front of a room. Comics research each city before a show; universities publish lists of what incoming students have never heard of so professors stop making dated jokes. A language model can tell you what a reference *is*, but not whether 19-year-olds in Alabama care about it, whether it's fading, or what would do the same job for that crowd. That takes taste data.

## How it works

1. **Find every reference.** An agent reads the script and returns each movie, show, artist, public figure, brand, place and game it mentions, mapped to the entity a taste graph holds (a song becomes its artist, a character becomes its show), with the exact words to highlight and the job the reference does in its line.
2. **Ask the taste graph.** For each reference, Qloo signals describe the room: how widely it's known, how each age group in the room over- or under-indexes on it, how it plays in each city on the tour, and whether it's rising or fading.
3. **Fix what won't land.** For weak references, an agent searches Qloo for substitutes that do the same job for this audience, checks them with the same signals, and rewrites the line.

The language model handles language: reading the script, choosing between candidates, judging whether a swap keeps the joke. Every number comes from Qloo through deterministic code. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Use it from an agent (MCP)

The same pipeline is exposed as an MCP server over Streamable HTTP at `/api/mcp`, with two tools:

- `check_script` takes `text`, `room` and optional `cities`, and returns every reference with its role, verdict, reasons and swaps.
- `list_rooms` lists the audience presets and their age mixes.

```json
{ "mcpServers": { "whoosh": { "url": "https://<your-deployment>/api/mcp" } } }
```

For stdio-only clients, wrap it with `npx -y mcp-remote https://<your-deployment>/api/mcp`.

## Run it locally

Requires Node.js 20+.

```bash
npm install
cp .env.example .env.local   # add your keys; the built-in examples run without them
npm run dev                  # http://localhost:3000
```

| Variable | Purpose |
|---|---|
| `QLOO_API_KEY` | Qloo hackathon key. Only valid on `https://hackathon.api.qloo.com`. |
| `ANTHROPIC_API_KEY` | Claude key for analyzing your own scripts. The built-in examples replay a recorded extraction and don't need it. |

Keys stay on the server; nothing is sent to the browser.

```bash
npm test             # unit tests
npm run typecheck
npx tsx evals/extraction/score.ts <run-dir>   # score reference extraction against the gold set
```

## Project layout

```
src/app/            UI and route handlers (/api/analyze, /api/cities, /api/mcp)
src/components/     UI components
src/lib/analysis/   extraction, reference spans, the analysis pipeline
src/lib/audience/   room presets and the age-mix math
src/lib/qloo/       Qloo client: rate limiting, retries, caching, response normalization
src/lib/geo/        city lookup
src/content/        example scripts, their recorded extractions, city data
evals/extraction/   gold annotations and scorer for reference extraction
scripts/            data build scripts
```

## Data and privacy

- Qloo results describe aggregate audiences. Whoosh never sends anything about an individual to Qloo, and presents results as audience-level affinity, not predictions about a person.
- Qloo responses are cached on the server only and never committed (`.cache/` is git-ignored).
- City data comes from [GeoNames](https://www.geonames.org), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), via `scripts/build_cities.py`.
- The example scripts are original writing for this project.

## License

[MIT](LICENSE)
