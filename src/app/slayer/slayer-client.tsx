"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { ChevronDown, ChevronRight, Shield, Skull, Star, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { rankMasters, blockSuggestions, type PlayerState } from "@/lib/slayer/simulator";
import type { MasterSimulation, TaskOption } from "@/lib/slayer/simulator";
import { hiscoresAction, syncedPlayerAction } from "@/app/actions";
import { computeCombatLevel } from "@/lib/hiscores";
import { TASK_ID_TO_MONSTER } from "@/lib/slayer/task-ids";
import { MONSTERS_BY_ID } from "@/lib/slayer/monsters";
import { readBankHandoffPayload } from "@/lib/next-bank-handoff";
import { pluginVerifyUrlForSyncedRsn } from "@/lib/plugin-sync-actions";
import { buildSlayerBankContext, type SlayerBankContext } from "@/lib/slayer-bank-context";
import { ItemSprite } from "@/components/item-sprite";
import { BankContextActions } from "@/components/bank-context-actions";
import { ScapestackReadinessRail } from "@/components/scapestack-readiness-rail";
import { buildSlayerTaskActions, type SlayerTaskActionOptions } from "@/lib/slayer-task-actions";

// Task Check — eerste versie.
//
// Geen RSN-lookup nog (dat sluit aan op het plugin-pad in fase 3); voor
// nu typt de speler combat + slayer level handmatig. Output:
//   - Ranking van masters op expected XP/u
//   - Per master: alle eligible tasks met probability + verwachte XP/u
//   - Block-suggestions: 5 lowest-XP tasks om te overwegen
//
// Geen gear-koppeling, geen Konar-location filter, geen unlocks. Die
// komen in v0.2 zodra deze versie validate is via gebruik.

// Quest-checkboxes voor de master-gates. Houd het mini — alleen de
// drie die een master-eis raken.
const QUESTS = [
  { id: "priest_in_peril", label: "Priest in Peril (Mazchna)" },
  { id: "lost_city",       label: "Lost City (Chaeldar)" },
  { id: "shilo_village",   label: "Shilo Village (Duradel)" }
];

