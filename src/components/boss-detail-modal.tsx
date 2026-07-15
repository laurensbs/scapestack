"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X, Sword, Target, TrendingUp, Package, ExternalLink, Copy, CheckCheck } from "lucide-react";
import { BOSSES, isNonCombatBossActivity, type Boss } from "@/lib/bosses";
import { bestStyleAndSetup, calcDps, autoSetup, type DpsBreakdown, type Setup } from "@/lib/dps";
import { GEAR, type GearItem, type CombatStyle } from "@/lib/gear";
import { PRESETS } from "@/lib/presets";
import { formatGp, cn } from "@/lib/utils";
import { ItemSprite } from "@/components/item-sprite";
import { BossSprite } from "@/components/boss-picker";
import { wikiPriceUrl } from "@/lib/item-action";
import { wikiSearchUrl } from "@/lib/wiki";
import type { BankHandoffItem } from "@/lib/next-bank-handoff";
import { exportTag } from "@/lib/bank-tags";
import { copyText } from "@/lib/clipboard";
import { buildBossInventoryPlan, type InventoryRowPick } from "@/lib/boss-trip-loadout";

interface Props {
  boss: Boss;
  owned: GearItem[];
  bankItems?: BankHandoffItem[];
  onClose: () => void;
  onSelectBoss?: (boss: Boss) => void;
}

