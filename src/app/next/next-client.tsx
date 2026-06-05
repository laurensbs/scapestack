"use client";

import { useState, useTransition, useMemo, useEffect, type MouseEvent } from "react";
import Link from "next/link";
import {
  ArrowRight, ChevronRight, Edit3, Target, Sword, TrendingUp, Layers,
  Sparkles, Trophy, Gamepad2, Coins, Scroll, Map as MapIcon, Dices, ExternalLink,
  Copy, CheckCheck, CheckCircle2, Shield, Trash2
} from "lucide-react";
import { SupportCard } from "@/components/support-card";
import { SavedBankBanner } from "@/components/saved-bank-banner";
import { BossSprite } from "@/components/boss-picker";
import { ItemSprite } from "@/components/item-sprite";
import { KcProbabilityGraph } from "@/components/kc-probability-graph";
import { XpDropLoader } from "@/components/xp-drop-loader";
import { ShuffleLoader } from "@/components/shuffle-loader";
import { BossDetailModal } from "@/components/boss-detail-modal";
import { ScapestackReadinessRail } from "@/components/scapestack-readiness-rail";
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
import { pickForMood, MOOD_LABEL, type Mood, type TimeBudget } from "@/lib/mood";
import { saveMood, loadMood, relativeSince, type MoodSession } from "@/lib/mood-storage";
import {
  clearRecommendationFeedback,
  loadRecommendationFeedback,
  restoreRecommendation,
  suppressRecommendation,
  type RecommendationFeedback
} from "@/lib/recommendation-feedback";
import { wikiSearchUrl } from "@/lib/wiki";
import { CURRENT_PLUGIN_VERSION, pluginSyncHealth } from "@/lib/plugin-sync";
import { isPluginSyncSource, pluginVerifyUrlForSyncedRsn } from "@/lib/plugin-sync-actions";
import { summarizeNextPluginSync, type NextPluginSignalStatus } from "@/lib/next-plugin-sync-summary";
import { nextPluginHubCta, type NextPluginHubState } from "@/lib/next-plugin-hub-copy";
import { toolHandoffUrl } from "@/lib/bank-tool-routes";
import { bankOrganizerHref } from "@/lib/bank-handoff-url";
import { shouldReadNextBankHandoff, shouldReadNextHeroBank } from "@/lib/next-route-context";
import { nextIntentFromSearch, type NextIntentPreset } from "@/lib/next-intent";
import { formatRecommendationActionPlan, formatRecommendationSessionPlan } from "@/lib/action-plan-text";
import {
  primaryActionForRecommendation,
  recommendationHrefWithContext,
  routeActionForHref,
  type RecommendationActionContext
} from "@/lib/recommendation-action";
import { missingDataActionForRecommendation, type RecommendationDataAction } from "@/lib/recommendation-data-action";
import { buildRecommendationIdentity } from "@/lib/recommendation-identity";
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

