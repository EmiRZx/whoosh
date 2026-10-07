"use client";

import { useMemo } from "react";
import { segmentText } from "@/lib/analysis/references";
import type { AnalyzedReference } from "@/lib/analysis/types";
import { VERDICT_LABEL } from "./labels";

interface Props {
  text: string;
  references: AnalyzedReference[];
  selectedKey?: string;
  onSelect: (key: string) => void;
}

export function ScriptView({ text, references, selectedKey, onSelect }: Props) {
  const segments = useMemo(() => segmentText(text, references), [text, references]);
  const byKey = useMemo(() => new Map(references.map((r) => [r.key, r])), [references]);

  return (
    <div className="ruled whitespace-pre-wrap font-script text-[15px] leading-8 text-ink sm:text-base">
      {segments.map((segment, i) => {
        const ref = segment.refKey ? byKey.get(segment.refKey) : undefined;
        if (!ref) return <span key={i}>{segment.text}</span>;
        return (
          <mark
            key={i}
            role="button"
            tabIndex={0}
            className="hl text-inherit"
            data-verdict={ref.verdict}
            data-selected={ref.key === selectedKey}
            aria-pressed={ref.key === selectedKey}
            aria-label={`${segment.text}: ${ref.extracted.name}, ${VERDICT_LABEL[ref.verdict]}`}
            onClick={() => onSelect(ref.key)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(ref.key);
              }
            }}
          >
            {segment.text}
          </mark>
        );
      })}
    </div>
  );
}
