"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { ArrowRight, Backpack, Ban, Check, ChevronDown, Coins, MapPin, RotateCw, Search, Swords } from "lucide-react";
import { hiscoresAction, syncedPlayerAction } from "@/app/actions";
import { ItemSprite } from "@/components/item-sprite";
import { ScapestackReadinessRail } from "@/components/scapestack-readiness-rail";
import { computeCombatLevel } from "@/lib/hiscores";
import { bankHandoffItemsFromBankItems, readBankHandoffPayload, type NextUpBankItem } from "@/lib/next-bank-handoff";
import { pluginSyncHealth, type PluginSyncHealth } from "@/lib/plugin-sync";
import { pluginVerifyUrlForSyncedRsn } from "@/lib/plugin-sync-actions";
import { scapestackAccountTypeToPlannerType, type PlannerAccountType } from "@/lib/account-type";
import { buildSlayerBankContext, type SlayerBankContext } from "@/lib/slayer-bank-context";
import { decideSlayerTask, type SlayerTaskDecision, type SlayerTaskMood, type SlayerTaskState } from "@/lib/slayer-task-decision";
import { buildSlayerTaskActions } from "@/lib/slayer-task-actions";
import { MONSTERS_BY_ID } from "@/lib/slayer/monsters";
import { rankMasters, type PlayerState } from "@/lib/slayer/simulator";
import { resolveSlayerTaskMonsterId } from "@/lib/slayer/task-ids";

const MASTER_QUESTS = [
  { id: "priest_in_peril", name: "Priest in Peril" },
  { id: "lost_city", name: "Lost City" },
  { id: "shilo_village", name: "Shilo Village" }
];

interface LoadedSlayerSync {
  state: SlayerTaskState | null;
  syncedAt: string;
  pluginVersion: string;
  accountType: PlannerAccountType;
}

function routeMood(): SlayerTaskMood {
  if (typeof window === "undefined") return "smart";
  const value = new URLSearchParams(window.location.search).get("intent");
  if (value === "chill" || value === "cash" || value === "bossing" || value === "unlock" || value === "afk" || value === "short") return value;
  return "smart";
}

function syncedQuestSet(names: string[]): Set<string> {
  const normalized = new Set(names.map((name) => name.toLowerCase()));
  return new Set(MASTER_QUESTS.filter((quest) => normalized.has(quest.name.toLowerCase())).map((quest) => quest.id));
}