const SAMPLE_LABEL = "mid-game PvM sample";
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
  // When the user came from /bank's "What should I do next?" handoff,
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
  // path: pre-parsed `bankItems` from /bank's "What should I do next?"
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
      } catch { /* malformed payload — silently ignore, fall back to intake */ }
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
        } catch { /* malformed payload — run with RSN only */ }
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

  // "Use saved bank" from the welcome-back banner. Reuses the same engine
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
        <h2 className="text-[22px] sm:text-[26px] font-bold text-[var(--color-text)] tracking-tight leading-tight">
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
          <h3 className="text-[17px] font-bold text-[var(--color-text)] tracking-tight leading-tight">
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
// for sharper advice.
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
      // give bank-aware recs even before they type their RSN.
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
        <h2 className="text-[28px] sm:text-[36px] font-bold text-[var(--color-text)] tracking-tight leading-[1.1]">
          What should you do<br className="sm:hidden" /> next?
        </h2>
        <p className="mt-3 text-[14px] sm:text-[15px] text-[var(--color-text-dim)] leading-relaxed max-w-md mx-auto">
          Type your OSRS name. We&apos;ll read your stats, rank what&apos;s worth doing,
          and shape it around the mood you&apos;re in.
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
          title="Use your saved bank?"
          message={`We found your saved bank from ${savedBank ? relativeSince(savedBank.savedAt) : "earlier"}. Use it for bank-aware recommendations, or skip it and enter only an OSRS name.`}
          primaryLabel="Use saved bank"
          secondaryLabel="Skip bank"
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
                Back from RuneLite setup
              </p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--color-text-muted)]">
                Enter the same OSRS name to use verified sync if it exists. If /next still looks inferred, verify the Sync URL and payload from the plugin page.
              </p>
            </div>
            <Link
              href={pluginVerifyHref}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--color-warning)]/35 bg-[var(--color-bg)]/45 px-2.5 py-1.5 text-[11px] font-bold text-[var(--color-warning)] transition-colors hover:bg-[var(--color-warning)]/10"
            >
              Verify sync
              <ArrowRight className="size-3" />
            </Link>
          </div>
        </div>
      )}

      {/* Handoff banner — appears when the user arrived here via the
          Bank Organizer's "What should I do next?" button. The bank is
          already loaded; an RSN is optional but gets sharper advice. */}
      {fromBank && (
        <div className="mb-4 rounded-lg border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/8 px-4 py-3 flex items-start gap-3 animate-[fade-in_0.3s_ease-out] text-left">
          <Sparkles className="size-4 text-[var(--color-accent)] shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] text-[var(--color-text)] leading-relaxed">
              <span className="font-semibold">Using the bank you just organised</span>
              {handoffSummary ? ` (${handoffSummary.label}).` : "."}{" "}
              Add your OSRS name for stat-aware
              advice, or just click the button — we&apos;ll do what we can with the bank alone.
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-[var(--color-text-muted)]">
              Browser-only handoff; it expires automatically and only avoids pasting the same bank twice.
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
              Plan with this bank
              <ArrowRight className="size-3" />
            </button>
            <button
              type="button"
              onClick={onClearBankHandoff}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/45 px-2.5 py-1.5 text-[11px] font-semibold text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-danger)]/45 hover:text-[var(--color-danger)]"
            >
              Clear handoff
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
            ? "border-[var(--color-accent)]/60 shadow-[0_0_0_4px_rgba(230,165,47,0.10)]"
            : "border-[var(--color-border)] focus-within:border-[var(--color-accent)]/60 focus-within:shadow-[0_0_0_4px_rgba(230,165,47,0.10)]"
        )}>
          <div className="flex flex-col sm:flex-row sm:items-center">
            <input
              type="text"
              value={rsn}
              onChange={(e) => setRsn(e.target.value)}
              placeholder="e.g. Lynx Titan"
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
              {loading ? <XpDropLoader /> : "Show me"}
              {!loading && <ArrowRight className="size-4 group-hover/btn:translate-x-0.5 transition-transform" />}
            </button>
          </div>
          <p
            id="next-show-me-disabled-help"
            aria-live="polite"
            className="border-t border-[var(--color-border)] px-5 py-2 text-[11.5px] leading-relaxed text-[var(--color-text-muted)]"
          >
            {loading
              ? "Building your plan from available account signals…"
              : rsn.trim()
              ? "Ready: /next will use your RSN, Hiscores, saved bank and verified sync if available."
              : fromBank
              ? "Ready: bank-only planning is available; add an RSN for stat-aware picks."
              : "Type an OSRS name, paste a bank, or start from the Bank Organizer to unlock Show me."}
          </p>

          {/* Tijdens loading verschijnt de ShuffleLoader onder de input
              (sprite-shuffle + lore-quote). Voelt levendiger dan een
              SourceStatus pill-rij. */}
          {loading && (
            <div className="border-t border-[var(--color-border)]">
              <ShuffleLoader />
            </div>
          )}
        </div>

        {/* Secondary: optional bank paste for sharper advice. Onder
            het hero-frame zodat de eerste indruk niet vol-staat met
            opties — alleen onthuld als de speler er om vraagt. */}
        <div className="mt-4 text-center">
          {showBankField ? (
            <div className="text-left animate-[fade-in_0.3s_ease-out]">
              <label className="block">
                <span className="text-[11.5px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                  Bank export <span className="normal-case tracking-normal">(optional — sharper advice)</span>
                </span>
                <textarea
                  value={bank}
                  onChange={(e) => setBank(e.target.value)}
                  placeholder="Paste your RuneLite Bank Memory export here…"
                  rows={4}
                  className="mt-2 w-full rounded-lg bg-[var(--color-panel)] border border-[var(--color-border)] focus:border-[var(--color-accent)] outline-none px-3 py-2 text-[12px] font-mono text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] resize-y"
                />
                <button
                  type="button"
                  onClick={() => { setShowBankField(false); setBank(""); }}
                  className="mt-2 text-[11.5px] text-[var(--color-text-muted)] hover:text-[var(--color-text-dim)] transition-colors"
                >
                  Hide — just use my stats
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
              + Add your bank for sharper advice
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
          Or see it with a {SAMPLE_LABEL}
        </button>
      </div>

      <p className="mt-8 text-[11.5px] text-[var(--color-text-muted)] text-center leading-relaxed">
        {cameFromPlugin
          ? "RuneLite sync is optional and only counted after /next loads a verified payload. Bank handoff stays browser-only."
          : "Free, no account, no plugin. We never store your bank — everything runs in your browser and on Scapestack's own server."}
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

  const basisNote =
    summary.basis === "full" ? "Based on your Hiscores and your bank."
    : summary.basis === "hiscores-only" ? "Based on your Hiscores. Paste a bank for gear-aware advice."
    : summary.basis === "bank-only" ? "Based on your bank. Add your OSRS name for stat-aware advice."
    : "Add your OSRS name or a bank for tailored advice.";

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
  const primaryRec = headline ?? rest[0] ?? null;

  return (
    <div className="space-y-8">
      {/* ── TRACK 0: HERO ──────────────────────────────────────────── */}
      <div style={trackAnim(0)}>
        <HeroStrip summary={summary} basisNote={basisNote} onEdit={onEdit} />
      </div>

      <div style={trackAnim(75)}>
        <SessionBrief
          rec={primaryRec}
          summary={summary}
          bankItems={bankItems}
          activeRsn={activeRsn}
          pluginSyncState={pluginSyncState}
          onEdit={onEdit}
        />
      </div>

      <div style={trackAnim(150)}>
        <EvidenceLedger summary={summary} pathData={result.pathProgress} bankItems={bankItems} />
      </div>

      <div style={trackAnim(225)}>
        <ScapestackReadinessRail
          surface="next"
          hasBankContext={bankItems.length > 0}
          hasRsn={Boolean(activeRsn)}
          hasPluginSync={Boolean(result.pathProgress.syncedSources?.scapestack)}
          pluginSyncState={pluginSyncState}
          rsn={activeRsn}
          className="mb-0"
        />
      </div>

      <div style={trackAnim(300)}>
        <NextBankContextStrip
          bankItems={bankItems}
          basis={summary.basis}
          activeRsn={activeRsn}
          pluginSyncState={pluginSyncState}
          onClearStoredBankHandoff={onClearStoredBankHandoff}
        />
      </div>

      <div style={trackAnim(375)}>
        <PluginSyncStrip pathData={result.pathProgress} expectedPluginSync={expectedPluginSync} activeRsn={activeRsn} />
      </div>

      {/* ── TRACK 1: WHAT TO DO ─────────────────────────────────────── */}
      <div style={trackAnim(450)}>
        <WhatToDo
          allRecs={allRecs}
          activeRsn={activeRsn}
          hasBankContext={bankItems.length > 0}
          onBossOpen={onBossOpen}
          onEdit={onEdit}
          routeIntent={routeIntent}
        />
      </div>

      {/* ── TRACK 2: WHERE YOU ARE ──────────────────────────────────── */}
      <div style={trackAnim(600)}>
        <WhereYouAre
          pathData={result.pathProgress}
          maxEstimate={result.maxEstimate}
        />
      </div>

      {/* ── TRACK 3: ALMOST THERE ───────────────────────────────────── */}
      <div style={trackAnim(750)}>
        <ReadinessSection readiness={result.readiness} />
      </div>

      <div className="pt-4" style={trackAnim(900)}>
        <SupportCard />
      </div>
    </div>
  );
}

function syncAgeLabel(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "recently";
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function SessionBrief({
  rec,
  summary,
  bankItems,
  activeRsn,
  pluginSyncState,
  onEdit
}: {
  rec: Recommendation | null;
  summary: NextUpResult["summary"];
  bankItems: BankHandoffItem[];
  activeRsn: string;
  pluginSyncState: "live" | "stale" | "outdated" | null;
  onEdit: () => void;
}) {
  if (!rec) return null;

  const plan = rec.actionPlan;
  const trustLabel = pluginSyncState === "live" && bankItems.length > 0
    ? "Verified RuneLite + bank"
    : pluginSyncState === "live"
      ? "Verified RuneLite"
      : pluginSyncState === "stale"
        ? "Refresh sync first"
        : pluginSyncState === "outdated"
          ? "Update plugin first"
          : summary.basis === "full"
            ? "Hiscores + bank"
            : summary.basis === "hiscores-only"
              ? "Hiscores only"
              : summary.basis === "bank-only"
                ? "Bank only"
                : "Guided estimate";
  const beforeCommit = pluginSyncState === "stale"
    ? "Refresh RuneLite sync before spending GP or locking a long grind."
    : pluginSyncState === "outdated"
      ? `Update Scapestack Sync to v${CURRENT_PLUGIN_VERSION}, then re-run /next.`
      : !activeRsn
        ? "Add your OSRS name before relying on quest, diary or skill gates."
        : bankItems.length === 0
          ? "Paste a bank when gear, supplies or affordability could change the route."
          : plan?.caveat ?? "Good to run now; mark it done or hide it if it does not fit tonight.";
  const firstStep = plan?.steps[0] ?? rec.why;

  return (
    <section
      data-testid="next-session-brief"
      className="rounded-xl border border-[var(--color-accent)]/25 bg-gradient-to-br from-[var(--color-accent)]/10 to-[var(--color-panel)]/70 px-4 py-3"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-[var(--color-accent)]">
            Tonight&apos;s session brief
          </div>
          <h2 className="mt-1 text-[17px] font-bold tracking-tight text-[var(--color-text)]">
            {rec.title}
          </h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--color-text-dim)]">
            First click: <span className="font-semibold text-[var(--color-text)]">{firstStep}</span>
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[520px]">
          <BriefChip
            label="Trust level"
            value={trustLabel}
            tone={pluginSyncState === "live" || summary.basis === "full" ? "good" : pluginSyncState ? "warn" : "muted"}
          />
          <BriefChip
            label="Timebox"
            value={plan?.timebox ?? "Pick a short test run"}
            tone="muted"
          />
          <button
            type="button"
            onClick={onEdit}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/35 px-3 py-2 text-left transition-colors hover:border-[var(--color-accent)]/45"
          >
            <div className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
              Before you commit
            </div>
            <div className="mt-0.5 text-[11.5px] font-semibold leading-snug text-[var(--color-text-dim)]">
              {beforeCommit}
            </div>
          </button>
        </div>
      </div>
    </section>
  );
}

function BriefChip({ label, value, tone }: { label: string; value: string; tone: "good" | "warn" | "muted" }) {
  return (
    <div className={cn(
      "rounded-lg border px-3 py-2",
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
        "mt-0.5 text-[11.5px] font-semibold leading-snug",
        tone === "good"
          ? "text-[var(--color-good)]"
          : tone === "warn"
            ? "text-[var(--color-warning)]"
            : "text-[var(--color-text-dim)]"
      )}>
        {value}
      </div>
    </div>
  );
}

