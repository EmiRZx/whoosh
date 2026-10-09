// Recorded candidate choices for the example scripts' ambiguous references,
// made by the matching prompt (src/lib/analysis/choose.ts). Stored by name and
// type, not by Qloo data, and applied to live search results at runtime.
export interface RecordedPick {
  name: string;
  type: string;
  standIn?: string;
}

export const RECORDED_PICKS: Record<string, Record<string, RecordedPick | null>> = {
  "01-dating-set": {
    Blockbuster: { name: "Blockbuster", type: "urn:entity:place", standIn: "The last remaining Blockbuster store, in Bend, Oregon" },
    "Tower Records": null,
    Tupperware: { name: "Tupperware Brands", type: "urn:entity:brand" },
  },
  "02-keynote": {
    "Microsoft Office": { name: "Microsoft365", type: "urn:entity:brand", standIn: "Microsoft 365, the renamed successor to Microsoft Office" },
    Apple: { name: "Apple Inc", type: "urn:entity:brand" },
  },
  "03-best-man": {
    YMCA: null,
  },
  "04-lecture": {
    "Ask Jeeves": null,
    TRL: { name: "Total Request Live", type: "urn:entity:tv_show" },
    Canvas: null,
    ChatGPT: null,
  },
};
