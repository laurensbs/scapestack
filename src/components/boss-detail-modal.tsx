"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Sword, Target, TrendingUp, Package, ExternalLink, Copy, CheckCheck } from "lucide-react";
import { BOSSES, isNonCombatBossActivity, type Boss } from "@/lib/bosses";
import { bestStyleAndSetup, calcDps, type DpsBreakdown, type Setup } from "@/lib/dps";
import { type GearItem } from "@/lib/gear";
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
import { track } from "@/lib/analytics";
import {
  bossKnowledge,
  bossKnowledgeAllowsGpRate,
  bossKnowledgeSupportsSingleDps
} from "@/lib/boss-knowledge";
import type { PlannerAccountType } from "@/lib/account-type";
import { buildBossUpgradePlan } from "@/lib/boss-upgrade-plan";

interface Props {
  boss: Boss;
  owned: GearItem[];
  bankItems?: BankHandoffItem[];
  onClose: () => void;
  onSelectBoss?: (boss: Boss) => void;
  analyticsSource?: "next" | "check_kill";
  accountType?: PlannerAccountType | null;
}

// Full-bleed boss profile modal. Triggered from /dps (row click) and
// /next (KC-rec portrait click). Layout is side-by-side on desktop —
// big portrait left 60%, gear+stats+upgrades+inventory right — and
// stacks on mobile.
export function BossDetailModal({ boss, owned, bankItems = [], onClose, onSelectBoss, analyticsSource = "check_kill", accountType = null }: Props) {
  const titleId = "boss-modal-title";
  const descriptionId = "boss-modal-description";
  const statsId = "boss-modal-stats";
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const lastTrackedBoss = useRef<string | null>(null);
  useEffect(() => {
    if (lastTrackedBoss.current === boss.slug) return;
    lastTrackedBoss.current = boss.slug;
    track("boss:opened", {
      bossSlug: boss.slug,
      source: analyticsSource,
      hasBank: bankItems.length > 0
    });
  }, [analyticsSource, bankItems.length, boss.slug]);
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

  const bankDps = useMemo(() => bestStyleAndSetup(owned, boss), [owned, boss]);
  const activitySetup = isNonCombatBossActivity(boss);
  const knowledge = useMemo(() => bossKnowledge(boss), [boss]);
  const singleDps = bossKnowledgeSupportsSingleDps(knowledge);
  const preset = useMemo(() => PRESETS.find((p) => p.slug === boss.slug), [boss]);
  const inventoryPlan = useMemo(
    () => buildBossInventoryPlan({ boss, preset, bankItems, owned, dps: bankDps }),
    [bankDps, bankItems, boss, owned, preset]
  );
  const dps = useMemo(
    () => bankDps.dps > 0 ? calcDps(inventoryPlan.wornSetup, boss, bankDps.style) : bankDps,
    [bankDps, boss, inventoryPlan.wornSetup]
  );
  const upgradePlan = useMemo(
    () => activitySetup || !singleDps ? null : buildBossUpgradePlan({ boss, owned, bankItems, current: dps, accountType }),
    [accountType, activitySetup, bankItems, boss, dps, owned, singleDps]
  );
  const inventoryRows = inventoryPlan.rows;
  const inventoryTagRows = activitySetup ? inventoryRows : undefined;
  const verdict = useMemo(
    () => bossTripVerdict({ boss, dps, inventoryPlan, upgradePlan, activitySetup }),
    [boss, dps, inventoryPlan, upgradePlan, activitySetup]
  );
  const tagString = useMemo(
    () => activitySetup || singleDps ? bossSetupTagString(boss, dps, inventoryTagRows) : "",
    [activitySetup, singleDps, boss, dps, inventoryTagRows]
  );
  const bossRail = useMemo(() => {
    const sameCategory = BOSSES.filter((candidate) => candidate.category === boss.category && candidate.slug !== boss.slug);
    const rest = BOSSES.filter((candidate) => candidate.category !== boss.category && candidate.slug !== boss.slug);
    return [boss, ...sameCategory, ...rest].slice(0, 13);
  }, [boss]);

  // GP/hr is only comparable for supported single-target encounters and is
  // capped at the encounter's realistic kills-per-hour ceiling.
  const gpPerHour = bossKnowledgeAllowsGpRate(knowledge) && dps.dps > 0 && boss.avgLootGp && boss.killsPerHourCap
    ? Math.min(boss.killsPerHourCap, Math.floor(3600 / dps.ttk)) * boss.avgLootGp
    : null;
  const copyRuneLiteTab = async () => {
    if (!tagString) return;
    const result = await copyText(tagString);
    setCopyState(result === "failed" ? "failed" : "copied");
    if (result !== "failed") {
      track("boss:loadout_used", {
        bossSlug: boss.slug,
        source: analyticsSource,
        hasBank: bankItems.length > 0,
        action: "copy_runelite_tab"
      });
    }
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
        className="scapestack-lock-panel relative grid max-h-[90vh] min-h-0 w-full max-w-5xl overflow-y-auto overscroll-contain lg:grid-cols-[3fr_2fr] lg:overflow-hidden"
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
                {activitySetup ? "Activity setup" : knowledge.groupSize} · {knowledge.playerLine}
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
          className="relative min-h-0 space-y-5 p-5 pb-16 sm:p-6 sm:pb-16 lg:max-h-[90vh] lg:overflow-y-auto lg:overscroll-contain"
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

          {/* Inventory loadout — a fixed 4×7 OSRS inventory, not a metrics panel. */}
          {inventoryRows.length > 0 && (
            <section data-testid="boss-inventory-setup">
              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_224px] sm:items-start">
                <div>
                  <h3 className="eyebrow text-[var(--color-text-muted)]">
                    <Package className="mr-1 inline-block size-3" />First-trip inventory
                  </h3>
                  <p className="mt-1 text-[12.5px] font-semibold leading-relaxed text-[var(--color-text)]">
                    {inventoryPlan.leaveWith}
                  </p>
                  <p className="mt-2 text-[11px] text-[var(--color-text-dim)]">
                    {inventoryPlan.firstTripRange}
                  </p>
                  {inventoryPlan.mandatoryMissing.length > 0 && (
                    <p className="mt-3 text-[12px] font-bold leading-relaxed text-[var(--color-danger)]" data-testid="boss-mandatory-missing">
                      Missing before you go: {inventoryPlan.mandatoryMissing.join(", ")}.
                    </p>
                  )}
                  {inventoryPlan.slotPressure && (
                    <p className="mt-2 text-[11.5px] font-semibold text-[var(--color-warning)]">
                      {inventoryPlan.slotPressure}
                    </p>
                  )}
                  <p className="mt-3 text-[12px] leading-relaxed text-[var(--color-text-dim)]">
                    {inventoryPlan.firstTrip}
                  </p>
                </div>

                <div className="grid grid-cols-4 gap-1 rounded-md border border-[var(--color-border-strong)] bg-[#17130d] p-2" data-testid="osrs-inventory-grid">
                  {inventoryPlan.inventory.map((slot, index) => (
                    <a
                      key={`${slot.label}-${index}`}
                      href={slot.label === "Empty" ? undefined : wikiSearchUrl(slot.item?.name ?? slot.label)}
                      target={slot.label === "Empty" ? undefined : "_blank"}
                      rel={slot.label === "Empty" ? undefined : "noopener noreferrer"}
                      aria-label={slot.label === "Empty" ? `Empty inventory slot ${index + 1}` : slot.item ? `${slot.item.name}, bring ${slot.quantity}` : `Missing ${slot.label}`}
                      className={cn(
                        "relative flex aspect-square min-w-0 items-center justify-center rounded border",
                        slot.label === "Empty" && "pointer-events-none border-black/25 bg-black/20",
                        slot.item && "border-[#5b4a2b] bg-[#282015] hover:border-[var(--color-accent)]/65",
                        slot.missing && "border-dashed border-[var(--color-danger)]/55 bg-[var(--color-danger)]/5"
                      )}
                      title={slot.item ? `${slot.item.name}: ${slot.item.quantity.toLocaleString()} in bank` : slot.missing ? `${slot.label}: missing` : "Empty"}
                    >
                      {slot.item ? (
                        <ItemSprite id={slot.item.id} alt="" className="pixelated max-h-[78%] max-w-[78%]" />
                      ) : slot.missing ? (
                        <span className="px-1 text-center text-[8px] font-black uppercase leading-tight text-[var(--color-danger)]">
                          {slot.label}
                        </span>
                      ) : null}
                      {slot.quantity > 1 && (
                        <span className="absolute bottom-0.5 right-1 font-mono text-[9px] font-black text-[var(--color-accent)] [text-shadow:0_1px_2px_#000]">
                          {slot.quantity}
                        </span>
                      )}
                    </a>
                  ))}
                </div>
              </div>

              {inventoryRows.some((row) => row.slots.some((slot) => slot.alternatives.length > 0)) && (
                <details className="mt-3 border-t border-[var(--color-border)] pt-2">
                  <summary className="cursor-pointer text-[11.5px] font-bold text-[var(--color-text-dim)]">Other usable items in your bank</summary>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {inventoryRows.flatMap((row) => row.slots).flatMap((slot) => slot.alternatives.map((item) => (
                      <span key={`${slot.label}-${item.id}`} className="inline-flex items-center gap-1 rounded border border-[var(--color-border)] px-2 py-1 text-[10.5px] text-[var(--color-text-dim)]">
                        <ItemSprite id={item.id} alt="" size={14} className="pixelated" />
                        {item.name}
                      </span>
                    )))}
                  </div>
                </details>
              )}
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
            ) : !singleDps ? (
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/30 p-3.5">
                <h3 className="eyebrow text-[var(--color-text-muted)] mb-2">
                  {knowledge.encounterType === "raid" ? "Build the raid" : knowledge.encounterType === "wave" ? "Plan the full run" : "Plan the encounter"}
                </h3>
                <p className="text-[13px] font-semibold leading-relaxed text-[var(--color-text)]">
                  {knowledge.playerLine}
                </p>
                <div className="mt-3 space-y-2 border-t border-[var(--color-border)] pt-3 text-[12px] leading-relaxed text-[var(--color-text-dim)]">
                  <p><span className="font-black text-[var(--color-accent)]">Bring:</span> {knowledge.inventoryArchetype}</p>
                  {knowledge.hardRequirements.length > 0 && (
                    <p><span className="font-black text-[var(--color-accent)]">Before:</span> {knowledge.hardRequirements.join("; ")}</p>
                  )}
                  <p><span className="font-black text-[var(--color-accent)]">Stop:</span> {knowledge.stopPoint}</p>
                </div>
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
          {!activitySetup && singleDps && (
            <section>
              <h3 className="eyebrow text-[var(--color-text-muted)] mb-2">
                <Sword className="size-3 inline-block mr-1" />Gear from bank
              </h3>
              <GearSlotGrid setup={inventoryPlan.wornSetup} />
            </section>
          )}

          {upgradePlan && (
            <section>
              <h3 className="eyebrow text-[var(--color-text-muted)] mb-2">
                <Target className="size-3 inline-block mr-1" />Best next improvement
              </h3>
              <div className="flex items-center gap-3 border-y border-[var(--color-border)] py-3" data-testid="boss-primary-upgrade">
                <div className="flex size-11 shrink-0 items-center justify-center rounded border border-[var(--color-border)] bg-[var(--color-bg)]">
                  <ItemSprite id={upgradePlan.item.id} alt="" className="pixelated max-h-[78%] max-w-[78%]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-black text-[var(--color-text)]">{upgradePlan.item.name}</div>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--color-text-dim)]">
                    {upgradePlan.sourcePath ?? upgradePlan.reason}
                  </p>
                  <div className="mt-1 text-[10.5px] text-[var(--color-text-muted)]">
                    +{upgradePlan.gain.toFixed(2)} DPS
                    {upgradePlan.approximatePrice !== null && upgradePlan.approximatePrice > 0 && (
                      <> · roughly {formatGp(upgradePlan.approximatePrice)}</>
                    )}
                    {!upgradePlan.sourcePath && upgradePlan.affordable && <> · inside visible cash</>}
                  </div>
                </div>
                <a
                  href={upgradePlan.sourcePath ? wikiSearchUrl(upgradePlan.item.name) : wikiPriceUrl(upgradePlan.item.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-9 shrink-0 items-center justify-center gap-1 rounded border border-[var(--color-accent)]/35 px-2.5 text-[10.5px] font-black text-[var(--color-accent)] hover:border-[var(--color-accent)]/65"
                  aria-label={`${upgradePlan.actionLabel} for ${upgradePlan.item.name}`}
                >
                  {upgradePlan.actionLabel} <ExternalLink className="size-3" />
                </a>
              </div>
            </section>
          )}

          {!activitySetup && (
            <p className="text-[10.5px] text-[var(--color-text-muted)] italic pt-3 border-t border-[var(--color-border)]">
              {singleDps
                ? "Solo DPS uses level 99 stats and offensive prayers. Mechanics can change real kill speed."
                : "No single DPS or GP/hour is shown here because roles, rooms or the full run decide the result."}
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
  upgradePlan,
  activitySetup
}: {
  boss: Boss;
  dps: DpsBreakdown;
  inventoryPlan: ReturnType<typeof buildBossInventoryPlan>;
  upgradePlan: ReturnType<typeof buildBossUpgradePlan>;
  activitySetup?: boolean;
}): BossTripVerdict {
  const missingInventory = inventoryPlan.missingCount;
  const knowledge = bossKnowledge(boss);
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
  if (inventoryPlan.mandatoryMissing.length > 0) {
    return {
      title: "Do not leave yet",
      body: `Your bank is missing ${inventoryPlan.mandatoryMissing.join(", ")}. Add those before this can be a real first trip.`,
      badge: "Required prep",
      tone: "warn"
    };
  }
  if (knowledge.wildernessRisk) {
    return {
      title: "Risky trip",
      body: dps.dps > 0
        ? `${dps.weapon.name} works, but this is Wildy. Bring only what you are willing to lose and test one kill.`
        : "Wildy boss with no clear weapon in this bank. Add gear before risking a trip.",
      badge: "Wildy risk",
      tone: "risk"
    };
  }
  if (!bossKnowledgeSupportsSingleDps(knowledge)) {
    const encounterCopy = knowledge.encounterType === "raid"
      ? { title: "Build a learner raid", badge: "Room checklist" }
      : knowledge.encounterType === "wave"
        ? { title: "Plan the full run", badge: "Full-run prep" }
        : knowledge.dpsModel === "phase-switch"
          ? { title: "Build every phase", badge: "Switch check" }
          : { title: "Pick the role first", badge: "Role first" };
    return {
      ...encounterCopy,
      body: `${knowledge.playerLine} ${knowledge.stopPoint}`,
      tone: "warn"
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
  if (dps.hitChance < 0.38 || (upgradePlan && upgradePlan.gain > dps.dps * 0.4)) {
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