function EvidenceLedger({
  summary,
  pathData,
  bankItems
}: {
  summary: NextUpResult["summary"];
  pathData: NextUpResult["pathProgress"];
  bankItems: BankHandoffItem[];
}) {
  const plugin = pathData.syncedSources?.scapestack ?? null;
  const pluginState = plugin ? summarizeNextPluginSync(plugin).state : null;
  const trackerCount = [
    pathData.syncedSources?.wom,
    pathData.syncedSources?.temple,
    pathData.syncedSources?.collectionLog
  ].filter(Boolean).length;
  const hasHiscores = summary.basis === "full" || summary.basis === "hiscores-only";
  const hasBank = bankItems.length > 0 || summary.basis === "full" || summary.basis === "bank-only";
  const evidence = [
    {
      label: "Hiscores",
      value: hasHiscores ? "Used" : "Missing",
      detail: hasHiscores ? "Stats and account gates shape the ranking." : "Add an OSRS name for combat, skill and quest gates.",
      tone: hasHiscores ? "good" : "muted"
    },
    {
      label: "Bank",
      value: hasBank ? `${bankItems.length || "Bank"} item${bankItems.length === 1 ? "" : "s"}` : "Optional",
      detail: hasBank ? "Gear and supplies can move boss, DPS and prep picks up." : "Paste or hand off a bank for gear-aware advice.",
      tone: hasBank ? "good" : "muted"
    },
    {
      label: "RuneLite",
      value: pluginState === "live" ? "Verified" : pluginState === "stale" ? "Refresh" : pluginState === "outdated" ? "Update" : "Not used",
      detail: pluginState === "live"
        ? "Quest, diary, collection-log and Slayer coverage came from a fresh Scapestack payload."
        : pluginState === "stale"
        ? "Payload exists, but needs a refresh before trusting coverage labels."
        : pluginState === "outdated"
        ? "Plugin payload exists, but update before trusting newer fields."
        : "Optional: verify a payload when you want coverage labels instead of inference.",
      tone: pluginState === "live" ? "good" : pluginState ? "warn" : "muted"
    },
    {
      label: "Trackers",
      value: trackerCount > 0 ? `${trackerCount} linked` : "Best effort",
      detail: trackerCount > 0 ? "External trackers added account context where available." : "No WOM, Temple or collection-log tracker signal contributed.",
      tone: trackerCount > 0 ? "good" : "muted"
    }
  ] as const;

  return (
    <section
      data-testid="next-evidence-ledger"
      className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)]/70 px-4 py-3"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-[var(--color-accent)]">
            Evidence used
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-[var(--color-text-muted)]">
            Scapestack ranks picks from the signals below; missing signals stay visible instead of being hidden.
          </p>
        </div>
        <div className="grid flex-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {evidence.map((item) => (
            <div
              key={item.label}
              title={item.detail}
              className={cn(
                "rounded-lg border px-2.5 py-2",
                item.tone === "good"
                  ? "border-[var(--color-good)]/25 bg-[var(--color-good)]/10"
                  : item.tone === "warn"
                    ? "border-[var(--color-warning)]/25 bg-[var(--color-warning)]/10"
                    : "border-[var(--color-border)] bg-[var(--color-bg)]/35"
              )}
            >
              <div className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                {item.label}
              </div>
              <div className={cn(
                "mt-0.5 text-[11.5px] font-semibold leading-snug",
                item.tone === "good"
                  ? "text-[var(--color-good)]"
                  : item.tone === "warn"
                    ? "text-[var(--color-warning)]"
                    : "text-[var(--color-text-dim)]"
              )}>
                {item.value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
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
      ? "This is the full Scapestack loop: verified RuneLite account payload plus browser-only bank gear and supplies."
      : pluginSyncState === "stale"
        ? "RuneLite sync is connected, but refresh it before trusting quest, diary, collection-log and Slayer coverage labels."
        : pluginSyncState === "outdated"
          ? "RuneLite sync is connected, but update the plugin before trusting newer Slayer and coverage fields."
      : basis === "full"
      ? "Your plan is using both the bank and Hiscores, so gear, goals and account gates are being ranked together."
      : basis === "bank-only"
        ? "Your bank is loaded. Add an OSRS name next time for quests, diaries, combat level and skill gates."
        : "Your bank context is loaded for item and gear checks where this run can use it.";

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
              {hasPluginSync ? "Bank + RuneLite sync connected" : "Bank context active"}
            </div>
            {hasPluginSync && (
              <div className={cn(
                "mt-1 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.12em]",
                hasLivePluginSync
                  ? "border-[var(--color-good)]/25 bg-[var(--color-good)]/10 text-[var(--color-good)]"
                  : "border-[var(--color-warning)]/25 bg-[var(--color-warning)]/10 text-[var(--color-warning)]"
              )}>
                <CheckCircle2 className="size-3" />
                {hasLivePluginSync ? "Verified fusion" : pluginSyncState === "outdated" ? "Plugin update needed" : "Refresh sync"}
              </div>
            )}
            <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--color-text-dim)]">
              <span className="font-semibold text-[var(--color-text)]">{context.summary.label}</span>
              {" · "}
              {basisCopy}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-[var(--color-text-muted)]">
              Browser-only handoff for cross-tool navigation. Clear it to stop carrying this bank into new `/next`, `/dps`, `/goals`, `/slayer` or `/plugin` sessions.
              {handoffCleared ? " Stored handoff cleared; this current result keeps its already-computed bank-aware plan until you rerun." : ""}
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
            Review bank
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
            Clear handoff
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
            Verify RuneLite sync
            <Sparkles className="size-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function PluginSyncStrip({
  pathData,
  expectedPluginSync,
  activeRsn
}: {
  pathData: NextUpResult["pathProgress"];
  expectedPluginSync: boolean;
  activeRsn: string;
}) {
  const plugin = pathData.syncedSources?.scapestack ?? null;
  const [pluginHubState, setPluginHubState] = useState<NextPluginHubState>("open");
  const hasAnyTracker =
    Boolean(pathData.syncedSources?.wom) ||
    Boolean(pathData.syncedSources?.temple) ||
    Boolean(pathData.syncedSources?.collectionLog);
  const pluginReviewHref = (() => {
    const params = new URLSearchParams();
    if (activeRsn.trim()) params.set("rsn", activeRsn.trim());
    params.set("from", "next");
    return `/plugin?${params.toString()}#review-readiness`;
  })();

  useEffect(() => {
    if (plugin) return;
    let active = true;

    fetch("/api/plugin-hub/status")
      .then(async (response) => response.ok ? await response.json() as {
        state?: unknown;
        reviewCopyIssues?: unknown;
        pinSummary?: unknown;
        reviewSummary?: unknown;
      } : null)
      .then((status) => {
        if (!active) return;
        const state = status?.state;
        const reviewCopyBlocked = Array.isArray(status?.reviewCopyIssues) && status.reviewCopyIssues.length > 0;
        const pinBlocked = typeof status?.pinSummary === "string" && status.pinSummary.includes("behind standalone repo head");
        const reviewBlocked = typeof status?.reviewSummary === "string" && status.reviewSummary.includes("requested changes");
        setPluginHubState(
          reviewCopyBlocked || pinBlocked || reviewBlocked
            ? "review-blocked"
            : state === "merged" || state === "closed" || state === "unknown"
            ? state
            : "open"
        );
      })
      .catch(() => {
        if (active) setPluginHubState("unknown");
      });

    return () => {
      active = false;
    };
  }, [plugin]);

  if (plugin) {
    const pluginSummary = summarizeNextPluginSync(plugin);
    const stale = pluginSummary.state === "stale";
    const outdated = pluginSummary.state === "outdated";
    return (
      <section className={cn(
        "rounded-xl border px-4 py-3 flex items-start justify-between gap-4",
        outdated
          ? "border-[var(--color-danger)]/35 bg-[var(--color-danger)]/10"
          : stale
          ? "border-[var(--color-warning)]/35 bg-[var(--color-warning)]/10"
          : "border-[var(--color-good)]/30 bg-[var(--color-good)]/10"
      )}>
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "mt-0.5 size-2 rounded-full",
              outdated
                ? "bg-[var(--color-danger)] shadow-[0_0_14px_rgba(248,113,113,0.55)]"
                : stale
                ? "bg-[var(--color-warning)] shadow-[0_0_14px_rgba(245,158,11,0.55)]"
                : "bg-[var(--color-good)] shadow-[0_0_14px_rgba(74,222,128,0.55)]"
            )}
            aria-hidden="true"
          />
          <div>
            <div className={cn(
              "text-[11px] uppercase tracking-[0.18em] font-bold",
              outdated ? "text-[var(--color-danger)]" : stale ? "text-[var(--color-warning)]" : "text-[var(--color-good)]"
            )}>
              {pluginSummary.title}
            </div>
            <p className="mt-1 text-[12.5px] text-[var(--color-text-dim)] leading-relaxed">
              {pluginSummary.body} Synced {syncAgeLabel(plugin.syncedAt)}.
            </p>
            <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
              <div className="rounded-lg border border-[var(--color-good)]/20 bg-[var(--color-bg)]/35 px-2.5 py-2">
                <div className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-[var(--color-good)]">
                  Account proof
                </div>
                <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--color-text-dim)]">
                  RuneLite verified quests, diaries, collection-log and Slayer labels for this RSN.
                </p>
              </div>
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/35 px-2.5 py-2">
                <div className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                  Bank proof
                </div>
                <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--color-text-dim)]">
                  Still browser-only. Paste Bank Memory or Bank Tags when gear, supplies or affordability matter.
                </p>
              </div>
            </div>
            {(stale || outdated) && (
              <a
                href={pluginVerifyUrlForSyncedRsn(activeRsn, "next")}
                className={cn(
                  "mt-2 inline-flex rounded-md border bg-[var(--color-bg)]/35 px-2 py-1 text-[11px] font-semibold transition-colors",
                  outdated
                    ? "border-[var(--color-danger)]/35 text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10"
                    : "border-[var(--color-warning)]/35 text-[var(--color-warning)] hover:bg-[var(--color-warning)]/10"
                )}
              >
                {outdated ? "Open update steps →" : "Open plugin sync steps →"}
              </a>
            )}
          </div>
        </div>
        <div className="shrink-0 grid grid-cols-2 gap-1.5 text-[11px] tabular-nums">
          {pluginSummary.signals.map((signal) => (
            <div
              key={signal.label}
              className={cn("rounded-lg border px-2 py-1.5 text-right", pluginSignalClass(signal.status))}
              title={`${signal.label}: ${signal.status}`}
            >
              <div className="font-bold uppercase tracking-[0.12em]">{signal.label}</div>
              <div className="mt-0.5 text-[var(--color-text)] font-semibold">{signal.value}</div>
            </div>
          ))}
          {plugin.pluginVersion && (
            <div className="col-span-2 text-right text-[10.5px] text-[var(--color-text-muted)]">v{plugin.pluginVersion}</div>
          )}
        </div>
      </section>
    );
  }

  if (expectedPluginSync) {
    return (
      <section className="rounded-xl border border-[var(--color-warning)]/35 bg-[var(--color-warning)]/10 px-4 py-3 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span
            className="mt-0.5 size-2 rounded-full bg-[var(--color-warning)] shadow-[0_0_14px_rgba(245,158,11,0.55)]"
            aria-hidden="true"
          />
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-[var(--color-warning)]">
              RuneLite sync not found for this run
            </div>
            <p className="mt-1 text-[12.5px] text-[var(--color-text-dim)] leading-relaxed">
              You came from the plugin checker, but /next could not load Scapestack sync data for this RSN. Re-check the RSN spelling or sync again from RuneLite.
            </p>
          </div>
        </div>
        <a
          href={pluginVerifyUrlForSyncedRsn(activeRsn, "next")}
          className="shrink-0 rounded-lg border border-[var(--color-warning)]/35 bg-[var(--color-bg)]/35 px-3 py-2 text-[11.5px] font-semibold text-[var(--color-warning)] hover:bg-[var(--color-warning)]/10 transition-colors"
        >
          Re-check sync →
        </a>
      </section>
    );
  }

  const pluginHubCta = nextPluginHubCta(pluginHubState, hasAnyTracker);
  const pluginHubHref = pluginHubState === "review-blocked"
    ? pluginReviewHref
    : pluginVerifyUrlForSyncedRsn(activeRsn, "next");

  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)]/70 px-4 py-3 flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <Sparkles className="mt-0.5 size-4 text-[var(--color-accent)] shrink-0" />
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-[var(--color-accent)]">
            {pluginHubCta.title}
          </div>
          <p className="mt-1 text-[12.5px] text-[var(--color-text-dim)] leading-relaxed">
            {pluginHubCta.body}
          </p>
        </div>
      </div>
      <a
        href={pluginHubHref}
        className="shrink-0 rounded-lg border border-[var(--color-accent)]/35 bg-[var(--color-accent)]/10 px-3 py-2 text-[11.5px] font-semibold text-[var(--color-accent)] hover:bg-[var(--color-accent)]/15 transition-colors"
      >
        {pluginHubCta.cta}
      </a>
    </section>
  );
}