export function SlayerClient() {
  const [combatLevel, setCombatLevel] = useState(100);
  const [slayerLevel, setSlayerLevel] = useState(85);
  const [questsDone, setQuestsDone] = useState<Set<string>>(new Set(QUESTS.map((q) => q.id)));
  const [expanded, setExpanded] = useState<string | null>(null);

  // RSN-lookup state. Niet vereist — handmatig invullen werkt nog
  // steeds — maar voor 95% van de gebruikers is "typ je naam → autofill"
  // sneller dan twee numbers + drie quest-toggles.
  const [rsn, setRsn] = useState("");
  const [lookupErr, setLookupErr] = useState<string | null>(null);
  const [lookupOk, setLookupOk] = useState<string | null>(null);
  const [pluginBlocks, setPluginBlocks] = useState<Set<string>>(new Set());
  const [pluginSlayer, setPluginSlayer] = useState<{
    points: number;
    streak: number;
    taskRemaining: number;
    currentTaskId: number;
    blocks: string[];
  } | null>(null);
  const [hasPluginPayload, setHasPluginPayload] = useState(false);
  const [bankContext, setBankContext] = useState<SlayerBankContext | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("bank") === "none") {
        setBankContext(null);
        return;
      }
      setBankContext(buildSlayerBankContext(readBankHandoffPayload(window)));
    } catch {
      setBankContext(null);
    }
  }, []);

  const lookupRsn = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setRsn(trimmed);
    setLookupErr(null);
    setLookupOk(null);
    setHasPluginPayload(false);
    setPluginBlocks(new Set());
    setPluginSlayer(null);
    startTransition(async () => {
      // Parallel: Hiscores (skills + combat) + onze plugin-sync (claimed
      // RSN → quests, diaries, CL items, en in toekomst block-list).
      const [hi, sync] = await Promise.all([
        hiscoresAction(trimmed),
        syncedPlayerAction(trimmed)
      ]);
      if (!hi) {
        setLookupErr(`Geen Hiscores-resultaat voor "${trimmed}". Tikfout?`);
        return;
      }
      const cb = computeCombatLevel(hi.skills);
      const sl = hi.skills.find((s) => s.name.toLowerCase() === "slayer")?.level ?? 1;
      setCombatLevel(cb);
      setSlayerLevel(sl);
      // We weten welke quests gedaan zijn niet uit Hiscores; aanname
      // = alle drie voltooid bij combat 90+ (vrij safe — de meeste
      // accounts op dat niveau hebben Lost City + Shilo + PiP).
      // Plugin-sync overrulet dit wanneer hij quest-data heeft.
      if (sync && sync.questsCompleted.length > 0) {
        const lower = new Set(sync.questsCompleted.map((q) => q.toLowerCase()));
        const next = new Set<string>();
        for (const q of QUESTS) {
          // Plugin gebruikt OSRS display-namen ("Lost City"), wij
          // lower-snake ("lost_city"); doe een fuzzy contains.
          const target = q.label.split(" (")[0].toLowerCase();
          if (lower.has(target)) next.add(q.id);
        }
        // Als geen match, val terug op alle 3 (slayer-master eis is
        // bewust laag).
        setQuestsDone(next.size > 0 ? next : new Set(QUESTS.map((q) => q.id)));
      } else if (cb >= 90) {
        setQuestsDone(new Set(QUESTS.map((q) => q.id)));
      }
      // Plugin block-list: server mapt task-id → monster.id voordat
      // we hem teruggeven. Lege array = geen blocks of plugin-versie
      // pre-fase 3.3.
      setHasPluginPayload(Boolean(sync));
      setPluginBlocks(new Set(sync?.slayer?.blocks ?? []));
      setPluginSlayer(sync?.slayer ?? null);
      const syncStatus = sync?.slayer
        ? "RuneLite: Slayer task live"
        : sync
          ? "RuneLite: no live task"
          : "RuneLite not found";
      const bits = [
        `Combat ${cb}`,
        `Slayer ${sl}`,
        syncStatus
      ];
      setLookupOk(`Loaded: ${bits.join(" · ")}`);
    });
  }, []);

  const onLookup = () => lookupRsn(rsn);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const paramRsn = params.get("rsn");
      if (paramRsn?.trim()) lookupRsn(paramRsn);
    } catch {
      // URL preload is best-effort; manual lookup still works.
    }
  }, [lookupRsn]);

  const state: PlayerState = useMemo(() => ({
    combatLevel,
    slayerLevel,
    completedQuests: questsDone,
    // Plugin-blocks worden hier ingevoerd zodra de RuneLite plugin
    // ze in zijn sync-payload meestuurt (fase 3.2).
    blockedMonsterIds: pluginBlocks,
    taskStreak: 50
  }), [combatLevel, slayerLevel, questsDone, pluginBlocks]);

  const masters = useMemo(() => rankMasters(state), [state]);
  const taskActionOptions = useMemo<SlayerTaskActionOptions>(() => ({
    hasBankContext: Boolean(bankContext),
    rsn
  }), [bankContext, rsn]);

  return (
    <div className="space-y-6">
      <ScapestackReadinessRail
        surface="slayer"
        hasBankContext={Boolean(bankContext)}
        hasRsn={Boolean(rsn.trim())}
        hasPluginSync={hasPluginPayload}
        pluginSyncState={hasPluginPayload ? (pluginSlayer ? "live" : "stale") : null}
        rsn={rsn}
      />

      {/* Input card */}
      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-5">
        <h2 className="text-[11px] uppercase tracking-[0.18em] font-bold text-[var(--color-accent)] mb-3">
          Your account
        </h2>
        {/* RSN-lookup: 1 invoer-veld, alles eronder wordt
            geautomatisch ingevuld via Hiscores + plugin-sync.
            Handmatig invullen blijft mogelijk voor wie geen account
            wil typen (test mode). */}
        <div className="mb-4">
          <label htmlFor="slayer-rsn-input" className="text-[11.5px] text-[var(--color-text-muted)] mb-1.5 block">
            Look up your OSRS name
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--color-text-muted)]" />
              <input
                id="slayer-rsn-input"
                name="rsn"
                type="text"
                value={rsn}
                onChange={(e) => setRsn(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") onLookup(); }}
                placeholder="e.g. Lynx Titan"
                maxLength={12}
                autoComplete="off"
                spellCheck={false}
                aria-describedby="slayer-rsn-help slayer-lookup-status"
                aria-invalid={lookupErr ? "true" : undefined}
                className="w-full pl-10 pr-3 py-2 rounded-lg bg-[var(--color-bg-2)] border border-[var(--color-border)] focus:border-[var(--color-accent)]/50 text-[14px] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] outline-none"
              />
            </div>
            <button
              type="button"
              onClick={onLookup}
              disabled={pending || !rsn.trim()}
              aria-label="Look up Slayer data from Hiscores and RuneLite sync"
              className="px-4 py-2 rounded-lg bg-[var(--color-accent)] text-[var(--color-bg)] text-[13px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-110 transition-all"
            >
              {pending ? "..." : "Lookup"}
            </button>
          </div>
          <p id="slayer-rsn-help" className="mt-1.5 text-[11.5px] leading-relaxed text-[var(--color-text-muted)]">
            Uses Hiscores for combat/Slayer level and Scapestack Sync for task, points, streak and blocks when available.
          </p>
          {lookupErr && (
            <p id="slayer-lookup-status" role="status" aria-live="polite" className="mt-1.5 text-[11.5px] text-[var(--color-bad)]">{lookupErr}</p>
          )}
          {lookupOk && (
            <p id="slayer-lookup-status" role="status" aria-live="polite" className="mt-1.5 text-[11.5px] text-[var(--color-good)]">{lookupOk}</p>
          )}
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-[11.5px] text-[var(--color-text-muted)] mb-1.5 block">Combat level</span>
            <input
              type="number"
              min={3} max={126}
              value={combatLevel}
              onChange={(e) => setCombatLevel(Math.max(3, Math.min(126, parseInt(e.target.value) || 3)))}
              className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-2)] border border-[var(--color-border)] focus:border-[var(--color-accent)]/50 text-[14px] text-[var(--color-text)] outline-none tabular-nums"
            />
          </label>
          <label className="block">
            <span className="text-[11.5px] text-[var(--color-text-muted)] mb-1.5 block">Slayer level</span>
            <input
              type="number"
              min={1} max={99}
              value={slayerLevel}
              onChange={(e) => setSlayerLevel(Math.max(1, Math.min(99, parseInt(e.target.value) || 1)))}
              className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-2)] border border-[var(--color-border)] focus:border-[var(--color-accent)]/50 text-[14px] text-[var(--color-text)] outline-none tabular-nums"
            />
          </label>
        </div>
        <div className="mt-4">
          <span className="text-[11.5px] text-[var(--color-text-muted)] mb-2 block">Quest requirements voltooid</span>
          <div className="flex flex-wrap gap-2">
            {QUESTS.map((q) => {
              const on = questsDone.has(q.id);
              return (
                <button
                  key={q.id}
                  type="button"
                  aria-pressed={on}
                  aria-label={`${on ? "Mark incomplete" : "Mark complete"}: ${q.label}`}
                  onClick={() => {
                    const next = new Set(questsDone);
                    if (on) next.delete(q.id); else next.add(q.id);
                    setQuestsDone(next);
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-[11.5px] border transition-colors",
                    on
                      ? "border-[var(--color-good)]/50 bg-[var(--color-good)]/10 text-[var(--color-good)]"
                      : "border-[var(--color-border)] text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
                  )}
                >
                  {on ? "✓ " : ""}{q.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {bankContext && (
        <SlayerBankContextBanner context={bankContext} rsn={rsn} />
      )}

      {/* Plugin-data callout — toont alleen als de RuneLite plugin echt
          data heeft gepushed voor deze RSN. Geeft de speler vertrouwen
          dat de sync werkt + surfaceert points/streak die je anders
          alleen in-game ziet. */}
      {pluginSlayer && (
        <section className="rounded-xl border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5 p-4 space-y-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-[var(--color-accent)] flex items-center gap-1.5">
              <span className="text-[12px]">🔌</span>
              Plugin sync live
            </div>
            <div className="flex items-center gap-5 text-[13px] tabular-nums">
              <div>
                <span className="text-[var(--color-text-muted)]">Points</span>{" "}
                <span className="text-[var(--color-text)] font-semibold">{pluginSlayer.points.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-[var(--color-text-muted)]">Streak</span>{" "}
                <span className="text-[var(--color-text)] font-semibold">{pluginSlayer.streak}</span>
              </div>
              <div>
                <span className="text-[var(--color-text-muted)]">Task left</span>{" "}
                <span className="text-[var(--color-text)] font-semibold">{pluginSlayer.taskRemaining}</span>
              </div>
            </div>
          </div>

          {/* Current task — toont "Doing 47 Aberrant Spectres". Vereist
              dat het current-task-id mapt naar een bekende monster slug;
              anders skippen we deze regel (rauwe ID is verwarrend). */}
          {(() => {
            const slug = TASK_ID_TO_MONSTER[pluginSlayer.currentTaskId];
            const monster = slug ? MONSTERS_BY_ID.get(slug) : undefined;
            if (!monster) return null;
            const taskXp = monster.hp * 4 * pluginSlayer.taskRemaining;
            const actions = buildSlayerTaskActions(monster, taskActionOptions);
            return (
              <div className="border-t border-[var(--color-accent)]/20 pt-3 flex items-baseline justify-between gap-3 flex-wrap text-[12.5px]">
                <div>
                  <span className="text-[var(--color-text-muted)]">Currently on:</span>{" "}
                  <a
                    href={actions.wikiHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--color-text)] font-semibold transition-colors hover:text-[var(--color-accent)] hover:underline"
                    title={`Open ${monster.name} on OSRS Wiki`}
                  >
                    {pluginSlayer.taskRemaining} × {monster.name}
                  </a>
                  {monster.slayerLevel > 1 && (
                    <span className="ml-2 rounded border border-[var(--color-border)] bg-[var(--color-bg-2)] px-1.5 py-0.5 text-[10.5px] text-[var(--color-text-muted)]">
                      lvl {monster.slayerLevel}
                    </span>
                  )}
                  {actions.dpsHref && (
                    <a
                      href={actions.dpsHref}
                      className="ml-1.5 rounded border border-[var(--color-accent)]/35 bg-[var(--color-accent)]/10 px-1.5 py-0.5 text-[10.5px] font-semibold text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent)]/15"
                    >
                      DPS
                    </a>
                  )}
                </div>
                <div className="text-[var(--color-text-dim)] tabular-nums">
                  ~{(taskXp / 1000).toFixed(1)}k slayer XP remaining
                </div>
              </div>
            );
          })()}

          {/* Block-slot overview — markeert duidelijk dat deze 6 vanuit
              de plugin komen, niet handmatig. UI gebruikt ze al automatisch
              via blockedMonsterIds; deze rij is puur affordance. */}
          {pluginSlayer.blocks.length > 0 && (
            <div className="border-t border-[var(--color-accent)]/20 pt-3">
              <div className="text-[10.5px] uppercase tracking-[0.18em] text-[var(--color-text-muted)] mb-1.5">
                Blocks from plugin ({pluginSlayer.blocks.length})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {pluginSlayer.blocks.map((slug) => {
                  const m = MONSTERS_BY_ID.get(slug);
                  if (!m) return null;
                  const actions = buildSlayerTaskActions(m, taskActionOptions);
                  return (
                    <a
                      key={slug}
                      href={actions.wikiHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2 py-1 rounded text-[11px] bg-[var(--color-bg-2)] border border-[var(--color-border)] text-[var(--color-text-dim)] transition-colors hover:border-[var(--color-accent)]/45 hover:text-[var(--color-accent)]"
                      title={`Open ${m.name} block on OSRS Wiki`}
                    >
                      {m.name}
                    </a>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Masters ranking */}
      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-[11px] uppercase tracking-[0.18em] font-bold text-[var(--color-accent)]">
            Best master for you
          </h2>
          <span className="text-[11px] text-[var(--color-text-muted)]">
            Sorted op expected XP/uur
          </span>
        </div>
        {masters.length === 0 ? (
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] p-6 text-center text-[12.5px] text-[var(--color-text-dim)]">
            Geen master beschikbaar voor jouw combat/slayer combinatie. Probeer combat 20+ voor Mazchna.
          </div>
        ) : (
          <div className="space-y-2.5">
            {masters.map((sim) => (
              <MasterCard
                key={sim.master.id}
                sim={sim}
                isExpanded={expanded === sim.master.id}
                onToggle={() => setExpanded(expanded === sim.master.id ? null : sim.master.id)}
                blocks={blockSuggestions(sim.master.id, state)}
                isTop={sim === masters[0]}
                taskActionOptions={taskActionOptions}
              />
            ))}
          </div>
        )}
      </section>

      <p className="mt-2 text-[10.5px] text-center text-[var(--color-text-dim)] italic">
        XP/uur estimates zijn gebaseerd op gemiddelde kill-rates per HP-bucket — gear, cannon en bursting maken in praktijk veel verschil.
        Open <a href={pluginVerifyUrlForSyncedRsn(rsn, "slayer")} className="text-[var(--color-accent)] hover:underline">de RuneLite plugin guide</a> voor live task-data.
      </p>
    </div>
  );
}

function SlayerBankContextBanner({
  context,
  rsn
}: {
  context: SlayerBankContext;
  rsn?: string | null;
}) {
  return (
    <section className="rounded-xl border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5 p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[10.5px] uppercase tracking-[0.18em] font-bold text-[var(--color-accent)]">
            Bank added
          </div>
          <h3 className="mt-1 text-[14px] font-semibold text-[var(--color-text)]">
            Slayer from this bank
          </h3>
          <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
            {context.summary.label} · {context.readyCount} Slayer checks found
          </p>
        </div>
        <BankContextActions source="slayer" rsn={rsn} />
      </div>

      <div className="grid gap-2 md:grid-cols-3">
        <SlayerBankList title="Gear" items={context.gear} empty="No Slayer gear detected" />
        <SlayerBankList title="Supplies" items={context.consumables} empty="No potions, food or bracelets" />
        <SlayerBankList title="Unlocks" items={context.unlocks} empty="No pouch/sack utility found" />
      </div>

      {context.missing.length > 0 && (
        <div className="rounded-lg border border-[var(--color-warning)]/25 bg-[var(--color-warning)]/8 px-3 py-2 text-[11.5px] text-[var(--color-text-dim)]">
          <span className="font-semibold text-[var(--color-warning)]">Check before task:</span>{" "}
          {context.missing.join(" · ")}
        </div>
      )}
    </section>
  );
}

function SlayerBankList({
  title,
  items,
  empty
}: {
  title: string;
  items: SlayerBankContext["gear"];
  empty: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/30 p-3">
      <div className="text-[10.5px] uppercase tracking-[0.18em] font-bold text-[var(--color-text-muted)]">
        {title}
      </div>
      {items.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {items.map((item) => (
            <span
              key={item.id}
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-2)] px-2 py-1 text-[11px] text-[var(--color-text-dim)]"
              title={`${item.name} · item id ${item.id}`}
            >
              <ItemSprite id={item.id} alt="" size={16} />
              <span>{item.name}</span>
              {item.quantity > 1 && (
                <span className="ml-1 text-[var(--color-text-muted)]">×{item.quantity.toLocaleString()}</span>
              )}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-[11.5px] text-[var(--color-text-muted)]">{empty}</p>
      )}
    </div>
  );
}

// ── Master card with expandable task list ──

function MasterCard({ sim, isExpanded, onToggle, blocks, isTop, taskActionOptions }: {
  sim: MasterSimulation;
  isExpanded: boolean;
  onToggle: () => void;
  blocks: TaskOption[];
  isTop: boolean;
  taskActionOptions: SlayerTaskActionOptions;
}) {
  const blockIds = new Set(blocks.map((b) => b.monster.id));
  return (
    <div className={cn(
      "rounded-xl border bg-gradient-to-br from-[var(--color-panel)] to-[var(--color-bg-2)] overflow-hidden",
      isTop
        ? "border-[var(--color-accent)]/40 shadow-[0_0_0_1px_rgba(134, 166, 217,0.15)]"
        : "border-[var(--color-border)]"
    )}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full p-4 flex items-center gap-4 text-left hover:bg-[var(--color-bg-2)]/50 transition-colors"
      >
        <div className={cn(
          "size-10 rounded-lg flex items-center justify-center shrink-0",
          isTop ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)]" : "bg-[var(--color-bg-2)] text-[var(--color-text-muted)]"
        )}>
          {isTop ? <Star className="size-5" /> : <Shield className="size-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-[14.5px] font-semibold text-[var(--color-text)]">{sim.master.name}</h3>
            {isTop && (
              <span className="text-[10px] uppercase tracking-wider text-[var(--color-accent)] bg-[var(--color-accent)]/10 px-1.5 py-0.5 rounded">
                Best for you
              </span>
            )}
          </div>
          <p className="text-[11.5px] text-[var(--color-text-dim)] mt-0.5">
            {sim.master.location} · {sim.eligibleTaskCount} eligible tasks
          </p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[15px] font-bold text-[var(--color-text)] tabular-nums">
            {(sim.averageXpPerHour / 1000).toFixed(1)}k
          </div>
          <div className="text-[10.5px] text-[var(--color-text-muted)] tracking-wide uppercase">
            XP/hour avg
          </div>
        </div>
        {isExpanded ? <ChevronDown className="size-4 text-[var(--color-text-muted)]" /> : <ChevronRight className="size-4 text-[var(--color-text-muted)]" />}
      </button>

      {isExpanded && (
        <div className="border-t border-[var(--color-border)]/60 px-4 py-4 space-y-4">
          {/* Block suggestions */}
          {blocks.length > 0 && (
            <div>
              <h4 className="text-[10.5px] uppercase tracking-[0.18em] font-bold text-[var(--color-text-muted)] mb-2 flex items-center gap-1.5">
                <Skull className="size-3.5" />
                Suggested blocks (lowest XP/u)
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {blocks.map((b) => {
                  const actions = buildSlayerTaskActions(b.monster, taskActionOptions);
                  return (
                    <a
                      key={b.monster.id}
                      href={actions.wikiHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2 py-1 rounded text-[11px] bg-[var(--color-bg-2)] border border-[var(--color-border)] text-[var(--color-text-dim)] transition-colors hover:border-[var(--color-accent)]/45 hover:text-[var(--color-accent)]"
                      title={`${(b.estimatedXpPerHour / 1000).toFixed(1)}k XP/u · open OSRS Wiki`}
                    >
                      {b.monster.name}
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {/* Task table */}
          <div>
            <h4 className="text-[10.5px] uppercase tracking-[0.18em] font-bold text-[var(--color-text-muted)] mb-2">
              Possible tasks ({sim.tasks.length})
            </h4>
            <div className="space-y-1">
              {sim.tasks.map((t) => {
                const actions = buildSlayerTaskActions(t.monster, taskActionOptions);
                return (
                  <div
                    key={t.monster.id}
                    className={cn(
                      "grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 py-1.5 px-2 rounded text-[12px] tabular-nums",
                      blockIds.has(t.monster.id) && "opacity-50"
                    )}
                  >
                    <div className="min-w-0">
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <a
                          href={actions.wikiHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="truncate font-semibold text-[var(--color-text)] transition-colors hover:text-[var(--color-accent)] hover:underline"
                          title={`Open ${t.monster.name} on OSRS Wiki`}
                        >
                          {t.monster.name}
                        </a>
                        {t.monster.slayerLevel > 1 && (
                          <span className="rounded border border-[var(--color-border)] bg-[var(--color-bg-2)] px-1.5 py-0.5 text-[10px] text-[var(--color-text-muted)]">
                            lvl {t.monster.slayerLevel}
                          </span>
                        )}
                        {actions.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded border border-[var(--color-border)] bg-[var(--color-bg-2)] px-1.5 py-0.5 text-[10px] text-[var(--color-text-muted)]"
                          >
                            {tag}
                          </span>
                        ))}
                        {actions.dpsHref && (
                          <a
                            href={actions.dpsHref}
                            className="rounded border border-[var(--color-accent)]/35 bg-[var(--color-accent)]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent)]/15"
                          >
                            DPS
                          </a>
                        )}
                      </div>
                      {t.monster.hint && (
                        <p className="mt-0.5 truncate text-[10.5px] text-[var(--color-text-muted)]">
                          {t.monster.hint}
                        </p>
                      )}
                    </div>
                    <span className="text-[var(--color-text-dim)]" title="Chance you get this task">
                      {(t.probability * 100).toFixed(1)}%
                    </span>
                    <span className="text-[var(--color-text-muted)]" title="Quantity midpoint">
                      ×{t.expectedQuantity}
                    </span>
                    <span className="text-[var(--color-text)] font-medium" title="Est. XP/u">
                      {(t.estimatedXpPerHour / 1000).toFixed(0)}k/u
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