export function SlayerClient() {
  const [rsn, setRsn] = useState("");
  const [combatLevel, setCombatLevel] = useState(3);
  const [slayerLevel, setSlayerLevel] = useState(1);
  const [questsDone, setQuestsDone] = useState<Set<string>>(new Set());
  const [sync, setSync] = useState<LoadedSlayerSync | null>(null);
  const [bank, setBank] = useState<NextUpBankItem[]>([]);
  const [bankContext, setBankContext] = useState<SlayerBankContext | null>(null);
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [hasPluginPayload, setHasPluginPayload] = useState(false);
  const [pending, startTransition] = useTransition();
  const mood = useMemo(routeMood, []);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("bank") === "none") return;
      const localItems = readBankHandoffPayload(window);
      setBank(localItems.map((item) => ({ id: item.id, name: item.name, quantity: item.quantity })));
      setBankContext(buildSlayerBankContext(localItems));
    } catch {
      setBank([]);
      setBankContext(null);
    }
  }, []);

  const lookupRsn = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setRsn(trimmed);
    setLookupError(null);
    setLookupMessage(null);
    setHasPluginPayload(false);
    setSync(null);

    startTransition(async () => {
      const [hiscores, player] = await Promise.all([
        hiscoresAction(trimmed),
        syncedPlayerAction(trimmed)
      ]);
      if (!hiscores) {
        setLookupError(`No Hiscores result for “${trimmed}”. Check the spelling.`);
        return;
      }

      const nextCombat = computeCombatLevel(hiscores.skills);
      const nextSlayer = hiscores.skills.find((skill) => skill.name.toLowerCase() === "slayer")?.level ?? 1;
      setCombatLevel(nextCombat);
      setSlayerLevel(nextSlayer);
      setQuestsDone(player ? syncedQuestSet(player.questsCompleted) : new Set());
      setHasPluginPayload(Boolean(player));

      if (player) {
        setSync({
          state: player.slayer,
          syncedAt: player.syncedAt,
          pluginVersion: player.pluginVersion,
          accountType: scapestackAccountTypeToPlannerType(player.accountType)
        });
        if (player.bankItems.length > 0) {
          const pluginBank = player.bankItems.map((item) => ({ id: item.id, name: item.name, quantity: item.quantity }));
          const handoff = bankHandoffItemsFromBankItems(pluginBank, "RuneLite bank sync");
          setBank(pluginBank);
          setBankContext(buildSlayerBankContext(handoff));
        }
      }

      const taskSlug = player?.slayer
        ? resolveSlayerTaskMonsterId(player.slayer.taskName, player.slayer.currentTaskId)
        : null;
      const taskFound = Boolean(player?.slayer?.taskRemaining && taskSlug);
      const unresolvedTask = Boolean(player?.slayer?.taskRemaining && !taskSlug);
      setLookupMessage(taskFound
        ? `Found ${player!.slayer!.taskRemaining.toLocaleString()} left on your current task.`
        : unresolvedTask
          ? `RuneLite found ${player!.slayer!.taskRemaining.toLocaleString()} left, but this older scan does not include the task name yet.`
        : player
          ? "RuneLite is connected, but no active Slayer task was found."
          : "Stats loaded. Add RuneLite to read the current task.");
    });
  }, []);

  useEffect(() => {
    try {
      const paramRsn = new URLSearchParams(window.location.search).get("rsn");
      if (paramRsn?.trim()) lookupRsn(paramRsn);
    } catch {
      // Manual lookup remains available.
    }
  }, [lookupRsn]);

  const syncHealth = useMemo<PluginSyncHealth | "unknown">(() => sync
    ? pluginSyncHealth({ pluginVersion: sync.pluginVersion, syncedAt: sync.syncedAt, staleAfterHours: 6 })
    : "unknown", [sync]);
  const taskMonster = useMemo(() => {
    const slug = sync?.state ? resolveSlayerTaskMonsterId(sync.state.taskName, sync.state.currentTaskId) : null;
    return slug ? MONSTERS_BY_ID.get(slug) ?? null : null;
  }, [sync]);
  const decision = useMemo(() => taskMonster && sync?.state
    ? decideSlayerTask({
        task: taskMonster,
        state: sync.state,
        bank,
        accountType: sync.accountType,
        combatLevel,
        slayerLevel,
        mood,
        syncHealth
      })
    : null, [bank, combatLevel, mood, slayerLevel, sync, syncHealth, taskMonster]);

  const playerState = useMemo<PlayerState>(() => ({
    combatLevel,
    slayerLevel,
    completedQuests: questsDone,
    blockedMonsterIds: new Set(sync?.state?.blocks ?? []),
    taskStreak: sync?.state?.streak ?? 0
  }), [combatLevel, questsDone, slayerLevel, sync]);
  const masters = useMemo(() => rankMasters(playerState), [playerState]);

  return (
    <div className="space-y-5">
      <RsnLookup
        rsn={rsn}
        setRsn={setRsn}
        onLookup={() => lookupRsn(rsn)}
        pending={pending}
        message={lookupMessage}
        error={lookupError}
      />

      {decision && taskMonster ? (
        <SlayerTaskRoute
          decision={decision}
          monster={taskMonster}
          rsn={rsn}
          bankContext={bankContext}
        />
      ) : (
        <NoCurrentTask
          rsn={rsn}
          hasSync={hasPluginPayload}
          pending={pending}
          topMaster={masters[0]?.master.name ?? null}
          unresolvedRemaining={sync?.state?.taskRemaining && !taskMonster ? sync.state.taskRemaining : 0}
        />
      )}

      <details className="group border-y border-[var(--color-border)] py-1">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 py-3 text-[13px] font-bold text-[var(--color-text)]">
          <span>Make this task sharper</span>
          <ChevronDown className="size-4 text-[var(--color-text-muted)] transition-transform group-open:rotate-180" />
        </summary>
        <div className="pb-4">
          <ScapestackReadinessRail
            surface="slayer"
            hasBankContext={bank.length > 0}
            hasRsn={Boolean(rsn.trim())}
            hasPluginSync={hasPluginPayload}
            pluginSyncState={hasPluginPayload ? (syncHealth === "unknown" ? "stale" : syncHealth) : null}
            rsn={rsn}
          />
        </div>
      </details>

      <MasterRoutes masters={masters} />
    </div>
  );
}