function pluginSignalClass(status: NextPluginSignalStatus): string {
  if (status === "exact") return "border-[var(--color-good)]/25 bg-[var(--color-good)]/10 text-[var(--color-good)]";
  if (status === "partial" || status === "refresh") return "border-[var(--color-warning)]/25 bg-[var(--color-warning)]/10 text-[var(--color-warning)]";
  return "border-[var(--color-danger)]/25 bg-[var(--color-danger)]/10 text-[var(--color-danger)]";
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
    // Premium hero-card: lichte gradient, accent top-stripe, gold sweep
    // van links naar rechts elke 6s. Voelt mee met de loader-vibe.
    <div
      className="relative overflow-hidden rounded-xl border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-panel)] to-[var(--color-bg-2)] p-5 sm:p-6"
    >
      {/* Subtiele accent top-line — zelfde signature als de SyncedBadge
          en headline-card. Bindt het visueel aan de rest van /next. */}
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: "linear-gradient(to right, transparent, rgba(230,165,47,0.55), transparent)" }}
      />
      {/* Sweep — zacht goudje dat elke 6s van links naar rechts wandelt.
          Subtieler dan de loader-spotlight (we zijn klaar met laden),
          maar geeft de card leven. */}
      <div
        className="pointer-events-none absolute inset-y-0 -inset-x-1/2 opacity-60"
        style={{
          background: "linear-gradient(90deg, transparent 0%, transparent 35%, rgba(230,165,47,0.06) 50%, transparent 65%, transparent 100%)",
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
// missing slug). `prominent` enables the pulsing-gold-ring halo for the
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

function confidenceTone(confidence: NonNullable<Recommendation["actionPlan"]>["confidence"]): string {
  if (confidence === "exact") return "border-[var(--color-good)]/40 bg-[var(--color-good)]/10 text-[var(--color-good)]";
  if (confidence === "likely") return "border-[var(--color-accent)]/35 bg-[var(--color-accent)]/10 text-[var(--color-accent)]";
  return "border-[var(--color-border)] bg-[var(--color-bg-2)] text-[var(--color-text-dim)]";
}

function RecommendationIdentityChip({ rec, compact = false }: { rec: Recommendation; compact?: boolean }) {
  const identity = buildRecommendationIdentity(rec);
  if (!identity) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-bg)]/45 font-mono text-[var(--color-text-muted)]",
        compact ? "px-1.5 py-0.5 text-[9.5px]" : "px-2 py-0.5 text-[10.5px]"
      )}
      title={identity.helper}
      aria-label={identity.helper}
    >
      {identity.label}
    </span>
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
          <span
            className={cn(
              "rounded-full border px-1.5 py-0.5 text-[9.5px] font-semibold normal-case tracking-normal",
              confidenceTone(plan.confidence)
            )}
            title={plan.caveat || "Recommendation confidence"}
          >
            {plan.confidenceLabel}
          </span>
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
          <span className={cn("rounded-full border px-2 py-0.5 text-[10.5px] font-semibold", confidenceTone(plan.confidence))}>
            {plan.confidenceLabel}
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

