"use client";

import { useEffect, useState } from "react";

interface Props {
  text: string;
  /** Total duration in ms — the reveal speed adapts to the string length
   *  so short titles still take their moment, long ones don't stall. */
  durationMs?: number;
  /** Delay before typing starts. Used to choreograph with downstream
   *  elements (e.g. the Path-to-Max ring lands ~300ms later). */
  startDelayMs?: number;
  className?: string;
  as?: keyof React.JSX.IntrinsicElements;
}

// Word-by-word reveal title. Each word fades + slides up + clears blur,
// 60-90ms apart. The whole string takes ~durationMs (700ms default). A
// blinking caret sits at the trailing edge so the page reads as 'this
// is being written for you right now', not 'a screenshot is unfolding'.
//
// Why word-by-word instead of letter-by-letter: letters at 30ms+ stagger
// take 2s+ for a short heading and read as theatrical. Words land in
// 0.7s and still give the reveal a sense of weight.
export function TypingTitle({
  text,
  durationMs = 700,
  startDelayMs = 0,
  className,
  as = "h2"
}: Props) {
  const words = text.split(/(\s+)/); // keep whitespace so the layout stays exact
  const wordCount = words.filter((w) => w.trim().length > 0).length;
  const perWord = Math.max(60, Math.min(140, durationMs / Math.max(1, wordCount)));

  const [done, setDone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDone(true), startDelayMs + durationMs + 200);
    return () => clearTimeout(t);
  }, [startDelayMs, durationMs]);

  const Tag = as;
  let realWordIndex = -1;
  return (
    <Tag className={className} aria-label={text}>
      <span aria-hidden="true">
        {words.map((token, i) => {
          if (!token.trim()) return token; // whitespace passes through
          realWordIndex += 1;
          return (
            <span
              key={i}
              className="inline-block"
              style={{
                animation: `typing-word-in 0.45s cubic-bezier(0.22, 1, 0.36, 1) both`,
                animationDelay: `${startDelayMs + realWordIndex * perWord}ms`
              }}
            >
              {token}
            </span>
          );
        })}
        {/* Caret — blinks while text is settling, fades out when done. */}
        <span
          className="inline-block align-baseline ml-1 w-[2px] bg-[var(--color-accent)]"
          style={{
            height: "0.85em",
            verticalAlign: "-0.05em",
            animation: done
              ? "typing-caret-out 0.4s ease-out both"
              : "typing-caret-blink 0.9s steps(2) infinite",
            animationDelay: done ? `${startDelayMs + durationMs}ms` : "0ms"
          }}
        />
      </span>
    </Tag>
  );
}
