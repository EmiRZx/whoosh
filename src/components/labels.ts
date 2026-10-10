import type { ExtractedReference } from "@/lib/analysis/extract";
import type { Verdict } from "@/lib/analysis/types";

export const VERDICT_LABEL: Record<Verdict, string> = {
  lands: "Lands",
  risky: "Risky",
  dead: "Won't land",
  unchecked: "Not measured",
};

export const KIND_LABEL: Record<ExtractedReference["kind"], string> = {
  movie: "Movie",
  tv_show: "TV show",
  artist: "Music",
  person: "Public figure",
  brand: "Brand",
  book: "Book",
  video_game: "Video game",
  podcast: "Podcast",
  place: "Place",
  destination: "Destination",
  other: "Event or trend",
};

export const WEIGHT_LABEL: Record<ExtractedReference["weight"], string> = {
  punchline: "Punchline",
  setup: "Setup",
  color: "Aside",
};

export const AGE_LABELS = ["24 and under", "25–29", "30–34", "35–44", "45–54", "55+"];
export const AGE_SHORT = ["≤24", "25–29", "30–34", "35–44", "45–54", "55+"];

export const signed = (x: number) => {
  const n = Math.round(Math.abs(x) * 100);
  return n === 0 ? "0%" : `${x > 0 ? "+" : "−"}${n}%`;
};

export const shortCity = (name: string) => name.split(",")[0];