function RecommendationProofStrip({ rec, compact = false }: { rec: Recommendation; compact?: boolean }) {
  const plan = rec.actionPlan;
  const chips = [
    plan ? { label: "Confidence", value: plan.confidenceLabel, title: plan.caveat || "Recommendation confidence" } : null,
    plan ? { label: "Session", value: plan.timebox } : null,
    rec.payoff ? { label: "Payoff", value: rec.payoff } : null,
    plan?.caveat ? { label: "Missing data", value: plan.caveat } : null
  ].filter((chip): chip is { label: string; value: string; title?: string } => Boolean(chip));

  if (chips.length === 0) return null;

  return (
    <div
      data-testid={compact ? "next-row-proof-strip" : "next-headline-proof-strip"}
      className={cn("mt-3 grid gap-1.5", compact ? "grid-cols-1" : "sm:grid-cols-2")}
    >
      {chips.slice(0, compact ? 3 : 4).map((chip) => (
        <div
          key={`${rec.id}:${chip.label}`}
          title={chip.title ?? chip.value}
          className={cn(
            "rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/35 px-2.5 py-2",
            chip.label === "Missing data" && "border-[var(--color-warning)]/30 bg-[var(--color-warning)]/7"
          )}
        >
          <div className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
            {chip.label}
          </div>
          <div className={cn(
            "mt-0.5 line-clamp-2 font-semibold leading-snug",
            compact ? "text-[10.5px]" : "text-[11.5px]",
            chip.label === "Missing data" ? "text-[var(--color-warning)]" : "text-[var(--color-text-dim)]"
          )}>
            {chip.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function RecommendationConfidenceLegend() {
  const items: Array<{
    confidence: NonNullable<Recommendation["actionPlan"]>["confidence"];
    label: string;
    helper: string;
  }> = [
    {
      confidence: "exact",
      label: "Verified",
      helper: "Verified RuneLite payload covers this quest, diary, collection log or Slayer state."
    },
    {
      confidence: "likely",
      label: "Likely",
      helper: "Uses your RSN, hiscores and saved bank where available."
    },
    {
      confidence: "guided",
      label: "Guided",
      helper: "Good default pick, but missing live account signals."
    }
  ];

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-2)]/35 p-3">
      <div className="text-[10.5px] uppercase tracking-[0.18em] text-[var(--color-text-muted)] mb-2">
        Why this pick?
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.confidence} className="flex items-start gap-2">
            <span className={cn("mt-0.5 shrink-0 rounded-full border px-1.5 py-0.5 text-[9.5px] font-semibold", confidenceTone(item.confidence))}>
              {item.label}
            </span>
            <span className="text-[10.5px] leading-snug text-[var(--color-text-muted)]">
              {item.helper}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// The headline — the one thing the hub most wants the player to do. Big,
// mint-accented, with the payoff and a direct link into the relevant tool.
function HeadlineCard({
  rec,
  actionContext,
  onBossOpen
}: {
  rec: Recommendation;
  actionContext: RecommendationActionContext;
  onBossOpen: (slug: string) => void;
}) {
  // Boss/KC recs that resolve to a known boss become clickable — the click
  // opens the BossDetailModal with the player's bank-derived gear set.
  // For other rec kinds, the card stays linked to `rec.link` as before.
  const isBossWithDetail = (rec.kind === "kc" || rec.kind === "boss") && !!rec.bossSlug;
  const primaryAction = primaryActionForRecommendation(rec, actionContext);
  const actionLabel = isBossWithDetail ? "Open boss detail" : primaryAction.label;
  const actionHref = isBossWithDetail ? undefined : primaryAction.href;
  const card = (
    <article
      className={cn(
        // group/headline triggers the headline-shimmer-target::after sweep
        // defined in globals.css — fires once on hover, doesn't loop.
        "group/headline group relative overflow-hidden rounded-xl p-6 headline-shimmer-target",
        "border border-[var(--color-accent)]/30 bg-gradient-to-br from-[var(--color-accent)]/12 to-transparent",
        (actionHref || isBossWithDetail) && "surface-interactive cursor-pointer transition-transform duration-200 hover:-translate-y-0.5"
      )}
    >
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: "linear-gradient(to right, transparent, rgba(230, 165, 47,0.55), transparent)" }}
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
            <span className="eyebrow text-[var(--color-accent)]">Start here</span>
            <RecommendationIdentityChip rec={rec} />
          </div>
          <h3 className="text-[19px] font-bold text-[var(--color-text)] tracking-tight leading-tight">
            {rec.title}
          </h3>
          <p className="mt-1.5 text-[13.5px] text-[var(--color-text-dim)] leading-relaxed">
            {rec.why}
          </p>
          {rec.payoff && (
            <p className="mt-2 text-[12.5px] text-[var(--color-text-secondary)] border-t border-[var(--color-border)] pt-2">
              {rec.payoff}
            </p>
          )}
          <RecommendationProofStrip rec={rec} />
          <ActionPlanBlock rec={rec} />
          {/* Probability chart — collapsed by default. Was default-open
              on the headline KC-rec but read as 'big chart shouting at
              you' the moment the page loaded. Toggle still works for
              players who want the depth. */}
          {hasDropChanceGraph(rec) && (
            <KcProbabilityGraph
              kc={rec.kcMeta.kc}
              denom={rec.kcMeta.denom}
              dropName={rec.kcMeta.dropName}
            />
          )}
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
            <div className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--color-accent)] group-hover:gap-2 transition-all">
              {actionLabel} <ArrowRight className="size-4" />
            </div>
          )}
        </div>
      </div>
    </article>
  );
  // Boss/KC cards contain their own KC graph toggle, so they expose an
  // explicit modal CTA button instead of pretending the whole card is a
  // button and risking nested interactive controls.
  if (isBossWithDetail) return card;
  // Non-boss card with a link wraps in <Link>. Boss/KC without a resolved
  // boss slug (rare — raid slug that fell through) renders as a static card.
  if (actionHref && primaryAction.external) {
    return <a href={actionHref} target="_blank" rel="noopener noreferrer">{card}</a>;
  }
  return actionHref ? <Link href={actionHref}>{card}</Link> : card;
}

