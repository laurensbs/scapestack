"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  ArrowRight, ChevronRight, Edit3, Target, Sword, TrendingUp, Layers,
  Sparkles, Trophy, Gamepad2, Coins, Scroll, Map as MapIcon, Dices, ExternalLink,
  Copy, CheckCheck, CheckCircle2, Shield, Trash2, Camera
} from "lucide-react";
import { SupportCard } from "@/components/support-card";
import { SavedBankBanner } from "@/components/saved-bank-banner";
import { BossSprite } from "@/components/boss-picker";
import { ItemSprite } from "@/components/item-sprite";
import { KcProbabilityGraph } from "@/components/kc-probability-graph";
import { XpDropLoader } from "@/components/xp-drop-loader";
import { ShuffleLoader } from "@/components/shuffle-loader";
import { BossDetailModal } from "@/components/boss-detail-modal";
import { BOSSES, type Boss } from "@/lib/bosses";
import { ownedGear, type GearItem } from "@/lib/gear";
import { organizeAction, nextUpAction, hiscoresAction, womAction, collectionLogAction, templeAction, syncedPlayerAction } from "@/app/actions";
import { type HiscoreSkill } from "@/lib/hiscores";
import { unlockedFromHiscores, GOAL_SETS, normaliseCompletion, type SetCompletion } from "@/lib/goals";
import type { HoursToMaxSummary } from "@/lib/hours-to-max";
import { loadSavedBank, loadSavedRsn, saveSavedRsn, type SavedBank } from "@/lib/saved-bank";
import { track } from "@/lib/analytics";
import type { Recommendation, RecKind, NextUpResult } from "@/lib/next-up";
import { defaultActionHints } from "@/lib/rec-hints";
import {
  pickForRoute,
  MOOD_LABEL,
  ROUTE_LENS_LABEL,
  ROUTE_LENS_ORDER,
  type Mood,
  type RouteLens,
  type TimeBudget
} from "@/lib/mood";
import { saveMood, loadMood, relativeSince, type MoodSession } from "@/lib/mood-storage";
import {
  clearRecommendationFeedback,
  latestRecommendationFeedback,
  latestRecommendationMemory,
  loadRecommendationFeedback,
  recommendationMemoryCounts,
  recordRecommendationMemory,
  restoreRecommendation,
  suppressRecommendation,
  type RecommendationMemoryEntry,
  type RecommendationFeedback
} from "@/lib/recommendation-feedback";
import { wikiSearchUrl } from "@/lib/wiki";
import { pluginSyncHealth } from "@/lib/plugin-sync";
import { isPluginSyncSource, pluginVerifyUrlForSyncedRsn } from "@/lib/plugin-sync-actions";
import { summarizeNextPluginSync } from "@/lib/next-plugin-sync-summary";
import { toolHandoffUrl } from "@/lib/bank-tool-routes";
import { bankOrganizerHref } from "@/lib/bank-handoff-url";
import { shouldReadNextBankHandoff, shouldReadNextHeroBank } from "@/lib/next-route-context";
import { nextIntentFromSearch, type NextIntentPreset } from "@/lib/next-intent";
import { formatRecommendationSessionPlan } from "@/lib/action-plan-text";
import {
  bossBySlug,
  bossViabilityFromBankItems,
  type BossViability
} from "@/lib/boss-viability";
import {
  primaryActionForRecommendation,
  recommendationHrefWithContext,
  routeActionForHref,
  type RecommendationActionContext
} from "@/lib/recommendation-action";
import { exportTag } from "@/lib/bank-tags";
import { copyText } from "@/lib/clipboard";
import { cn, formatGp } from "@/lib/utils";
import {
  NEXT_BANK_HANDOFF_KEY,
  bankHandoffItemsFromBankItems,
  bankHandoffItemsFromTabs,
  clearBankHandoffPayload,
  nextUpBankFromHandoff,
  organizedItemsFromHandoff,
  persistBankHandoffPayloadFromItems,
  readBankHandoffPayload,
  summarizeBankHandoff,
  type BankHandoffItem
} from "@/lib/next-bank-handoff";
import { buildNextBankContext } from "@/lib/next-bank-context";
import type { OrganizedItem } from "@/lib/organizer";

// Per-kind visual identity — Lucide fallback + an OSRS sprite. Recs that
// already carry their own `iconItemId` keep theirs; everything else falls
// back to the kind's signature item so the page reads as OSRS, not generic
// SaaS. The Lucide icon is a third-tier fallback for if the wiki sprite
// 404s.
//   quest → Quest point cape (signature of completionist questing)
//   diary → Karamja gloves 4 (most-recognised diary reward)
//   skill → Skill cape (any 99 cape stands in for skill progression)
//   bank  → Bank filler (literal bank icon, in-game)
//   milestone → Max cape
const KIND_META: Record<RecKind, { icon: typeof Target; label: string; iconItemId?: number }> = {
  goal:      { icon: Target,     label: "Goal",         iconItemId: 9813   }, // Quest point cape — generic "completion"
  quest:     { icon: Scroll,     label: "Quest",        iconItemId: 9813   }, // Quest point cape
  diary:     { icon: MapIcon,    label: "Diary",        iconItemId: 11140  }, // Karamja gloves 4
  boss:      { icon: Sword,      label: "Boss",         iconItemId: 4151   }, // Abyssal whip
  kc:        { icon: Dices,      label: "Drop chance",  iconItemId: 22325  }, // Scythe of vitur head
  minigame:  { icon: Gamepad2,   label: "Minigame",     iconItemId: 20720  }, // Bruma torch
  money:     { icon: Coins,      label: "Money",        iconItemId: 995    }, // Coins
  slayer:    { icon: Sword,      label: "Slayer",       iconItemId: 11864  }, // Slayer helmet
  skill:     { icon: TrendingUp, label: "Skill",        iconItemId: 9747   }, // Attack cape (any skill cape)
  bank:      { icon: Layers,     label: "Bank",         iconItemId: 20594  }, // Bank filler
  milestone: { icon: Trophy,     label: "Milestone",    iconItemId: 13342  }  // Max cape
};

function hasDropChanceGraph(rec: Recommendation): rec is Recommendation & { kcMeta: NonNullable<Recommendation["kcMeta"]> } {
  return Boolean(rec.kcMeta && rec.kcMeta.dropName !== "first 50 KC");
}

const SAMPLE_LABEL = "simple returning-player plan";
const COMPACT_NUMBER = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

const SAMPLE_SKILL_NAMES = [
  "Attack", "Defence", "Strength", "Hitpoints", "Ranged", "Prayer",
  "Magic", "Cooking", "Woodcutting", "Fletching", "Fishing", "Firemaking",
  "Crafting", "Smithing", "Mining", "Herblore", "Agility", "Thieving",
  "Slayer", "Farming", "Runecraft", "Hunter", "Construction", "Sailing"
];

const SAMPLE_LEVELS: Record<string, number> = {
  Attack: 90, Defence: 80, Strength: 90, Hitpoints: 85, Ranged: 92,
  Prayer: 74, Magic: 85, Cooking: 80, Woodcutting: 70, Fletching: 80,
  Fishing: 70, Firemaking: 70, Crafting: 75, Smithing: 70, Mining: 72,
  Herblore: 78, Agility: 70, Thieving: 80, Slayer: 80, Farming: 75,
  Runecraft: 70, Hunter: 70, Construction: 75, Sailing: 34
};

const SAMPLE_BANK = [
  { id: 4151, name: "Abyssal whip" },
  { id: 28688, name: "Blazing blowpipe" },
  { id: 11804, name: "Bandos godsword" },
  { id: 11832, name: "Bandos chestplate" },
  { id: 11834, name: "Bandos tassets" },
  { id: 19553, name: "Amulet of torture" },
  { id: 12954, name: "Dragon defender" },
  { id: 7462, name: "Barrows gloves" },
  { id: 21295, name: "Infernal cape" },
  { id: 21907, name: "Vorkath's head" },
  { id: 12921, name: "Magic fang" }
];

function sampleSkills(): HiscoreSkill[] {
  const skills = SAMPLE_SKILL_NAMES.map((name, index) => ({
    id: index + 1,
    name,
    rank: 100_000,
    level: SAMPLE_LEVELS[name] ?? 1,
    xp: SAMPLE_LEVELS[name] >= 99 ? 13_034_431 : 737_627
  }));
  const total = skills.reduce((sum, skill) => sum + skill.level, 0);
  return [{ id: 0, name: "Overall", rank: 100_000, level: total, xp: 0 }, ...skills];
}

function asOrganizedItems(items: Array<{ id: number; name: string }>): OrganizedItem[] {
  return items.map((item) => ({
    ...item,
    subtab: "Demo",
    slot: null,
    weight: 0,
    quantity: 1,
    unitPrice: 0,
    stackValue: 0
  }));
}

// Render a kind's signature glyph: OSRS sprite first (with a mounted-fade-in
// so the wiki round-trip doesn't pop), Lucide icon as a fallback when the
// sprite 404s. Used in the kind-group header — small, monochrome-ish, no
// border. `tone` flips the Lucide tint between muted (group headers) and
// accent (where the sprite container is already accent-tinted).
function KindGlyph({
  kind,
  size = 14,
  tone = "muted"
}: {
  kind: RecKind;
  size?: number;
  tone?: "muted" | "accent";
}) {
  const meta = KIND_META[kind];
  if (meta.iconItemId) {
    return (
      <ItemSprite
        id={meta.iconItemId}
        alt=""
        className="pixelated shrink-0"
        style={{
          width: size,
          height: size,
          objectFit: "contain",
          imageRendering: "pixelated",
          filter: "drop-shadow(1px 1px 0 rgb(0 0 0 / 0.9))"
        }}
      />
    );
  }
  const Icon = meta.icon;
  return (
    <Icon
      className={cn(
        "shrink-0",
        tone === "accent" ? "text-[var(--color-accent)]" : "text-[var(--color-text-muted)]"
      )}
      style={{ width: size, height: size }}
      strokeWidth={1.75}
    />
  );
}