function RsnLookup({
  rsn,
  setRsn,
  onLookup,
  pending,
  message,
  error
}: {
  rsn: string;
  setRsn: (value: string) => void;
  onLookup: () => void;
  pending: boolean;
  message: string | null;
  error: string | null;
}) {
  return (
    <section className="border-b border-[var(--color-border)] pb-5">
      <label htmlFor="slayer-rsn-input" className="mb-2 block font-serif text-[22px] font-bold text-[var(--color-text)]">
        Load your Slayer task
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            id="slayer-rsn-input"
            name="rsn"
            value={rsn}
            onChange={(event) => setRsn(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") onLookup(); }}
            placeholder="Type your OSRS name"
            maxLength={12}
            autoComplete="off"
            spellCheck={false}
            aria-describedby="slayer-rsn-help slayer-lookup-status"
            aria-invalid={error ? "true" : undefined}
            className="min-h-12 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] pl-10 pr-3 text-[15px] text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
          />
        </div>
        <button
          type="button"
          onClick={onLookup}
          disabled={pending || !rsn.trim()}
          aria-label="Look up Slayer data from Hiscores and RuneLite sync"
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[var(--color-accent)] px-5 text-[14px] font-black text-[var(--color-bg)] disabled:opacity-50"
        >
          {pending ? <RotateCw className="size-4 animate-spin" /> : <Swords className="size-4" />}
          {pending ? "Checking" : "Check task"}
        </button>
      </div>
      <p id="slayer-rsn-help" className="mt-2 text-[12px] text-[var(--color-text-muted)]">
        Uses Hiscores for levels and RuneLite for your task, points, streak, blocks and bank.
      </p>
      {(message || error) && (
        <p id="slayer-lookup-status" role="status" aria-live="polite" className={`mt-2 text-[12.5px] font-semibold ${error ? "text-[var(--color-bad)]" : "text-[var(--color-accent)]"}`}>
          {error ?? message}
        </p>
      )}
    </section>
  );
}

function SlayerTaskRoute({
  decision,
  monster,
  rsn,
  bankContext
}: {
  decision: SlayerTaskDecision;
  monster: NonNullable<ReturnType<typeof MONSTERS_BY_ID.get>>;
  rsn: string;
  bankContext: SlayerBankContext | null;
}) {
  const actions = buildSlayerTaskActions(monster, { hasBankContext: decision.bankUsed, rsn });
  const primaryHref = decision.verdict === "refresh"
    ? pluginVerifyUrlForSyncedRsn(rsn, "slayer")
    : decision.bossVariant
      ? `/dps?boss=${decision.bossVariant.slug}&from=slayer-task&rsn=${encodeURIComponent(rsn)}`
      : actions.wikiHref;
  const primaryLabel = decision.verdict === "refresh" ? "Sync again" : decision.bossVariant ? "Build boss setup" : "Open task guide";

  return (
    <article className="overflow-hidden rounded-xl border border-[var(--color-accent)]/55 bg-[var(--color-panel)] shadow-[0_24px_80px_-58px_rgba(0,0,0,0.95)]">
      <div className="p-5 sm:p-7">
        <div className="flex gap-4 sm:gap-5">
          <div className="flex size-20 shrink-0 items-center justify-center rounded-lg border border-[var(--color-accent)]/30 bg-[var(--color-bg)] sm:size-28">
            <ItemSprite id={decision.bossVariant?.viability.boss.iconItemId ?? 11864} alt="" size={72} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--color-accent)]">{decision.verdictLabel}</div>
            <h2 className="mt-1 font-serif text-[27px] font-bold leading-tight text-[var(--color-text)] sm:text-[38px]">
              {decision.remaining.toLocaleString()} {decision.task.name}{decision.remaining === 1 ? "" : "s"}
            </h2>
            <p className="mt-2 max-w-3xl text-[13px] font-semibold leading-relaxed text-[var(--color-text-dim)] sm:text-[14px]">{decision.why}</p>
          </div>
        </div>

        <div className="mt-6 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
          <RouteLine icon={Swords} label="Start" value={decision.firstStep} />
          <RouteLine icon={Backpack} label="Bring" value={inventoryCopy(decision)} />
          <RouteLine icon={MapPin} label="Stop at" value={decision.stopPoint} />
          <RouteLine icon={Coins} label="Points" value={decision.pointsConsequence} />
          {decision.avoid && <RouteLine icon={Ban} label="Skip for now" value={decision.avoid} />}
        </div>

        {decision.inventory.length > 0 && decision.bankUsed && (
          <div className="mt-5 flex flex-wrap gap-2" aria-label="Task items checked in bank">
            {decision.inventory.slice(0, 6).map((item) => (
              <span key={item.label} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${item.owned ? "border-[var(--color-accent)]/45 text-[var(--color-accent)]" : "border-[var(--color-warning)]/35 text-[var(--color-warning)]"}`}>
                {item.owned ? <Check className="size-3" /> : <Ban className="size-3" />}
                {item.itemName ?? item.label}
              </span>
            ))}
          </div>
        )}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <a href={primaryHref} target={primaryHref.startsWith("http") ? "_blank" : undefined} rel={primaryHref.startsWith("http") ? "noopener noreferrer" : undefined} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[var(--color-accent)] px-5 text-[13px] font-black text-[var(--color-bg)]">
            {primaryLabel}<ArrowRight className="size-4" />
          </a>
          {actions.dpsHref && !decision.bossVariant && (
            <a href={actions.dpsHref} className="inline-flex min-h-12 items-center justify-center rounded-lg border border-[var(--color-border)] px-5 text-[13px] font-bold text-[var(--color-text)]">Check owned gear</a>
          )}
        </div>
      </div>

      {bankContext && (
        <details className="group border-t border-[var(--color-border)] px-5 py-1 sm:px-7">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between text-[12.5px] font-bold text-[var(--color-text)]">
            <span>Items found for this task</span>
            <span className="flex items-center gap-2 text-[var(--color-text-muted)]">{bankContext.readyCount} found <ChevronDown className="size-4 transition-transform group-open:rotate-180" /></span>
          </summary>
          <div className="flex flex-wrap gap-2 pb-5">
            {[...bankContext.gear, ...bankContext.consumables, ...bankContext.unlocks].slice(0, 12).map((item) => (
              <span key={item.id} className="inline-flex items-center gap-2 rounded-md border border-[var(--color-border)] px-2.5 py-1.5 text-[11.5px] text-[var(--color-text-dim)]">
                <ItemSprite id={item.id} alt="" size={18} />{item.name}{item.quantity > 1 ? ` ×${item.quantity.toLocaleString()}` : ""}
              </span>
            ))}
          </div>
        </details>
      )}
    </article>
  );
}

function RouteLine({ icon: Icon, label, value }: { icon: typeof Swords; label: string; value: string }) {
  return (
    <div className="grid gap-1 py-4 sm:grid-cols-[120px_1fr] sm:gap-4">
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--color-accent)]"><Icon className="size-3.5" />{label}</div>
      <p className="text-[12.5px] font-semibold leading-relaxed text-[var(--color-text-dim)] sm:text-[13px]">{value}</p>
    </div>
  );
}

function inventoryCopy(decision: SlayerTaskDecision): string {
  if (!decision.bankUsed) return "Add bank for an owned-item check; keep the first trip short until then.";
  const owned = decision.inventory.filter((item) => item.owned).map((item) => item.itemName ?? item.label);
  if (decision.missing.length > 0) return `${owned.slice(0, 3).join(", ") || "Basic task gear"}. Missing: ${decision.missing.join(", ")}.`;
  return owned.slice(0, 4).join(", ") || "Your bank covers the basic task setup.";
}

function NoCurrentTask({
  rsn,
  hasSync,
  pending,
  topMaster,
  unresolvedRemaining
}: {
  rsn: string;
  hasSync: boolean;
  pending: boolean;
  topMaster: string | null;
  unresolvedRemaining: number;
}) {
  if (pending) return null;
  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-5 sm:p-7">
      <div className="max-w-2xl">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--color-accent)]">Next Slayer move</div>
        <h2 className="mt-2 font-serif text-[28px] font-bold text-[var(--color-text)]">
          {unresolvedRemaining > 0
            ? "Refresh the task name once."
            : hasSync
              ? "Get a task, then sync once."
              : rsn
                ? "Let RuneLite read the current task."
                : "Start with your OSRS name."}
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-text-muted)]">
          {unresolvedRemaining > 0
            ? `The previous scan found ${unresolvedRemaining.toLocaleString()} kills left but did not carry the monster name, so Scapestack will not guess the task.`
            : topMaster
              ? `${topMaster} is the strongest available master from the levels and quests currently known.`
              : "Scapestack will not invent a live task from levels alone."}
        </p>
        {rsn && (
          <a href={pluginVerifyUrlForSyncedRsn(rsn, "slayer")} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--color-accent)] px-4 text-[13px] font-black text-[var(--color-bg)]">Check RuneLite <ArrowRight className="size-4" /></a>
        )}
      </div>
    </section>
  );
}

function MasterRoutes({ masters }: { masters: ReturnType<typeof rankMasters> }) {
  return (
    <details className="group border-y border-[var(--color-border)] py-1">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 py-3">
        <div>
          <div className="font-serif text-[19px] font-bold text-[var(--color-text)]">Compare Slayer masters</div>
          <div className="mt-0.5 text-[11.5px] text-[var(--color-text-muted)]">Only when you need a new assignment.</div>
        </div>
        <ChevronDown className="size-4 text-[var(--color-text-muted)] transition-transform group-open:rotate-180" />
      </summary>
      <div className="divide-y divide-[var(--color-border)] pb-3">
        {masters.length > 0 ? masters.map((simulation, index) => (
          <div key={simulation.master.id} className="flex items-center justify-between gap-4 py-3">
            <div>
              <div className="text-[13px] font-bold text-[var(--color-text)]">{simulation.master.name}{index === 0 ? " · best available" : ""}</div>
              <div className="mt-0.5 text-[11.5px] text-[var(--color-text-muted)]">{simulation.master.location} · {simulation.eligibleTaskCount} possible tasks</div>
            </div>
            <span className="text-[11px] font-bold text-[var(--color-accent)]">Combat {simulation.master.combatRequirement}+</span>
          </div>
        )) : (
          <p className="py-4 text-[12.5px] text-[var(--color-text-muted)]">No master can be verified from the known levels and quest gates yet.</p>
        )}
      </div>
    </details>
  );
}