// One checklist row — compact, linkable.
function RecRow({
  rec,
  actionContext,
  onBossOpen
}: {
  rec: Recommendation;
  actionContext: RecommendationActionContext;
  onBossOpen: (slug: string) => void;
}) {
  const isBossWithDetail = (rec.kind === "kc" || rec.kind === "boss") && !!rec.bossSlug;
  const primaryAction = primaryActionForRecommendation(rec, actionContext);
  const actionLabel = isBossWithDetail ? "Open boss detail" : primaryAction.label;
  const actionHref = isBossWithDetail ? undefined : primaryAction.href;
  const inner = (
    <article
      className={cn(
        "group h-full rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] p-3.5",
        (actionHref || isBossWithDetail) && "cursor-pointer transition-colors hover:border-[var(--color-accent)]/40"
      )}
    >
      <div className="flex items-start gap-3">
        <div className="size-9 shrink-0 rounded-md flex items-center justify-center bg-[var(--color-bg-2)] border border-[var(--color-border)] text-[var(--color-accent)] overflow-hidden">
          {rec.kind === "kc" && rec.bossSlug ? (
            <KcPortrait rec={rec} size={30} />
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
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <h4 className="text-[13px] font-semibold text-[var(--color-text)] tracking-tight leading-tight">
              {rec.title}
            </h4>
            <RecommendationIdentityChip rec={rec} compact />
          </div>
          <p className="mt-0.5 text-[12px] text-[var(--color-text-dim)] leading-snug">{rec.why}</p>
          {rec.payoff && (
            <p className="mt-1 text-[11px] text-[var(--color-text-muted)] leading-snug">{rec.payoff}</p>
          )}
          <RecommendationProofStrip rec={rec} compact />
          <ActionPlanBlock rec={rec} compact />
          {hasDropChanceGraph(rec) && (
            <KcProbabilityGraph
              kc={rec.kcMeta.kc}
              denom={rec.kcMeta.denom}
              dropName={rec.kcMeta.dropName}
            />
          )}
          {isBossWithDetail && rec.bossSlug ? (
            <button
              type="button"
              onClick={() => onBossOpen(rec.bossSlug!)}
              className="mt-2 inline-flex items-center gap-1 rounded border border-[var(--color-accent)]/35 bg-[var(--color-accent)]/10 px-2.5 py-1.5 text-[11.5px] font-semibold text-[var(--color-accent)] transition-all hover:bg-[var(--color-accent)]/15 hover:gap-1.5"
              aria-label={`${actionLabel}: ${rec.title}`}
              title={`${actionLabel}: ${rec.title}`}
            >
              {actionLabel} <ArrowRight className="size-3.5" />
            </button>
          ) : actionHref && (
            <div className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-semibold text-[var(--color-accent)] transition-all group-hover:gap-1.5">
              {actionLabel} <ArrowRight className="size-3.5" />
            </div>
          )}
        </div>
        {actionHref && (
          <ArrowRight
            aria-hidden="true"
            className="size-3.5 text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)] transition-colors shrink-0 mt-0.5"
          />
        )}
      </div>
    </article>
  );
  // Boss/KC rows keep the KC graph toggle and modal CTA as sibling buttons.
  if (isBossWithDetail) return inner;
  if (actionHref && primaryAction.external) {
    return <a href={actionHref} target="_blank" rel="noopener noreferrer" aria-label={`${actionLabel}: ${rec.title}`} title={`${actionLabel}: ${rec.title}`}>{inner}</a>;
  }
  return actionHref
    ? <Link href={actionHref} aria-label={`${actionLabel}: ${rec.title}`} title={`${actionLabel}: ${rec.title}`}>{inner}</Link>
    : inner;
}

// ── Mood section ───────────────────────────────────────────────────────────
// "Wat heb je zin in?" — kies een vibe, kies een tijdsbudget, krijg
// één concrete suggestie + 2 alternatieven. Optioneel; "Tonight's pick"
// hierboven blijft de objectief-beste anchor voor wie deze keuze wil
// overslaan. Engine zit in src/lib/mood.ts (pickForMood).

const MOODS: Mood[] = ["chill", "focused", "cash", "quest"];
const TIME_OPTIONS: { value: TimeBudget; label: string }[] = [
  { value: 15,  label: "15 min" },
  { value: 30,  label: "30 min" },
  { value: 60,  label: "1 hour" },
  { value: 120, label: "2 hours" },
];


// ── Bank readiness ─────────────────────────────────────────────────────────
// Toont "je bent dicht bij completen van deze sets" als chip-row.
// Klik op een chip → expandeert + toont wat er nog mist. Geen visual
// noise wanneer de bank leeg is.

function ReadinessSection({ readiness }: { readiness: SetCompletion[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  if (readiness.length === 0) return null;

  return (
    <section className="mb-10">
      <h3 className="eyebrow mb-1 text-[var(--color-accent)]">Almost there</h3>
      <p className="text-[11.5px] text-[var(--color-text-muted)] mb-3">
        Sets you're closest to completing — click for what's still missing.
      </p>
      <div className="flex flex-wrap gap-2">
        {readiness.map((c) => {
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
        const c = readiness.find((r) => r.setId === openId);
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
// + alternatieven rechts. Default-mood "focused 60min" zodat de pagina
// nooit leeg start. Save naar localStorage zoals de oude MoodSection.

function WhatToDo({
  allRecs,
  activeRsn,
  hasBankContext,
  onBossOpen,
  onEdit,
  routeIntent
}: {
  allRecs: Recommendation[];
  activeRsn: string;
  hasBankContext: boolean;
  onBossOpen: (slug: string) => void;
  onEdit: () => void;
  routeIntent: NextIntentPreset | null;
}) {
  const [mood, setMood] = useState<Mood>(routeIntent?.mood ?? "focused");
  const [minutes, setMinutes] = useState<TimeBudget>(routeIntent?.minutes ?? 60);
  const [shuffleIdx, setShuffleIdx] = useState(0);
  const [prev, setPrev] = useState<MoodSession | null>(null);
  const [dismissedBanner, setDismissedBanner] = useState(false);
  const [lastSuppressed, setLastSuppressed] = useState<{ id: string; title: string } | null>(null);
  const [lastCompleted, setLastCompleted] = useState<{ id: string; title: string } | null>(null);
  const [feedback, setFeedback] = useState<RecommendationFeedback>(() => ({
    version: 1,
    suppressed: {}
  }));
  const [sessionCopyState, setSessionCopyState] = useState<"idle" | "copied" | "error">("idle");

  useEffect(() => {
    const last = loadMood();
    if (last) {
      setPrev(last);
      if (!routeIntent) {
        setMood(last.mood);
        setMinutes(last.minutes);
      }
    }
    setFeedback(loadRecommendationFeedback());
  }, [routeIntent]);

  const hiddenCount = allRecs.filter((rec) => feedback.suppressed[rec.id]).length;
  const visibleRecs = allRecs.filter((rec) => !feedback.suppressed[rec.id]);
  const actionContext = useMemo<RecommendationActionContext>(
    () => ({ from: "next", hasBankContext, rsn: activeRsn }),
    [activeRsn, hasBankContext]
  );
  const sessionPlanText = useMemo(
    () => formatRecommendationSessionPlan(visibleRecs, actionContext),
    [visibleRecs, actionContext]
  );

  // Reset shuffle wanneer mood/time veranderen — een nieuwe vibe begint
  // op de top-pick, anders blijven we stiekem op een oude alternative.
  useEffect(() => {
    setShuffleIdx(0);
  }, [mood, minutes]);

  const pick = useMemo(
    () => pickForMood(visibleRecs, mood, minutes, shuffleIdx),
    [visibleRecs, mood, minutes, shuffleIdx]
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
  const showBanner = prev && !dismissedBanner && prev.lastHeadlineTitle;
  const hideRecommendation = (rec: Recommendation) => {
    setFeedback(suppressRecommendation({ id: rec.id, kind: rec.kind, reason: "not_today" }));
    setLastSuppressed({ id: rec.id, title: rec.title });
    setLastCompleted(null);
  };
  const completeRecommendation = (rec: Recommendation) => {
    setFeedback(suppressRecommendation({ id: rec.id, kind: rec.kind, reason: "already_done" }));
    setLastCompleted({ id: rec.id, title: rec.title });
    setLastSuppressed(null);
  };
  const restoreLastSuppressed = () => {
    if (!lastSuppressed) return;
    setFeedback(restoreRecommendation(lastSuppressed.id));
    setLastSuppressed(null);
    setShuffleIdx(0);
  };
  const restoreLastCompleted = () => {
    if (!lastCompleted) return;
    setFeedback(restoreRecommendation(lastCompleted.id));
    setLastCompleted(null);
    setShuffleIdx(0);
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
    ? "Session copied"
    : sessionCopyState === "error"
      ? "Try copy again"
      : "Copy session plan";

  return (
    <section>
      <div className="flex items-baseline justify-between gap-3 mb-3 flex-wrap">
        <div className="flex items-baseline gap-3">
          <h3 className="eyebrow text-[var(--color-accent)]">What to do</h3>
          {pick && allRecs.length > 1 && (
            <button
              type="button"
              onClick={() => setShuffleIdx((i) => i + 1)}
              className="text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors inline-flex items-center gap-1"
              title="Show me something else"
            >
              <Dices className="size-3" />
              Try something else
            </button>
          )}
          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={restoreHidden}
              className="text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
            >
              Show hidden ({hiddenCount})
            </button>
          )}
          {routeIntent && (
            <span
              className="inline-flex items-center gap-1 rounded-full border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 px-2 py-0.5 text-[10.5px] font-semibold text-[var(--color-accent)]"
              title={routeIntent.helper}
            >
              {routeIntent.label}
            </span>
          )}
          {visibleRecs.length > 0 && (
            <button
              type="button"
              onClick={copySessionPlan}
              aria-label="Copy top Scapestack session plan"
              className={cn(
                "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors",
                sessionCopyState === "error"
                  ? "border-[var(--color-danger)]/40 text-[var(--color-danger)] hover:border-[var(--color-danger)]/55"
                  : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-accent)]/40 hover:text-[var(--color-accent)]"
              )}
            >
              {sessionCopyState === "copied" ? <CheckCheck className="size-3" /> : <Copy className="size-3" />}
              {sessionCopyLabel}
            </button>
          )}
        </div>
        {showBanner && prev && (
          <p className="text-[11px] text-[var(--color-text-muted)] hidden sm:block">
            Welcome back — {relativeSince(prev.savedAt)} you were on {prev.lastHeadlineTitle}.
            <button
              type="button"
              onClick={() => setDismissedBanner(true)}
              className="ml-2 hover:text-[var(--color-text)]"
              aria-label="Dismiss"
            >
              ×
            </button>
          </p>
        )}
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
          <button
            type="button"
            onClick={restoreLastSuppressed}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-warning)]/35 bg-[var(--color-bg)]/35 px-2.5 py-1.5 text-[11px] font-semibold text-[var(--color-warning)] transition-colors hover:bg-[var(--color-warning)]/10"
          >
            Undo hide
          </button>
        </div>
      )}

      {lastCompleted && (
        <div
          role="status"
          aria-live="polite"
          className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--color-good)]/30 bg-[var(--color-good)]/10 px-3.5 py-2.5 text-[12px]"
        >
          <span className="text-[var(--color-text-dim)]">
            Marked done: <span className="font-semibold text-[var(--color-text)]">{lastCompleted.title}</span>.
          </span>
          <button
            type="button"
            onClick={restoreLastCompleted}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-good)]/35 bg-[var(--color-bg)]/35 px-2.5 py-1.5 text-[11px] font-semibold text-[var(--color-good)] transition-colors hover:bg-[var(--color-good)]/10"
          >
            Undo done
          </button>
        </div>
      )}

      <div className="grid lg:grid-cols-[260px_1fr] gap-4">
        {/* Left rail: mood-chips + time-budget toggle in één card. */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-4 space-y-4">
          <div>
            <div className="text-[10.5px] uppercase tracking-[0.18em] text-[var(--color-text-muted)] mb-2">
              I want to
            </div>
            <div className="grid grid-cols-2 gap-2">
              {MOODS.map((m) => {
                const label = MOOD_LABEL[m];
                const active = mood === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMood(m)}
                    className={cn(
                      "group/mood relative overflow-hidden px-2.5 py-2.5 rounded-lg border text-left transition-all duration-200",
                      "flex items-center gap-2.5",
                      active
                        ? "border-[var(--color-accent)]/60 bg-gradient-to-br from-[var(--color-accent)]/15 to-[var(--color-accent)]/5 shadow-[0_0_18px_-6px_rgba(230,165,47,0.45)]"
                        : "border-[var(--color-border)] bg-[var(--color-bg-2)]/40 hover:border-[var(--color-accent)]/30 hover:bg-[var(--color-accent)]/5 hover:-translate-y-0.5"
                    )}
                  >
                    {/* Sprite — scale-up + soft pulse op active */}
                    <ItemSprite
                      id={label.itemId}
                      alt=""
                      className="pixelated shrink-0 transition-transform duration-200 group-hover/mood:scale-110"
                      style={{
                        width: 22, height: 22,
                        imageRendering: "pixelated",
                        filter: active
                          ? "drop-shadow(0 0 4px rgba(230,165,47,0.6)) drop-shadow(1px 1px 0 rgb(0 0 0 / 0.9))"
                          : "drop-shadow(1px 1px 0 rgb(0 0 0 / 0.9))",
                        objectFit: "contain",
                        transform: active ? "scale(1.08)" : undefined
                      }}
                    />
                    <span className={cn(
                      "text-[12.5px] font-semibold transition-colors",
                      active ? "text-[var(--color-accent)]" : "text-[var(--color-text)]"
                    )}>
                      {label.name}
                    </span>
                  </button>
                );
              })}
            </div>
            {/* Tagline van de actieve mood — geeft context. */}
            <p className="text-[10.5px] text-[var(--color-text-muted)] mt-2 italic">
              {MOOD_LABEL[mood].tagline}
            </p>
          </div>
          <div>
            <div className="text-[10.5px] uppercase tracking-[0.18em] text-[var(--color-text-muted)] mb-2">
              Time
            </div>
            <div className="flex flex-wrap gap-1.5">
              {TIME_OPTIONS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setMinutes(t.value)}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-[11px] border transition-colors",
                    minutes === t.value
                      ? "border-[var(--color-accent)]/50 bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                      : "border-[var(--color-border)] text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:border-[var(--color-border-strong)]"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <RecommendationConfidenceLegend />
        </div>

        {/* Right column: gekozen suggestie + alternatieven. */}
        <div className="space-y-3">
          {pick ? (
            <>
              <RecHeadlineExpandable
                rec={pick.headline}
                actionContext={actionContext}
                onBossOpen={onBossOpen}
                onSuppress={hideRecommendation}
                onComplete={completeRecommendation}
                onEdit={onEdit}
              />
              {pick.alternatives.length > 0 && (
                <div className="grid sm:grid-cols-2 gap-2.5">
                  {pick.alternatives.map((r) => (
                    <RecRowExpandable
                      key={r.id}
                      rec={r}
                      actionContext={actionContext}
                      onBossOpen={onBossOpen}
                      onSuppress={hideRecommendation}
                      onComplete={completeRecommendation}
                      onEdit={onEdit}
                    />
                  ))}
                </div>
              )}
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
                        boxShadow: isFocus ? "0 0 14px -2px rgba(230,165,47,0.55)" : undefined,
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

// ── SourceStatus ───────────────────────────────────────────────────────────
// Tijdens intake-loading: toont welke databronnen we aan het bevragen
// zijn. We weten niet *precies* wanneer elke parallel-call resolve't —
// time-based reveal die de werkelijke gemiddelde latency benadert.
// Pill naar ✓ = "we hebben deze al gehad of zijn er bijna." Niet exact
// maar dichter bij de waarheid dan een lege loading-balk.

const SOURCE_TIMINGS: Array<{ key: string; label: string; delay: number }> = [
  { key: "plugin",   label: "Plugin",         delay:  200 },
  { key: "hiscores", label: "Hiscores",       delay:  500 },
  { key: "cl",       label: "Collection log", delay:  900 },
  { key: "wom",      label: "Wise Old Man",   delay: 1100 },
  { key: "temple",   label: "Temple",         delay: 1400 },
];

function SourceStatus() {
  const [done, setDone] = useState<Set<string>>(new Set());

  useEffect(() => {
    const timers = SOURCE_TIMINGS.map((s) =>
      setTimeout(() => {
        setDone((prev) => new Set(prev).add(s.key));
      }, s.delay)
    );
    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  return (
    <div className="border-t border-[var(--color-border)] px-4 py-3 animate-[fade-in_0.2s_ease-out]">
      <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)] mb-2">
        Reading
      </div>
      <div className="flex flex-wrap gap-1.5">
        {SOURCE_TIMINGS.map((s) => {
          const isDone = done.has(s.key);
          return (
            <span
              key={s.key}
              className={cn(
                "inline-flex items-center gap-1.5 px-2 py-1 rounded text-[11px] transition-all duration-300",
                isDone
                  ? "bg-[var(--color-good)]/10 text-[var(--color-good)] border border-[var(--color-good)]/30"
                  : "bg-[var(--color-bg-2)] text-[var(--color-text-muted)] border border-[var(--color-border)]"
              )}
            >
              {isDone ? (
                <span className="inline-block size-1.5 rounded-full bg-[var(--color-good)]" />
              ) : (
                <span className="inline-block size-1.5 rounded-full bg-[var(--color-text-muted)] animate-pulse" />
              )}
              {s.label}
            </span>
          );
        })}
      </div>
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
  actionContext
}: {
  rec: Recommendation;
  actionContext: RecommendationActionContext;
}) {
  // Fallback naar default hints wanneer rec ze niet expliciet meegaf.
  const hints = defaultActionHints(rec.kind);
  const needs = rec.needs ?? hints.needs;
  const details = rec.details ?? hints.details;
  const linkedAction = rec.link ? routeActionForHref(rec.link, actionContext) : null;
  const identity = buildRecommendationIdentity(rec);
  const wikiQuery = recommendationWikiQuery(rec);
  return (
    <div className="mt-2 px-4 py-3 rounded-lg bg-[var(--color-bg-2)]/40 border border-[var(--color-border)] animate-[fade-in_0.2s_ease-out] space-y-2.5">
      {details && (
        <p className="text-[12.5px] text-[var(--color-text-dim)] leading-relaxed">
          {details}
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
      {identity && (
        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)]/40 px-2.5 py-2">
          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)] mb-1.5">
            Visual identity
          </div>
          <div className="grid gap-1 sm:grid-cols-3">
            {identity.item.facts.map((fact) => (
              <div key={fact} className="rounded border border-[var(--color-border)] bg-[var(--color-panel)]/45 px-2 py-1 font-mono text-[10px] leading-relaxed text-[var(--color-text-dim)]">
                {fact}
              </div>
            ))}
          </div>
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

function RecommendationActions({
  rec,
  actionContext,
  onBossOpen,
  onEdit,
  compact = false
}: {
  rec: Recommendation;
  actionContext: RecommendationActionContext;
  onBossOpen: (slug: string) => void;
  onEdit: () => void;
  compact?: boolean;
}) {
  const action = primaryActionForRecommendation(rec, actionContext);
  const dataAction = missingDataActionForRecommendation(rec, actionContext);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const baseClass = cn(
    "inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-colors",
    compact
      ? "px-2.5 py-1.5 text-[11px]"
      : "px-3.5 py-2 text-[12.5px]",
    "border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/12 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/18"
  );
  const icon = action.external
    ? <ExternalLink className={compact ? "size-3" : "size-3.5"} />
    : <ArrowRight className={compact ? "size-3" : "size-3.5"} />;
  const formattedPlan = rec.actionPlan ? formatRecommendationActionPlan(rec, actionContext) : "";
  const copyPlan = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const result = await copyText(formattedPlan);
    if (result !== "failed") {
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1600);
    } else {
      setCopyState("error");
    }
  };
  const copyLabel = copyState === "copied"
    ? "Copied"
    : copyState === "error"
      ? "Try copy again"
      : "Copy plan";

  return (
    <div className={cn("mt-2 flex flex-wrap items-center gap-2", compact ? "" : "justify-between")}>
      {dataAction && (
        <RecommendationDataActionCallout
          action={dataAction}
          onEdit={onEdit}
          compact={compact}
        />
      )}
      <p className={cn(
        "text-[var(--color-text-muted)] leading-snug",
        compact ? "text-[10.5px] w-full" : "text-[11.5px]"
      )}>
        {action.helper}
      </p>
      {action.bossSlug ? (
        <>
          <button
            type="button"
            onClick={() => onBossOpen(action.bossSlug!)}
            className={baseClass}
          >
            {action.label}
            {icon}
          </button>
          {action.href && (
            <Link
              href={action.href}
              className={cn(
                "inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-dim)] transition-colors hover:border-[var(--color-accent)]/45 hover:text-[var(--color-accent)]",
                compact ? "px-2.5 py-1.5 text-[11px]" : "px-3.5 py-2 text-[12.5px]"
              )}
            >
              Open in DPS
              <ExternalLink className={compact ? "size-3" : "size-3.5"} />
            </Link>
          )}
        </>
      ) : action.href && action.external ? (
        <a
          href={action.href}
          target="_blank"
          rel="noopener noreferrer"
          className={baseClass}
        >
          {action.label}
          {icon}
        </a>
      ) : action.href ? (
        <Link href={action.href} className={baseClass}>
          {action.label}
          {icon}
        </Link>
      ) : null}
      {rec.actionPlan && (
        <div className={cn("flex flex-col gap-1.5", copyState === "error" && "w-full")}>
          <button
            type="button"
            onClick={copyPlan}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--color-border)] font-semibold text-[var(--color-text-dim)] transition-colors hover:border-[var(--color-accent)]/40 hover:text-[var(--color-accent)]",
              copyState === "error" && "border-[var(--color-danger)]/40 text-[var(--color-danger)] hover:border-[var(--color-danger)]/55 hover:text-[var(--color-danger)]",
              compact ? "px-2.5 py-1.5 text-[11px]" : "px-3.5 py-2 text-[12.5px]"
            )}
            aria-label={`Copy plan for ${rec.title}`}
            aria-live="polite"
          >
            {copyState === "copied" ? <CheckCheck className={compact ? "size-3" : "size-3.5"} /> : <Copy className={compact ? "size-3" : "size-3.5"} />}
            {copyLabel}
          </button>
          {copyState === "error" && (
            <label className="block text-[10.5px] font-medium text-[var(--color-text-muted)]">
              Clipboard failed — copy manually
              <textarea
                readOnly
                value={formattedPlan}
                onFocus={(event) => event.currentTarget.select()}
                className="mt-1 h-24 w-full resize-y rounded-lg border border-[var(--color-danger)]/25 bg-[var(--color-bg)]/65 p-2 font-mono text-[10.5px] leading-relaxed text-[var(--color-text-dim)] outline-none focus:border-[var(--color-accent)]/45"
              />
            </label>
          )}
        </div>
      )}
    </div>
  );
}

