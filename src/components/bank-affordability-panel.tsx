"use client";

// What this bank can finish tonight, priced at live GE rates.
//
// The prices are fetched by the BROWSER, not the server. /bank promises
// "Saved on this device only" and a pasted bank has never touched Postgres;
// routing it through an API to price it would quietly break that promise for a
// feature the player did not ask to pay for. prices.runescape.wiki serves
// CORS, so the device can do the whole thing itself.
//
// Deliberately placed above the tab preview: a player who can finish a set for
// 1.5m tonight cares about that more than about tab layout, and this is the
// only sentence on the site that no other OSRS tool can print.

import { useEffect, useState } from "react";
import {
  buildAffordabilityReport,
  formatGpExact,
  tradeableIndex,
  type AffordabilityBankItem,
  type AffordabilityReport
} from "@/lib/bank-affordability";
import { parseLatestPrices, parseWikiMapping } from "@/lib/wiki";

const LATEST_URL = "https://prices.runescape.wiki/api/v1/osrs/latest";
const MAPPING_URL = "https://prices.runescape.wiki/api/v1/osrs/mapping";

type State =
  | { kind: "loading" }
  | { kind: "ready"; report: AffordabilityReport }
  /** Prices unreachable. Says so instead of rendering an empty table that
   *  reads as "you cannot afford anything". */
  | { kind: "offline" };

export function BankAffordabilityPanel({
  items,
  /**
   * An Ironman cannot buy anything, so every column this panel was built
   * around is a lie to them.
   *
   * Shipped wrong today: the panel rendered `buyableNow` and `shortBy` — both
   * pure Grand Exchange concepts — and discarded `notForSale`, which is the
   * only list that means anything to an account that has to source its own
   * gear. It put "Buy now" against a Karil's leatherskirt and a gp headline
   * above it, which is the flagship sentence of the whole feature and the
   * single most wrong thing that account type could read.
   */
  cannotBuy = false
}: {
  items: AffordabilityBankItem[];
  cannotBuy?: boolean;
}) {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    if (items.length === 0) return;

    (async () => {
      try {
        const [latestResponse, mappingResponse] = await Promise.all([
          fetch(LATEST_URL, { headers: { accept: "application/json" } }),
          fetch(MAPPING_URL, { headers: { accept: "application/json" } })
        ]);
        if (!latestResponse.ok || !mappingResponse.ok) throw new Error("price feed");
        const latestBody = await latestResponse.json() as { data?: Record<string, Record<string, unknown>> };
        const mappingBody = await mappingResponse.json() as Array<Record<string, unknown>>;
        if (cancelled) return;
        const report = buildAffordabilityReport(
          items,
          parseLatestPrices(latestBody.data ?? {}),
          tradeableIndex(parseWikiMapping(mappingBody))
        );
        setState({ kind: "ready", report });
      } catch {
        if (!cancelled) setState({ kind: "offline" });
      }
    })();

    return () => { cancelled = true; };
  }, [items]);

  if (items.length === 0) return null;
  if (state.kind === "loading") {
    return (
      <p className="mt-4 text-[12.5px] text-[var(--color-text-muted)]">Pricing what you are missing…</p>
    );
  }
  if (state.kind === "offline") {
    return (
      <p className="mt-4 text-[12.5px] text-[var(--color-text-muted)]">
        Grand Exchange prices are not reachable right now, so nothing is costed below.
      </p>
    );
  }

  const { report } = state;
  const rows = cannotBuy
    ? report.notForSale.slice(0, 6)
    : [...report.buyableNow.slice(0, 4), ...report.shortBy.slice(0, 2)];
  if (rows.length === 0) return null;

  const best = cannotBuy ? null : report.buyableNow[0];

  return (
    <section className="mt-6" aria-labelledby="afford-heading">
      <h2
        id="afford-heading"
        className="text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--color-text-muted)]"
      >
        {cannotBuy ? "Sets you have started" : "What this bank can finish tonight"}
      </h2>

      {/* The sentence first, the table underneath. A player who reads only one
          line should get the whole answer, and the exact figure is the one
          they type into the Grand Exchange — not a rounded headline. */}
      {cannotBuy ? (
        <p className="mt-1 text-[13px] text-[var(--color-text-dim)]">
          Nothing here is for sale to you. These are the sets your bank has pieces of, and what is
          still missing.
        </p>
      ) : best ? (
        <p className="mt-1 text-[14px] leading-snug text-[var(--color-text)]">
          <span className="font-semibold tabular-nums">{formatGpExact(report.gp)}</span> banked.{" "}
          {best.missing.length === 1
            ? best.missing[0].name
            : `${best.missing.length} pieces of ${best.setName}`}{" "}
          — <span className="font-semibold tabular-nums">{formatGpExact(best.cost ?? 0)}</span>. That
          finishes {best.setName}.
        </p>
      ) : (
        <p className="mt-1 text-[13px] text-[var(--color-text-dim)]">
          <span className="tabular-nums">{formatGpExact(report.gp)}</span> banked — not enough to close
          any set you have started.
        </p>
      )}

      <div className="scape-table-wrap mt-3">
        <table className="scape-table" aria-label="Sets you could finish by buying the missing pieces">
          <thead>
            <tr>
              <th scope="col">Set</th>
              <th scope="col">Missing</th>
              {!cannotBuy && <th scope="col" data-num>Cost</th>}
              {!cannotBuy && <th scope="col">Verdict</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.setId}>
                <th scope="row" className="whitespace-nowrap">
                  {row.setName}{" "}
                  <span className="font-normal tabular-nums text-[var(--color-text-muted)]">
                    {row.owned}/{row.total}
                  </span>
                </th>
                <td className="w-full max-w-0 truncate">
                  {row.missing.map((piece) => piece.name).join(", ")}
                </td>
                {!cannotBuy && <td data-num>{formatGpExact(row.cost ?? 0)}</td>}
                {!cannotBuy && (
                  <td>
                    <span className="scape-verdict" data-gate={row.affordable ? "ready" : "test"}>
                      {row.affordable
                        ? "Buy now"
                        : `Short ${formatGpExact(-(row.remainingGp ?? 0))}`}
                    </span>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="scape-table-note mt-2">
        {cannotBuy
          ? "Prices are not shown for an Ironman bank. Sourcing is the whole game and a gp figure is not an answer."
          : "Live Grand Exchange prices, insta-buy side. Only pieces you do not already have are costed. "
            + "Sets that need something untradeable are left out — money will not finish those."}
      </p>
    </section>
  );
}
