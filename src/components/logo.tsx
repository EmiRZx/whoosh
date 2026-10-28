// Whoosh's mark: a glowing dot going past, with its trail.
export function LogoMark({ className = "h-3.5 w-7" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 28 14"
      className={`shrink-0 text-accent-glow drop-shadow-[0_0_6px_color-mix(in_srgb,var(--accent-glow)_60%,transparent)] ${className}`}
      aria-hidden
    >
      <path d="M2 4h10M6 7h8M3 10h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity="0.5" />
      <circle cx="21" cy="7" r="4.6" fill="currentColor" />
    </svg>
  );
}