// Full-bleed boss profile modal. Triggered from /dps (row click) and
// /next (KC-rec portrait click). Layout is side-by-side on desktop —
// big portrait left 60%, gear+stats+upgrades+inventory right — and
// stacks on mobile.
export function BossDetailModal({ boss, owned, bankItems = [], onClose, onSelectBoss }: Props) {
  const titleId = "boss-modal-title";
  const descriptionId = "boss-modal-description";
  const statsId = "boss-modal-stats";
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  // a11y: Esc closes, body scroll locked while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const dps = useMemo(() => bestStyleAndSetup(owned, boss), [owned, boss]);
  const activitySetup = isNonCombatBossActivity(boss);
  const upgrades = useMemo(
    () => activitySetup ? [] : suggestUpgradesForBoss(owned, boss, dps),
    [activitySetup, owned, boss, dps]
  );
  const preset = useMemo(() => PRESETS.find((p) => p.slug === boss.slug), [boss]);
  const inventoryPlan = useMemo(
    () => buildBossInventoryPlan({ boss, preset, bankItems, owned, dps }),
    [boss, preset, bankItems, owned, dps]
  );
  const inventoryRows = inventoryPlan.rows;
  const inventoryTagRows = activitySetup ? inventoryRows : undefined;
  const verdict = useMemo(
    () => bossTripVerdict({ boss, dps, inventoryPlan, upgrades, activitySetup }),
    [boss, dps, inventoryPlan, upgrades, activitySetup]
  );
  const tagString = useMemo(
    () => bossSetupTagString(boss, dps, inventoryTagRows),
    [boss, dps, inventoryTagRows]
  );
  const bossRail = useMemo(() => {
    const sameCategory = BOSSES.filter((candidate) => candidate.category === boss.category && candidate.slug !== boss.slug);
    const rest = BOSSES.filter((candidate) => candidate.category !== boss.category && candidate.slug !== boss.slug);
    return [boss, ...sameCategory, ...rest].slice(0, 13);
  }, [boss]);

  // GP/hr is honest: cap kills/hour at the boss's killsPerHourCap. Skipped
  // when the engine couldn't find a usable weapon (dps === 0).
  const gpPerHour = dps.dps > 0 && boss.avgLootGp && boss.killsPerHourCap
    ? Math.min(boss.killsPerHourCap, Math.floor(3600 / dps.ttk)) * boss.avgLootGp
    : null;
  const copyRuneLiteTab = async () => {
    if (!tagString) return;
    const result = await copyText(tagString);
    setCopyState(result === "failed" ? "failed" : "copied");
    window.setTimeout(() => setCopyState("idle"), 1800);
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={`${descriptionId} ${statsId}`}
      style={{ animation: "fade-in 0.2s ease-out" }}
    >
      <button
        type="button"
        aria-label={`Close ${boss.name} boss setup details`}
        aria-hidden="true"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 bg-[rgba(7,9,12,0.82)] backdrop-blur-sm cursor-default"
      />

      <div
        className="scapestack-lock-panel relative grid max-h-[90vh] min-h-0 w-full max-w-5xl lg:grid-cols-[3fr_2fr]"
        style={{ animation: "pop-in 0.28s cubic-bezier(0.22, 1, 0.36, 1)" }}
      >
        {/* Close — floats top-right over the portrait so it stays visible
            even when the portrait is dark in that corner. */}
        <button
          type="button"
          onClick={onClose}
          aria-label={`Close ${boss.name} boss setup details`}
          className="absolute top-3 right-3 z-10 size-9 rounded-full flex items-center justify-center bg-[var(--color-bg)]/70 backdrop-blur border border-[var(--color-border-strong)] text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)] transition-colors"
        >
          <X className="size-4" />
        </button>

        {/* Left column — portrait. Full-bleed within its column, no frame
            (matches the homepage showcase treatment). Drop-shadow gives
            it weight against the panel background. */}
        <div className="relative bg-[var(--color-bg-2)] aspect-square lg:aspect-auto min-h-[280px] flex items-center justify-center p-6 overflow-hidden">
          <div
            className="absolute inset-[-10%] pointer-events-none"
            style={{
              background: "radial-gradient(closest-side, rgba(134, 166, 217, 0.18) 0%, transparent 70%)",
              opacity: 0.5
            }}
          />
          <img
            src={`/sprites/bosses/${boss.slug}.png`}
            alt=""
            className="relative w-full h-full object-contain"
            style={{ filter: "drop-shadow(0 14px 24px rgb(0 0 0 / 0.55))" }}
          />
          {/* Title overlay along the bottom-left. Big enough to be the
              page hero, low-contrast bg-tint so it doesn't fight the boss. */}
          <div className="absolute bottom-4 left-4 right-4 z-10">
            <h2
              id={titleId}
              className="text-[24px] sm:text-[28px] font-bold tracking-normal text-[var(--color-text)] leading-tight"
              style={{ textShadow: "0 2px 12px rgb(0 0 0 / 0.6)" }}
            >
              {boss.name}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <p id={descriptionId} className="text-[12px] text-[var(--color-text-dim)]" style={{ textShadow: "0 1px 6px rgb(0 0 0 / 0.7)" }}>
                {activitySetup ? "Activity setup" : `${boss.hp} HP`}{boss.notes ? ` · ${boss.notes}` : ""}
              </p>
              {boss.iconItemId && (
                <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-black/30 px-1.5 py-0.5 text-[9.5px] font-black text-[var(--color-text-muted)]">
                  <ItemSprite id={boss.iconItemId} alt="" size={16} className="pixelated" />
                  Loadout
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right column — gear, stats, upgrades, inventory. Scrolls
            internally so the modal as a whole stays in viewport. */}
        <div
          className="relative min-h-0 max-h-[90vh] space-y-5 overflow-y-auto overscroll-contain p-5 pb-16 sm:p-6 sm:pb-16"
          data-testid="boss-modal-scroll-panel"
        >
          <section className="scapestack-lock-card border-[var(--color-accent)]/30 bg-[var(--color-bg)]/30 p-3.5" data-testid="boss-trip-verdict">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h3 className="eyebrow text-[var(--color-accent)]">Can I do this?</h3>
                <div className="mt-1 text-[19px] font-black leading-tight text-[var(--color-text)]">
                  {verdict.title}
                </div>
                <p className="mt-1 text-[12.5px] font-semibold leading-relaxed text-[var(--color-text-dim)]">
                  {verdict.body}
                </p>
              </div>
              <span className={cn(
                "inline-flex shrink-0 rounded-full border px-2.5 py-1 text-[10.5px] font-black",
                verdict.tone === "good" && "border-[var(--color-good)]/35 bg-[var(--color-good)]/10 text-[var(--color-good)]",
                verdict.tone === "warn" && "border-[var(--color-warning)]/35 bg-[var(--color-warning)]/10 text-[var(--color-warning)]",
                verdict.tone === "risk" && "border-[var(--color-danger)]/35 bg-[var(--color-danger)]/10 text-[var(--color-danger)]"
              )}>
                {verdict.badge}
              </span>
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={copyRuneLiteTab}
                disabled={!tagString}
                className={cn(
                  "inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[12.5px] font-black transition-all",
                  tagString
                    ? "bg-[var(--color-accent)] text-[#0B1116] hover:brightness-110"
                    : "cursor-not-allowed bg-[var(--color-panel-2)] text-[var(--color-text-muted)]"
                )}
                aria-label={`Copy RuneLite tab for ${boss.name}`}
              >
                {copyState === "copied" ? <CheckCheck className="size-3.5" /> : <Copy className="size-3.5" />}
                {copyState === "copied" ? "RuneLite tab copied" : copyState === "failed" ? "Copy failed" : "Copy RuneLite tab"}
              </button>
              <a
                href={wikiSearchUrl(boss.name)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/35 px-3 py-2 text-[12.5px] font-bold text-[var(--color-text-dim)] transition-colors hover:border-[var(--color-accent)]/45 hover:text-[var(--color-accent)]"
              >
                Boss guide
                <ExternalLink className="size-3.5" />
              </a>
            </div>
          </section>

          {/* Inventory loadout — placed before stats/upgrades so the trip
              answer starts with what to bring, not calculator output. */}
          {inventoryRows.length > 0 && (
            <section data-testid="boss-inventory-setup">
              <h3 className="eyebrow text-[var(--color-text-muted)] mb-2">
                <Package className="size-3 inline-block mr-1" />Leave with this
              </h3>
              <p className="mb-2 text-[12px] font-semibold leading-relaxed text-[var(--color-text-dim)]">
                {inventoryPlan.leaveWith}
              </p>
              <div className="space-y-2.5">
                {inventoryRows.map((row) => (
                  <div key={row.label}>
                    <div className="text-[10.5px] uppercase tracking-wider text-[var(--color-text-dim)] mb-1.5">
                      {row.label}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {row.slots.map((slot, i) => {
                        return (
                          <a
                            key={`${row.label}-${i}-${slot.label}`}
                            href={slot.item ? wikiSearchUrl(slot.item.name) : wikiSearchUrl(slot.label)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn(
                              "inline-flex min-h-9 items-center gap-1.5 rounded border px-2 py-1 text-[11px] transition-colors",
                              slot.item
                                ? "bg-[var(--color-accent)]/10 border-[var(--color-accent)]/30 text-[var(--color-text)]"
                                : "bg-[var(--color-bg-2)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-accent)]/45 hover:text-[var(--color-accent)]"
                            )}
                            title={slot.item ? `${slot.item.name}: ${slot.item.quantity.toLocaleString()} in bank` : `${slot.label}: missing from bank`}
                          >
                            {slot.item ? (
                              <ItemSprite
                                id={slot.item.id}
                                alt=""
                                size={14}
                                className="pixelated"
                              />
                            ) : (
                              <span className="rounded bg-[var(--color-bg)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--color-accent)]">
                                Buy/gather
                              </span>
                            )}
                            <span className="truncate max-w-[155px]">{slot.item?.name ?? slot.label}</span>
                            {slot.note && (
                              <span className="text-[10px] text-[var(--color-text-muted)]">
                                {slot.note}
                              </span>
                            )}
                            {slot.item && slot.item.quantity > 1 && (
                              <span className="font-mono text-[10px] text-[var(--color-text-muted)]">
                                x{slot.item.quantity.toLocaleString()}
                              </span>
                            )}
                          </a>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[10.5px] text-[var(--color-text-muted)] italic">
                Gold chips are in your bank. Buy/gather chips are missing or too specific to detect from this paste.
              </p>
              <div className="mt-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/35 px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-accent)]">Try first</div>
                <p className="mt-1 text-[12.5px] font-semibold leading-relaxed text-[var(--color-text)]">
                  {inventoryPlan.firstTrip}
                </p>
              </div>
            </section>
          )}

          {/* Stats row — available after the verdict and inventory. */}
          <section id={statsId}>
            {activitySetup ? (
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/30 p-3.5">
                <h3 className="eyebrow text-[var(--color-text-muted)] mb-2">Activity setup</h3>
                <p className="text-[13px] leading-relaxed text-[var(--color-text-dim)]">
                  This is not a combat DPS check. Use the inventory above for warm gear, tools and food from your bank.
                </p>
              </div>
            ) : (
              <>
                <h3 className="eyebrow text-[var(--color-text-muted)] mb-2">Kill speed</h3>
                {dps.dps > 0 ? (
                  <>
                    <div className="text-[13px] text-[var(--color-text-dim)] mb-3">
                      Use{" "}
                      <span className="text-[var(--color-accent)] font-semibold uppercase tracking-wider">{dps.style}</span>
                      {" with "}
                      <span className="text-[var(--color-text)] font-semibold">{dps.weapon.name}</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                      <Stat label="DPS"      value={dps.dps.toFixed(1)} />
                      <Stat label="Max hit"  value={String(dps.maxHit)} />
                      <Stat label="Accuracy" value={`${Math.round(dps.hitChance * 100)}%`} />
                      {dps.ttk > 0 && (
                        <Stat
                          label="Kc/u"
                          value={String(Math.min(boss.killsPerHourCap ?? Infinity, Math.floor(3600 / dps.ttk)))}
                        />
                      )}
                    </div>
                    {gpPerHour !== null && (
                      <div className="mt-2 text-[12px] text-[var(--color-text-dim)] flex items-center gap-1.5">
                        <TrendingUp className="size-3.5 text-[var(--color-accent)]" />
                        Est. <span className="text-[var(--color-text)] font-mono tabular-nums">{formatGp(gpPerHour)}</span>/hr
                        {boss.killsPerHourCap !== undefined && Math.floor(3600 / dps.ttk) > boss.killsPerHourCap && (
                          <span className="text-[var(--color-text-muted)]"> (capped at {boss.killsPerHourCap} kills/hr)</span>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-[13px] text-[var(--color-warning)]">
                    Your bank doesn&apos;t carry a weapon that works against this boss yet — check the upgrades below.
                  </p>
                )}
              </>
            )}
          </section>

          {onSelectBoss && bossRail.length > 0 && (
            <section>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="eyebrow text-[var(--color-text-muted)]">Try another boss</h3>
                <span className="text-[10.5px] text-[var(--color-text-muted)]">{bossRail.length - 1} nearby picks</span>
              </div>
              <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
                {bossRail.map((candidate) => {
                  const active = candidate.slug === boss.slug;
                  return (
                  <button
                    key={candidate.slug}
                    type="button"
                    onClick={() => {
                      if (!active) onSelectBoss(candidate);
                    }}
                    title={candidate.name}
                    aria-label={active ? `${candidate.name} is selected` : `Switch boss setup to ${candidate.name}`}
                    aria-current={active ? "true" : undefined}
                    className={cn(
                      "inline-flex size-11 shrink-0 items-center justify-center rounded-lg border bg-[var(--color-bg)]/50 transition-colors",
                      active
                        ? "border-[var(--color-accent)] bg-[var(--color-accent)]/12 shadow-[0_0_0_2px_rgba(240,176,44,0.18)]"
                        : "border-[var(--color-border)] hover:border-[var(--color-accent)]/55 hover:bg-[var(--color-accent)]/10"
                    )}
                  >
                    <BossSprite boss={candidate} size={36} />
                  </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Worn gear grid — 8 slots in the OSRS equipment-tab layout
              (best-fit since we don't model 11 slots; missing slots
              render as empty cells). */}
          {!activitySetup && (
            <section>
              <h3 className="eyebrow text-[var(--color-text-muted)] mb-2">
                <Sword className="size-3 inline-block mr-1" />Gear from bank
              </h3>
              <GearSlotGrid setup={dps.setup} />
            </section>
          )}

          {/* Upgrades — top 3 items the player doesn't own that would
              raise DPS the most for THIS boss specifically (not the
              global suggestion the page already shows up top). */}
          {upgrades.length > 0 && (
            <section>
              <h3 className="eyebrow text-[var(--color-text-muted)] mb-2">
                <Target className="size-3 inline-block mr-1" />Upgrade before camping
              </h3>
              <div className="space-y-1.5">
                {upgrades.map((u) => {
                  // Vertaal DPS-gain naar concrete impact: kills/uur erbij +
                  // GP/uur erbij. Gebruikt dezelfde kph-cap als de hoofdrij.
                  const currentKph = dps.ttk > 0 ? Math.min(boss.killsPerHourCap ?? Infinity, Math.floor(3600 / dps.ttk)) : 0;
                  const newKph = u.newTtk > 0 ? Math.min(boss.killsPerHourCap ?? Infinity, Math.floor(3600 / u.newTtk)) : 0;
                  const kphGain = Math.max(0, newKph - currentKph);
                  const gpGain = kphGain && boss.avgLootGp ? kphGain * boss.avgLootGp : 0;
                  return (
                    <div
                      key={u.item.id}
                      className="flex items-center gap-2.5 px-2.5 py-2 rounded-md bg-[var(--color-bg-2)] border border-[var(--color-border)]"
                    >
                      <div className="size-8 shrink-0 rounded bg-[var(--color-bg)] border border-[var(--color-border)] flex items-center justify-center">
                        <ItemSprite
                          id={u.item.id}
                          alt=""
                          className="pixelated"
                          style={{ maxWidth: "78%", maxHeight: "78%" }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[12.5px] font-semibold text-[var(--color-text)] truncate">{u.item.name}</div>
                        <div className="text-[10.5px] text-[var(--color-text-muted)] tabular-nums">
                          <span className="text-[var(--color-good)]">+{u.gain.toFixed(2)} DPS</span>
                          {kphGain > 0 && (
                            <> · <span className="text-[var(--color-text-dim)]">+{kphGain} kc/u</span></>
                          )}
                          {gpGain > 0 && (
                            <> · <span className="text-[var(--color-text-dim)]">+{(gpGain / 1000).toFixed(0)}k GP/u</span></>
                          )}
                          {" · "}{u.item.slot ?? "weapon"}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col gap-1">
                        <a
                          href={wikiSearchUrl(u.item.name)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center gap-1 rounded border border-[var(--color-border)] px-2 py-1 text-[10px] font-semibold text-[var(--color-text-dim)] transition-colors hover:border-[var(--color-accent)]/45 hover:text-[var(--color-accent)]"
                          aria-label={`Open ${u.item.name} on the OSRS Wiki`}
                        >
                          Wiki <ExternalLink className="size-2.5" />
                        </a>
                        <a
                          href={wikiPriceUrl(u.item.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center gap-1 rounded border border-[var(--color-accent)]/25 px-2 py-1 text-[10px] font-semibold text-[var(--color-accent)] transition-colors hover:border-[var(--color-accent)]/45"
                          aria-label={`Open ${u.item.name} GE price`}
                        >
                          GE <ExternalLink className="size-2.5" />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {!activitySetup && (
            <p className="text-[10.5px] text-[var(--color-text-muted)] italic pt-3 border-t border-[var(--color-border)]">
              DPS at level 99 stats with full offensive prayer. Boss-specific mechanics not modelled.
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-[var(--color-bg-2)] border border-[var(--color-border)] px-2.5 py-2">
      <div className="text-[9.5px] uppercase tracking-wider text-[var(--color-text-muted)]">{label}</div>
      <div className="text-[18px] font-bold text-[var(--color-text)] font-mono tabular-nums leading-tight">{value}</div>
    </div>
  );
}

interface BossTripVerdict {
  title: string;
  body: string;
  badge: string;
  tone: "good" | "warn" | "risk";
}

function bossTripVerdict({
  boss,
  dps,
  inventoryPlan,
  upgrades,
  activitySetup
}: {
  boss: Boss;
  dps: DpsBreakdown;
  inventoryPlan: ReturnType<typeof buildBossInventoryPlan>;
  upgrades: UpgradePick[];
  activitySetup?: boolean;
}): BossTripVerdict {
  const missingInventory = inventoryPlan.missingCount;
  if (activitySetup) {
    return {
      title: "Prep the activity",
      body: missingInventory > 0
        ? `${missingInventory} activity items are missing. Fill those before starting.`
        : "Your bank has the key activity items. Copy the tab, do one round, then adjust after the reward.",
      badge: "No combat DPS",
      tone: missingInventory > 0 ? "warn" : "good"
    };
  }
  if (boss.category === "wildy") {
    return {
      title: "Risky trip",
      body: dps.dps > 0
        ? `${dps.weapon.name} works, but this is Wildy. Bring only what you are willing to lose and test one kill.`
        : "Wildy boss with no clear weapon in this bank. Add gear before risking a trip.",
      badge: "Wildy risk",
      tone: "risk"
    };
  }
  if (dps.dps <= 0) {
    return {
      title: "Gear missing",
      body: "This bank does not show a usable weapon for this boss yet. Add a combat tab before buying supplies.",
      badge: "Need weapon",
      tone: "warn"
    };
  }
  if (dps.hitChance < 0.38 || upgrades.length >= 3) {
    return {
      title: "Not worth yet",
      body: `${dps.weapon.name} is detected, but the hit chance is low. Check upgrades before camping this boss.`,
      badge: "Upgrade first",
      tone: "warn"
    };
  }
  if (missingInventory > 2) {
    return {
      title: "Prep missing",
      body: `${dps.weapon.name} works, but ${inventoryPlan.missingLine ?? "some supplies"} are missing. Fill those before the trip.`,
      badge: "Prep first",
      tone: "warn"
    };
  }
  return {
    title: "Do one trip",
    body: `${dps.weapon.name} is your best banked weapon here. ${inventoryPlan.firstTrip}`,
    badge: "Bank can start",
    tone: "good"
  };
}

function bossSetupTagString(boss: Boss, dps: DpsBreakdown, inventoryRows?: InventoryRowPick[]): string {
  if (inventoryRows) {
    const activityIds = inventoryRows
      .flatMap((row) => row.slots.map((slot) => slot.item?.id))
      .filter((id): id is number => typeof id === "number" && id > 0);
    const uniqueIds = [...new Set(activityIds)];
    if (uniqueIds.length === 0) return "";
    return exportTag({
      name: `${boss.slug}-activity`,
      iconItemId: boss.iconItemId ?? uniqueIds[0],
      items: uniqueIds.map((id) => ({ id }))
    });
  }
  if (dps.dps <= 0) return "";
  const setupIds = [
    dps.weapon?.id,
    dps.setup.head?.id,
    dps.setup.cape?.id,
    dps.setup.neck?.id,
    dps.setup.ammo?.id,
    dps.setup.body?.id,
    dps.setup.shield?.id,
    dps.setup.legs?.id,
    dps.setup.hands?.id,
    dps.setup.feet?.id,
    dps.setup.ring?.id
  ].filter((id): id is number => typeof id === "number" && id > 0);
  if (setupIds.length === 0) return "";
  return exportTag({
    name: `${boss.slug}-trip`,
    iconItemId: boss.iconItemId ?? setupIds[0],
    items: setupIds.map((id) => ({ id }))
  });
}

// 4×2 grid of gear slots. Each slot shows the item's sprite (or empty
// placeholder if not equipped/available). Slot order matches the OSRS
// equipment tab layout roughly: top row = head/cape/neck/ammo,
// bottom row = weapon/body/shield/legs/hands/feet/ring.
function GearSlotGrid({ setup }: { setup: Setup }) {
  const slots: Array<{ key: keyof Setup; label: string }> = [
    { key: "head",   label: "Head" },
    { key: "cape",   label: "Cape" },
    { key: "neck",   label: "Neck" },
    { key: "ammo",   label: "Ammo" },
    { key: "weapon", label: "Weapon" },
    { key: "body",   label: "Body" },
    { key: "shield", label: "Shield" },
    { key: "legs",   label: "Legs" },
    { key: "hands",  label: "Hands" },
    { key: "feet",   label: "Feet" },
    { key: "ring",   label: "Ring" }
  ];
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {slots.map(({ key, label }) => {
        const item = setup[key];
        return (
          <div
            key={key}
            title={item ? item.name : `${label} (empty)`}
            className={cn(
              "aspect-square rounded-md border flex items-center justify-center relative overflow-hidden",
              item
                ? "bg-[var(--color-bg)] border-[var(--color-border)]"
                : "bg-[var(--color-bg-2)]/40 border-dashed border-[var(--color-border)]/60"
            )}
          >
            {item ? (
              <ItemSprite
                id={item.id}
                alt=""
                className="pixelated"
                style={{ maxWidth: "75%", maxHeight: "75%" }}
              />
            ) : (
              <span className="text-[9px] uppercase tracking-wider text-[var(--color-text-muted)]/50">{label}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

interface UpgradePick {
  item: GearItem;
  gain: number;     // DPS gain over current best setup at this boss
  /** TTK (seconds per kill) met deze upgrade. Gebruikt om kc/u en
   *  GP/u te tonen — meer concreet dan "DPS +0.5". */
  newTtk: number;
}

// Per-boss upgrade picker. Tries each unowned gear item against the
// boss's best style; keeps the three with the biggest DPS gain. This
// is cheaper than the global suggester because we only test one
// boss + one style.
function suggestUpgradesForBoss(owned: GearItem[], boss: Boss, current: DpsBreakdown): UpgradePick[] {
  if (current.dps === 0) return [];
  const ownedIds = new Set(owned.map((g) => g.id));
  const style: CombatStyle = current.style;
  const baseDps = current.dps;
  const candidates: UpgradePick[] = [];
  for (const g of GEAR) {
    if (ownedIds.has(g.id)) continue;
    // Style-bound weapons only count for their own style.
    if (g.slot === "weapon" && g.weaponStyle && g.weaponStyle !== style) continue;
    const newSetup = autoSetup([...owned, g], style);
    if (!newSetup.weapon) continue;
    const newCalc = calcDps(newSetup, boss, style);
    const gain = newCalc.dps - baseDps;
    if (gain > 0.1) {
      candidates.push({ item: g, gain, newTtk: newCalc.ttk });
    }
  }
  return candidates.sort((a, b) => b.gain - a.gain).slice(0, 3);
}
