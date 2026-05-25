"use client";

import { useEffect, useState } from "react";

// The hero subhead names three things /next does: goal-progress,
// boss-readiness, drop-chance maths. After the boss-arena pulls the
// reader's eye to the right, this cycle pulls it back to the copy.
// One phrase gets a gold underline at a time, 2.4s per phrase. CSS-
// only animation; React only handles the index rotation.
const PHRASES = ["Goals you're close to", "bosses your stats support", "drops you're statistically due"];

export function HeroSubhead() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % PHRASES.length), 2400);
    return () => clearInterval(t);
  }, []);

  return (
    <p
      className="mt-6 text-[16px] sm:text-[17px] text-[var(--color-text-dim)] max-w-xl leading-relaxed"
      style={{ animation: "hero-fade 0.7s cubic-bezier(0.22,1,0.36,1) 0.32s both" }}
    >
      <span className="text-[var(--color-text)] font-medium">
        One page that looks at your account and tells you what&apos;s worth doing next.
      </span>{" "}
      {PHRASES.map((phrase, i) => (
        <span key={phrase} className="relative inline">
          <span
            className={
              i === idx
                ? "transition-colors duration-500 text-[var(--color-text)]"
                : "transition-colors duration-500"
            }
          >
            {phrase}
          </span>
          {/* Gold underline appears under the active phrase, slides in
              from left to right via background-size keyframe. */}
          {i === idx && (
            <span
              aria-hidden="true"
              className="absolute left-0 right-0 -bottom-0.5 h-[2px] bg-[var(--color-accent)] origin-left"
              style={{ animation: "hero-underline-sweep 0.6s cubic-bezier(0.22, 1, 0.36, 1) both" }}
            />
          )}
          {i < PHRASES.length - 1 ? ", " : ". "}
        </span>
      ))}
      Free, no account, no plugin.
    </p>
  );
}
