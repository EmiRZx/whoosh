"use client";

import Image from "next/image";
import { useState } from "react";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter((w) => /^[\p{L}\p{N}]/u.test(w))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");

// Qloo's picture for an entity, or its initials when there isn't one.
export function EntityThumb({ src, name, className = "size-12" }: { src?: string; name: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className={`relative grid shrink-0 place-items-center overflow-hidden rounded-xl bg-sunk ring-1 ring-line ${className}`}>
      {src && !failed ? (
        <Image src={src} alt="" fill sizes="64px" unoptimized className="object-cover" onError={() => setFailed(true)} />
      ) : (
        <span className="text-sm font-semibold text-ink-soft" aria-hidden>
          {initials(name)}
        </span>
      )}
    </span>
  );
}
