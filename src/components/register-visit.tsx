"use client";

import { useEffect, useRef } from "react";

/**
 * Tells the server this player was looked at today. Renders nothing.
 *
 * It renders nothing on purpose: /p/[rsn] holds three sections and a
 * one-line header, and that budget is enforced by
 * tests/e2e/page-budget.spec.ts. This adds no pixels to it.
 *
 * Why the client rather than the page's own render: the write costs a database
 * round trip, and paying it during render means every visitor waits on it for a
 * number only Scapestack reads. A crawler that never runs this script also
 * never enters the return metric, which is the correct answer for a metric
 * about whether people come back.
 */
export function RegisterVisit({ rsn }: { rsn: string }) {
  const sent = useRef<string | null>(null);

  useEffect(() => {
    if (!rsn) return;
    // React runs effects twice in development's strict mode, and a route change
    // between two player pages remounts this. Guarding on the name rather than
    // on a bare boolean keeps the second player's visit from being swallowed.
    if (sent.current === rsn) return;
    sent.current = rsn;

    // Fire and forget. A failed ping is a hole in a metric; it is never worth a
    // retry loop, a spinner, or a word to the player.
    void fetch("/api/account/visit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rsn }),
      keepalive: true
    }).catch(() => undefined);
  }, [rsn]);

  return null;
}
