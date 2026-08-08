import type { BossViability } from "@/lib/boss-viability";
import { bossViabilityDecisionLine } from "@/lib/boss-viability";
import { BossSprite } from "@/components/boss-picker";
import { JournalSpriteSlot } from "@/components/journal-primitives";
import {
  orderBossesForGoal,
  type PinnedGoalBossSource
} from "@/lib/pinned-goal-orientation";
import type { PinnedGoal } from "@/lib/pinned-goals";
import { wikiSearchUrl } from "@/lib/wiki";

function orderedBosses(bosses: readonly BossViability[]): BossViability[] {
  const toneRank = { ready: 0, test: 1, blocked: 2 } as const;
  return [...bosses].sort((left, right) =>
    Number(right.canKill) - Number(left.canKill)
    || toneRank[left.tone] - toneRank[right.tone]
    || left.boss.name.localeCompare(right.boss.name)
  );
}

export function PlayerBossesSection({
  bosses,
  activeGoal = null,
  goalBossSources = []
}: {
  bosses: readonly BossViability[] | null;
  activeGoal?: PinnedGoal | null;
  goalBossSources?: readonly PinnedGoalBossSource[];
}) {
  const ordered = bosses ? orderBossesForGoal(orderedBosses(bosses), activeGoal, goalBossSources) : [];
  const killable = ordered.filter((boss) => boss.canKill).length;
  const exactSources = activeGoal
    ? goalBossSources.filter((source) => source.goalKey === activeGoal.key && ordered.some((boss) =>
        source.bossSlug === boss.boss.slug
        || source.bossName.toLowerCase() === boss.boss.name.toLowerCase()))
    : [];
  return (
    <section id="bosses" data-player-tool-section="bosses" className="scroll-mt-20 border-t border-[var(--color-border)] pt-6" aria-labelledby="player-bosses-title">
      <p className="eyebrow">Bosses</p>
      <h2 id="player-bosses-title" className="mt-1 text-[length:var(--text-subject)] font-semibold text-[var(--color-text)]">
        {activeGoal ? `Which bosses move ${activeGoal.target}?` : "Which bosses can this bank kill?"}
      </h2>
      {bosses ? (
        <>
          <p data-testid="boss-startable-count" className="mt-2 max-w-[65ch] tabular-nums text-[length:var(--text-body)] font-normal leading-relaxed text-[var(--color-text)]">
            {activeGoal
              ? exactSources.length > 0
                ? `${exactSources.length.toLocaleString()} exact Wiki drop source${exactSources.length === 1 ? " is" : "s are"} listed first. `
                : `No exact boss drop source is recorded here for ${activeGoal.target}. The full kill list stays below. `
              : ""}
            Of {ordered.length.toLocaleString()} combat bosses, {killable.toLocaleString()} are a kill or test trip with these levels and this bank.
          </p>
          <div className="scape-table-wrap mt-3 overflow-x-hidden">
            <table className="scape-table table-fixed" aria-label="Boss viability from this bank">
              <colgroup>
                <col className="w-[34%]" />
                <col className="w-[66%]" />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">Boss</th>
                  <th scope="col">Answer</th>
                </tr>
              </thead>
              <tbody>
                {ordered.map((boss) => {
                  const source = exactSources.find((candidate) =>
                    candidate.bossSlug === boss.boss.slug
                    || candidate.bossName.toLowerCase() === boss.boss.name.toLowerCase());
                  return (
                    <tr key={boss.boss.slug}>
                      <th scope="row" className="break-words align-top">
                        <span className="flex min-w-0 items-start gap-3">
                          <JournalSpriteSlot>
                            <BossSprite boss={boss.boss} size={40} />
                          </JournalSpriteSlot>
                          <a href={wikiSearchUrl(boss.boss.name)} target="_blank" rel="noopener noreferrer" className="min-w-0 break-words font-semibold text-[var(--color-text)] hover:underline">
                            {boss.boss.name}
                          </a>
                        </span>
                      </th>
                      <td data-boss-answer={boss.boss.slug} className="whitespace-normal break-words align-top">
                        {source && activeGoal && (
                          <span className="mb-1 block font-semibold text-[var(--color-text)]">
                            {source.dropName} {source.rarity} from {source.bossName} moves {activeGoal.target}.
                          </span>
                        )}
                        <span className="scape-verdict" data-gate={boss.tone}>{boss.verdict}</span>
                        <span className="mt-1 block leading-relaxed">{bossViabilityDecisionLine(boss)}</span>
                        <span className="mt-1 block max-w-[65ch] text-[length:var(--text-micro)] font-normal leading-relaxed text-[var(--color-text-muted)]">
                          {boss.missing.length > 0 ? `Missing: ${boss.missing.join(", ")}.` : "Missing: nothing."}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="scape-table-note">Worn gear is not counted. Every answer uses the combat levels above and items in the synced bank.</p>
        </>
      ) : (
        <p className="mt-2 max-w-[65ch] text-[length:var(--text-body)] font-normal leading-relaxed text-[var(--color-text-muted)]">Waiting on your bank.</p>
      )}
    </section>
  );
}
