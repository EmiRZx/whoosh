import { Check, LoaderCircle, Minus, TriangleAlert, X, type LucideIcon } from "lucide-react";
import type { Verdict } from "@/lib/analysis/types";
import { VERDICT_LABEL } from "./labels";

// Status colors always travel with an icon and a label, never alone.
const ICON: Record<Verdict, LucideIcon> = { lands: Check, risky: TriangleAlert, dead: X, unchecked: Minus };

const CHIP: Record<Verdict, string> = {
  lands: "bg-lands-tint text-lands-ink",
  risky: "bg-risky-tint text-risky-ink",
  dead: "bg-dead-tint text-dead-ink",
  unchecked: "bg-sunk text-quiet-ink",
};

const MARK: Record<Verdict, string> = {
  lands: "text-lands",
  risky: "text-risky",
  dead: "text-dead",
  unchecked: "text-quiet",
};

export function VerdictIcon({ verdict, pending, className = "size-3.5" }: { verdict: Verdict; pending?: boolean; className?: string }) {
  if (pending) return <LoaderCircle className={`${className} animate-spin text-ink-faint`} aria-hidden />;
  const Icon = ICON[verdict];
  return <Icon className={`${className} ${MARK[verdict]}`} strokeWidth={2.75} aria-hidden />;
}

export function VerdictChip({ verdict, pending, className = "" }: { verdict: Verdict; pending?: boolean; className?: string }) {
  const Icon = pending ? LoaderCircle : ICON[verdict];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
        pending ? "bg-sunk text-ink-soft" : CHIP[verdict]
      } ${className}`}
    >
      <Icon className={`size-3 ${pending ? "animate-spin" : ""}`} strokeWidth={2.75} aria-hidden />
      {pending ? "Checking" : VERDICT_LABEL[verdict]}
    </span>
  );
}
