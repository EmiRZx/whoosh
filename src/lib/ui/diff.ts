// A word-level diff between a line and its rewrite, so a swap can be shown as
// tracked changes and applied to the script without touching anything else.

export interface DiffPart {
  kind: "same" | "del" | "ins";
  text: string;
}

// Words keep inner apostrophes, hyphens and dots (O'Donnell, Wi-Fi, U.S.);
// whitespace and punctuation are tokens of their own.
const TOKEN = /\s+|[\p{L}\p{N}]+(?:['’.\-][\p{L}\p{N}]+)*|[^\s\p{L}\p{N}]/gu;

export function tokenize(s: string): string[] {
  return s.match(TOKEN) ?? [];
}

// Below this share of unchanged text the rewrite is treated as a new line
// rather than an edit: a diff of two different sentences is noise.
const MIN_SHARED = 0.4;

export function diffWords(a: string, b: string): DiffPart[] {
  const x = tokenize(a);
  const y = tokenize(b);
  const n = x.length;
  const m = y.length;
  // Longest common subsequence, filled from the end so the walk below can go forward.
  const lcs = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = x[i] === y[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const raw: DiffPart[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (x[i] === y[j]) {
      raw.push({ kind: "same", text: x[i++] });
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      raw.push({ kind: "del", text: x[i++] });
    } else {
      raw.push({ kind: "ins", text: y[j++] });
    }
  }
  while (i < n) raw.push({ kind: "del", text: x[i++] });
  while (j < m) raw.push({ kind: "ins", text: y[j++] });

  const parts = tidy(raw);
  const shared = parts.filter((p) => p.kind === "same" && p.text.trim()).reduce((sum, p) => sum + p.text.length, 0);
  if (a.length > 0 && shared / a.length < MIN_SHARED) {
    return [
      { kind: "del", text: a },
      { kind: "ins", text: b },
    ];
  }
  return parts;
}

type Run = { same: true; text: string } | { same: false; del: string; ins: string };

// A gap this small between two changes reads better as part of one change:
// "CBS This Morning" -> "Good Morning America", not three edits around "Morning".
const SHORT_GAP = /^\s*(?:[\p{L}\p{N}'’\-]{1,12}\s*)?$/u;

// Groups each run of changes into one deletion followed by one insertion, and
// folds short gaps between changes into them, so "Norah O'Donnell" becomes
// "George Stephanopoulos" in one piece rather than word by word.
function tidy(raw: DiffPart[]): DiffPart[] {
  const runs: Run[] = [];
  for (const part of raw) {
    const last = runs.at(-1);
    if (part.kind === "same") {
      if (last?.same) last.text += part.text;
      else runs.push({ same: true, text: part.text });
    } else if (last && !last.same) {
      last[part.kind] += part.text;
    } else {
      runs.push({ same: false, del: part.kind === "del" ? part.text : "", ins: part.kind === "ins" ? part.text : "" });
    }
  }

  const folded: Run[] = [];
  for (let k = 0; k < runs.length; k++) {
    const run = runs[k];
    const prev = folded.at(-1);
    const next = runs[k + 1];
    if (run.same && prev && !prev.same && next && !next.same && SHORT_GAP.test(run.text)) {
      prev.del += run.text + next.del;
      prev.ins += run.text + next.ins;
      k++;
      continue;
    }
    folded.push({ ...run });
  }

  return folded.flatMap((run): DiffPart[] => {
    if (run.same) return [{ kind: "same", text: run.text }];
    const out: DiffPart[] = [];
    if (run.del) out.push({ kind: "del", text: run.del });
    if (run.ins) out.push({ kind: "ins", text: run.ins });
    return out;
  });
}