export function NextClient({ initialQueryString }: { initialQueryString: string }) {
  const [view, setView] = useState<"intake" | "result" | "not-found">("intake");
  const [result, setResult] = useState<NextUpResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  // When we land on the not-found view, remember what the user typed so
  // we can show 'Lynx Titan didn't return any data' and offer a retry.
  const [notFoundRsn, setNotFoundRsn] = useState<string>("");
  // GearItem[] derived from the player's bank — needed by the boss
  // detail modal which is shared with /dps. Stored alongside `result`
  // so a KC-rec click opens the modal with real owned-gear instead
  // of an empty bag.
  const [ownedGearItems, setOwnedGearItems] = useState<GearItem[]>([]);
  // Currently-open boss in the detail modal (KC-rec click target).
  const [modalBoss, setModalBoss] = useState<Boss | null>(null);
  const [pending, startTransition] = useTransition();
  const [expectedPluginSync, setExpectedPluginSync] = useState(false);
  // When the user came from /bank's plan-next-move handoff,
  // we surface a small banner on the intake so they know the bank is
  // already loaded — they only need to add an RSN for stat-aware advice.
  // Avoids `useSearchParams` (which would need a Suspense wrapper at the
  // page level, as we discovered with /bank).
  const [fromBank, setFromBank] = useState<{ items: BankHandoffItem[] } | null>(null);
  // Saved-bank welcome-back: same component as on /bank. Loaded once on
  // mount. Beats nothing — a returning player on /next can now just click
  // a button instead of going to /bank, pasting again, then coming back.
  // We *don't* clobber the bank-handoff banner; if both are present
  // fromBank wins (the user is mid-flow from /bank — that's a fresher
  // intent than yesterday's saved bank).
  const [savedBank, setSavedBank] = useState<SavedBank | null>(null);
  const [savedRsn, setSavedRsn] = useState<string | null>(null);
  const [activeBankItems, setActiveBankItems] = useState<BankHandoffItem[]>([]);
  const [activeRsn, setActiveRsn] = useState("");
  const routeIntent = useMemo(
    () => nextIntentFromSearch(initialQueryString),
    [initialQueryString]
  );
  const cameFromPlugin = useMemo(() => {
    const params = new URLSearchParams(initialQueryString.replace(/^\?/, ""));
    return params.get("from") === "plugin";
  }, [initialQueryString]);

  // Three intake paths feed the same engine: RSN-only (no bank),
  // RSN + bank (full data), or sample data (demo). A fourth, hidden
  // path: pre-parsed `bankItems` from /bank's plan-next-move
  // handoff via sessionStorage — skips the textarea + organizeAction
  // round-trip entirely. Each path builds the same engine input shape;
  // we branch at the edges, not in the engine.
  const run = (opts: { input?: string; rsn?: string; bankItems?: BankHandoffItem[]; sample?: boolean }) => {
    setError(null);
    setActiveBankItems([]);
    // Fire the funnel event *before* the async work — Plausible is
    // fire-and-forget; we don't want the await chain in front of it.
    track("next:submit", {
      hasRsn: Boolean((opts.rsn ?? "").trim()),
      hasBank: Boolean((opts.input ?? "").trim() || (opts.bankItems && opts.bankItems.length > 0))
    });
    startTransition(async () => {
      // Minimum loader-tijd: zelfs als data binnen 50ms binnen is
      // (cached request) houden we de ShuffleLoader minimaal 2s op
      // het scherm. Voorkomt dat de wow-animatie nauwelijks zichtbaar
      // is + geeft de speler een moment om de lore-quote te lezen.
      const minLoaderUntil = Date.now() + 2000;
      const rsn = (opts.rsn ?? "").trim();
      const input = (opts.input ?? "").trim();
      setActiveRsn(rsn);

      if (opts.sample) {
        setActiveRsn("");
        const bank = SAMPLE_BANK.map((item) => ({ ...item }));
        const sampleHandoffItems = bankHandoffItemsFromBankItems(bank, "Demo PvM sample");
        setActiveBankItems(sampleHandoffItems);
        try {
          persistBankHandoffPayloadFromItems(sampleHandoffItems, window);
        } catch {
          // Demo still works in /next if storage is unavailable; DPS handoff is best-effort.
        }
        setOwnedGearItems(ownedGear(asOrganizedItems(bank)));
        setResult(await nextUpAction({
          skills: sampleSkills(),
          bank,
          questPoints: 180,
          bossKc: {
            Vorkath: 250,
            Zulrah: 180,
            Vardorvis: 15
          },
          accountMeta: {
            displayName: "Demo PvMer",
            accountType: "regular",
            ehp: 420,
            ehb: 85,
            lastChangedAt: null
          },
          syncedSources: {
            wom: false,
            temple: false,
            collectionLog: false,
            scapestack: null
          }
        }));
        const remainingLoaderMs = minLoaderUntil - Date.now();
        if (remainingLoaderMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, remainingLoaderMs));
        }
        setView("result");
        return;
      }

      // Five best-effort lookups in parallel:
      //   - Hiscores: Jagex official. Skills + bossKC + activities.
      //   - WOM: account type + EHP/EHB + WOM-tracked boss KCs.
      //   - Temple: per-quest completion (real data, not heuristic).
      //   - cl.net: per-item collection-log state.
      //   - scapestackSync: our own plugin (highest priority — sources
      //     quest + diary + CL state directly from the game client).
      // Each returns null when the player isn't tracked there — we keep
      // whatever we got and fall back to heuristics for the rest.
      const [hiscores, wom, temple, collectionLog, scapestackSync] = rsn
        ? await Promise.all([
            hiscoresAction(rsn),
            womAction(rsn),
            templeAction(rsn),
            collectionLogAction(rsn),
            syncedPlayerAction(rsn)
          ])
        : [null, null, null, null, null];

      // Three ways to fill `bank`: pre-parsed handoff, paste-string, or
      // empty. organizeAction is only called for the paste-string path.
      const handoffItems = opts.bankItems ?? [];
      let bankItemsForContext = handoffItems;
      let bank: Array<{ id: number; name: string }> = nextUpBankFromHandoff(handoffItems);
      // ownedGear needs richer OrganizedItem-shaped entries. The /bank
      // handoff now carries quantity/value/subtab metadata, so boss detail
      // modals can use the gear immediately instead of looking bank-less.
      let gearItems: GearItem[] = handoffItems.length > 0
        ? ownedGear(organizedItemsFromHandoff(handoffItems))
        : [];
      if (bank.length === 0 && input) {
        const bankRes = await organizeAction(input, { junkFilter: false, includePrices: false });
        if (bankRes.error || !bankRes.result) {
          setError(bankRes.error || "Couldn't read that bank — check the paste.");
          return;
        }
        const flat = bankRes.result.tabs.flatMap((t) => t.items);
        bank = flat.map((it) => ({ id: it.id, name: it.name }));
        gearItems = ownedGear(flat);
        bankItemsForContext = bankHandoffItemsFromTabs(bankRes.result.tabs);
      }
      setOwnedGearItems(gearItems);
      setActiveBankItems(bankItemsForContext);
      if (bankItemsForContext.length > 0 && typeof window !== "undefined") {
        try {
          persistBankHandoffPayloadFromItems(bankItemsForContext, window);
        } catch {
          // Cross-tool handoff is best-effort; the current /next run still has state.
        }
      }

      // Fold in 99-skill capes synthesised from the Hiscores so goal-
      // completion reflects what the player has *earned*, not just what
      // sits in their bank.
      const skills: HiscoreSkill[] = hiscores?.skills ?? [];
      const seenBankIds = new Set(bank.map((it) => it.id));
      const earnedItems = unlockedFromHiscores(skills)
        .filter((cape) => !seenBankIds.has(cape.id));

      // Pull Quest points + every positive boss KC from Hiscores activities.
      const qpActivity = hiscores?.activities.find((a) => a.name === "Quest points");
      const questPoints = qpActivity && qpActivity.score >= 0 ? qpActivity.score : 0;
      const bossKc: Record<string, number> = {};
      for (const a of hiscores?.activities ?? []) {
        if (a.score > 0) bossKc[a.name] = a.score;
      }

      // If neither RSN nor bank gave us anything, branch on *why*. A
      // player who typed an RSN that 404'd on the Hiscores (typo, or
      // combat too low to be ranked) gets the not-found preview screen
      // — better than a red error blob next to the button which is
      // where v0.4 lost people. A player who submitted nothing gets
      // the original 'fill something in' nudge.
      if (skills.length === 0 && bank.length === 0) {
        if (rsn) {
          setNotFoundRsn(rsn);
          setView("not-found");
        } else {
          setError("Enter your OSRS name or paste a bank to get advice.");
        }
        return;
      }

      // Pass all four enrichments. Each is null when the player isn't
      // tracked on that service; the engine + path-progress fall back
      // to heuristics for whatever's missing.
      setResult(await nextUpAction({
        skills, bank, earnedItems, questPoints, bossKc,
        womBossKills: wom?.bossKills,
        accountMeta: wom ? {
          displayName: wom.displayName,
          accountType: wom.accountType,
          ehp: wom.ehp,
          ehb: wom.ehb,
          lastChangedAt: wom.lastChangedAt
        } : null,
        templeQuestsCompleted: temple?.questsCompleted,
        collectionLogOwnedItemIds: collectionLog?.ownedItemIds,
        scapestackSync: scapestackSync ? {
          displayName: scapestackSync.displayName,
          questsCompleted: scapestackSync.questsCompleted,
          diariesCompleted: scapestackSync.diariesCompleted,
          collectionLogItemIds: scapestackSync.collectionLogItemIds,
          slayer: scapestackSync.slayer
        } : undefined,
        syncedSources: {
          wom: wom !== null,
          temple: temple !== null,
          collectionLog: collectionLog !== null,
          scapestack: scapestackSync ? {
            syncedAt: scapestackSync.syncedAt,
            quests: scapestackSync.questsCompleted.length,
            diaries: scapestackSync.diariesCompleted.length,
            clItems: scapestackSync.collectionLogItemIds.length,
            pluginVersion: scapestackSync.pluginVersion,
            slayerTaskRemaining: scapestackSync.slayer?.taskRemaining ?? null,
            slayerBlocks: scapestackSync.slayer?.blocks.length ?? 0
          } : null
        }
      }));

      // Wacht uit tot we de minimum loader-tijd hebben gehaald voordat
      // we naar het result-view flippen. Bij gecachede requests (data
      // in <100ms binnen) houden we de wow-animatie ~2s zichtbaar.
      const remainingLoaderMs = minLoaderUntil - Date.now();
      if (remainingLoaderMs > 0) {
        await new Promise((r) => setTimeout(r, remainingLoaderMs));
      }
      setView("result");

      // Remember the RSN for next time — independent of bank-save. If the
      // user is in the session opt-out (shared device), this is a no-op.
      if (rsn) saveSavedRsn(rsn);
    });
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const queryString = initialQueryString || window.location.search.replace(/^\?/, "");
    const params = new URLSearchParams(queryString);
    setExpectedPluginSync(isPluginSyncSource(params.get("source")));
    const hasFromParam = params.has("from");
    const heroRsn = params.get("rsn");
    const shouldReadBankHandoff = shouldReadNextBankHandoff(queryString);
    const shouldReadHeroBank = shouldReadNextHeroBank(queryString);
    const isDirectRun = params.get("sample") === "1" || Boolean(heroRsn?.trim());
    if (isDirectRun) setSavedBank(null);
    if (shouldReadBankHandoff) {
      try {
        const items = readBankHandoffPayload(window);
        if (items.length > 0) setFromBank({ items });
        // We deliberately DON'T clear sessionStorage here — if the user
        // refreshes /next during the same tab session the banner stays.
      } catch { /* malformed handoff — silently ignore, fall back to intake */ }
    } else {
      // Only look up the saved bank when we're not in a handoff/direct-run flow.
      // Otherwise deep links like /next?rsn=X get blocked by a modal instead of
      // running immediately.
      if (!isDirectRun) setSavedBank(loadSavedBank());
    }
    setSavedRsn(loadSavedRsn());

    // Demo deep-link: /next?sample=1 should behave like clicking the
    // sample CTA. Useful for homepage previews, browser verification and
    // sharing a working result without requiring a real RSN.
    if (params.get("sample") === "1") {
      window.setTimeout(() => {
        run({ sample: true });
      }, 0);
      return;
    }

    // Hero-handoff: ?rsn=X (+optioneel sessionStorage bank-paste) →
    // sla de intake-form over, run direct. Geeft de homepage hero
    // input een one-shot lookup zonder dat /next er een tweede keer
    // om vraagt.
    if (heroRsn && heroRsn.trim()) {
      let heroBank: string | undefined;
      let heroBankItems = [] as BankHandoffItem[];
      if (shouldReadHeroBank) {
        try {
          heroBank = sessionStorage.getItem("scapestack:hero:bank") ?? undefined;
          sessionStorage.removeItem("scapestack:hero:bank");
        } catch { /* sessionStorage disabled */ }
      }
      if (shouldReadBankHandoff) {
        try {
          heroBankItems = readBankHandoffPayload(window);
        } catch { /* malformed handoff — run with RSN only */ }
      }
      // Trigger run zodra de component-state is gestabiliseerd. setTimeout
      // blijft ook werken in background tabs; requestAnimationFrame kan daar
      // te agressief throttlen waardoor deep-links stil op de intake bleven.
      window.setTimeout(() => {
        run({ rsn: heroRsn.trim(), input: heroBank, bankItems: heroBankItems });
      }, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQueryString]);

  // "Use saved gear" from the welcome-back banner. Reuses the same engine
  // pipeline as a fresh paste — by calling run() with the stored input
  // string, we always re-derive recommendations from the latest engine,
  // not from any cached output.
  const useSaved = (bank: SavedBank) => {
    setSavedBank(null);
    run({ input: bank.banktags, rsn: savedRsn ?? "" });
  };

  const clearStoredBankHandoff = () => {
    try {
      clearBankHandoffPayload(window);
    } catch {
    }
    setFromBank(null);
  };

  if (view === "intake") {
    // Hero-handoff: er staat ?rsn=X in de URL en we zijn al aan't laden.
    // Toon de ShuffleLoader full-pane zodat de speler nooit een leeg
    // intake-form ziet voor data die zo binnen is.
    if (pending && typeof window !== "undefined"
        && new URLSearchParams(window.location.search).get("rsn")) {
      return (
        <div className="mx-auto pt-8">
          <ShuffleLoader />
        </div>
      );
    }
    return (
      <NextIntake
        onRun={run}
        loading={pending}
        error={error}
        fromBank={fromBank}
        savedBank={savedBank}
        savedRsn={savedRsn}
        cameFromPlugin={cameFromPlugin}
        onUseSaved={useSaved}
        onDismissSaved={() => setSavedBank(null)}
        onClearBankHandoff={clearStoredBankHandoff}
      />
    );
  }

  if (view === "not-found") {
    return (
      <NotFoundPreview
        rsn={notFoundRsn}
        onRetry={() => { setNotFoundRsn(""); setView("intake"); }}
      />
    );
  }

  return result ? (
    <>
      <ResultView
        result={result}
        bankItems={activeBankItems}
        activeRsn={activeRsn}
        onEdit={() => setView("intake")}
        onClearStoredBankHandoff={clearStoredBankHandoff}
        expectedPluginSync={expectedPluginSync}
        routeIntent={routeIntent}
        onBossOpen={(slug) => {
          const target = BOSSES.find((b) => b.slug === slug);
          if (target) setModalBoss(target);
        }}
      />
      {modalBoss && (
        <BossDetailModal
          boss={modalBoss}
          owned={ownedGearItems}
          onClose={() => setModalBoss(null)}
        />
      )}
    </>
  ) : null;
}

// Empty-state for when an RSN lookup 404s. Instead of a red error
// blob (which is where v0.4 lost people via "Lynx Titan" typos), we
// show what /next *would* look like if the lookup had worked — a
// faded sample-result + a 'try a different name' CTA. The point is
// to keep the user oriented: this tool works, your name didn't.
function NotFoundPreview({ rsn, onRetry }: { rsn: string; onRetry: () => void }) {
  return (
    <section className="animate-[slide-up_0.35s_ease-out] max-w-2xl mx-auto">
      <header className="mb-6">
        <h2 className="text-[22px] sm:text-[26px] font-bold text-[var(--color-text)] tracking-normal leading-tight">
          We couldn&apos;t find <span className="text-[var(--color-accent)]">{rsn}</span> on Hiscores.
        </h2>
        <p className="mt-2 text-[14px] text-[var(--color-text-dim)] leading-relaxed">
          Either it&apos;s a typo, or the account isn&apos;t ranked yet (low combat /
          new account). Try again, or have a look at what a found account looks like.
        </p>
      </header>

      {/* Faded sample-result preview — same shape as a real result page,
          but greyed out and overlaid with a 'try again' CTA. Tells the
          user 'this tool produces something useful' without forcing them
          through the sample-flow detour. */}
      <div className="relative rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)]/40 p-6 overflow-hidden">
        <div className="opacity-40 pointer-events-none select-none" aria-hidden="true">
          <div className="eyebrow text-[var(--color-accent)] mb-1">Start here</div>
          <h3 className="text-[17px] font-bold text-[var(--color-text)] tracking-normal leading-tight">
            Karamja Diary — Hard
          </h3>
          <p className="mt-1.5 text-[13px] text-[var(--color-text-dim)] leading-relaxed">
            Your visible stats clear the Hard skill gates in this region.
          </p>
          <p className="mt-2 text-[12px] text-[var(--color-text-secondary)] border-t border-[var(--color-border)] pt-2">
            Step toward the tier-4 reward; Hard unlocks its tier perks.
          </p>
          <div className="mt-4 grid sm:grid-cols-2 gap-2.5">
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] p-3 text-[12px] text-[var(--color-text-dim)]">
              <div className="font-semibold text-[var(--color-text)]">Try the Dagannoth Kings</div>
              Your Abyssal Whip fits — and CL 89 clears the gate.
            </div>
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] p-3 text-[12px] text-[var(--color-text-dim)]">
              <div className="font-semibold text-[var(--color-text)]">Monkey Madness II</div>
              Grandmaster · Very Long
            </div>
          </div>
        </div>

        {/* Overlay CTA */}
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-transparent via-[var(--color-bg)]/40 to-[var(--color-bg)]/70 backdrop-blur-[1px]">
          <button
            type="button"
            onClick={onRetry}
            className="btn-primary group"
          >
            Try a different name
            <ArrowRight className="size-4 group-hover:translate-x-0.5 transition-transform" />
          </button>
          <p className="mt-3 text-[11.5px] text-[var(--color-text-muted)]">
            What you&apos;d see if your name had been on the list.
          </p>
        </div>
      </div>

      <p className="mt-6 text-[11.5px] text-[var(--color-text-muted)] text-center leading-relaxed">
        Tip: Hiscores names are case-sensitive in some Jagex regions.
        Try &ldquo;Lynx Titan&rdquo; (capital L, T) if you&apos;re testing.
      </p>
    </section>
  );
}

// ── Intake UI ─────────────────────────────────────────────────────────────
// Three paths, surfaced explicitly — that's the whole point of the empty-
// state redesign. RSN-only is the lightest entry (most returning players
// can't export a bank from a session they haven't started). Sample data
// gives a "show me what this looks like" preview. Adding a bank is opt-in
// for optional bank context.
function NextIntake({
  onRun, loading, error, fromBank, savedBank, savedRsn, cameFromPlugin, onUseSaved, onDismissSaved, onClearBankHandoff
}: {
  onRun: (opts: { input?: string; rsn?: string; bankItems?: BankHandoffItem[]; sample?: boolean }) => void;
  loading: boolean;
  error: string | null;
  fromBank: { items: BankHandoffItem[] } | null;
  savedBank: SavedBank | null;
  savedRsn: string | null;
  cameFromPlugin: boolean;
  onUseSaved: (bank: SavedBank) => void;
  onDismissSaved: () => void;
  onClearBankHandoff: () => void;
}) {
  // Pre-fill RSN from the remembered value so a returning player doesn't
  // re-type their name. The bank-save and rsn-save are independent — we
  // might have one without the other.
  const [rsn, setRsn] = useState(savedRsn ?? "");
  const [showBankField, setShowBankField] = useState(false);
  const [bank, setBank] = useState("");
  const handoffSummary = fromBank ? summarizeBankHandoff(fromBank.items) : null;
  const pluginVerifyHref = pluginVerifyUrlForSyncedRsn(rsn, "next", {
    hasBankContext: Boolean(fromBank)
  });

  const submitRsn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rsn.trim() && !fromBank) return;
    onRun({
      rsn,
      input: showBankField ? bank : undefined,
      // If the user came from /bank, ride that bank along so /next can
      // give gear-aware recs even before they type their RSN.
      bankItems: fromBank?.items
    });
  };

  return (
    <section className={cn(
      "max-w-2xl mx-auto",
      loading
        ? "animate-[intake-lift_0.5s_cubic-bezier(0.22,1,0.36,1)_both]"
        : "animate-[slide-up_0.4s_ease-out]"
    )}>
      {/* Hero-vraag: groot, gecentreerd, voelt als één doel-moment. */}
      <header className="mb-8 text-center">
        <h2 className="text-[28px] sm:text-[36px] font-bold text-[var(--color-text)] tracking-normal leading-[1.1]">
          What should you do<br className="sm:hidden" /> next?
        </h2>
        <p className="mt-3 text-[14px] sm:text-[15px] text-[var(--color-text-dim)] leading-relaxed max-w-md mx-auto">
          Type your OSRS name. Scapestack gives one best move, two backups and a clear stop point.
        </p>
      </header>

      {/* Welcome-back banner. Only shown when there's no fresh /bank
          handoff — the loader above already skips populating savedBank
          in that case, but the explicit guard keeps the JSX honest. */}
      {savedBank && !fromBank && (
        <SavedBankBanner
          saved={savedBank}
          loading={loading}
          presentation="inline"
          title="Use your saved gear?"
          message={`We found gear from ${savedBank ? relativeSince(savedBank.savedAt) : "earlier"}. Use it when supplies or GP would change the plan, or skip and start with only an OSRS name.`}
          primaryLabel="Use saved gear"
          secondaryLabel="Skip gear"
          secondaryMode="dismiss"
          onUse={() => onUseSaved(savedBank)}
          onDismiss={onDismissSaved}
        />
      )}

      {cameFromPlugin && (
        <div className="mb-4 rounded-lg border border-[var(--color-warning)]/35 bg-[var(--color-warning)]/8 px-4 py-3 text-left">
          <div className="flex items-start gap-3">
            <Shield className="mt-0.5 size-4 shrink-0 text-[var(--color-warning)]" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-[var(--color-text)]">
                Back from RuneLite
              </p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--color-text-muted)]">
                Enter the same RSN. If the plan still looks guessed, press Sync now in RuneLite and check again.
              </p>
            </div>
            <Link
              href={pluginVerifyHref}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--color-warning)]/35 bg-[var(--color-bg)]/45 px-2.5 py-1.5 text-[11px] font-bold text-[var(--color-warning)] transition-colors hover:bg-[var(--color-warning)]/10"
            >
              Check RuneLite
              <ArrowRight className="size-3" />
            </Link>
          </div>
        </div>
      )}

      {/* Handoff banner — appears when the user arrived here via the
          Gear & Bank's "Plan next move" button. The bank is
          already loaded; an RSN is optional and adds stats. */}
      {fromBank && (
        <div className="mb-4 rounded-lg border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/8 px-4 py-3 flex items-start gap-3 animate-[fade-in_0.3s_ease-out] text-left">
          <Sparkles className="size-4 text-[var(--color-accent)] shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] text-[var(--color-text)] leading-relaxed">
              <span className="font-semibold">Using the gear you just organised</span>
              {handoffSummary ? ` (${handoffSummary.label}).` : "."}{" "}
              Add your OSRS name for stats and KC, or start with gear alone.
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-[var(--color-text-muted)]">
              This gear stays in this browser and expires automatically.
            </p>
            {handoffSummary && handoffSummary.topItems.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-[10.5px] uppercase tracking-[0.14em] font-semibold text-[var(--color-text-muted)]">
                  Top stacks
                </span>
                {handoffSummary.topItems.map((item) => (
                  <span
                    key={item.id}
                    className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)]/45 px-2 py-1 text-[11px] text-[var(--color-text-dim)]"
                    title={`${item.name}: ${item.stackValue.toLocaleString()} gp`}
                  >
                    <ItemSprite id={item.id} alt="" size={15} />
                    <span className="max-w-[120px] truncate">{item.name}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col sm:items-stretch">
            <button
              type="button"
              onClick={() => onRun({ bankItems: fromBank.items })}
              disabled={loading}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--color-accent)]/35 bg-[var(--color-accent)]/10 px-2.5 py-1.5 text-[11px] font-bold text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent)]/15 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Plan with this gear
              <ArrowRight className="size-3" />
            </button>
            <button
              type="button"
              onClick={onClearBankHandoff}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/45 px-2.5 py-1.5 text-[11px] font-semibold text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-danger)]/45 hover:text-[var(--color-danger)]"
            >
              Clear gear
              <Trash2 className="size-3" />
            </button>
          </div>
        </div>
      )}

      {/* Hero input — premium-voelt: gecentreerd, oversized, accent-glow
          op focus. Submit-button leeft binnen het input-frame zodat het
          één geheel is, geen formuliertje. */}
      <form onSubmit={submitRsn}>
        <div className={cn(
          "group relative rounded-2xl bg-[var(--color-panel)] border transition-all",
          loading
            ? "border-[var(--color-accent)]/60 shadow-[0_0_0_4px_rgba(134, 166, 217,0.10)]"
            : "border-[var(--color-border)] focus-within:border-[var(--color-accent)]/60 focus-within:shadow-[0_0_0_4px_rgba(134, 166, 217,0.10)]"
        )}>
          <div className="flex flex-col sm:flex-row sm:items-center">
            <input
              type="text"
              value={rsn}
              onChange={(e) => setRsn(e.target.value)}
              placeholder="Type your OSRS name"
              autoFocus
              disabled={loading}
              className="flex-1 bg-transparent outline-none px-5 py-4 sm:py-5 text-[16px] sm:text-[18px] font-mono text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] disabled:opacity-60"
            />
            <button
              type="submit"
              aria-describedby="next-show-me-disabled-help"
              disabled={loading || (!rsn.trim() && !fromBank)}
              className={cn(
                "group/btn relative overflow-hidden rounded-xl m-1.5 px-5 py-3 inline-flex items-center justify-center gap-2",
                "bg-[var(--color-accent)] text-[var(--color-bg)] font-semibold text-[14px]",
                "hover:brightness-110 transition-all",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {loading ? <XpDropLoader /> : "Plan my next move"}
              {!loading && <ArrowRight className="size-4 group-hover/btn:translate-x-0.5 transition-transform" />}
            </button>
          </div>
          <p
            id="next-show-me-disabled-help"
            aria-live="polite"
            className="border-t border-[var(--color-border)] px-5 py-2 text-[11.5px] leading-relaxed text-[var(--color-text-muted)]"
          >
            {loading
              ? "Building one clear plan…"
              : rsn.trim()
              ? "Ready: public stats are enough. Gear or RuneLite can come later."
              : fromBank
              ? "Ready: gear-only plan. Add a name for stats and KC."
              : "Enter an OSRS name to get one clear next move."}
          </p>

          {/* Tijdens loading verschijnt de ShuffleLoader onder de input
              zodat de speler een rustige "building one plan" state ziet. */}
          {loading && (
            <div className="border-t border-[var(--color-border)]">
              <ShuffleLoader />
            </div>
          )}
        </div>

        {/* Secondary: optional bank paste. Onder
            het hero-frame zodat de eerste indruk niet vol-staat met
            opties — alleen onthuld als de speler er om vraagt. */}
        <div className="mt-4 text-center">
          {showBankField ? (
            <div className="text-left animate-[fade-in_0.3s_ease-out]">
              <label className="block">
                <span className="text-[11.5px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                  Gear paste <span className="normal-case tracking-normal">(optional)</span>
                </span>
                <textarea
                  value={bank}
                  onChange={(e) => setBank(e.target.value)}
                  placeholder="Paste Bank Memory or Bank Tags here…"
                  rows={4}
                  className="mt-2 w-full rounded-lg bg-[var(--color-panel)] border border-[var(--color-border)] focus:border-[var(--color-accent)] outline-none px-3 py-2 text-[12px] font-mono text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] resize-y"
                />
                <button
                  type="button"
                  onClick={() => { setShowBankField(false); setBank(""); }}
                  className="mt-2 text-[11.5px] text-[var(--color-text-muted)] hover:text-[var(--color-text-dim)] transition-colors"
                >
                  Hide gear
                </button>
              </label>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowBankField(true)}
              disabled={loading}
              className="text-[12.5px] text-[var(--color-text-dim)] hover:text-[var(--color-accent)] underline underline-offset-4 decoration-dotted transition-colors disabled:opacity-50"
            >
              + Add gear (optional)
            </button>
          )}
        </div>

        {error && (
          <p className="mt-3 text-[12px] text-[var(--color-warning)] text-center">{error}</p>
        )}
      </form>

      {/* Tertiary: sample run, no input needed */}
      <div className="mt-4 text-center">
        <button
          type="button"
          onClick={() => onRun({ sample: true })}
          disabled={loading}
          className="text-[12.5px] text-[var(--color-text-dim)] hover:text-[var(--color-text)] underline underline-offset-4 decoration-dotted transition-colors disabled:opacity-50"
        >
          New or returning? See a {SAMPLE_LABEL}
        </button>
      </div>

      <p className="mt-8 text-[11.5px] text-[var(--color-text-muted)] text-center leading-relaxed">
        {cameFromPlugin
          ? "RuneLite is optional. If it finds this RSN, /next can avoid progress you already finished. Gear stays in this browser."
          : "Free, no account needed. Gear paste stays in this browser."}
      </p>
    </section>
  );
}