function RecommendationDataActionCallout({
  action,
  onEdit,
  compact = false
}: {
  action: RecommendationDataAction;
  onEdit: () => void;
  compact?: boolean;
}) {
  const copy = (
    <span className={cn(
      "min-w-0 flex-1 leading-snug",
      compact ? "text-[10.5px]" : "text-[11.5px]"
    )}>
      <span className="font-semibold text-[var(--color-text)]">Sharpen this pick:</span>{" "}
      <span className="text-[var(--color-text-muted)]">{action.helper}</span>
    </span>
  );
  const buttonClass = cn(
    "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[var(--color-warning)]/35 bg-[var(--color-warning)]/10 font-semibold text-[var(--color-warning)] transition-colors hover:bg-[var(--color-warning)]/15",
    compact ? "px-2.5 py-1.5 text-[11px]" : "px-3 py-2 text-[12px]"
  );

  return (
    <div className={cn(
      "flex w-full flex-wrap items-center gap-2 rounded-lg border border-[var(--color-warning)]/25 bg-[var(--color-warning)]/7",
      compact ? "px-2.5 py-2" : "px-3 py-2.5"
    )}>
      {copy}
      {action.kind === "rsn" ? (
        <button
          type="button"
          onClick={onEdit}
          className={buttonClass}
        >
          {action.label}
          <Edit3 className={compact ? "size-3" : "size-3.5"} />
        </button>
      ) : action.href ? (
        <Link href={action.href} className={buttonClass}>
          {action.label}
          <ArrowRight className={compact ? "size-3" : "size-3.5"} />
        </Link>
      ) : null}
    </div>
  );
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
  actionContext,
  onBossOpen,
  onSuppress,
  onComplete,
  onEdit
}: {
  rec: Recommendation;
  actionContext: RecommendationActionContext;
  onBossOpen: (slug: string) => void;
  onSuppress: (rec: Recommendation) => void;
  onComplete: (rec: Recommendation) => void;
  onEdit: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <HeadlineCard rec={rec} actionContext={actionContext} onBossOpen={onBossOpen} />
      <RecommendationActions rec={rec} actionContext={actionContext} onBossOpen={onBossOpen} onEdit={onEdit} />
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
          {open ? "Hide details" : "Show details"}
          <ChevronRight
            className={cn("size-3 transition-transform", open && "rotate-90")}
          />
        </button>
      </div>
      {open && <RecDetailPanel rec={rec} actionContext={actionContext} />}
    </div>
  );
}

