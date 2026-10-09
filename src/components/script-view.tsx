"use client";

import type { AnalyzedReference } from "@/lib/analysis/types";
import type { Piece } from "@/lib/ui/document";
import { VERDICT_LABEL } from "./labels";

interface Props {
  pieces: Piece[];
  references: Map<string, AnalyzedReference>;
  selectedKey?: string;
  onSelect: (key: string) => void;
  showChanges: boolean;
}

const activate = (onSelect: () => void) => ({
  role: "button" as const,
  tabIndex: 0,
  onClick: onSelect,
  onKeyDown: (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect();
    }
  },
});

// The script set like a page, with each reference highlighted by verdict and
// accepted swaps shown as tracked changes.
export function ScriptView({ pieces, references, selectedKey, onSelect, showChanges }: Props) {
  return (
    <div className="whitespace-pre-wrap font-serif text-[17px] leading-[1.85] text-ink sm:text-[18.5px]">
      {pieces.map((piece, i) => {
        if (piece.kind === "del") {
          return showChanges ? (
            <del key={i} className="swap-del">
              {piece.text}
            </del>
          ) : null;
        }
        if (piece.kind === "ins") {
          const owner = references.get(piece.editKey);
          return (
            <ins
              key={i}
              className="swap-ins"
              data-selected={piece.editKey === selectedKey}
              aria-label={`${piece.text}: your swap for ${owner?.extracted.name ?? "a reference"}`}
              {...activate(() => onSelect(piece.editKey))}
            >
              {piece.text}
            </ins>
          );
        }
        const ref = piece.refKey ? references.get(piece.refKey) : undefined;
        if (!ref) return <span key={i}>{piece.text}</span>;
        const pending = ref.resolution.status === "pending";
        return (
          <mark
            key={i}
            className="ref"
            data-verdict={ref.verdict}
            data-pending={pending}
            data-selected={ref.key === selectedKey}
            aria-pressed={ref.key === selectedKey}
            aria-label={`${piece.text}: ${ref.extracted.name}, ${pending ? "checking" : VERDICT_LABEL[ref.verdict]}`}
            {...activate(() => onSelect(ref.key))}
          >
            {piece.text}
          </mark>
        );
      })}
    </div>
  );
}