function ResultView({ result, bankItems, activeRsn, onEdit, onBossOpen, onClearStoredBankHandoff, expectedPluginSync, routeIntent }: {
  result: NextUpResult;
  bankItems: BankHandoffItem[];
  activeRsn: string;
  onEdit: () => void;
  // Called when the user clicks a KC-rec to open the boss detail modal.
  // /next threads this from NextClient down to HeadlineCard + RecRow.
  onBossOpen: (slug: string) => void;
  onClearStoredBankHandoff: () => void;
  expectedPluginSync: boolean;
  routeIntent: NextIntentPreset | null;
}) {
  const { headline, rest, summary } = result;
  const [shareMode, setShareMode] = useState(false);

  const basisNote =
    summary.basis === "full" ? "Stats and gear are helping this pick."
    : summary.basis === "hiscores-only" ? "Public stats are enough. Add gear only when GP or supplies change the answer."
    : summary.basis === "bank-only" ? "Gear is enough for a rough plan. Add your OSRS name for stats and KC."
    : "Add your OSRS name or gear when you want a sharper plan.";

  // Alle recommendations voor de What-to-do track. Mood-laag herrangschikt
  // ze; "Also worth knowing" is verdwenen — niet-getoonde recs blijven
  // beschikbaar via de drill-in cards in Where-you-are.
  const allRecs = headline ? [headline, ...rest] : rest;

  // Track-stagger: elke sectie fade'd binnen met 150ms verschil zodat
  // de pagina vouwt-open ipv pop-in. Gebruikt CSS animation-delay
  // (geen JS-timers) zodat motion-prefers-reduced-motion users niets
  // zien dat ze niet willen.
  const trackAnim = (delayMs: number): React.CSSProperties => ({
    animation: "track-in 0.6s cubic-bezier(0.22, 1, 0.36, 1) both",
    animationDelay: `${delayMs}ms`,
  });
  const pluginSyncState = result.pathProgress.syncedSources?.scapestack
    ? summarizeNextPluginSync(result.pathProgress.syncedSources.scapestack).state
    : null;

  return (
    <div className="space-y-6">
      {/* The first screen is the product: one recommendation, two backups. */}
      <div style={trackAnim(0)}>
        <WhatToDo
          allRecs={allRecs}
          activeRsn={activeRsn}
          accountStage={summary.accountStage}
          hasBankContext={bankItems.length > 0}
          bankItems={bankItems}
          onBossOpen={onBossOpen}
          onEdit={onEdit}
          routeIntent={routeIntent}
          pluginSyncState={pluginSyncState}
          shareMode={shareMode}
          onShareModeChange={setShareMode}
        />
      </div>

      {!shareMode && (
        <>
          <div style={trackAnim(150)}>
            <MakePlanSmarter
              summary={summary}
              basisNote={basisNote}
              bankItems={bankItems}
              activeRsn={activeRsn}
              pluginSyncState={pluginSyncState}
              expectedPluginSync={expectedPluginSync}
              onEdit={onEdit}
              onClearStoredBankHandoff={onClearStoredBankHandoff}
            />
          </div>

          <div style={trackAnim(300)}>
            <details className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)]/65 p-4 sm:p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[13px] font-bold text-[var(--color-text)] marker:hidden">
                <span>Account details</span>
                <span className="text-[11.5px] font-semibold text-[var(--color-text-muted)]">
                  Open later
                </span>
              </summary>
              <div className="mt-4 space-y-6">
                <HeroStrip summary={summary} basisNote={basisNote} onEdit={onEdit} />
                <WhereYouAre
                  pathData={result.pathProgress}
                  maxEstimate={result.maxEstimate}
                />
                <BankProgressSection progress={result.readiness} />
              </div>
            </details>
          </div>

          <div className="pt-2" style={trackAnim(450)}>
            <SupportCard />
          </div>
        </>
      )}
    </div>
  );
}

function MakePlanSmarter({
  summary,
  basisNote,
  bankItems,
  activeRsn,
  pluginSyncState,
  expectedPluginSync,
  onEdit,
  onClearStoredBankHandoff
}: {
  summary: NextUpResult["summary"];
  basisNote: string;
  bankItems: BankHandoffItem[];
  activeRsn: string;
  pluginSyncState: "live" | "stale" | "outdated" | null;
  expectedPluginSync: boolean;
  onEdit: () => void;
  onClearStoredBankHandoff: () => void;
}) {
  const hasBank = bankItems.length > 0 || summary.basis === "full" || summary.basis === "bank-only";
  const hasRsn = Boolean(activeRsn.trim());
  const syncHref = pluginVerifyUrlForSyncedRsn(activeRsn, "next", { hasBankContext: hasBank });

  return (
    <details className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)]/65 p-4 sm:p-5">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 marker:hidden">
        <span>
          <span className="block text-[13px] font-bold text-[var(--color-text)]">Add gear</span>
          <span className="mt-0.5 block text-[11.5px] font-medium text-[var(--color-text-muted)]">
            Better supplies, boss picks and Bank Tags.
          </span>
        </span>
        <span className="shrink-0 rounded-full border border-[var(--color-border)] px-2.5 py-1 text-[10.5px] font-bold text-[var(--color-text-muted)]">
          Details
        </span>
      </summary>

      <div className="mt-4 space-y-4">
        <div className="grid gap-2 sm:grid-cols-3">
          <PlanInputTile
            label="OSRS name"
            value={hasRsn ? activeRsn : "Add name"}
            helper={hasRsn ? "Stats, combat and KC are in the plan." : "Adds skills, combat and KC."}
            tone={hasRsn ? "good" : "muted"}
          />
          <PlanInputTile
            label="Gear"
            value={hasBank ? "Loaded" : "Optional"}
            helper={hasBank ? "Gear, supplies and GP can shape the pick." : "Use it when gear matters."}
            tone={hasBank ? "good" : "muted"}
          />
          <PlanInputTile
            label="RuneLite"
            value={pluginSyncState === "live" ? "Helping" : pluginSyncState ? "Refresh" : "Optional"}
            helper={pluginSyncState === "live"
              ? "Skips finished quests, diaries, clog slots and Slayer mistakes."
              : "Use it when finished progress would change the pick."}
            tone={pluginSyncState === "live" ? "good" : pluginSyncState ? "warn" : "muted"}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/45 px-3 py-2 text-[11.5px] font-semibold text-[var(--color-text)] transition-colors hover:border-[var(--color-accent)]/45 hover:text-[var(--color-accent)]"
          >
            Change input
            <Edit3 className="size-3.5" />
          </button>
          {!hasBank && (
            <Link
              href={bankOrganizerHref(activeRsn, "next")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/45 px-3 py-2 text-[11.5px] font-semibold text-[var(--color-text)] transition-colors hover:border-[var(--color-accent)]/45 hover:text-[var(--color-accent)]"
            >
              Add gear
              <ArrowRight className="size-3.5" />
            </Link>
          )}
          {pluginSyncState !== "live" && (
            <Link
              href={syncHref}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-accent)]/35 bg-[var(--color-accent)]/10 px-3 py-2 text-[11.5px] font-semibold text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent)]/15"
            >
              Check RuneLite
              <Sparkles className="size-3.5" />
            </Link>
          )}
        </div>

        <p className="text-[11.5px] leading-relaxed text-[var(--color-text-muted)]">{basisNote}</p>
        {expectedPluginSync && pluginSyncState !== "live" && (
          <div className="rounded-xl border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10 px-4 py-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[12.5px] leading-relaxed text-[var(--color-text-dim)]">
                RuneLite did not show up yet. Sync again, then check this RSN.
              </p>
              <Link
                href={syncHref}
                className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-[var(--color-warning)]/35 bg-[var(--color-bg)]/35 px-3 py-2 text-[11.5px] font-semibold text-[var(--color-warning)] transition-colors hover:bg-[var(--color-warning)]/10"
              >
                Check RuneLite
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </div>
        )}
        <NextBankContextStrip
          bankItems={bankItems}
          basis={summary.basis}
          activeRsn={activeRsn}
          pluginSyncState={pluginSyncState}
          onClearStoredBankHandoff={onClearStoredBankHandoff}
        />
      </div>
    </details>
  );
}

function PlanInputTile({
  label,
  value,
  helper,
  tone
}: {
  label: string;
  value: string;
  helper: string;
  tone: "good" | "warn" | "muted";
}) {
  return (
    <div className={cn(
      "rounded-xl border px-3 py-2.5",
      tone === "good"
        ? "border-[var(--color-good)]/25 bg-[var(--color-good)]/10"
        : tone === "warn"
          ? "border-[var(--color-warning)]/25 bg-[var(--color-warning)]/10"
          : "border-[var(--color-border)] bg-[var(--color-bg)]/35"
    )}>
      <div className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
        {label}
      </div>
      <div className={cn(
        "mt-0.5 text-[12px] font-bold",
        tone === "good" ? "text-[var(--color-good)]" : tone === "warn" ? "text-[var(--color-warning)]" : "text-[var(--color-text-dim)]"
      )}>
        {value}
      </div>
      <p className="mt-1 text-[11px] leading-snug text-[var(--color-text-muted)]">{helper}</p>
    </div>
  );
}

function NextBankContextStrip({
  bankItems,
  basis,
  activeRsn,
  pluginSyncState,
  onClearStoredBankHandoff
}: {
  bankItems: BankHandoffItem[];
  basis: NextUpResult["summary"]["basis"];
  activeRsn: string;
  pluginSyncState: "live" | "stale" | "outdated" | null;
  onClearStoredBankHandoff: () => void;
}) {
  const context = useMemo(() => buildNextBankContext(bankItems), [bankItems]);
  const [handoffCleared, setHandoffCleared] = useState(false);
  if (!context) return null;

  const hasLivePluginSync = pluginSyncState === "live";
  const hasPluginSync = pluginSyncState !== null;
  const basisCopy =
    hasLivePluginSync && bankItems.length > 0
      ? "Gear and finished progress are both shaping this pick."
      : pluginSyncState === "stale"
        ? "RuneLite is connected, but refresh before a long grind or GP spend."
        : pluginSyncState === "outdated"
          ? "RuneLite is connected, but update it before trusting newer details."
          : basis === "full"
            ? "Gear, goals and account gates are ranked together."
            : basis === "bank-only"
              ? "Gear is loaded. Add an OSRS name next time for account gates."
              : "Gear is loaded for item checks.";

  const backToBank = () => {
    if (typeof window === "undefined") return;
    if (document.referrer.includes("/bank")) {
      window.history.back();
      return;
    }
    window.location.href = bankOrganizerHref(activeRsn, "next");
  };

  return (
    <section className="rounded-xl border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/8 px-4 py-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-3">
          <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-[var(--color-accent)]/25 bg-[var(--color-bg)]/40">
            <ItemSprite id={20594} alt="" size={25} />
          </span>
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--color-accent)]">
              {hasPluginSync ? "Gear + RuneLite" : "Gear loaded"}
            </div>
            {hasPluginSync && (
              <div className={cn(
                "mt-1 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.12em]",
                hasLivePluginSync
                  ? "border-[var(--color-good)]/25 bg-[var(--color-good)]/10 text-[var(--color-good)]"
                  : "border-[var(--color-warning)]/25 bg-[var(--color-warning)]/10 text-[var(--color-warning)]"
              )}>
                <CheckCircle2 className="size-3" />
                {hasLivePluginSync ? "Gear + RuneLite" : pluginSyncState === "outdated" ? "Update RuneLite" : "Refresh RuneLite"}
              </div>
            )}
            <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--color-text-dim)]">
              <span className="font-semibold text-[var(--color-text)]">{context.summary.label}</span>
              {" · "}
              {basisCopy}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-[var(--color-text-muted)]">
              This gear stays in this browser. Clear it when you want Scapestack to ignore this gear.
              {handoffCleared ? " Stored gear cleared; this current result keeps the plan it already made until you rerun." : ""}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {context.summary.topItems.map((item) => (
                <span
                  key={item.id}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)]/45 px-2 py-1 text-[11px] text-[var(--color-text-dim)]"
                  title={`${item.name}: ${item.stackValue.toLocaleString()} gp`}
                >
                  <ItemSprite id={item.id} alt="" size={15} />
                  <span className="max-w-[130px] truncate">{item.name}</span>
                  <span className="font-mono text-[var(--color-text-muted)]">{formatGp(item.stackValue)}</span>
                </span>
              ))}
              {context.topAreas.map((area) => (
                <span
                  key={area.name}
                  className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-2)]/45 px-2 py-1 text-[11px] text-[var(--color-text-muted)]"
                  title={area.totalValue > 0 ? `${area.totalValue.toLocaleString()} gp` : undefined}
                >
                  {area.name} · {area.itemCount}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
          <button
            type="button"
            onClick={backToBank}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-bg)]/45 px-3 py-2 text-[11.5px] font-semibold text-[var(--color-text)] transition-colors hover:border-[var(--color-accent)]/45 hover:text-[var(--color-accent)]"
          >
            Review gear
            <ArrowRight className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              onClearStoredBankHandoff();
              setHandoffCleared(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-bg)]/45 px-3 py-2 text-[11.5px] font-semibold text-[var(--color-text)] transition-colors hover:border-[var(--color-danger)]/45 hover:text-[var(--color-danger)]"
          >
            Clear gear
            <Trash2 className="size-3.5" />
          </button>
          <Link
            href={toolHandoffUrl("/dps", "next", activeRsn)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-bg)]/45 px-3 py-2 text-[11.5px] font-semibold text-[var(--color-text)] transition-colors hover:border-[var(--color-accent)]/45 hover:text-[var(--color-accent)]"
          >
            Open DPS
            <Sword className="size-3.5" />
          </Link>
          <Link
            href={toolHandoffUrl("/goals", "next", activeRsn)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-bg)]/45 px-3 py-2 text-[11.5px] font-semibold text-[var(--color-text)] transition-colors hover:border-[var(--color-accent)]/45 hover:text-[var(--color-accent)]"
          >
            Open goals
            <Target className="size-3.5" />
          </Link>
          <Link
            href={toolHandoffUrl("/slayer", "next", activeRsn)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-bg)]/45 px-3 py-2 text-[11.5px] font-semibold text-[var(--color-text)] transition-colors hover:border-[var(--color-accent)]/45 hover:text-[var(--color-accent)]"
          >
            Open Slayer
            <Shield className="size-3.5" />
          </Link>
          <Link
            href={toolHandoffUrl("/plugin", "next", activeRsn)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-accent)]/35 bg-[var(--color-accent)]/10 px-3 py-2 text-[11.5px] font-semibold text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent)]/15"
          >
            Check RuneLite
            <Sparkles className="size-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}

