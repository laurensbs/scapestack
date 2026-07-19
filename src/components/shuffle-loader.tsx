"use client";

import { Route } from "lucide-react";

interface ShuffleLoaderProps {
  label?: string;
}

export function ShuffleLoader({ label = "Building your next trip…" }: ShuffleLoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
      className="mx-auto flex min-h-[220px] w-full max-w-xl flex-col items-center justify-center px-5 py-10 text-center"
    >
      <div className="relative grid size-16 place-items-center rounded-full border border-[var(--color-accent)]/35 bg-[var(--color-accent)]/8 text-[var(--color-accent)]">
        <span className="absolute inset-[-5px] animate-spin rounded-full border border-transparent border-t-[var(--color-accent)]/75" />
        <Route className="size-7" strokeWidth={1.7} />
      </div>
      <div className="mt-5 text-[12px] font-bold uppercase tracking-[0.18em] text-[var(--color-accent)]">
        {label}
      </div>
      <p className="mt-2 text-[13px] font-medium text-[var(--color-text-muted)]">
        One clear pick is next.
      </p>
    </div>
  );
}