function RecRowExpandable({
  rec,
  actionContext,
  onBossOpen,
  onSuppress,
  onComplete,
  onEdit
}: {
  rec: Recommendation;
  actionContext: RecommendationActionContext;
  onBossOpen: (slug: string) => void;
  onSuppress: (rec: Recommendation) => void;
  onComplete: (rec: Recommendation) => void;
  onEdit: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <RecRow rec={rec} actionContext={actionContext} onBossOpen={onBossOpen} />
      <RecommendationActions rec={rec} actionContext={actionContext} onBossOpen={onBossOpen} onEdit={onEdit} compact />
      <div className="mt-1 flex items-center gap-3">
        <button
          type="button"
          onClick={() => onComplete(rec)}
          aria-label={`Done: mark ${rec.title} complete`}
          className={recommendationFeedbackButtonClass("done", true)}
        >
          Done
        </button>
        <button
          type="button"
          onClick={() => onSuppress(rec)}
          aria-label={`Not today: hide ${rec.title}`}
          className={recommendationFeedbackButtonClass("skip", true)}
        >
          Not today
        </button>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={recommendationFeedbackButtonClass("details", true)}
        >
          {open ? "Hide" : "Details"}
          <ChevronRight
            className={cn("size-2.5 transition-transform", open && "rotate-90")}
          />
        </button>
      </div>
      {open && <RecDetailPanel rec={rec} actionContext={actionContext} />}
    </div>
  );
}