// ── HeroStrip ──────────────────────────────────────────────────────────
// Eén compact account-identity strip. Bewust géén big hero — dat
// gevecht om aandacht voert "What to do" hieronder.

function HeroStrip({ summary, basisNote, onEdit }: {
  summary: NextUpResult["summary"];
  basisNote: string;
  onEdit: () => void;
}) {
  return (
    // Premium hero-card: lichte gradient, accent top-stripe, route sweep
    // van links naar rechts elke 6s. Voelt mee met de loader-vibe.
    <div
      className="relative overflow-hidden rounded-xl border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-panel)] to-[var(--color-bg-2)] p-5 sm:p-6"
    >
      {/* Subtiele accent top-line — zelfde signature als de SyncedBadge
          en headline-card. Bindt het visueel aan de rest van /next. */}
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: "linear-gradient(to right, transparent, rgba(134, 166, 217,0.55), transparent)" }}
      />
      {/* Sweep — zachte route-tint die elke 6s van links naar rechts wandelt.
          Subtieler dan de loader-spotlight (we zijn klaar met laden),
          maar geeft de card leven. */}
      <div
        className="pointer-events-none absolute inset-y-0 -inset-x-1/2 opacity-60"
        style={{
          background: "linear-gradient(90deg, transparent 0%, transparent 35%, rgba(134, 166, 217,0.06) 50%, transparent 65%, transparent 100%)",
          animation: "hero-sweep 6s linear infinite"
        }}
      />

      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          {/* Vier metrics als één rij — primary stat per metric.
              Geen duplicate titel meer; ToolHeader hierboven is de titel.
              Hier draait het om de échte read-out. */}
          <div className="flex flex-wrap gap-x-7 gap-y-3">
            {summary.combatLevel !== null && (
              <HeroStat icon={<Sword className="size-4 opacity-60" />} label="Combat" value={summary.combatLevel} />
            )}
            {summary.totalLevel !== null && (
              <HeroStat icon={<TrendingUp className="size-4 opacity-60" />} label="Total" value={summary.totalLevel} />
            )}
            {summary.goalPercent !== null && (
              <HeroStat
                icon={<Target className="size-4" />}
                label="Goals"
                value={`${summary.goalPercent}%`}
                accent
              />
            )}
          </div>
          <p className="text-[11.5px] text-[var(--color-text-muted)]">{basisNote}</p>
        </div>
        <button type="button" onClick={onEdit} className="btn-ghost relative z-10">
          <Edit3 className="size-3.5" /> Change input
        </button>
      </div>
    </div>
  );
}

function HeroStat({ icon, label, value, accent }: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
        {icon}
        {label}
      </div>
      <div
        className={cn(
          "text-[24px] sm:text-[28px] font-bold tabular-nums leading-none",
          accent ? "text-[var(--color-accent)]" : "text-[var(--color-text)]"
        )}
      >
        {value}
      </div>
    </div>
  );
}

// Renders a wiki NPC portrait for a kc-kind rec. Falls back to whatever
// KindGlyph would have shown if we can't resolve the boss (sprite 404,
// missing slug). `prominent` enables the pulsing route-ring halo for the
// headline-card variant. Hover rumble is always on — it's the "the boss
// notices you" cue that makes a KC-rec feel like more than a number.
function KcPortrait({ rec, size, prominent = false }: {
  rec: Recommendation;
  size: number;
  prominent?: boolean;
}) {
  const boss = rec.bossSlug ? BOSSES.find((b) => b.slug === rec.bossSlug) : undefined;
  if (!boss) {
    // Fallback identical to the non-kc path so the layout doesn't jump.
    return rec.iconItemId
      ? <ItemSprite
          id={rec.iconItemId}
          alt=""
          className="pixelated"
          style={{ maxWidth: "72%", maxHeight: "72%", imageRendering: "pixelated", filter: "drop-shadow(1px 1px 0 rgb(0 0 0 / 0.9))" }}
        />
      : <KindGlyph kind={rec.kind} size={size * 0.72} tone="accent" />;
  }
  return (
    <div
      className="size-full flex items-center justify-center rounded-md overflow-hidden transition-transform duration-200 group-hover:[animation:boss-rumble_0.4s_ease-in-out]"
      style={prominent ? { animation: "boss-halo 2.4s ease-in-out infinite" } : undefined}
    >
      <BossSprite boss={boss} size={size} />
    </div>
  );
}

function playerChoiceTag(rec: Recommendation): { label: string; helper: string } {
  if (rec.kind === "money") return { label: "GP", helper: "Pick this when you want cash or the next upgrade." };
  if (rec.kind === "boss" || rec.kind === "kc") return { label: "Bossing", helper: "Pick this when you want a PvM trip." };
  if (rec.kind === "skill") return { label: "AFK", helper: "Pick this when you want a low-pressure grind." };
  if (rec.kind === "bank" || rec.kind === "minigame") return { label: "Chill", helper: "Pick this when you want a lighter session." };
  if (rec.kind === "slayer") return { label: "Slayer", helper: "Pick this when the task should drive the session." };
  return { label: "Unlock", helper: "Pick this when you want quests, diary progress or account unlocks." };
}

function runeLitePlanNote(pluginSyncState: "live" | "stale" | "outdated" | null): string | null {
  if (pluginSyncState === "live") {
    return "RuneLite helped skip finished quests, diary steps, clog slots and Slayer mistakes.";
  }
  if (pluginSyncState === "stale") {
    return "RuneLite is old. Refresh before a long grind or GP spend.";
  }
  if (pluginSyncState === "outdated") {
    return "Update RuneLite before trusting newer Slayer or clog details.";
  }
  return "RuneLite can improve picks later.";
}

const GEAR_REALITY_KEYWORDS = {
  weapon: [
    "whip", "fang", "scythe", "shadow", "trident", "bowfa", "blowpipe", "crossbow",
    "zaryte", "rapier", "lance", "hasta", "sword", "staff", "bow", "macuahuitl"
  ],
  armour: [
    "bandos", "torva", "barrows", "karil", "ahrim", "void", "masori", "ancestral",
    "armadyl", "crystal", "inquisitor", "fighter torso", "blessed d'hide", "dhide"
  ],
  food: ["shark", "angler", "karambwan", "manta", "monkfish", "brew", "saradomin brew"],
  potion: [
    "potion", "restore", "super combat", "ranging", "magic", "antifire", "stamina",
    "divine", "prayer", "brew"
  ],
  travel: ["teleport", "tablet", "tabs", "rune", "ring", "amulet", "necklace", "jewellery", "jewelry"]
} as const;

function bossViabilityForRecommendation(
  rec: Recommendation,
  bankItems: BankHandoffItem[],
  hasBankContext: boolean
): BossViability | null {
  if (!hasBankContext || bankItems.length === 0 || !rec.bossSlug) return null;
  const boss = bossBySlug(rec.bossSlug);
  return boss ? bossViabilityFromBankItems(bankItems, boss) : null;
}

function bossViabilityBadgeText(viability: BossViability): string {
  if (viability.dps > 0) {
    return `${viability.verdict} · ${viability.dps.toFixed(viability.dps >= 10 ? 0 : 1)} DPS`;
  }
  return viability.verdict;
}

function bossViabilityBadgeClass(viability: BossViability): string {
  if (viability.tone === "ready") return "border-emerald-400/35 bg-emerald-400/10 text-emerald-300";
  if (viability.tone === "test") return "border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 text-[var(--color-accent)]";
  return "border-red-400/30 bg-red-400/10 text-red-200";
}

function bankIncludes(items: BankHandoffItem[], keywords: readonly string[]): boolean {
  return items.some((item) => {
    const haystack = `${item.name} ${item.subtab}`.toLowerCase();
    return keywords.some((keyword) => haystack.includes(keyword));
  });
}

function recommendationNeedsCombatSetup(rec: Recommendation): boolean {
  return rec.kind === "boss" || rec.kind === "kc" || rec.kind === "slayer";
}

function recommendationNeeds(rec: Recommendation): string[] {
  const hints = defaultActionHints(rec.kind);
  return (rec.needs?.length ? rec.needs : hints.needs).slice(0, 3);
}

function recommendationFirstStepValue(rec: Recommendation): string {
  return rec.actionPlan?.steps[0] ?? rec.why;
}

function recommendationStopPointValue(rec: Recommendation): string {
  const plan = rec.actionPlan;
  return plan?.steps.at(-1) ?? "Stop when the trip starts dragging.";
}

function recommendationBringValue(rec: Recommendation): string {
  const needs = recommendationNeeds(rec);
  return needs[0] ?? rec.actionPlan?.prep ?? "Nothing special flagged.";
}

const TRIP_BANK_KEYWORDS = {
  weapon: GEAR_REALITY_KEYWORDS.weapon,
  armour: GEAR_REALITY_KEYWORDS.armour,
  food: GEAR_REALITY_KEYWORDS.food,
  potion: GEAR_REALITY_KEYWORDS.potion,
  travel: GEAR_REALITY_KEYWORDS.travel,
  quest: ["key", "seal", "mould", "rune", "rope", "hammer", "spade", "saw", "axe", "pickaxe", "tinderbox", "lantern"]
} as const;

type TripBuilderPlan = {
  bring: string[];
  missing: string[];
  teleport: string;
  stopPoint: string;
  tagName: string;
  tag: string | null;
};

function tripItemMatches(item: BankHandoffItem, keywords: readonly string[]): boolean {
  const haystack = `${item.name} ${item.subtab}`.toLowerCase();
  return keywords.some((keyword) => haystack.includes(keyword));
}

function tripBankItems(
  bankItems: BankHandoffItem[],
  keywordGroups: Array<readonly string[]>,
  limit: number
): BankHandoffItem[] {
  const seen = new Set<number>();
  const picks: BankHandoffItem[] = [];
  for (const group of keywordGroups) {
    for (const item of bankItems) {
      if (seen.has(item.id) || !tripItemMatches(item, group)) continue;
      seen.add(item.id);
      picks.push(item);
      if (picks.length >= limit) return picks;
    }
  }
  return picks;
}

function tripItemLabel(item: BankHandoffItem): string {
  if (item.quantity > 1 && item.quantity < 10_000) return `${item.name} x${item.quantity}`;
  return item.name;
}

function buildRecommendationTrip(
  rec: Recommendation,
  bankItems: BankHandoffItem[],
  hasBankContext: boolean
): TripBuilderPlan {
  const needsCombat = recommendationNeedsCombatSetup(rec);
  const isUnlock = rec.kind === "quest" || rec.kind === "diary" || rec.kind === "goal" || rec.kind === "milestone";
  const keywordGroups = needsCombat
    ? [
        TRIP_BANK_KEYWORDS.weapon,
        TRIP_BANK_KEYWORDS.armour,
        TRIP_BANK_KEYWORDS.food,
        TRIP_BANK_KEYWORDS.potion,
        TRIP_BANK_KEYWORDS.travel
      ]
    : isUnlock
      ? [TRIP_BANK_KEYWORDS.travel, TRIP_BANK_KEYWORDS.quest, TRIP_BANK_KEYWORDS.potion]
      : [TRIP_BANK_KEYWORDS.travel, TRIP_BANK_KEYWORDS.food, TRIP_BANK_KEYWORDS.potion, TRIP_BANK_KEYWORDS.weapon];
  const pickedItems = hasBankContext ? tripBankItems(bankItems, keywordGroups, 18) : [];
  const travelItem = pickedItems.find((item) => tripItemMatches(item, TRIP_BANK_KEYWORDS.travel));
  const bring = pickedItems.length
    ? pickedItems.slice(0, 6).map(tripItemLabel)
    : recommendationNeeds(rec).slice(0, 3);
  const missing: string[] = [];

  if (!hasBankContext) {
    missing.push("gear for a cleaner trip");
  } else if (needsCombat) {
    if (!bankIncludes(bankItems, TRIP_BANK_KEYWORDS.weapon) && !bankIncludes(bankItems, TRIP_BANK_KEYWORDS.armour)) {
      missing.push("combat gear");
    }
    if (!bankIncludes(bankItems, TRIP_BANK_KEYWORDS.food)) missing.push("food");
    if (!bankIncludes(bankItems, TRIP_BANK_KEYWORDS.potion)) missing.push("potions");
    if (!bankIncludes(bankItems, TRIP_BANK_KEYWORDS.travel)) missing.push("teleport");
  } else if (isUnlock) {
    if (!bankIncludes(bankItems, TRIP_BANK_KEYWORDS.travel)) missing.push("teleport near the start");
    missing.push("quest items check");
  } else if (pickedItems.length === 0) {
    missing.push("supplies check");
  }

  const tagName = `Scapestack ${playerChoiceTag(rec).label}`;
  const tagItems = needsCombat
    ? pickedItems
    : pickedItems.filter((item) =>
        tripItemMatches(item, TRIP_BANK_KEYWORDS.travel) ||
        tripItemMatches(item, TRIP_BANK_KEYWORDS.quest)
      );
  const iconItemId = rec.iconItemId ?? KIND_META[rec.kind].iconItemId ?? tagItems[0]?.id ?? 995;
  const tag = tagItems.length
    ? exportTag({
        name: tagName,
        iconItemId,
        items: tagItems.map((item) => ({ id: item.id }))
      })
    : null;

  return {
    bring,
    missing: missing.slice(0, 3),
    teleport: travelItem ? tripItemLabel(travelItem) : "Best teleport near the first step",
    stopPoint: recommendationStopPointValue(rec),
    tagName,
    tag
  };
}

function headlinePayoff(rec: Recommendation): string | null {
  const payoff = rec.payoff?.trim();
  if (!payoff) return null;
  return payoff.length <= 120 ? payoff : null;
}

function firstSentence(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^[^.!?]+[.!?]/);
  return match?.[0] ?? trimmed;
}

function headlineSmartRead(rec: Recommendation): string | null {
  const reason = rec.decisionReason?.trim();
  if (!reason) return null;
  const oneLine = firstSentence(reason);
  return oneLine.length > 150 ? `${oneLine.slice(0, 147).trim()}...` : oneLine;
}

function recommendationWhyNot({
  headline,
  allRecs,
  mood,
  hasBankContext,
  pluginSyncState
}: {
  headline: Recommendation;
  allRecs: Recommendation[];
  mood: Mood;
  hasBankContext: boolean;
  pluginSyncState: "live" | "stale" | "outdated" | null;
}): string | null {
  const others = allRecs.filter((rec) => rec.id !== headline.id);
  const scout = others.find((rec) =>
    rec.kind === "kc" &&
    typeof rec.kcMeta?.kc === "number" &&
    rec.kcMeta.kc > 0 &&
    rec.kcMeta.kc < 5
  );
  if (scout?.kcMeta) {
    return `Why not ${scout.title}: ${scout.kcMeta.kc.toLocaleString()} KC is still a test trip, so it stays backup.`;
  }

  const hasBossBackup = others.some((rec) => rec.kind === "boss" || rec.kind === "kc" || rec.kind === "slayer");
  if ((mood === "chill" || mood === "afk" || mood === "short") && hasBossBackup) {
    return "Why not bossing: this pace avoids intense trips unless you pick Bossing.";
  }

  if (!hasBankContext && hasBossBackup && headline.kind !== "boss" && headline.kind !== "kc") {
    return "Why not a boss headline: no gear pasted, so kill checks stay conservative.";
  }

  const longQuest = others.find((rec) => {
    if (rec.kind !== "quest") return false;
    const text = `${rec.title} ${rec.why} ${rec.payoff ?? ""} ${rec.decisionReason ?? ""}`.toLowerCase();
    return /grandmaster|very long|\(\+\d+ more\)|long prereq/.test(text);
  });
  if (longQuest) {
    return `Why not ${longQuest.title}: the prereq chain looks longer than this session needs.`;
  }

  if (pluginSyncState === "live") {
    return "Why not finished stuff: RuneLite skipped quests, diary steps, clog slots and Slayer mistakes.";
  }

  return null;
}

