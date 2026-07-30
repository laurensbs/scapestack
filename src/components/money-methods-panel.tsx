import { moneyMethodCountLine, type MoneyMethodFilterReport } from "@/lib/money-methods";
import { formatGp } from "@/lib/utils";

function wikiMethodUrl(page: string): string {
  const path = page.split("/").map((part) => encodeURIComponent(part.replace(/ /g, "_"))).join("/");
  return `https://oldschool.runescape.wiki/w/${path}`;
}

export function MoneyMethodsPanel({
  report,
  cannotBuy = false
}: {
  report: MoneyMethodFilterReport | null;
  /** Shared with BankAffordabilityPanel. True means GE purchases cannot turn
   * a missing input into a startable method. */
  cannotBuy?: boolean;
}) {
  return (
    <section id="money" data-player-tool-section="money" className="scroll-mt-20 border-t border-[var(--color-border)] pt-6" aria-labelledby="money-methods-title">
      <p className="eyebrow">Money</p>
      <h2 id="money-methods-title" className="mt-1 text-[22px] font-semibold text-[var(--color-text)]">
        Which Wiki methods can this bank start?
      </h2>
      {!report ? (
        <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-text-muted)]">No synced bank is available for a money-method answer.</p>
      ) : (
        <>
          <p
            data-testid="money-method-startable-count"
            data-startable-count={report.startableCount}
            className="mt-2 text-[15px] leading-relaxed text-[var(--color-text)]"
          >
            {moneyMethodCountLine(report)}
          </p>
          {cannotBuy && (
            <p className="mt-1 text-[12px] leading-relaxed text-[var(--color-text-muted)]">
              Grand Exchange purchases are excluded for this account; only levels, quests and items already banked count.
            </p>
          )}

          {report.startable.length > 0 && (
            <div className="mt-3 grid gap-2">
              {report.startable.slice(0, 3).map((method) => {
                const banked = method.banked.slice(0, 3);
                const remainingBanked = Math.max(0, method.banked.length - banked.length);
                return (
                  <a
                    key={method.id}
                    href={wikiMethodUrl(method.page)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)]/55 px-3 py-2.5 transition-colors hover:border-[var(--color-accent)]/45"
                  >
                    <p className="text-[13px] font-semibold text-[var(--color-text)]">
                      {method.activity} · {formatGp(method.gpPerHour)}/hr
                    </p>
                    <p className="mt-1 whitespace-normal break-words text-[11.5px] leading-relaxed text-[var(--color-text-dim)]">
                      {banked.length > 0
                        ? `${banked.join(", ")}${remainingBanked > 0 ? ` +${remainingBanked} more` : ""} in bank.`
                        : "No item input required from the bank."}
                      {method.buyable.length > 0 && ` ${method.buyable.length} tradeable gap${method.buyable.length === 1 ? "" : "s"} covered by banked GP.`}
                      {" Missing: nothing."}
                    </p>
                  </a>
                );
              })}
            </div>
          )}
          <p className="mt-2 text-[10.5px] text-[var(--color-text-muted)]">
            Requirements and methods: OSRS Wiki Bucket snapshot. GP/hour uses the live Wiki price feed when available.
          </p>
        </>
      )}
    </section>
  );
}
