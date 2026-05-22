"use client";

import { useState, useTransition, useMemo } from "react";
import { Edit3, Sword, Zap, Target, TrendingUp, Coins, Info } from "lucide-react";
import { Intake } from "@/components/intake";
import { SupportCard } from "@/components/support-card";
import { organizeAction } from "@/app/actions";
import { BOSSES, type Boss } from "@/lib/bosses";
import { ownedGear, lookupGear, GEAR, type GearItem, type CombatStyle } from "@/lib/gear";
import { bestStyleAndSetup, calcDps, autoSetup, allStyleBreakdowns, type DpsBreakdown, type Setup } from "@/lib/dps";
import { cn, formatGp, ICON_URL } from "@/lib/utils";
import { BossPicker } from "@/components/boss-picker";

export function DpsClient() {
  const [view, setView] = useState<"intake" | "result">("intake");
  const [owned, setOwned] = useState<GearItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [focusedBoss, setFocusedBoss] = useState<Boss | null>(null);

  const run = (input: string, _junk: boolean, _rsn: string) => {
    setError(null);
    startTransition(async () => {
      const res = await organizeAction(input, { junkFilter: false, includePrices: false });
      if (res.error || !res.result) {
        setError(res.error || "Failed to read bank");
        return;
      }
      const flat = res.result.tabs.flatMap((t) => t.items);
      const gear = ownedGear(flat);
      setOwned(gear);
      setView("result");
    });
  };

  // For each boss, compute the best style/setup. We keep input order so the
  // table groups visually by category; the BossPicker handles search.
  const bossResults = useMemo(
    () => BOSSES.map((boss) => ({ boss, dps: bestStyleAndSetup(owned, boss) })),
    [owned]
  );

  // Sort hook for the picker: order suggestions by current DPS desc so the
  // most actionable target sits at the top of the search results.
  const dpsByBossSlug = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of bossResults) m.set(r.boss.slug, r.dps.dps);
    return m;
  }, [bossResults]);

  // Find global upgrade suggestions — items the player doesn't have that would
  // improve DPS by the largest factor across most bosses.
  const upgrades = useMemo(() => suggestUpgrades(owned), [owned]);

  if (view === "intake") {
    return (
      <>
        <div className="mb-6 grid sm:grid-cols-3 gap-3">
          <FeatureCard
            icon={Sword}
            title="Best setup from YOUR bank"
            body="We pick your top weapon and accessories per boss — no manual gear input." />
          <FeatureCard
            icon={Target}
            title={`${BOSSES.length} bosses`}
            body="Vorkath, Zulrah, GWD bosses, demonics, Hydra, Sire, Skotizo — accurate stats." />
          <FeatureCard
            icon={TrendingUp}
            title="Upgrade path"
            body="See the 3 items that would speed up your kills the most." />
        </div>
        <Intake onSubmit={run} loading={pending} error={error} />
      </>
    );
  }

  return (
    <div className="animate-[slide-up_0.35s_ease-out]">
      {/* Header */}
      <section className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-[var(--color-gold-soft)] mb-1">
            Gear recognized
          </div>
          <div className="text-3xl font-black text-[var(--color-gold)] leading-none tabular-nums">
            {owned.length}
          </div>
          <div className="text-[11.5px] text-[var(--color-text-dim)] mt-1">
            {owned.length === 0
              ? "We didn't recognise any combat gear in this bank."
              : `${owned.filter((g) => g.slot === "weapon").length} weapons in bank.`}
          </div>
        </div>
        <button
          onClick={() => { setView("intake"); setError(null); }}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px]",
            "bg-transparent border border-[var(--color-border)] text-[var(--color-text-dim)]",
            "hover:text-[var(--color-text)] hover:border-[var(--color-border-strong)] transition-colors"
          )}
        >
          <Edit3 className="size-3.5" /> Edit input
        </button>
      </section>

      {/* Upgrade suggestions */}
      {upgrades.length > 0 && (
        <section className="mb-7">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="size-4 text-[var(--color-good)]" />
            <h2 className="text-[11px] uppercase tracking-[0.18em] font-bold text-[var(--color-gold-soft)]">
              Biggest upgrades
            </h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-2.5">
            {upgrades.map((u) => (
              <div
                key={u.gear.id}
                className={cn(
                  "rounded-xl p-3 border border-[var(--color-good)]/30",
                  "bg-gradient-to-br from-[oklch(0.22_0.06_145/0.10)] to-[var(--color-bg-2)]"
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <img
                    src={ICON_URL(u.gear.id)}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="pixelated shrink-0 pointer-events-none"
                    style={{
                      maxWidth: "28px",
                      maxHeight: "28px",
                      width: "auto",
                      height: "auto",
                      imageRendering: "pixelated"
                    }}
                  />
                  <span className="text-[13px] font-semibold text-[var(--color-text)]">{u.gear.name}</span>
                </div>
                <div className="text-[11px] text-[var(--color-text-dim)] mb-1.5">
                  Adds <span className="text-[var(--color-good)] font-bold">+{u.avgGain.toFixed(1)} DPS</span> avg
                </div>
                <div className="text-[10.5px] text-[var(--color-text-dim)]">
                  Helps in: <span className="text-[var(--color-gold-soft)]">{u.bossLabels.slice(0, 3).join(", ")}</span>
                  {u.bossLabels.length > 3 && ` +${u.bossLabels.length - 3}`}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Boss table */}
      <section>
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <h2 className="text-[11px] uppercase tracking-[0.18em] font-bold text-[var(--color-accent)]">
            Per-boss DPS with your gear
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-semibold">Jump to</span>
            <BossPicker
              selected={focusedBoss ?? BOSSES[0]}
              onSelect={(b) => {
                setFocusedBoss(b);
                requestAnimationFrame(() => {
                  document.getElementById(`boss-${b.slug}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                });
              }}
              sortKey={(b) => dpsByBossSlug.get(b.slug) ?? 0}
            />
          </div>
        </div>
        <div className="space-y-2.5">
          {bossResults.map(({ boss, dps }) => (
            <BossRow
              key={boss.slug}
              boss={boss}
              dps={dps}
              owned={owned}
              startExpanded={focusedBoss?.slug === boss.slug}
            />
          ))}
        </div>
        <p className="mt-6 text-[10.5px] text-center text-[var(--color-text-dim)] italic">
          DPS calculated at level 99 stats with full offensive prayer (Piety / Rigour / Augury).
          Boss-specific mechanics (heap mode, transitions, specs) not modelled.
        </p>
      </section>

      <SupportCard context="Helped pick your gear for tonight's trip?" />
    </div>
  );
}

// ── Boss row ──

function BossRow({ boss, dps, owned, startExpanded = false }: {
  boss: Boss;
  dps: DpsBreakdown;
  owned: GearItem[];
  startExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(startExpanded);
  useMemo(() => {
    // Re-expand when external highlight changes (jump-to-boss).
    if (startExpanded) setExpanded(true);
  }, [startExpanded]);

  const usable = dps.dps > 0;
  const gpPerHour =
    usable && boss.avgLootGp && boss.killsPerHourCap
      ? Math.min(boss.killsPerHourCap, Math.floor(3600 / dps.ttk)) * boss.avgLootGp
      : null;

  // All three styles side-by-side. Only computed when expanded to avoid extra
  // work for off-screen rows.
  const allStyles = useMemo(
    () => expanded ? allStyleBreakdowns(owned, boss) : [],
    [expanded, owned, boss]
  );

  const styleIcon: Record<CombatStyle, React.ReactNode> = {
    stab:    <Sword className="size-3.5" />,
    slash:   <Sword className="size-3.5" />,
    crush:   <Sword className="size-3.5" />,
    ranged:  <Target className="size-3.5" />,
    magic:   <Zap className="size-3.5" />
  };

  return (
    <div
      id={`boss-${boss.slug}`}
      className={cn(
        "rounded-xl border scroll-mt-24",
        "bg-gradient-to-br from-[var(--color-panel)] to-[var(--color-bg-2)] border-[var(--color-border)]",
        "hover:border-[var(--color-border-strong)] transition-colors",
        startExpanded && "border-[var(--color-accent)]/40 shadow-[0_0_0_1px_rgba(0,226,154,0.18)]"
      )}>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left p-3.5 flex items-center gap-4 flex-wrap"
      >
        <div className="flex items-center gap-2.5 min-w-0 w-[160px]">
          {boss.iconItemId ? (
            <div className="size-9 shrink-0 rounded-md bg-[var(--color-bg-2)] border border-[var(--color-border)] flex items-center justify-center">
              <img
                src={ICON_URL(boss.iconItemId)}
                alt=""
                className="pixelated"
                style={{
                  maxWidth: "78%",
                  maxHeight: "78%",
                  imageRendering: "pixelated",
                  filter: "drop-shadow(1px 1px 0 rgb(0 0 0 / 0.9))"
                }}
              />
            </div>
          ) : (
            <span className="text-2xl shrink-0">{boss.emoji}</span>
          )}
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-[var(--color-text)] truncate">{boss.name}</div>
            <div className="text-[10.5px] text-[var(--color-text-dim)]">{boss.hp} hp</div>
          </div>
        </div>

        {usable ? (
          <>
            <Stat label="Style" value={dps.style.toUpperCase()} icon={styleIcon[dps.style]} />
            <Stat label="Weapon" value={dps.weapon.name} />
            <Stat label="Max hit" value={String(dps.maxHit)} />
            <Stat label="Accuracy" value={`${Math.round(dps.hitChance * 100)}%`} />
            <Stat label="DPS" value={dps.dps.toFixed(2)} highlight />
            <Stat label="TTK" value={`${dps.ttk.toFixed(0)}s`} />
            {gpPerHour && (
              <Stat label="GP/hr" value={formatGp(gpPerHour)} icon={<Coins className="size-3.5 text-[var(--color-gold)]" />} />
            )}
          </>
        ) : (
          <div className="text-[12px] text-[var(--color-text-dim)] italic flex-1">
            No usable weapon in your bank for this boss.
          </div>
        )}
      </button>

      {expanded && usable && (
        <div className="px-3.5 pb-3.5 pt-1 border-t border-[var(--color-border)]/40">
          {/* Per-style breakdown — melee/range/magic side by side. The winner
              is highlighted with mint so the user immediately sees which gear
              they should actually grab. */}
          {allStyles.length > 0 && (
            <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
              {allStyles.map((sd) => {
                const isWinner = sd.style === dps.style && sd.dps === dps.dps;
                const label =
                  sd.style === "stab" || sd.style === "slash" || sd.style === "crush"
                    ? `Melee · ${sd.style}`
                    : sd.style === "ranged" ? "Ranged" : "Magic";
                return (
                  <div
                    key={sd.style + "-" + sd.weapon.id}
                    className={cn(
                      "rounded-lg border p-3",
                      isWinner
                        ? "border-[var(--color-accent)]/45 bg-[var(--color-accent)]/8"
                        : "border-[var(--color-border)] bg-[var(--color-bg-2)]"
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className={cn(
                        "text-[10.5px] uppercase tracking-wider font-semibold flex items-center gap-1.5",
                        isWinner ? "text-[var(--color-accent)]" : "text-[var(--color-text-muted)]"
                      )}>
                        {styleIcon[sd.style]}
                        {label}
                        {isWinner && <span className="text-[9px] font-mono bg-[var(--color-accent)]/15 px-1 py-0.5 rounded border border-[var(--color-accent)]/40">BEST</span>}
                      </div>
                      <div className={cn(
                        "text-[14px] font-bold tabular-nums",
                        isWinner ? "text-[var(--color-accent)]" : "text-[var(--color-text)]"
                      )}>
                        {sd.dps.toFixed(2)}
                      </div>
                    </div>
                    <div className="text-[10.5px] text-[var(--color-text-dim)] flex items-baseline justify-between mb-2">
                      <span className="truncate">{sd.weapon.name}</span>
                      <span className="font-mono tabular-nums text-[var(--color-text-muted)] shrink-0 ml-2">
                        max {sd.maxHit} · {Math.round(sd.hitChance * 100)}%
                      </span>
                    </div>
                    <div className="grid grid-cols-11 gap-1">
                      {(["head","cape","neck","ammo","weapon","body","shield","legs","hands","feet","ring"] as const).map((slot) => {
                        const g = sd.setup[slot];
                        return (
                          <div
                            key={slot}
                            className={cn(
                              "aspect-square rounded flex items-center justify-center border",
                              g
                                ? "bg-[var(--color-osrs-slot)] border-[var(--color-osrs-slot-edge)]"
                                : "bg-[var(--color-bg)]/50 border-dashed border-[var(--color-border)]"
                            )}
                            title={g?.name || `(no ${slot})`}
                          >
                            {g ? (
                              <img
                                src={ICON_URL(g.id)}
                                alt={g.name}
                                loading="lazy"
                                decoding="async"
                                className="pixelated pointer-events-none"
                                style={{
                                  maxWidth: "78%",
                                  maxHeight: "78%",
                                  imageRendering: "pixelated",
                                  filter: "drop-shadow(1px 1px 0 rgb(0 0 0 / 0.9))"
                                }}
                              />
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {boss.notes && (
            <div className="mt-3 flex items-start gap-1.5 text-[11px] text-[var(--color-text-dim)] italic">
              <Info className="size-3 shrink-0 mt-0.5" />
              <span>{boss.notes}</span>
            </div>
          )}
          {boss.rooms && boss.rooms.length > 0 && (
            <div className="mt-4 pt-3 border-t border-[var(--color-border)]/40">
              <div className="text-[10.5px] uppercase tracking-wider font-semibold text-[var(--color-text-muted)] mb-2">
                Per room · best style
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {boss.rooms.map((room) => {
                  // Reuse bestStyleAndSetup by adapting the room into a Boss shape.
                  const roomAsBoss: Boss = {
                    slug: `${boss.slug}-${room.slug}`,
                    name: room.name,
                    category: boss.category,
                    hp: room.hp,
                    defenceLevel: room.defenceLevel,
                    defenceBonuses: room.defenceBonuses,
                    magicLevel: room.magicLevel,
                    weaknesses: room.weaknesses,
                    notes: room.notes
                  };
                  const roomBest = bestStyleAndSetup(owned, roomAsBoss);
                  return (
                    <div
                      key={room.slug}
                      className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-2)] px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[12px] font-medium text-[var(--color-text)] truncate">{room.name}</span>
                        <span className="text-[10px] font-mono tabular-nums text-[var(--color-text-muted)] shrink-0">{room.hp} hp</span>
                      </div>
                      {roomBest.dps > 0 ? (
                        <div className="mt-1 flex items-center gap-1.5 text-[10.5px]">
                          <span className="text-[var(--color-text-muted)] uppercase tracking-wider">{roomBest.style}</span>
                          <span className="text-[var(--color-accent)] font-semibold tabular-nums">{roomBest.dps.toFixed(2)}</span>
                          <span className="text-[var(--color-text-dim)] truncate">{roomBest.weapon.name}</span>
                        </div>
                      ) : (
                        <div className="mt-1 text-[10.5px] text-[var(--color-text-muted)] italic">No weapon for this room</div>
                      )}
                      {room.notes && (
                        <div className="mt-1 text-[10px] text-[var(--color-text-dim)] italic truncate" title={room.notes}>{room.notes}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, icon, highlight }: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <div className="text-[9px] uppercase tracking-widest text-[var(--color-text-dim)]/70 flex items-center gap-0.5">
        {icon}
        {label}
      </div>
      <div className={cn(
        "text-[12.5px] font-bold tabular-nums",
        highlight ? "text-[var(--color-gold)]" : "text-[var(--color-text)]"
      )}>
        {value}
      </div>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, body }: { icon: React.ComponentType<{ className?: string }>; title: string; body: string }) {
  return (
    <div className={cn(
      "rounded-xl p-3.5 bg-gradient-to-br from-[var(--color-panel)] to-[var(--color-bg-2)]",
      "border border-[var(--color-border)]"
    )}>
      <Icon className="size-4 text-[var(--color-gold-soft)] mb-2" />
      <div className="text-[12.5px] font-semibold text-[var(--color-text)] mb-1">{title}</div>
      <p className="text-[11.5px] text-[var(--color-text-dim)] leading-relaxed">{body}</p>
    </div>
  );
}

// ── Upgrade suggester ──

interface UpgradeSuggestion {
  gear: GearItem;
  avgGain: number;
  bossLabels: string[];
}

function suggestUpgrades(owned: GearItem[]): UpgradeSuggestion[] {
  const ownedIds = new Set(owned.map((g) => g.id));
  const candidates: UpgradeSuggestion[] = [];

  // For each item player DOESN'T own, simulate giving it to them and measure
  // DPS gain averaged across all bosses where it helps.
  for (const g of GEAR) {
    if (ownedIds.has(g.id)) continue;

    let totalGain = 0;
    const helpedBosses: string[] = [];

    for (const boss of BOSSES) {
      // For each style, compare with vs without
      const styles: CombatStyle[] = g.weaponStyle
        ? [g.weaponStyle]
        : g.slot === "weapon"
          ? []
          : ["stab", "slash", "crush", "ranged", "magic"];

      for (const style of styles) {
        const baseSetup = autoSetup(owned, style);
        if (!baseSetup.weapon) continue;
        const baseDps = calcDps(baseSetup, boss, style).dps;

        const withGear = autoSetup([...owned, g], style);
        if (!withGear.weapon) continue;
        const newDps = calcDps(withGear, boss, style).dps;

        const gain = newDps - baseDps;
        if (gain > 0.05) {
          totalGain += gain;
          if (!helpedBosses.includes(boss.name)) helpedBosses.push(boss.name);
        }
      }
    }

    if (totalGain > 0.5 && helpedBosses.length > 0) {
      candidates.push({
        gear: g,
        avgGain: totalGain / helpedBosses.length,
        bossLabels: helpedBosses
      });
    }
  }

  return candidates
    .sort((a, b) => (b.avgGain * b.bossLabels.length) - (a.avgGain * a.bossLabels.length))
    .slice(0, 3);
}