function recommendationAvoidance(rec: Recommendation): string {
  switch (rec.kind) {
    case "kc":
      return rec.kcMeta && rec.kcMeta.kc >= 10
        ? "Run the fixed KC block. Do not change the goal mid-trip."
        : "Do a fixed KC block. Do not turn a scout read into an endless grind.";
    case "boss":
      return "Do not buy upgrades before DPS proves the trip is worth it.";
    case "skill":
      return "Stop at the unlock unless you actually want an AFK grind.";
    case "quest":
    case "diary":
      return "Do not start if the prereq chain makes this a long session.";
    case "slayer":
      return "Check points before skipping, blocking or extending the task.";
    case "money":
      return "Check prices first. Stop if the GP/hr is not worth your focus.";
    case "goal":
      return "Chase the closest missing piece, then re-run the planner.";
    case "bank":
      return "Only clean up what changes the next plan.";
    case "minigame":
      return "Do one reward or XP block, then switch if it drags.";
    default:
      return "Keep it to one clear stop point, then choose again.";
  }
}

function backupChoicePrompt(rec: Recommendation, headline: Recommendation): { label: string; helper: string } {
  if (rec.kind === "money") {
    return { label: "Need GP?", helper: "Pick this if funding the next upgrade matters more than the main route." };
  }
  if (rec.kind === "skill" || rec.kind === "bank" || rec.kind === "minigame") {
    return headline.kind === "boss" || headline.kind === "kc" || headline.kind === "slayer"
      ? { label: "Too sweaty?", helper: "Lower-pressure progress if the main trip feels like too much." }
      : { label: "Want chill?", helper: "Lower-pressure progress with a clearer stop point." };
  }
  if (rec.kind === "boss" || rec.kind === "kc" || rec.kind === "slayer") {
    return { label: "Want action?", helper: "Use this when you would rather do a trip, task or KC block." };
  }
  return { label: "Prefer unlock?", helper: "Use this when account progress matters more than GP or KC." };
}

function routeStepLabel(index: number): string {
  if (index === 0) return "Now";
  if (index === 1) return "Next login";
  return "Backup";
}

function TonightRouteStrip({
  recs,
  shareMode
}: {
  recs: Recommendation[];
  shareMode: boolean;
}) {
  if (recs.length === 0) return null;

  const content = (
    <>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-[var(--color-accent)]">
          Next 3 sessions
        </span>
        <span className="text-[11px] font-semibold text-[var(--color-text-muted)]">
          Finish the stop point, then re-run /next.
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {recs.map((rec, index) => {
          const choice = playerChoiceTag(rec);
          return (
            <div
              key={`${rec.id}:route-step:${index}`}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/35 p-3"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                  {routeStepLabel(index)}
                </span>
                <span className="rounded-full border border-[var(--color-accent)]/25 bg-[var(--color-accent)]/10 px-2 py-0.5 text-[9.5px] font-bold text-[var(--color-accent)]">
                  {choice.label}
                </span>
              </div>
              <p className="line-clamp-2 text-[12.5px] font-bold leading-snug text-[var(--color-text)]">
                {rec.title}
              </p>
              <p className="mt-1 line-clamp-2 text-[11px] font-semibold leading-snug text-[var(--color-text-muted)]">
                Stop: {recommendationStopPointValue(rec)}
              </p>
            </div>
          );
        })}
      </div>
    </>
  );

  if (!shareMode) {
    return (
      <details className="group rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)]/42 p-2.5">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-1 py-1 text-left marker:hidden [&::-webkit-details-marker]:hidden">
          <span>
            <span className="block text-[12.5px] font-bold text-[var(--color-text)]">Next sessions</span>
            <span className="mt-0.5 block text-[11px] text-[var(--color-text-muted)]">
              Optional follow-up after the stop point.
            </span>
          </span>
          <span className="rounded-full border border-[var(--color-border)] px-2.5 py-1 text-[10.5px] font-bold text-[var(--color-text-muted)]">
            Show
          </span>
        </summary>
        <div className="mt-3">
          {content}
        </div>
      </details>
    );
  }

  return (
    <div className="mb-3 rounded-xl border border-[var(--color-accent)]/25 bg-[var(--color-bg)]/45 p-3">
      {content}
    </div>
  );
}

function scapestackNotice({
  headline,
  allRecs,
  mood,
  routeLens,
  hasBankContext,
  pluginSyncState
}: {
  headline: Recommendation | null;
  allRecs: Recommendation[];
  mood: Mood;
  routeLens: RouteLens;
  hasBankContext: boolean;
  pluginSyncState: "live" | "stale" | "outdated" | null;
}): string | null {
  if (!headline) return null;

  if (routeLens === "maxing") {
    return "Maxing week: cape, diary, quest and total-level progress beat random trips.";
  }
  if (routeLens === "fun") {
    return "Fun session: rewards, KC, minigames and lighter grinds stay in the mix.";
  }
  if (routeLens === "gp-upgrade") {
    return "GP rebuild: cash and upgrade funding beat long unlock chains.";
  }
  if (routeLens === "boss-log") {
    return "Boss log: KC, clog chances and realistic trips move up.";
  }
  if (routeLens === "afk-progress") {
    return "AFK progress: low-pressure progress moves up and intense trips move down.";
  }
  if (routeLens === "unlock-chain") {
    return "Iron unlock: quests, diaries and account gates move up.";
  }

  const scout = allRecs.find((rec) =>
    rec.id !== headline.id &&
    rec.kind === "kc" &&
    rec.kcMeta &&
    rec.kcMeta.kc > 0 &&
    rec.kcMeta.kc < 5
  );
  if (scout?.kcMeta) {
    return `${scout.kcMeta.kc.toLocaleString()} KC stays a test trip, not the main grind.`;
  }

  if (!hasBankContext && (headline.kind === "boss" || headline.kind === "kc" || headline.kind === "money")) {
    return "No gear pasted, so the trip stays conservative.";
  }

  const activeBackup = allRecs.find((rec) =>
    rec.id !== headline.id &&
    (rec.kind === "boss" || rec.kind === "kc" || rec.kind === "slayer")
  );
  if ((mood === "unlock" || mood === "chill" || mood === "afk" || mood === "short") && activeBackup) {
    return "Bossing stays backup while this route has the cleaner stop point.";
  }

  if (pluginSyncState === "live") {
    return "RuneLite changed this: finished quests, diary steps, clog slots and Slayer mistakes were skipped before this pick won.";
  }

  return null;
}

function sessionMemoryNote({
  feedback,
  lastSession,
  allRecs,
  headline,
  activeRsn
}: {
  feedback: RecommendationFeedback;
  lastSession: MoodSession | null;
  allRecs: Recommendation[];
  headline: Recommendation | null;
  activeRsn: string;
}): string | null {
  const twoWeeks = 14 * 24 * 60 * 60 * 1000;
  const latest = latestRecommendationFeedback(feedback);
  if (latest && Date.now() - latest.savedAt < twoWeeks) {
    const title = latest.title ?? allRecs.find((rec) => rec.id === latest.id)?.title;
    if (latest.reason === "not_today") {
      return title
        ? `Last time: you skipped ${title}, so this plan avoids it.`
        : "Last time: you skipped a pick, so this plan avoids it.";
    }
    if (latest.reason === "already_done") {
      return title
        ? `Welcome back — ${title} is marked done, so this is the next move.`
        : "Welcome back — that pick is marked done, so this is the next move.";
    }
    if (latest.reason === "too_hard") {
      return title
        ? `Last time: ${title} felt too hard, so this plan goes easier.`
        : "Last time: that pick felt too hard, so this plan goes easier.";
    }
  }

  const latestMemory = latestRecommendationMemory(feedback, { rsn: activeRsn });
  if (latestMemory?.action === "try_another") {
    const title = latestMemory.title ?? allRecs.find((rec) => rec.id === latestMemory.id)?.title;
    return title
      ? `Last time: you asked for another route, so ${title} starts lower.`
      : "Last time: you asked for another route, so that pick starts lower.";
  }

  if (!lastSession?.lastHeadlineTitle || !headline) return null;
  if (lastSession.lastHeadlineId === headline.id) return null;
  if (Date.now() - lastSession.savedAt > twoWeeks) return null;
  return `Welcome back — last pick was ${lastSession.lastHeadlineTitle}. This is the next move.`;
}

function RecommendationSessionSummary({
  rec,
  compact = false
}: {
  rec: Recommendation;
  compact?: boolean;
}) {
  if (compact) {
    return null;
  }

  const summary = [
    {
      label: "Start",
      value: recommendationFirstStepValue(rec)
    },
    {
      label: "Stop",
      value: recommendationStopPointValue(rec)
    }
  ];

  return (
    <div className="mt-4">
      <dl className="divide-y divide-[var(--color-border)]/55 border-y border-[var(--color-border)]/60">
        {summary.map((note) => (
          <div
            key={`${rec.id}:session:${note.label}`}
            className="grid gap-1 py-2.5 sm:grid-cols-[74px_minmax(0,1fr)] sm:gap-4"
          >
            <dt className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-[var(--color-accent)]">
              {note.label}
            </dt>
            <dd className="text-[12px] font-semibold leading-relaxed text-[var(--color-text-dim)]">
              {note.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function TripBuilder({
  rec,
  bankItems,
  hasBankContext
}: {
  rec: Recommendation;
  bankItems: BankHandoffItem[];
  hasBankContext: boolean;
}) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const trip = useMemo(
    () => buildRecommendationTrip(rec, bankItems, hasBankContext),
    [rec, bankItems, hasBankContext]
  );

  const copyBankTag = async () => {
    if (!trip.tag) return;
    const ok = await copyText(trip.tag);
    setCopyState(ok ? "copied" : "failed");
    window.setTimeout(() => setCopyState("idle"), 1800);
  };

  return (
    <details
      className="group mt-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/35 p-3"
      open={hasBankContext && Boolean(trip.tag)}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 marker:hidden [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block text-[12px] font-bold text-[var(--color-text)]">Build trip</span>
          <span className="mt-0.5 block text-[11px] font-semibold text-[var(--color-text-muted)]">
            Bring, teleport, stop point.
          </span>
        </span>
        <span className="rounded-full border border-[var(--color-border)] px-2.5 py-1 text-[10.5px] font-bold text-[var(--color-text-muted)] transition-colors group-open:border-[var(--color-accent)]/35 group-open:text-[var(--color-accent)]">
          <span className="group-open:hidden">Show</span>
          <span className="hidden group-open:inline">Hide</span>
        </span>
      </summary>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-panel)]/55 p-2.5">
          <div className="mb-1 text-[9.5px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
            Bring
          </div>
          <p className="text-[12px] font-semibold leading-relaxed text-[var(--color-text-dim)]">
            {trip.bring.length ? trip.bring.join(", ") : "Check setup before leaving the bank."}
          </p>
        </div>
        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-panel)]/55 p-2.5">
          <div className="mb-1 text-[9.5px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
            Teleport
          </div>
          <p className="text-[12px] font-semibold leading-relaxed text-[var(--color-text-dim)]">{trip.teleport}</p>
        </div>
        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-panel)]/55 p-2.5">
          <div className="mb-1 text-[9.5px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
            Missing
          </div>
          <p className="text-[12px] font-semibold leading-relaxed text-[var(--color-text-dim)]">
            {trip.missing.length ? trip.missing.join(", ") : "Looks ready enough for one short run."}
          </p>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-panel)]/45 px-2.5 py-2">
        <p className="min-w-0 text-[11.5px] font-semibold leading-relaxed text-[var(--color-text-muted)]">
          Stop: <span className="text-[var(--color-text-dim)]">{trip.stopPoint}</span>
        </p>
        {trip.tag ? (
          <button
            type="button"
            onClick={copyBankTag}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[var(--color-accent)]/35 bg-[var(--color-accent)]/10 px-3 py-1.5 text-[11.5px] font-bold text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent)]/15"
            aria-label={`Copy RuneLite Bank Tag for ${rec.title}`}
          >
            {copyState === "copied" ? <CheckCheck className="size-3.5" /> : <Copy className="size-3.5" />}
            {copyState === "copied" ? "Bank Tag copied" : copyState === "failed" ? "Try copy again" : "Copy Bank Tag"}
          </button>
        ) : (
          <span className="shrink-0 rounded-full border border-[var(--color-border)] px-2.5 py-1 text-[10.5px] font-bold text-[var(--color-text-muted)]">
            Add gear to build a Bank Tag.
          </span>
        )}
      </div>
    </details>
  );
}

