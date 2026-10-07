import { z } from "zod";

export const REFERENCE_KINDS = [
  "movie",
  "tv_show",
  "artist",
  "person",
  "brand",
  "book",
  "video_game",
  "podcast",
  "place",
  "destination",
  "other",
] as const;

export const ExtractedReferenceSchema = z.object({
  name: z.string().describe("Canonical name to look up, e.g. 'Friends', 'Taylor Swift', 'Olive Garden'"),
  kind: z.enum(REFERENCE_KINDS),
  disambiguation: z
    .string()
    .nullable()
    .describe("A few words that pick the right entity when the name is ambiguous, else null"),
  quotes: z.array(z.string()).describe("Every exact span of the text that refers to this entity"),
  role: z.string().describe("The job the reference does in the line, phrased so a substitute could do the same job"),
  weight: z.enum(["punchline", "setup", "color"]),
  checkable: z.boolean().describe("false for events, memes, eras and trends a taste graph cannot represent"),
});

export const ExtractionSchema = z.object({
  references: z.array(ExtractedReferenceSchema),
});

export type ExtractedReference = z.infer<typeof ExtractedReferenceSchema>;
export type Extraction = z.infer<typeof ExtractionSchema>;

export const EXTRACT_SYSTEM_PROMPT = `You find the cultural references in writing that someone will say out loud to an audience: a stand-up set, a speech, a wedding toast, a lecture, a pitch, ad copy. A downstream system looks each reference up in Qloo's taste graph to measure whether a specific audience will recognize and enjoy it, then suggests replacements for the ones that won't land. Your list decides what gets checked, so be complete about real references and strict about everything else.

A reference is a named piece of culture the audience is expected to recognize: a movie, TV show, musician or band, public figure, brand, product, app, restaurant or store chain, book or author, video game, podcast, a specific venue or landmark, or a city, neighborhood or destination invoked for what it connotes.

Map each reference to the entity a taste graph would hold:
- a song or album -> its artist
- a character, catchphrase or scene -> its show or film
- a product, slogan or mascot -> its brand
- a fandom name ("Swiftie") -> the artist or show
- a description that clearly points to one entity ("the guy who sang Never Gonna Give You Up") -> that entity
If one entity is referenced several times, return it once with every quote.

Not references: private people (friends, family, the couple, a teacher, anyone named only by first name or as Mr./Mrs. Somebody), generic nouns (podcast, QR code, casino, radio station), concepts and topics, and places that are only logistics rather than meaning.

Events, memes, eras, holidays, sports leagues used generically and trends (Y2K, the ice bucket challenge, fantasy football) are references a listener must recognize, but a taste graph can't represent them. Include them with kind "other" and checkable false. Everything else gets checkable true.

Fields:
- name: the canonical name you would type into a search box. For a song, the artist's name, not the song title.
- kind: movie, tv_show, artist (musicians and bands), person (any other public figure), brand (companies, products, apps, chains, franchises), book (books and authors), video_game, podcast, place (a specific venue, restaurant location or landmark), destination (a city, neighborhood, region or country), other.
- disambiguation: when the name alone is ambiguous, a few words that pick the right entity ("US sitcom 2005-2013", "learning management software"); otherwise null.
- quotes: each span copied from the text exactly, character for character, so it can be highlighted. Keep spans tight: the words that carry the reference, not the whole sentence.
- role: the job the reference does in this line, phrased so someone could choose a substitute that does the same job. Describe the job, not the entity: "a shorthand for 90s TV romance", "a cheap chain restaurant that signals comfort over sophistication", "a dated device that dates the speaker".
- weight: punchline if the joke or point depends on the audience getting it, setup if it frames a punchline, color if it is decoration.`;

export interface QuoteSpan {
  quote: string;
  start: number;
  end: number;
}

// Finds where each quote sits in the text so the UI can highlight it. Models
// sometimes normalize whitespace or curly quotes, so fall back to a looser
// match before giving up.
export function locateQuotes(text: string, quotes: string[]): { spans: QuoteSpan[]; missing: string[] } {
  const spans: QuoteSpan[] = [];
  const missing: string[] = [];
  const taken = new Set<number>();
  const fold = (s: string) => s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').toLowerCase();
  const folded = fold(text);

  for (const quote of quotes) {
    const needle = quote.trim();
    if (!needle) continue;
    let start = -1;
    // Repeated quotes ("Ross" twice) should land on successive occurrences.
    for (const [haystack, target] of [
      [text, needle],
      [folded, fold(needle)],
    ]) {
      let from = 0;
      for (;;) {
        const i = haystack.indexOf(target, from);
        if (i < 0) break;
        if (!taken.has(i)) {
          start = i;
          break;
        }
        from = i + 1;
      }
      if (start >= 0) break;
    }
    if (start < 0) {
      const pattern = needle
        .split(/\s+/)
        .map((w) => fold(w).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join("\\s+");
      const m = new RegExp(pattern).exec(folded);
      if (m && !taken.has(m.index)) {
        spans.push({ quote: text.slice(m.index, m.index + m[0].length), start: m.index, end: m.index + m[0].length });
        taken.add(m.index);
        continue;
      }
      missing.push(quote);
      continue;
    }
    taken.add(start);
    spans.push({ quote: text.slice(start, start + needle.length), start, end: start + needle.length });
  }
  return { spans: spans.sort((a, b) => a.start - b.start), missing };
}