function ActionPlanBlock({ rec, compact = false }: { rec: Recommendation; compact?: boolean }) {
  const plan = rec.actionPlan;
  if (!plan) return null;

  if (compact) {
    return (
      <div className="mt-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-2)]/45 px-2.5 py-2">
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
          <span className="text-[var(--color-accent)]">Plan</span>
          <span className="text-[var(--color-text-muted)]">·</span>
          <span>{plan.timebox}</span>
        </div>
        <ul className="space-y-1 text-[11px] leading-snug text-[var(--color-text-dim)]">
          {plan.steps.slice(0, 2).map((step, idx) => (
            <li key={`${rec.id}:mini-step:${idx}`} className="flex gap-1.5">
              <span className="mt-[1px] text-[var(--color-accent)]">✓</span>
              <span>{step}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-2)]/55 p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
        <div className="text-[10.5px] uppercase tracking-[0.18em] font-bold text-[var(--color-accent)]">
          Plan for this session
        </div>
        <div className="flex items-center gap-1.5">
          <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-panel)] px-2 py-0.5 text-[10.5px] font-semibold text-[var(--color-text-dim)]">
            {plan.timebox}
          </span>
        </div>
      </div>
      <p className="text-[12px] leading-relaxed text-[var(--color-text-secondary)]">{plan.prep}</p>
      <ol className="mt-3 space-y-2">
        {plan.steps.map((step, idx) => (
          <li key={`${rec.id}:step:${idx}`} className="flex gap-2 text-[12.5px] leading-relaxed text-[var(--color-text-dim)]">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-[var(--color-accent)]/35 bg-[var(--color-accent)]/10 text-[10.5px] font-bold text-[var(--color-accent)]">
              {idx + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      {plan.caveat && (
        <p className="mt-3 border-t border-[var(--color-border)] pt-2 text-[11.5px] leading-relaxed text-[var(--color-text-muted)]">
          {plan.caveat}
        </p>
      )}
    </div>
  );
}

// The headline — the one thing the hub most wants the player to do. Big,
// route-accented, with the payoff and a direct link into the relevant tool.
function HeadlineCard({
  rec,
  allRecs,
  actionContext,
  onBossOpen,
  mood,
  minutes,
  hasBankContext,
  bankItems,
  accountStage,
  pluginSyncState
}: {
  rec: Recommendation;
  allRecs: Recommendation[];
  actionContext: RecommendationActionContext;
  onBossOpen: (slug: string) => void;
  mood: Mood;
  minutes: TimeBudget;
  hasBankContext: boolean;
  bankItems: BankHandoffItem[];
  accountStage: NextUpResult["summary"]["accountStage"];
  pluginSyncState: "live" | "stale" | "outdated" | null;
}) {
  // Boss/KC recs expose an explicit modal button. Other kinds expose an
  // explicit route button. The article itself is not a fake button because
  // the card also contains Wiki/copy/detail controls.
  const isBossWithDetail = (rec.kind === "kc" || rec.kind === "boss") && !!rec.bossSlug;
  const primaryAction = primaryActionForRecommendation(rec, actionContext);
  const actionLabel = isBossWithDetail ? "Open boss detail" : primaryAction.label;
  const actionHref = isBossWithDetail ? undefined : primaryAction.href;
  const choice = playerChoiceTag(rec);
  const payoff = headlinePayoff(rec);
  const smartRead = headlineSmartRead(rec);
  const bossViability = bossViabilityForRecommendation(rec, bankItems, hasBankContext);
  const card = (
    <article
      className={cn(
        // group/headline triggers the headline-shimmer-target::after sweep
        // defined in globals.css — fires once on hover, doesn't loop.
        "group/headline group relative overflow-hidden rounded-xl p-6 headline-shimmer-target",
        "border border-[var(--color-accent)]/30 bg-gradient-to-br from-[var(--color-accent)]/12 to-transparent",
        (actionHref || isBossWithDetail) && "surface-interactive transition-transform duration-200 hover:-translate-y-0.5"
      )}
    >
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: "linear-gradient(to right, transparent, rgba(134, 166, 217,0.55), transparent)" }}
      />
      <div className="flex items-start gap-4">
        <div className="size-12 shrink-0 rounded-lg flex items-center justify-center bg-[var(--color-accent)]/15 border border-[var(--color-accent)]/30 text-[var(--color-accent)] overflow-hidden">
          {rec.kind === "kc" && rec.bossSlug ? (
            // KC-rec gets a live boss portrait + pulsing halo on the
            // headline (this IS the strongest pick). The portrait is
            // the strongest emotional signal in /next — players know
            // their boss by face faster than by name.
            <KcPortrait rec={rec} size={42} prominent />
          ) : rec.iconItemId ? (
            <ItemSprite
              id={rec.iconItemId}
              alt=""
              className="pixelated"
              style={{ maxWidth: "70%", maxHeight: "70%", imageRendering: "pixelated", filter: "drop-shadow(1px 1px 0 rgb(0 0 0 / 0.9))" }}
            />
          ) : (
            // No per-rec sprite — fall back to the kind's signature sprite
            // (Lucide is the third-tier fallback inside KindGlyph).
            <KindGlyph kind={rec.kind} size={28} tone="accent" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="eyebrow text-[var(--color-accent)]">Do this first</span>
            <span
              className="rounded-full border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 px-2 py-0.5 text-[10.5px] font-bold text-[var(--color-accent)]"
              title={choice.helper}
            >
              {choice.label}
            </span>
            {bossViability && (
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[10.5px] font-bold",
                  bossViabilityBadgeClass(bossViability)
                )}
                title={bossViability.summary}
              >
                {bossViabilityBadgeText(bossViability)}
              </span>
            )}
          </div>
          <h3 className="text-[19px] font-bold text-[var(--color-text)] tracking-normal leading-tight">
            {rec.title}
          </h3>
          <p className="mt-2 text-[13.5px] text-[var(--color-text-dim)] leading-relaxed">
            {rec.why}
          </p>
          {payoff && (
            <p className="mt-2 text-[12.5px] text-[var(--color-text-secondary)] border-t border-[var(--color-border)] pt-2">
              {payoff}
            </p>
          )}
          {smartRead && (
            <p className="mt-2 flex items-start gap-1.5 text-[12px] font-semibold leading-relaxed text-[var(--color-text-dim)]">
              <Sparkles className="mt-0.5 size-3.5 shrink-0 text-[var(--color-accent)]" />
              <span>{smartRead}</span>
            </p>
          )}
          <RecommendationSessionSummary
            rec={rec}
          />
          <TripBuilder rec={rec} bankItems={bankItems} hasBankContext={hasBankContext} />
          {isBossWithDetail && rec.bossSlug ? (
            <button
              type="button"
              onClick={() => onBossOpen(rec.bossSlug!)}
              className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-[var(--color-accent)]/35 bg-[var(--color-accent)]/10 px-3 py-2 text-[12.5px] font-semibold text-[var(--color-accent)] transition-all hover:bg-[var(--color-accent)]/15 hover:gap-2"
              aria-label={`${actionLabel}: ${rec.title}`}
              title={`${actionLabel}: ${rec.title}`}
            >
              {actionLabel} <ArrowRight className="size-4" />
            </button>
          ) : actionHref && (
            primaryAction.external ? (
              <a
                href={actionHref}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${actionLabel}: ${rec.title}`}
                title={`${actionLabel}: ${rec.title}`}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-accent)]/35 bg-[var(--color-accent)]/10 px-3.5 py-2 text-[12.5px] font-semibold text-[var(--color-accent)] transition-all hover:bg-[var(--color-accent)]/15 hover:gap-2"
              >
                {actionLabel} <ExternalLink className="size-3.5" />
              </a>
            ) : (
              <Link
                href={actionHref}
                aria-label={`${actionLabel}: ${rec.title}`}
                title={`${actionLabel}: ${rec.title}`}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-accent)]/35 bg-[var(--color-accent)]/10 px-3.5 py-2 text-[12.5px] font-semibold text-[var(--color-accent)] transition-all hover:bg-[var(--color-accent)]/15 hover:gap-2"
              >
              {actionLabel} <ArrowRight className="size-4" />
              </Link>
            )
          )}
        </div>
      </div>
    </article>
  );
  return card;
}

// One checklist row — compact, with explicit links/buttons.
function RecRow({
  rec,
  actionContext,
  onBossOpen,
  mood,
  minutes,
  hasBankContext,
  bankItems,
  accountStage,
  backupPrompt
}: {
  rec: Recommendation;
  actionContext: RecommendationActionContext;
  onBossOpen: (slug: string) => void;
  mood: Mood;
  minutes: TimeBudget;
  hasBankContext: boolean;
  bankItems: BankHandoffItem[];
  accountStage: NextUpResult["summary"]["accountStage"];
  backupPrompt?: { label: string; helper: string };
}) {
  const isBossWithDetail = (rec.kind === "kc" || rec.kind === "boss") && !!rec.bossSlug;
  const primaryAction = primaryActionForRecommendation(rec, actionContext);
  const actionLabel = isBossWithDetail ? "Open boss detail" : primaryAction.label;
  const actionHref = isBossWithDetail ? undefined : primaryAction.href;
  const choice = playerChoiceTag(rec);
  const inner = (
    <article
      className={cn(
        "group rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-2.5",
        (actionHref || isBossWithDetail) && "transition-colors hover:border-[var(--color-accent)]/40"
      )}
    >
      <div className="flex min-h-10 items-center gap-2.5">
        <div className="size-8 shrink-0 rounded-md flex items-center justify-center bg-[var(--color-bg-2)] border border-[var(--color-border)] text-[var(--color-accent)] overflow-hidden">
          {rec.kind === "kc" && rec.bossSlug ? (
            <KcPortrait rec={rec} size={28} />
          ) : rec.iconItemId ? (
            <ItemSprite
              id={rec.iconItemId}
              alt=""
              className="pixelated"
              style={{ maxWidth: "72%", maxHeight: "72%", imageRendering: "pixelated", filter: "drop-shadow(1px 1px 0 rgb(0 0 0 / 0.9))" }}
            />
          ) : (
            <KindGlyph kind={rec.kind} size={20} tone="accent" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <span
              className="shrink-0 rounded-full border border-[var(--color-border)] bg-[var(--color-bg)]/45 px-2 py-0.5 text-[10px] font-bold text-[var(--color-accent)]"
              title={backupPrompt?.helper ?? choice.helper}
            >
              {backupPrompt?.label ?? choice.label}
            </span>
            <h4 className="truncate text-[13px] font-semibold tracking-normal text-[var(--color-text)]">
              {rec.title}
            </h4>
          </div>
        </div>
        <div className="shrink-0">
          {isBossWithDetail && rec.bossSlug ? (
            <button
              type="button"
              onClick={() => onBossOpen(rec.bossSlug!)}
              className="inline-flex items-center gap-1 rounded-md border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 px-2.5 py-1.5 text-[11px] font-semibold text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent)]/15"
              aria-label={`${actionLabel}: ${rec.title}`}
              title={`${actionLabel}: ${rec.title}`}
            >
              Open <ArrowRight className="size-3.5" />
            </button>
          ) : actionHref && (
            primaryAction.external ? (
              <a
                href={actionHref}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${actionLabel}: ${rec.title}`}
                title={`${actionLabel}: ${rec.title}`}
                className="inline-flex items-center gap-1 rounded-md border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 px-2.5 py-1.5 text-[11px] font-semibold text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent)]/15"
              >
                Open <ExternalLink className="size-3" />
              </a>
            ) : (
              <Link
                href={actionHref}
                aria-label={`${actionLabel}: ${rec.title}`}
                title={`${actionLabel}: ${rec.title}`}
                className="inline-flex items-center gap-1 rounded-md border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 px-2.5 py-1.5 text-[11px] font-semibold text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent)]/15"
              >
                Open <ArrowRight className="size-3.5" />
              </Link>
            )
          )}
        </div>
      </div>
    </article>
  );
  return inner;
}

// ── Mood section ───────────────────────────────────────────────────────────
// "Wat heb je zin in?" — kies een vibe, kies een tijdsbudget, krijg
// één concrete suggestie + 2 alternatieven. Optioneel; "Tonight's pick"
// hierboven blijft de objectief-beste anchor voor wie deze keuze wil
// overslaan. Engine zit in src/lib/mood.ts (pickForMood).

const MOODS: Mood[] = ["chill", "cash", "bossing", "unlock", "afk", "short"];
const TIME_OPTIONS: { value: TimeBudget; label: string }[] = [
  { value: 15,  label: "15 min" },
  { value: 30,  label: "30 min" },
  { value: 60,  label: "1 hour" },
  { value: 120, label: "2 hours" },
];

function moodForRouteLens(lens: RouteLens, currentMood: Mood): Mood {
  switch (lens) {
    case "maxing":
    case "unlock-chain":
      return "unlock";
    case "fun":
      return currentMood === "bossing" || currentMood === "afk" ? currentMood : "chill";
    case "gp-upgrade":
      return "cash";
    case "boss-log":
      return "bossing";
    case "afk-progress":
      return "afk";
    case "smart":
      return currentMood;
  }
}

function defaultTimeForRouteLens(lens: RouteLens): TimeBudget | null {
  switch (lens) {
    case "maxing":
    case "unlock-chain":
    case "boss-log":
      return 120;
    case "gp-upgrade":
    case "afk-progress":
      return 60;
    case "fun":
      return 60;
    case "smart":
      return null;
  }
}

type SessionSkippedPick = {
  id: string;
  kind: RecKind;
  title: string;
  count: number;
  skippedAt: number;
};

function recordSessionSkip(
  current: Record<string, SessionSkippedPick>,
  rec: Recommendation
): Record<string, SessionSkippedPick> {
  const existing = current[rec.id];
  return {
    ...current,
    [rec.id]: {
      id: rec.id,
      kind: rec.kind,
      title: rec.title,
      count: (existing?.count ?? 0) + 1,
      skippedAt: Date.now()
    }
  };
}

function sessionSkippedCounts(skipped: Record<string, SessionSkippedPick>): Record<string, number> {
  return Object.fromEntries(Object.values(skipped).map((entry) => [entry.id, entry.count]));
}

function mergedSkipCounts(...counts: Record<string, number>[]): Record<string, number> {
  const merged: Record<string, number> = {};
  for (const countMap of counts) {
    for (const [id, count] of Object.entries(countMap)) {
      merged[id] = Math.min(5, (merged[id] ?? 0) + count);
    }
  }
  return merged;
}

function latestSessionSkip(skipped: Record<string, SessionSkippedPick>): SessionSkippedPick | null {
  return Object.values(skipped).sort((a, b) => b.skippedAt - a.skippedAt)[0] ?? null;
}

function memoryKind(memory: RecommendationMemoryEntry | null): RecKind | null {
  return memory ? (memory.kind as RecKind) : null;
}

function routeSwitchCopy(nextLens: RouteLens, skipped: Recommendation): string {
  const label = ROUTE_LENS_LABEL[nextLens];
  switch (nextLens) {
    case "maxing":
      return `Trying ${label.name}: cape, diary and total-level progress instead of ${skipped.title}.`;
    case "fun":
      return `Trying ${label.name}: rewards, KC or minigames instead of another chore.`;
    case "unlock-chain":
      return `Trying ${label.name}: a cleaner account unlock instead of ${skipped.title}.`;
    case "gp-upgrade":
      return `Trying ${label.name}: funding the next upgrade instead of ${skipped.title}.`;
    case "boss-log":
      return `Trying ${label.name}: a trip, KC block or clog angle instead of ${skipped.title}.`;
    case "afk-progress":
      return `Trying ${label.name}: lower-pressure progress instead of ${skipped.title}.`;
    case "smart":
      return `Fresh pick: ${skipped.title} is lowered for this session.`;
  }
}

function defaultTimeForMood(mood: Mood): TimeBudget | null {
  if (mood === "short") return 15;
  if (mood === "chill") return 30;
  if (mood === "unlock") return 120;
  if (mood === "bossing" || mood === "afk" || mood === "cash") return 60;
  return null;
}

// ── Bank progress ──────────────────────────────────────────────────────────
// Toont "je bent dicht bij completen van deze sets" als chip-row.
// Klik op een chip → expandeert + toont wat er nog mist. Geen visual
// noise wanneer de bank leeg is.

function BankProgressSection({ progress }: { progress: SetCompletion[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  if (progress.length === 0) return null;

  return (
    <section className="mb-10">
      <h3 className="eyebrow mb-1 text-[var(--color-accent)]">Almost there</h3>
      <p className="text-[11.5px] text-[var(--color-text-muted)] mb-3">
        Sets you're closest to completing — click for what's still missing.
      </p>
      <div className="flex flex-wrap gap-2">
        {progress.map((c) => {
          const set = GOAL_SETS.find((s) => s.id === c.setId);
          if (!set) return null;
          const norm = normaliseCompletion(c, set);
          const missing = norm.max - norm.progress;
          const active = openId === c.setId;
          return (
            <button
              key={c.setId}
              type="button"
              onClick={() => setOpenId(active ? null : c.setId)}
              className={cn(
                "px-3 py-1.5 rounded-md border text-[11.5px] transition-colors flex items-center gap-2 tabular-nums",
                active
                  ? "border-[var(--color-accent)]/60 bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                  : "border-[var(--color-border)] bg-[var(--color-panel)] text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:border-[var(--color-border-strong)]"
              )}
            >
              <span className="font-semibold">{set.name}</span>
              <span className="text-[10px] opacity-70">
                {norm.progress}/{norm.max}
              </span>
              {missing > 0 && (
                <span className="text-[10px] opacity-60">· {missing} short</span>
              )}
            </button>
          );
        })}
      </div>
      {/* Expanded panel — toont missende goals voor de open set. */}
      {openId && (() => {
        const c = progress.find((r) => r.setId === openId);
        const set = c && GOAL_SETS.find((s) => s.id === c.setId);
        if (!c || !set) return null;
        const missing = set.goals.filter((g) => !c.perGoal[g.id]?.satisfied);
        return (
          <div className="mt-3 p-3 rounded-lg bg-[var(--color-panel)] border border-[var(--color-border)]">
            <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-muted)] mb-2">
              {set.name} — still missing
            </div>
            {missing.length === 0 ? (
              <p className="text-[12px] text-[var(--color-good)]">
                Actually complete — probably a tiered set where you already own the top tier.
              </p>
            ) : (
              <ul className="space-y-1">
                {missing.slice(0, 12).map((g) => (
                  <li key={g.id} className="text-[12px] text-[var(--color-text-dim)] flex items-baseline gap-2">
                    <span className="size-1 rounded-full bg-[var(--color-text-muted)] inline-block translate-y-[-2px]" />
                    <span className="text-[var(--color-text)]">{g.name}</span>
                    {g.tier !== undefined && (
                      <span className="text-[10.5px] opacity-60">tier {g.tier}</span>
                    )}
                  </li>
                ))}
                {missing.length > 12 && (
                  <li className="text-[11px] text-[var(--color-text-muted)] mt-1">
                    + {missing.length - 12} more
                  </li>
                )}
              </ul>
            )}
          </div>
        );
      })()}
    </section>
  );
}

// ── WhatToDo (track 1) ─────────────────────────────────────────────────────
// Side-by-side layout: mood-chips + time-budget links, gekozen suggestie
// + alternatieven rechts. Default is unlock-first; explicit routes can
// still opt into GP, Bossing, AFK, Chill or Short.

const DEFAULT_MOOD: Mood = "unlock";
const DEFAULT_TIME: TimeBudget = 60;

function visibleMood(mood: Mood): Mood {
  if (mood === "focused") return "bossing";
  if (mood === "quest") return "unlock";
  return MOODS.includes(mood) ? mood : DEFAULT_MOOD;
}

function WhatToDo({
  allRecs,
  activeRsn,
  accountStage,
  hasBankContext,
  bankItems,
  onBossOpen,
  onEdit,
  routeIntent,
  pluginSyncState,
  shareMode,
  onShareModeChange
}: {
  allRecs: Recommendation[];
  activeRsn: string;
  accountStage: NextUpResult["summary"]["accountStage"];
  hasBankContext: boolean;
  bankItems: BankHandoffItem[];
  onBossOpen: (slug: string) => void;
  onEdit: () => void;
  routeIntent: NextIntentPreset | null;
  pluginSyncState: "live" | "stale" | "outdated" | null;
  shareMode: boolean;
  onShareModeChange: (enabled: boolean) => void;
}) {
  const [mood, setMood] = useState<Mood>(routeIntent ? visibleMood(routeIntent.mood) : DEFAULT_MOOD);
  const [minutes, setMinutes] = useState<TimeBudget>(routeIntent?.minutes ?? DEFAULT_TIME);
  const [routeLens, setRouteLens] = useState<RouteLens>("smart");
  const [shuffleIdx, setShuffleIdx] = useState(0);
  const [sessionSkipped, setSessionSkipped] = useState<Record<string, SessionSkippedPick>>({});
  const [routeSwitchNote, setRouteSwitchNote] = useState<string | null>(null);
  const [lastSuppressed, setLastSuppressed] = useState<{ id: string; kind: RecKind; title: string } | null>(null);
  const [lastCompleted, setLastCompleted] = useState<{ id: string; title: string } | null>(null);
  const [feedback, setFeedback] = useState<RecommendationFeedback>(() => ({
    version: 1,
    suppressed: {},
    recent: []
  }));
  const [lastSession, setLastSession] = useState<MoodSession | null>(null);
  const [sessionCopyState, setSessionCopyState] = useState<"idle" | "copied" | "error">("idle");

  useEffect(() => {
    if (!shareMode || typeof document === "undefined") return;
    document.body.classList.add("scapestack-clean-shot");
    return () => {
      document.body.classList.remove("scapestack-clean-shot");
    };
  }, [shareMode]);

  useEffect(() => {
    const last = loadMood();
    setLastSession(last);
    if (last) {
      if (!routeIntent) {
        setMood(visibleMood(last.mood));
        setMinutes(last.minutes);
      }
    }
    setFeedback(loadRecommendationFeedback());
  }, [routeIntent]);

  const routeLensIndex = ROUTE_LENS_ORDER.indexOf(routeLens);
  const nextRouteLens = ROUTE_LENS_ORDER[(routeLensIndex + 1) % ROUTE_LENS_ORDER.length] ?? "smart";
  const currentRouteLabel = ROUTE_LENS_LABEL[routeLens];
  const nextRouteLabel = ROUTE_LENS_LABEL[nextRouteLens];

  const hiddenCount = allRecs.filter((rec) => feedback.suppressed[rec.id]).length;
  const visibleRecs = allRecs.filter((rec) => !feedback.suppressed[rec.id]);
  const latestSkipped = useMemo(() => latestSessionSkip(sessionSkipped), [sessionSkipped]);
  const recentMemoryCounts = useMemo(
    () => recommendationMemoryCounts(feedback, { rsn: activeRsn }),
    [activeRsn, feedback]
  );
  const latestMemory = useMemo(
    () => latestRecommendationMemory(feedback, { rsn: activeRsn }),
    [activeRsn, feedback]
  );
  const routePickOptions = useMemo(
    () => ({
      skippedIds: mergedSkipCounts(sessionSkippedCounts(sessionSkipped), recentMemoryCounts),
      previousKind: latestSkipped?.kind ?? memoryKind(latestMemory),
      previousId: latestSkipped?.id ?? latestMemory?.id ?? null
    }),
    [latestMemory, latestSkipped?.id, latestSkipped?.kind, recentMemoryCounts, sessionSkipped]
  );
  const actionContext = useMemo<RecommendationActionContext>(
    () => ({ from: "next", hasBankContext, rsn: activeRsn }),
    [activeRsn, hasBankContext]
  );
  const archetype = accountStage;
  const runeLiteNote = runeLitePlanNote(pluginSyncState);

  // Reset shuffle wanneer mood/time veranderen — een nieuwe vibe begint
  // op de top-pick, anders blijven we stiekem op een oude alternative.
  useEffect(() => {
    setShuffleIdx(0);
  }, [mood, minutes, routeLens]);

  const pick = useMemo(
    () => pickForRoute(visibleRecs, mood, minutes, routeLens, shuffleIdx, routePickOptions),
    [visibleRecs, mood, minutes, routeLens, shuffleIdx, routePickOptions]
  );
  const sessionPlanText = useMemo(
    () => formatRecommendationSessionPlan(
      pick ? [pick.headline, ...pick.alternatives] : visibleRecs,
      actionContext
    ),
    [pick, visibleRecs, actionContext]
  );
  const memoryNote = useMemo(
    () => sessionMemoryNote({
      feedback,
      lastSession,
      allRecs,
      headline: pick?.headline ?? null,
      activeRsn
    }),
    [activeRsn, feedback, lastSession, allRecs, pick?.headline]
  );
  const noticedNote = useMemo(
    () => scapestackNotice({
      headline: pick?.headline ?? null,
      allRecs,
      mood,
      routeLens,
      hasBankContext,
      pluginSyncState
    }),
    [allRecs, hasBankContext, mood, pick?.headline, pluginSyncState, routeLens]
  );

  useEffect(() => {
    if (!pick) return;
    saveMood({
      mood,
      minutes,
      lastHeadlineId: pick.headline.id,
      lastHeadlineTitle: pick.headline.title
    });
  }, [mood, minutes, pick]);

  if (allRecs.length === 0) return null;
  const applySessionIntent = (nextMood: Mood, nextMinutes?: TimeBudget) => {
    setMood(nextMood);
    const defaultTime = nextMinutes ?? defaultTimeForMood(nextMood);
    if (defaultTime) setMinutes(defaultTime);
    setShuffleIdx(0);
    setRouteSwitchNote(null);
    setLastSuppressed(null);
    setLastCompleted(null);
  };
  const applyRouteLens = (nextLens: RouteLens, options: { keepRouteSwitchNote?: boolean } = {}) => {
    const routeDefaultTime = defaultTimeForRouteLens(nextLens);
    setRouteLens(nextLens);
    setMood((currentMood) => moodForRouteLens(nextLens, currentMood));
    if (routeDefaultTime) setMinutes(routeDefaultTime);
    setShuffleIdx(0);
    if (!options.keepRouteSwitchNote) setRouteSwitchNote(null);
    setLastSuppressed(null);
    setLastCompleted(null);
  };
  const hideRecommendation = (rec: Recommendation) => {
    setFeedback(suppressRecommendation({ id: rec.id, kind: rec.kind, title: rec.title, reason: "not_today" }));
    setLastSuppressed({ id: rec.id, kind: rec.kind, title: rec.title });
    setLastCompleted(null);
  };
  const completeRecommendation = (rec: Recommendation) => {
    setFeedback(suppressRecommendation({ id: rec.id, kind: rec.kind, title: rec.title, reason: "already_done" }));
    setLastCompleted({ id: rec.id, title: rec.title });
    setLastSuppressed(null);
  };
  const restoreLastSuppressed = () => {
    if (!lastSuppressed) return;
    setFeedback(restoreRecommendation(lastSuppressed.id));
    setLastSuppressed(null);
    setShuffleIdx(0);
  };
  const markLastSuppressedTooHard = () => {
    if (!lastSuppressed) return;
    setFeedback(suppressRecommendation({
      id: lastSuppressed.id,
      kind: lastSuppressed.kind,
      title: lastSuppressed.title,
      reason: "too_hard"
    }));
    applySessionIntent("chill", 30);
  };
  const restoreLastCompleted = () => {
    if (!lastCompleted) return;
    setFeedback(restoreRecommendation(lastCompleted.id));
    setLastCompleted(null);
    setShuffleIdx(0);
  };
  const moveToAnotherPlan = () => {
    setLastCompleted(null);
    setLastSuppressed(null);
    if (pick?.headline) {
      setSessionSkipped((current) => recordSessionSkip(current, pick.headline));
      setFeedback(recordRecommendationMemory({
        id: pick.headline.id,
        kind: pick.headline.kind,
        title: pick.headline.title,
        action: "try_another",
        mood,
        routeLens,
        rsn: activeRsn
      }));
      setRouteSwitchNote(routeSwitchCopy(nextRouteLens, pick.headline));
    }
    if (nextRouteLens === "smart") {
      setRouteLens("smart");
      setShuffleIdx((i) => i + 1);
      return;
    }
    applyRouteLens(nextRouteLens, { keepRouteSwitchNote: true });
  };
  const moveToChillPlan = () => {
    applySessionIntent("chill", 30);
  };
  const restoreHidden = () => {
    setFeedback(clearRecommendationFeedback());
    setLastSuppressed(null);
    setLastCompleted(null);
    setShuffleIdx(0);
  };
  const copySessionPlan = async () => {
    const result = await copyText(sessionPlanText);
    if (result !== "failed") {
      setSessionCopyState("copied");
      window.setTimeout(() => setSessionCopyState("idle"), 1600);
    } else {
      setSessionCopyState("error");
    }
  };
  const sessionCopyLabel = sessionCopyState === "copied"
    ? "Plan copied"
    : sessionCopyState === "error"
      ? "Try copy again"
      : "Copy plan";
  const routePreviewRecs = pick ? [pick.headline, ...pick.alternatives].slice(0, 3) : [];

  return (
    <section
      data-screenshot-mode={shareMode ? "true" : undefined}
      className={cn(
        shareMode &&
          "fixed inset-0 z-50 overflow-y-auto bg-[var(--color-bg)] px-4 py-6 sm:px-8 sm:py-8"
      )}
    >
      <div
        className={cn(
          shareMode &&
            "mx-auto max-w-4xl rounded-2xl border border-[var(--color-accent)]/25 bg-[var(--color-panel)]/86 p-4 shadow-[0_26px_80px_-54px_rgba(134, 166, 217,0.65)] sm:p-5"
        )}
      >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-[var(--color-accent)]">
            {shareMode ? "Scapestack /next" : "What to do now"}
          </div>
          <h2 className="mt-1 text-[26px] font-bold tracking-normal text-[var(--color-text)]">
            Do this first
          </h2>
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-[var(--color-text-dim)]">
            One best move for this account. Two backups if you want a different kind of session.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
            <span
              className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-bg)]/35 px-2.5 py-1 font-semibold text-[var(--color-text-dim)]"
              title={archetype.helper}
            >
              {archetype.label}
            </span>
            {runeLiteNote && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-semibold",
                  pluginSyncState === "live"
                    ? "border-[var(--color-good)]/25 bg-[var(--color-good)]/10 text-[var(--color-good)]"
                    : pluginSyncState
                      ? "border-[var(--color-warning)]/25 bg-[var(--color-warning)]/10 text-[var(--color-warning)]"
                      : "border-[var(--color-border)] bg-[var(--color-bg)]/35 text-[var(--color-text-dim)]"
                )}
              >
                {runeLiteNote}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {routeIntent && (
            <span
              className="inline-flex items-center gap-1 rounded-full border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 px-2.5 py-1 text-[10.5px] font-semibold text-[var(--color-accent)]"
              title={routeIntent.helper}
            >
              {routeIntent.label}
            </span>
          )}
          {pick && allRecs.length > 1 && !shareMode && (
            <button
              type="button"
              onClick={moveToAnotherPlan}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)]/65 px-3 py-2 text-[11.5px] font-semibold text-[var(--color-text-dim)] transition-colors hover:border-[var(--color-accent)]/40 hover:text-[var(--color-accent)]"
              title={`Try ${nextRouteLabel.name} route`}
            >
              <Dices className="size-3.5" />
              <span className="sm:hidden">Try {nextRouteLabel.name}</span>
              <span className="hidden sm:inline">Try {nextRouteLabel.name}</span>
            </button>
          )}
          {visibleRecs.length > 0 && !shareMode && (
            <button
              type="button"
              onClick={copySessionPlan}
              aria-label="Copy top OSRS plan"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border bg-[var(--color-panel)]/65 px-3 py-2 text-[11.5px] font-semibold transition-colors",
                sessionCopyState === "error"
                  ? "border-[var(--color-danger)]/40 text-[var(--color-danger)] hover:border-[var(--color-danger)]/55"
                  : "border-[var(--color-border)] text-[var(--color-text-dim)] hover:border-[var(--color-accent)]/40 hover:text-[var(--color-accent)]"
              )}
            >
              {sessionCopyState === "copied" ? <CheckCheck className="size-3.5" /> : <Copy className="size-3.5" />}
              {sessionCopyLabel}
            </button>
          )}
          <button
            type="button"
            onClick={() => onShareModeChange(!shareMode)}
            aria-pressed={shareMode}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border bg-[var(--color-panel)]/65 px-3 py-2 text-[11.5px] font-semibold transition-colors",
              shareMode
                ? "border-[var(--color-accent)]/45 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10"
                : "border-[var(--color-border)] text-[var(--color-text-dim)] hover:border-[var(--color-accent)]/40 hover:text-[var(--color-accent)]"
            )}
          >
            <Camera className="size-3.5" />
            {shareMode ? "Exit clean shot" : "Screenshot mode"}
          </button>
        </div>
      </div>

      {lastSuppressed && (
        <div
          role="status"
          aria-live="polite"
          className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10 px-3.5 py-2.5 text-[12px]"
        >
          <span className="text-[var(--color-text-dim)]">
            Hidden for now: <span className="font-semibold text-[var(--color-text)]">{lastSuppressed.title}</span>.
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => applySessionIntent("cash", 60)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-warning)]/35 bg-[var(--color-bg)]/35 px-2.5 py-1.5 text-[11px] font-semibold text-[var(--color-warning)] transition-colors hover:bg-[var(--color-warning)]/10"
            >
              Need GP
            </button>
            <button
              type="button"
              onClick={() => applySessionIntent("afk", 60)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-warning)]/35 bg-[var(--color-bg)]/35 px-2.5 py-1.5 text-[11px] font-semibold text-[var(--color-warning)] transition-colors hover:bg-[var(--color-warning)]/10"
            >
              Want AFK
            </button>
            <button
              type="button"
              onClick={markLastSuppressedTooHard}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-warning)]/35 bg-[var(--color-bg)]/35 px-2.5 py-1.5 text-[11px] font-semibold text-[var(--color-warning)] transition-colors hover:bg-[var(--color-warning)]/10"
            >
              Too hard
            </button>
            <button
              type="button"
              onClick={restoreLastSuppressed}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-warning)]/35 bg-[var(--color-bg)]/35 px-2.5 py-1.5 text-[11px] font-semibold text-[var(--color-warning)] transition-colors hover:bg-[var(--color-warning)]/10"
            >
              Undo hide
            </button>
          </div>
        </div>
      )}

      {lastCompleted && (
        <div
          role="status"
          aria-live="polite"
          className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--color-good)]/30 bg-[var(--color-good)]/10 px-3.5 py-2.5 text-[12px]"
        >
          <span className="text-[var(--color-text-dim)]">
            Nice. <span className="font-semibold text-[var(--color-text)]">{lastCompleted.title}</span> is done. Pick the next move.
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={moveToAnotherPlan}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-good)]/35 bg-[var(--color-bg)]/35 px-2.5 py-1.5 text-[11px] font-semibold text-[var(--color-good)] transition-colors hover:bg-[var(--color-good)]/10"
            >
              Another trip
            </button>
            <button
              type="button"
              onClick={moveToChillPlan}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-good)]/35 bg-[var(--color-bg)]/35 px-2.5 py-1.5 text-[11px] font-semibold text-[var(--color-good)] transition-colors hover:bg-[var(--color-good)]/10"
            >
              Chill now
            </button>
            <button
              type="button"
              onClick={restoreLastCompleted}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-good)]/35 bg-[var(--color-bg)]/35 px-2.5 py-1.5 text-[11px] font-semibold text-[var(--color-good)] transition-colors hover:bg-[var(--color-good)]/10"
            >
              Undo done
            </button>
          </div>
        </div>
      )}

      {memoryNote && !routeSwitchNote && !lastSuppressed && !lastCompleted && !shareMode && (
        <div
          role="status"
          aria-live="polite"
          className="mb-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)]/55 px-3.5 py-2.5 text-[12px] font-semibold leading-relaxed text-[var(--color-text-dim)]"
        >
          {memoryNote}
        </div>
      )}

      {routeSwitchNote && !lastSuppressed && !lastCompleted && !shareMode && (
        <div
          role="status"
          aria-live="polite"
          className="mb-3 rounded-xl border border-[var(--color-accent)]/20 bg-[var(--color-accent)]/8 px-3.5 py-2.5 text-[12px] font-semibold leading-relaxed text-[var(--color-text-dim)]"
        >
          {routeSwitchNote}
        </div>
      )}

      {noticedNote && !routeSwitchNote && !lastSuppressed && !lastCompleted && !shareMode && (
        <div
          role="note"
          className="mb-3 rounded-xl border border-[var(--color-accent)]/20 bg-[var(--color-accent)]/8 px-3.5 py-2.5 text-[12px] font-semibold leading-relaxed text-[var(--color-text-dim)]"
        >
          {noticedNote}
        </div>
      )}

      <div className="space-y-3">
        {pick ? (
          <>
            <RecHeadlineExpandable
              rec={pick.headline}
              allRecs={allRecs}
              actionContext={actionContext}
              onBossOpen={onBossOpen}
              onSuppress={hideRecommendation}
              onComplete={completeRecommendation}
              onEdit={onEdit}
              cleanMode={shareMode}
              mood={mood}
              minutes={minutes}
              hasBankContext={hasBankContext}
              bankItems={bankItems}
              accountStage={accountStage}
              pluginSyncState={pluginSyncState}
            />
            {pick.alternatives.length > 0 && (
              <div>
                <div className="mb-2 flex flex-wrap items-baseline gap-2">
                  <span className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                    Backups
                  </span>
                  <span className="text-[11px] text-[var(--color-text-muted)]">
                    Chill / GP / Bossing / Unlock / AFK
                  </span>
                </div>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {pick.alternatives.map((r) => (
                    <RecRowExpandable
                      key={r.id}
                      rec={r}
                      actionContext={actionContext}
                      onBossOpen={onBossOpen}
                      mood={mood}
                      minutes={minutes}
                      hasBankContext={hasBankContext}
                      bankItems={bankItems}
                      accountStage={accountStage}
                      backupPrompt={backupChoicePrompt(r, pick.headline)}
                    />
                  ))}
                </div>
              </div>
            )}
            {!shareMode && (
              <details className="group rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)]/42 p-2.5">
                <summary className="flex list-none items-center justify-between gap-3 rounded-lg px-1 py-1 text-left [&::-webkit-details-marker]:hidden">
                  <span>
                    <span className="block text-[12.5px] font-bold text-[var(--color-text)]">Try another</span>
                    <span className="mt-0.5 block text-[11px] text-[var(--color-text-muted)]">
                      {currentRouteLabel.name} · {minutes === 60 ? "1 hour" : `${minutes} min`}
                    </span>
                  </span>
                  <span className="text-right text-[11px] font-semibold text-[var(--color-text-dim)]">
                    Show
                  </span>
                </summary>
                <div className="mt-3 space-y-4">
                  <div>
                    <div className="mb-2 text-[10.5px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                      Route
                    </div>
                    <div className="flex gap-1.5 overflow-x-auto pb-1 sm:grid sm:grid-cols-7 sm:overflow-visible sm:pb-0">
                      {ROUTE_LENS_ORDER.map((lens) => {
                        const label = ROUTE_LENS_LABEL[lens];
                        const active = routeLens === lens;
                        return (
                          <button
                            key={lens}
                            type="button"
                            aria-pressed={active}
                            aria-label={`Pick ${label.name} route`}
                            onClick={() => applyRouteLens(lens)}
                            className={cn(
                              "flex min-h-10 min-w-[132px] items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-[11.5px] font-semibold transition-colors sm:min-w-0",
                              active
                                ? "border-[var(--color-accent)]/60 bg-[var(--color-accent)]/12 text-[var(--color-accent)]"
                                : "border-[var(--color-border)] bg-[var(--color-bg)]/35 text-[var(--color-text-dim)] hover:border-[var(--color-accent)]/35 hover:text-[var(--color-accent)]"
                            )}
                            title={label.tagline}
                          >
                            <ItemSprite
                              id={label.itemId}
                              alt=""
                              className="pixelated shrink-0"
                              style={{ width: 18, height: 18, imageRendering: "pixelated", objectFit: "contain" }}
                            />
                            <span className="truncate">{label.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-[190px_minmax(0,1fr)]">
                    <div>
                      <div className="mb-2 text-[10.5px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                        Time
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {TIME_OPTIONS.map((t) => (
                          <button
                            key={t.value}
                            type="button"
                            onClick={() => setMinutes(t.value)}
                            className={cn(
                              "rounded-md border px-2.5 py-1 text-[11px] transition-colors",
                              minutes === t.value
                                ? "border-[var(--color-accent)]/50 bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                                : "border-[var(--color-border)] text-[var(--color-text-dim)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text)]"
                            )}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="mb-2 text-[10.5px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                        Pace
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
                        {MOODS.map((m) => {
                          const label = MOOD_LABEL[m];
                          const active = mood === m;
                          return (
                            <button
                              key={m}
                              type="button"
                              aria-pressed={active}
                              aria-label={`Pick ${label.name} session pace`}
                              onClick={() => applySessionIntent(m)}
                              className={cn(
                                "flex min-h-9 items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition-colors",
                                active
                                  ? "border-[var(--color-accent)]/60 bg-[var(--color-accent)]/12 text-[var(--color-accent)]"
                                  : "border-[var(--color-border)] bg-[var(--color-bg)]/35 text-[var(--color-text-dim)] hover:border-[var(--color-accent)]/35 hover:text-[var(--color-accent)]"
                              )}
                              title={label.tagline}
                            >
                              <ItemSprite
                                id={label.itemId}
                                alt=""
                                className="pixelated shrink-0"
                                style={{ width: 16, height: 16, imageRendering: "pixelated", objectFit: "contain" }}
                              />
                              <span className="truncate">{label.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  {hiddenCount > 0 && (
                    <button
                      type="button"
                      onClick={restoreHidden}
                      className="text-[11px] font-semibold text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-accent)]"
                    >
                      Show hidden ({hiddenCount})
                    </button>
                  )}
                </div>
              </details>
            )}
            <TonightRouteStrip recs={routePreviewRecs} shareMode={shareMode} />
          </>
        ) : (
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-8 text-center text-[var(--color-text-muted)] text-[13px]">
            {hiddenCount > 0
              ? "Everything matching this mood is hidden. Restore hidden picks or change mood/time."
              : "Nothing urgent to flag — your account looks well on top of things."}
          </div>
        )}
      </div>

      </div>
    </section>
  );
}

// ── WhereYouAre (track 2) ──────────────────────────────────────────────────
// Top-strip met de 3 belangrijkste account-metrics + de 4 Path-axes
// gerenderd als één rij horizontale balken (geen losse ring-cards).
// Vervangt het oude HoursToMaxSection + PathOverview.

function WhereYouAre({
  pathData,
  maxEstimate
}: {
  pathData: NextUpResult["pathProgress"];
  maxEstimate: NextUpResult["maxEstimate"];
}) {
  const hasMaxData = maxEstimate.perSkill.length > 0;
  const days = hasMaxData ? Math.round(maxEstimate.totalHours / 4) : null;
  const overallPercent = pathData.overallPercent;

  // Bar-fill choreography: balken starten op 0% en groeien naar target
  // ná mount + na de stagger-delay van deze track (300ms). useEffect na
  // requestAnimationFrame zodat browser de "vanaf 0%" frame echt rendert.
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      // Extra 50ms na de track-stagger zodat de balken de laatste zijn
      // die "klikken" — sluit de animatie-sequentie netjes af.
      const t = setTimeout(() => setFilled(true), 50);
      return () => clearTimeout(t);
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <section>
      <h3 className="eyebrow text-[var(--color-accent)] mb-3">Where you are</h3>
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-5 space-y-5">
        {/* Top strip — drie cijfers naast elkaar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pb-4 border-b border-[var(--color-border)]/60">
          <Metric
            label="Overall"
            value={overallPercent}
            suffix="%"
            sub="to max account"
            animate
          />
          {hasMaxData ? (
            <Metric
              label="Time to max"
              value={Math.round(maxEstimate.totalHours)}
              suffix="h"
              sub={`≈ ${days} days @ 4h/day`}
              animate
            />
          ) : (
            <Metric label="Time to max" value="—" sub="add your RSN" />
          )}
          <Metric
            label="Top grind"
            value={maxEstimate.perSkill[0]?.skill ?? "—"}
            sub={maxEstimate.perSkill[0]
              ? `${COMPACT_NUMBER.format(Math.round(maxEstimate.perSkill[0].hours))}h to 99`
              : ""}
          />
        </div>

        {/* Vier paths als één rij van horizontale balken — bar-fill
            animation via transform:scaleX van 0 → 1. De pad met laagste
            % krijgt een 'focus here' marker + zachte continue glow op
            de balk: dat is waar de meeste tijd-investering zit. */}
        <div className="space-y-3.5">
          {(() => {
            const focusKind = pathData.paths.reduce((min, p) =>
              p.percent < min.percent ? p : min, pathData.paths[0]
            ).kind;
            return pathData.paths.map((p) => {
              const isFocus = p.kind === focusKind;
              return (
                <div key={p.kind} className="group/path">
                  <div className="flex items-baseline justify-between gap-3 text-[12px] tabular-nums mb-1">
                    <span className="flex items-center gap-2">
                      <span className={cn(
                        "font-semibold capitalize",
                        isFocus ? "text-[var(--color-accent)]" : "text-[var(--color-text)]"
                      )}>
                        {p.kind}
                      </span>
                      {isFocus && (
                        <span className="text-[9.5px] uppercase tracking-[0.18em] text-[var(--color-accent)] bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/30 px-1.5 py-0.5 rounded">
                          focus
                        </span>
                      )}
                    </span>
                    <span className="text-[var(--color-text-dim)]">
                      {p.done}/{p.total} · {p.percent}%
                    </span>
                  </div>
                  <div
                    className={cn(
                      "h-2 rounded-full bg-[var(--color-bg-2)] overflow-hidden relative transition-all",
                      "group-hover/path:bg-[var(--color-bg)]"
                    )}
                  >
                    <div
                      className={cn(
                        "h-full rounded-full origin-left transition-all",
                        isFocus
                          ? "bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent)]/70"
                          : "bg-[var(--color-accent)]/55"
                      )}
                      style={{
                        width: `${p.percent}%`,
                        transform: filled ? "scaleX(1)" : "scaleX(0)",
                        transition: "transform 900ms cubic-bezier(0.22, 1, 0.36, 1)",
                        boxShadow: isFocus ? "0 0 14px -2px rgba(134, 166, 217,0.55)" : undefined,
                        animation: isFocus && filled ? "card-breath 3.2s ease-in-out infinite" : undefined,
                      }}
                    />
                  </div>
                  {p.nextSteps.length > 0 && (
                    <p className="text-[10.5px] text-[var(--color-text-muted)] mt-1 truncate">
                      next: {p.nextSteps.slice(0, 2).map((n) => n.title).join(" · ")}
                    </p>
                  )}
                </div>
              );
            });
          })()}
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value, suffix, sub, animate }: {
  label: string;
  value: string | number;
  suffix?: string;
  sub?: string;
  /** Wanneer true en value een number is, telt het cijfer omhoog van
   *  0 → target over 900ms. Gebruikt requestAnimationFrame met
   *  ease-out cubic zodat het natuurlijk vertraagt aan het einde. */
  animate?: boolean;
}) {
  const isNumeric = typeof value === "number";
  const [display, setDisplay] = useState<number | string>(
    isNumeric && animate ? 0 : value
  );

  useEffect(() => {
    if (!isNumeric || !animate) return;
    // Respect OS-level motion preference — skip de animatie maar laat
    // de eindwaarde meteen zien zodat de UI niet "leeg" voelt.
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      setDisplay(value as number);
      return;
    }
    const target = value as number;
    const startedAt = performance.now();
    const duration = 900;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - startedAt) / duration);
      // ease-out cubic: snel beginnen, traag uitkomen
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(target * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, animate, isNumeric]);

  const text = isNumeric && typeof display === "number"
    ? COMPACT_NUMBER.format(display) + (suffix ?? "")
    : String(value);

  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">{label}</div>
      <div className="text-[18px] sm:text-[20px] font-bold text-[var(--color-text)] tabular-nums leading-tight mt-0.5">
        {text}
      </div>
      {sub && (
        <div className="text-[10.5px] text-[var(--color-text-dim)] tabular-nums">
          {sub}
        </div>
      )}
    </div>
  );
}

// ── RecHeadlineExpandable + RecRowExpandable ───────────────────────────────
// Wrappers rond HeadlineCard / RecRow die een details-paneel toevoegen.
// Klik op de "Show details" toggle → expand inline (geen navigatie weg).
// Details bevat: payoff, needs[], details-tekst, en de link-naar-tool.
// Werkt voor zowel hero als alt-rows (zelfde details, andere
// presentation density).

function RecDetailPanel({
  rec,
  actionContext,
  whyNot
}: {
  rec: Recommendation;
  actionContext: RecommendationActionContext;
  whyNot?: string | null;
}) {
  // Fallback naar default hints wanneer rec ze niet expliciet meegaf.
  const hints = defaultActionHints(rec.kind);
  const needs = rec.needs ?? hints.needs;
  const details = rec.details ?? hints.details;
  const linkedAction = rec.link ? routeActionForHref(rec.link, actionContext) : null;
  const wikiQuery = recommendationWikiQuery(rec);
  return (
    <div className="mt-2 px-4 py-3 rounded-lg bg-[var(--color-bg-2)]/40 border border-[var(--color-border)] animate-[fade-in_0.2s_ease-out] space-y-2.5">
      <ActionPlanBlock rec={rec} />
      {hasDropChanceGraph(rec) && (
        <KcProbabilityGraph
          kc={rec.kcMeta.kc}
          denom={rec.kcMeta.denom}
          dropName={rec.kcMeta.dropName}
        />
      )}
      {details && (
        <p className="text-[12.5px] text-[var(--color-text-dim)] leading-relaxed">
          {details}
        </p>
      )}
      {whyNot && (
        <p className="flex gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/35 px-3 py-2 text-[12px] font-semibold leading-relaxed text-[var(--color-text-muted)]">
          <Shield className="mt-0.5 size-3.5 shrink-0 text-[var(--color-text-muted)]" />
          <span>{whyNot}</span>
        </p>
      )}
      {needs.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)] mb-1.5">
            You'll need
          </div>
          <ul className="space-y-1">
            {needs.map((n, i) => (
              <li key={i} className="text-[12px] text-[var(--color-text)] flex items-baseline gap-2">
                <span className="size-1 rounded-full bg-[var(--color-accent)] inline-block translate-y-[-2px] shrink-0" />
                {n}
              </li>
            ))}
          </ul>
        </div>
      )}
      {(rec.link || wikiQuery) && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {rec.link && (
            <Link
              href={recommendationHrefWithContext(rec.link, actionContext)}
              className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--color-accent)] hover:underline"
            >
              {linkedAction?.label ?? "Open Scapestack route"} <ArrowRight className="size-3.5" />
            </Link>
          )}
          {wikiQuery && (
            <a
              href={wikiSearchUrl(wikiQuery)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)]/45 px-2.5 py-1 text-[11.5px] font-semibold text-[var(--color-text-dim)] transition-colors hover:border-[var(--color-accent)]/45 hover:text-[var(--color-accent)]"
              aria-label={`Open OSRS Wiki for ${wikiQuery}`}
            >
              OSRS Wiki
              <ExternalLink className="size-3" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function recommendationWikiQuery(rec: Recommendation): string {
  if (rec.kind === "kc" || rec.kind === "boss") {
    const boss = rec.bossSlug ? BOSSES.find((candidate) => candidate.slug === rec.bossSlug) : null;
    if (boss) return boss.name;
  }
  return rec.title
    .replace(/^Try\s+/i, "")
    .replace(/^Push\s+/i, "")
    .replace(/^Finish\s+/i, "")
    .replace(/\s+to\s+\d+\s*(?:KC)?$/i, "")
    .replace(/\s+KC$/i, "")
    .trim();
}

function recommendationFeedbackButtonClass(
  tone: "done" | "skip" | "details",
  compact = false
): string {
  const toneClass = tone === "done"
    ? "hover:border-[var(--color-good)]/40 hover:bg-[var(--color-good)]/10 hover:text-[var(--color-good)]"
    : tone === "skip"
      ? "hover:border-[var(--color-warning)]/40 hover:bg-[var(--color-warning)]/10 hover:text-[var(--color-warning)]"
      : "hover:border-[var(--color-accent)]/40 hover:bg-[var(--color-accent)]/10 hover:text-[var(--color-accent)]";

  return cn(
    "inline-flex items-center justify-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-panel)]/65 font-semibold text-[var(--color-text-muted)] transition-colors",
    compact ? "px-2.5 py-1 text-[10.5px]" : "px-3 py-1.5 text-[11px]",
    toneClass
  );
}

function RecHeadlineExpandable({
  rec,
  allRecs,
  actionContext,
  onBossOpen,
  onSuppress,
  onComplete,
  onEdit,
  cleanMode = false,
  mood,
  minutes,
  hasBankContext,
  bankItems,
  accountStage,
  pluginSyncState
}: {
  rec: Recommendation;
  allRecs: Recommendation[];
  actionContext: RecommendationActionContext;
  onBossOpen: (slug: string) => void;
  onSuppress: (rec: Recommendation) => void;
  onComplete: (rec: Recommendation) => void;
  onEdit: () => void;
  cleanMode?: boolean;
  mood: Mood;
  minutes: TimeBudget;
  hasBankContext: boolean;
  bankItems: BankHandoffItem[];
  accountStage: NextUpResult["summary"]["accountStage"];
  pluginSyncState: "live" | "stale" | "outdated" | null;
}) {
  const [open, setOpen] = useState(false);
  const whyNot = recommendationWhyNot({ headline: rec, allRecs, mood, hasBankContext, pluginSyncState });
  return (
    <div>
      <HeadlineCard
        rec={rec}
        allRecs={allRecs}
        actionContext={actionContext}
        onBossOpen={onBossOpen}
        mood={mood}
        minutes={minutes}
        hasBankContext={hasBankContext}
        bankItems={bankItems}
        accountStage={accountStage}
        pluginSyncState={pluginSyncState}
      />
      {!cleanMode && (
        <div className="flex justify-end mt-1.5 gap-3">
          <button
            type="button"
            onClick={() => onComplete(rec)}
            aria-label={`Done: mark ${rec.title} complete`}
            className={recommendationFeedbackButtonClass("done")}
          >
            Done
            <CheckCheck className="size-3" />
          </button>
          <button
            type="button"
            onClick={() => onSuppress(rec)}
            aria-label={`Not today: hide ${rec.title}`}
            className={recommendationFeedbackButtonClass("skip")}
          >
            Not today
          </button>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className={recommendationFeedbackButtonClass("details")}
          >
            {open ? "Hide steps" : "Show steps"}
            <ChevronRight
              className={cn("size-3 transition-transform", open && "rotate-90")}
            />
          </button>
        </div>
      )}
      {open && <RecDetailPanel rec={rec} actionContext={actionContext} whyNot={whyNot} />}
    </div>
  );
}

function RecRowExpandable({
  rec,
  actionContext,
  onBossOpen,
  mood,
  minutes,
  hasBankContext,
  bankItems,
  accountStage,
  backupPrompt
}: {
  rec: Recommendation;
  actionContext: RecommendationActionContext;
  onBossOpen: (slug: string) => void;
  mood: Mood;
  minutes: TimeBudget;
  hasBankContext: boolean;
  bankItems: BankHandoffItem[];
  accountStage: NextUpResult["summary"]["accountStage"];
  backupPrompt?: { label: string; helper: string };
}) {
  return (
    <RecRow
      rec={rec}
      actionContext={actionContext}
      onBossOpen={onBossOpen}
      mood={mood}
      minutes={minutes}
      hasBankContext={hasBankContext}
      bankItems={bankItems}
      accountStage={accountStage}
      backupPrompt={backupPrompt}
    />
  );
}
