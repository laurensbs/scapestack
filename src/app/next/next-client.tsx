"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  ArrowRight, ChevronRight, Edit3, Target, Sword, TrendingUp, Layers,
  Sparkles, Trophy, Gamepad2, Coins, Scroll, Map as MapIcon, Dices
} from "lucide-react";
import { SupportCard } from "@/components/support-card";
import { SavedBankBanner } from "@/components/saved-bank-banner";
import { BossSprite } from "@/components/boss-picker";
import { KcProbabilityGraph } from "@/components/kc-probability-graph";
import { XpDropLoader } from "@/components/xp-drop-loader";
import { BossDetailModal } from "@/components/boss-detail-modal";
import { TypingTitle } from "@/components/typing-title";
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
import { cn, ICON_URL } from "@/lib/utils";

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
  skill:     { icon: TrendingUp, label: "Skill",        iconItemId: 9747   }, // Attack cape (any skill cape)
  bank:      { icon: Layers,     label: "Bank",         iconItemId: 20594  }, // Bank filler
  milestone: { icon: Trophy,     label: "Milestone",    iconItemId: 13342  }  // Max cape
};

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
  const [failed, setFailed] = useState(false);
  if (meta.iconItemId && !failed) {
    return (
      <img
        src={ICON_URL(meta.iconItemId)}
        alt=""
        aria-hidden="true"
        className="pixelated shrink-0"
        style={{
          width: size,
          height: size,
          objectFit: "contain",
          imageRendering: "pixelated",
          filter: "drop-shadow(1px 1px 0 rgb(0 0 0 / 0.9))"
        }}
        onError={() => setFailed(true)}
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

export function NextClient() {
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
  // When the user came from /bank's "What should I do next?" handoff,
  // we surface a small banner on the intake so they know the bank is
  // already loaded — they only need to add an RSN for stat-aware advice.
  // Avoids `useSearchParams` (which would need a Suspense wrapper at the
  // page level, as we discovered with /bank).
  const [fromBank, setFromBank] = useState<{ items: Array<{ id: number; name: string }> } | null>(null);
  // Saved-bank welcome-back: same component as on /bank. Loaded once on
  // mount. Beats nothing — a returning player on /next can now just click
  // a button instead of going to /bank, pasting again, then coming back.
  // We *don't* clobber the bank-handoff banner; if both are present
  // fromBank wins (the user is mid-flow from /bank — that's a fresher
  // intent than yesterday's saved bank).
  const [savedBank, setSavedBank] = useState<SavedBank | null>(null);
  const [savedRsn, setSavedRsn] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hasFromParam = new URLSearchParams(window.location.search).has("from");
    if (hasFromParam) {
      try {
        const raw = sessionStorage.getItem("scapestack:next:bank");
        if (raw) {
          const items = JSON.parse(raw);
          if (Array.isArray(items) && items.length > 0) setFromBank({ items });
        }
        // We deliberately DON'T clear sessionStorage here — if the user
        // refreshes /next during the same tab session the banner stays.
      } catch { /* malformed payload — silently ignore, fall back to intake */ }
    } else {
      // Only look up the saved bank when we're not in a handoff flow.
      // Otherwise the user sees two banners stacking and that's noisy.
      setSavedBank(loadSavedBank());
    }
    setSavedRsn(loadSavedRsn());
  }, []);

  // Three intake paths feed the same engine: RSN-only (no bank),
  // RSN + bank (full data), or sample data (demo). A fourth, hidden
  // path: pre-parsed `bankItems` from /bank's "What should I do next?"
  // handoff via sessionStorage — skips the textarea + organizeAction
  // round-trip entirely. Each path builds the same engine input shape;
  // we branch at the edges, not in the engine.
  const run = (opts: { input?: string; rsn?: string; bankItems?: Array<{ id: number; name: string }> }) => {
    setError(null);
    // Fire the funnel event *before* the async work — Plausible is
    // fire-and-forget; we don't want the await chain in front of it.
    track("next:submit", {
      hasRsn: Boolean((opts.rsn ?? "").trim()),
      hasBank: Boolean((opts.input ?? "").trim() || (opts.bankItems && opts.bankItems.length > 0))
    });
    startTransition(async () => {
      const rsn = (opts.rsn ?? "").trim();
      const input = (opts.input ?? "").trim();

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
      let bank: Array<{ id: number; name: string }> = opts.bankItems ?? [];
      // ownedGear needs richer OrganizedItem-shaped entries (with quantity)
      // — only available when we actually called organizeAction. The
      // pre-parsed handoff path skips this; that's acceptable — the modal
      // just shows empty gear slots, same as a bank-less /next visit.
      let gearItems: GearItem[] = [];
      if (bank.length === 0 && input) {
        const bankRes = await organizeAction(input, { junkFilter: false, includePrices: false });
        if (bankRes.error || !bankRes.result) {
          setError(bankRes.error || "Couldn't read that bank — check the paste.");
          return;
        }
        const flat = bankRes.result.tabs.flatMap((t) => t.items);
        bank = flat.map((it) => ({ id: it.id, name: it.name }));
        gearItems = ownedGear(flat);
      }
      setOwnedGearItems(gearItems);

      // Fold in 99-skill capes synthesised from the Hiscores so goal-
      // completion reflects what the player has *earned*, not just what
      // sits in their bank.
      const skills: HiscoreSkill[] = hiscores?.skills ?? [];
      if (skills.length > 0) {
        const seen = new Set(bank.map((it) => it.id));
        for (const cape of unlockedFromHiscores(skills)) {
          if (!seen.has(cape.id)) { bank.push(cape); seen.add(cape.id); }
        }
      }

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
        skills, bank, questPoints, bossKc,
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
          questsCompleted: scapestackSync.questsCompleted,
          diariesCompleted: scapestackSync.diariesCompleted,
          collectionLogItemIds: scapestackSync.collectionLogItemIds
        } : undefined,
        syncedSources: {
          wom: wom !== null,
          temple: temple !== null,
          collectionLog: collectionLog !== null,
          scapestack: scapestackSync ? {
            syncedAt: scapestackSync.syncedAt,
            quests: scapestackSync.questsCompleted.length,
            diaries: scapestackSync.diariesCompleted.length,
            clItems: scapestackSync.collectionLogItemIds.length
          } : null
        }
      }));
      setView("result");

      // Remember the RSN for next time — independent of bank-save. If the
      // user is in the session opt-out (shared device), this is a no-op.
      if (rsn) saveSavedRsn(rsn);
    });
  };

  // "Use saved bank" from the welcome-back banner. Reuses the same engine
  // pipeline as a fresh paste — by calling run() with the stored input
  // string, we always re-derive recommendations from the latest engine,
  // not from any cached output.
  const useSaved = (bank: SavedBank) => {
    setSavedBank(null);
    run({ input: bank.banktags, rsn: savedRsn ?? "" });
  };

  if (view === "intake") {
    return (
      <NextIntake
        onRun={run}
        loading={pending}
        error={error}
        fromBank={fromBank}
        savedBank={savedBank}
        savedRsn={savedRsn}
        onUseSaved={useSaved}
        onDismissSaved={() => setSavedBank(null)}
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
        onEdit={() => setView("intake")}
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
            Your skills now clear every Hard task in this region.
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
const SAMPLE_RSN = "Lynx Titan";
function NextIntake({
  onRun, loading, error, fromBank, savedBank, savedRsn, onUseSaved, onDismissSaved
}: {
  onRun: (opts: { input?: string; rsn?: string; bankItems?: Array<{ id: number; name: string }> }) => void;
  loading: boolean;
  error: string | null;
  fromBank: { items: Array<{ id: number; name: string }> } | null;
  savedBank: SavedBank | null;
  savedRsn: string | null;
  onUseSaved: (bank: SavedBank) => void;
  onDismissSaved: () => void;
}) {
  // Pre-fill RSN from the remembered value so a returning player doesn't
  // re-type their name. The bank-save and rsn-save are independent — we
  // might have one without the other.
  const [rsn, setRsn] = useState(savedRsn ?? "");
  const [showBankField, setShowBankField] = useState(false);
  const [bank, setBank] = useState("");

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
          onUse={() => onUseSaved(savedBank)}
          onDismiss={onDismissSaved}
        />
      )}

      {/* Handoff banner — appears when the user arrived here via the
          Bank Organizer's "What should I do next?" button. The bank is
          already loaded; an RSN is optional but gets sharper advice. */}
      {fromBank && (
        <div className="mb-4 rounded-lg border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/8 px-4 py-3 flex items-start gap-3 animate-[fade-in_0.3s_ease-out]">
          <Sparkles className="size-4 text-[var(--color-accent)] shrink-0 mt-0.5" />
          <p className="text-[13px] text-[var(--color-text)] leading-relaxed">
            <span className="font-semibold">Using the bank you just organised</span>
            {" "}({fromBank.items.length} items). Add your OSRS name for stat-aware
            advice, or just click the button — we&apos;ll do what we can with the bank alone.
          </p>
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
              placeholder="Lynx Titan"
              autoFocus
              disabled={loading}
              className="flex-1 bg-transparent outline-none px-5 py-4 sm:py-5 text-[16px] sm:text-[18px] font-mono text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] disabled:opacity-60"
            />
            <button
              type="submit"
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

          {/* Source-status pills tijdens loading. Een speler ziet "we
              zijn bezig met X, Y en Z." Geen leeg loading-blok meer. */}
          {loading && <SourceStatus />}
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
          onClick={() => onRun({ rsn: SAMPLE_RSN })}
          disabled={loading}
          className="text-[12.5px] text-[var(--color-text-dim)] hover:text-[var(--color-text)] underline underline-offset-4 decoration-dotted transition-colors disabled:opacity-50"
        >
          Or see it with a sample account ({SAMPLE_RSN})
        </button>
      </div>

      <p className="mt-8 text-[11.5px] text-[var(--color-text-muted)] text-center leading-relaxed">
        Free, no account, no plugin. We never store your bank — everything
        runs in your browser and on Scapestack&apos;s own server.
      </p>
    </section>
  );
}

function ResultView({ result, onEdit, onBossOpen }: {
  result: NextUpResult;
  onEdit: () => void;
  // Called when the user clicks a KC-rec to open the boss detail modal.
  // /next threads this from NextClient down to HeadlineCard + RecRow.
  onBossOpen: (slug: string) => void;
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

  return (
    <div className="space-y-8">
      {/* ── TRACK 0: HERO ──────────────────────────────────────────── */}
      <div style={trackAnim(0)}>
        <HeroStrip summary={summary} basisNote={basisNote} onEdit={onEdit} />
      </div>

      {/* ── TRACK 1: WHAT TO DO ─────────────────────────────────────── */}
      <div style={trackAnim(150)}>
        <WhatToDo allRecs={allRecs} onBossOpen={onBossOpen} />
      </div>

      {/* ── TRACK 2: WHERE YOU ARE ──────────────────────────────────── */}
      <div style={trackAnim(300)}>
        <WhereYouAre
          pathData={result.pathProgress}
          maxEstimate={result.maxEstimate}
        />
      </div>

      {/* ── TRACK 3: ALMOST THERE ───────────────────────────────────── */}
      <div style={trackAnim(450)}>
        <ReadinessSection readiness={result.readiness} />
      </div>

      <div className="pt-4" style={trackAnim(600)}>
        <SupportCard />
      </div>
    </div>
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
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <TypingTitle
          as="h2"
          text="Here's what to do now"
          className="text-[20px] sm:text-[22px] font-semibold tracking-tight text-[var(--color-text)] leading-tight"
          durationMs={700}
        />
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] font-mono tabular-nums text-[var(--color-text-dim)]">
          {summary.combatLevel !== null && (
            <span className="flex items-center gap-1.5">
              <Sword className="size-3.5 opacity-50" /> Combat {summary.combatLevel}
            </span>
          )}
          {summary.totalLevel !== null && (
            <span className="flex items-center gap-1.5">
              <TrendingUp className="size-3.5 opacity-50" /> Total {summary.totalLevel}
            </span>
          )}
          {summary.goalPercent !== null && (
            <span className="flex items-center gap-1.5 text-[var(--color-accent)]">
              <Target className="size-3.5" /> {summary.goalPercent}% of goals
            </span>
          )}
        </div>
        <p className="mt-1.5 text-[11.5px] text-[var(--color-text-muted)]">{basisNote}</p>
      </div>
      <button onClick={onEdit} className="btn-ghost">
        <Edit3 className="size-3.5" /> Change input
      </button>
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
      ? <img
          src={ICON_URL(rec.iconItemId)}
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

// The headline — the one thing the hub most wants the player to do. Big,
// mint-accented, with the payoff and a direct link into the relevant tool.
function HeadlineCard({ rec, onBossOpen }: { rec: Recommendation; onBossOpen: (slug: string) => void }) {
  // KC-recs that resolve to a known boss become clickable — the click
  // opens the BossDetailModal with the player's bank-derived gear set.
  // For other rec kinds, the card stays linked to `rec.link` as before.
  const isKcWithBoss = rec.kind === "kc" && !!rec.bossSlug;
  const card = (
    <article
      className={cn(
        // group/headline triggers the headline-shimmer-target::after sweep
        // defined in globals.css — fires once on hover, doesn't loop.
        "group/headline group relative overflow-hidden rounded-xl p-6 headline-shimmer-target",
        "border border-[var(--color-accent)]/30 bg-gradient-to-br from-[var(--color-accent)]/12 to-transparent",
        (rec.link || isKcWithBoss) && "surface-interactive cursor-pointer transition-transform duration-200 hover:-translate-y-0.5"
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
            <img
              src={ICON_URL(rec.iconItemId)}
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
          <div className="eyebrow text-[var(--color-accent)] mb-1">Start here</div>
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
          {/* Probability chart — collapsed by default. Was default-open
              on the headline KC-rec but read as 'big chart shouting at
              you' the moment the page loaded. Toggle still works for
              players who want the depth. */}
          {rec.kcMeta && (
            <KcProbabilityGraph
              kc={rec.kcMeta.kc}
              denom={rec.kcMeta.denom}
              dropName={rec.kcMeta.dropName}
            />
          )}
          {(rec.link || isKcWithBoss) && (
            <div className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--color-accent)] group-hover:gap-2 transition-all">
              {isKcWithBoss ? "Open boss detail" : "Open the tool"} <ArrowRight className="size-4" />
            </div>
          )}
        </div>
      </div>
    </article>
  );
  // KC + boss: card becomes a clickable region that opens the modal.
  // We use role+onClick on a div instead of a button because the card
  // already contains the KC-graph toggle button, and nested buttons
  // are invalid HTML. Keyboard-equivalent via Enter/Space.
  if (isKcWithBoss && rec.bossSlug) {
    const slug = rec.bossSlug;
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => onBossOpen(slug)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onBossOpen(slug);
          }
        }}
      >
        {card}
      </div>
    );
  }
  // Non-KC card with a link wraps in <Link>. KC without a boss (rare —
  // raid slug that fell through) renders as a static card.
  return rec.link ? <Link href={rec.link}>{card}</Link> : card;
}

// One checklist row — compact, linkable.
function RecRow({ rec, onBossOpen }: { rec: Recommendation; onBossOpen: (slug: string) => void }) {
  const isKcWithBoss = rec.kind === "kc" && !!rec.bossSlug;
  const inner = (
    <article
      className={cn(
        "group h-full rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] p-3.5",
        (rec.link || isKcWithBoss) && "cursor-pointer transition-colors hover:border-[var(--color-accent)]/40"
      )}
    >
      <div className="flex items-start gap-3">
        <div className="size-9 shrink-0 rounded-md flex items-center justify-center bg-[var(--color-bg-2)] border border-[var(--color-border)] text-[var(--color-accent)] overflow-hidden">
          {rec.kind === "kc" && rec.bossSlug ? (
            <KcPortrait rec={rec} size={30} />
          ) : rec.iconItemId ? (
            <img
              src={ICON_URL(rec.iconItemId)}
              alt=""
              className="pixelated"
              style={{ maxWidth: "72%", maxHeight: "72%", imageRendering: "pixelated", filter: "drop-shadow(1px 1px 0 rgb(0 0 0 / 0.9))" }}
            />
          ) : (
            <KindGlyph kind={rec.kind} size={20} tone="accent" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-[13px] font-semibold text-[var(--color-text)] tracking-tight leading-tight">
            {rec.title}
          </h4>
          <p className="mt-0.5 text-[12px] text-[var(--color-text-dim)] leading-snug">{rec.why}</p>
          {rec.payoff && (
            <p className="mt-1 text-[11px] text-[var(--color-text-muted)] leading-snug">{rec.payoff}</p>
          )}
          {rec.kcMeta && (
            <KcProbabilityGraph
              kc={rec.kcMeta.kc}
              denom={rec.kcMeta.denom}
              dropName={rec.kcMeta.dropName}
            />
          )}
        </div>
        {(rec.link || isKcWithBoss) && (
          <ArrowRight className="size-3.5 text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)] transition-colors shrink-0 mt-0.5" />
        )}
      </div>
    </article>
  );
  // KC + boss: clickable region opens the modal. Same div-as-button
  // pattern as HeadlineCard — the inner KC-graph button can't legally
  // nest in a real <button>.
  if (isKcWithBoss && rec.bossSlug) {
    const slug = rec.bossSlug;
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => onBossOpen(slug)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onBossOpen(slug);
          }
        }}
      >
        {inner}
      </div>
    );
  }
  return rec.link ? <Link href={rec.link}>{inner}</Link> : inner;
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
  onBossOpen
}: {
  allRecs: Recommendation[];
  onBossOpen: (slug: string) => void;
}) {
  const [mood, setMood] = useState<Mood>("focused");
  const [minutes, setMinutes] = useState<TimeBudget>(60);
  const [shuffleIdx, setShuffleIdx] = useState(0);
  const [prev, setPrev] = useState<MoodSession | null>(null);
  const [dismissedBanner, setDismissedBanner] = useState(false);

  useEffect(() => {
    const last = loadMood();
    if (last) {
      setPrev(last);
      setMood(last.mood);
      setMinutes(last.minutes);
    }
  }, []);

  // Reset shuffle wanneer mood/time veranderen — een nieuwe vibe begint
  // op de top-pick, anders blijven we stiekem op een oude alternative.
  useEffect(() => {
    setShuffleIdx(0);
  }, [mood, minutes]);

  const pick = useMemo(
    () => pickForMood(allRecs, mood, minutes, shuffleIdx),
    [allRecs, mood, minutes, shuffleIdx]
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

      <div className="grid lg:grid-cols-[260px_1fr] gap-4">
        {/* Left rail: mood-chips + time-budget toggle in één card. */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-4 space-y-4">
          <div>
            <div className="text-[10.5px] uppercase tracking-[0.18em] text-[var(--color-text-muted)] mb-2">
              I want to
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {MOODS.map((m) => {
                const label = MOOD_LABEL[m];
                const active = mood === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMood(m)}
                    className={cn(
                      "px-2.5 py-2 rounded-md border text-left transition-colors flex items-center gap-2",
                      active
                        ? "border-[var(--color-accent)]/60 bg-[var(--color-accent)]/10"
                        : "border-[var(--color-border)] hover:border-[var(--color-border-strong)]"
                    )}
                  >
                    <img
                      src={ICON_URL(label.itemId)}
                      alt=""
                      className="pixelated shrink-0"
                      style={{
                        width: 20, height: 20,
                        imageRendering: "pixelated",
                        filter: "drop-shadow(1px 1px 0 rgb(0 0 0 / 0.9))",
                        objectFit: "contain"
                      }}
                    />
                    <span className={cn(
                      "text-[12px] font-semibold",
                      active ? "text-[var(--color-accent)]" : "text-[var(--color-text)]"
                    )}>
                      {label.name}
                    </span>
                  </button>
                );
              })}
            </div>
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
        </div>

        {/* Right column: gekozen suggestie + alternatieven. */}
        <div className="space-y-3">
          {pick ? (
            <>
              <RecHeadlineExpandable
                rec={pick.headline}
                onBossOpen={onBossOpen}
              />
              {pick.alternatives.length > 0 && (
                <div className="grid sm:grid-cols-2 gap-2.5">
                  {pick.alternatives.map((r) => (
                    <RecRowExpandable key={r.id} rec={r} onBossOpen={onBossOpen} />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-8 text-center text-[var(--color-text-muted)] text-[13px]">
              Nothing urgent to flag — your account looks well on top of things.
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
              ? `${Math.round(maxEstimate.perSkill[0].hours)}h to 99`
              : ""}
          />
        </div>

        {/* Vier paths als één rij van horizontale balken — bar-fill
            animation via transform:scaleX van 0 → 1. Transition pakt
            de toepassing op als `filled` flipt na mount. */}
        <div className="space-y-3">
          {pathData.paths.map((p) => (
            <div key={p.kind}>
              <div className="flex items-baseline justify-between gap-3 text-[12px] tabular-nums mb-1">
                <span className="text-[var(--color-text)] font-semibold capitalize">{p.kind}</span>
                <span className="text-[var(--color-text-dim)]">
                  {p.done}/{p.total} · {p.percent}%
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-[var(--color-bg-2)] overflow-hidden">
                <div
                  className="h-full bg-[var(--color-accent)]/70 rounded-full origin-left"
                  style={{
                    width: `${p.percent}%`,
                    transform: filled ? "scaleX(1)" : "scaleX(0)",
                    transition: "transform 900ms cubic-bezier(0.22, 1, 0.36, 1)"
                  }}
                />
              </div>
              {p.nextSteps.length > 0 && (
                <p className="text-[10.5px] text-[var(--color-text-muted)] mt-1 truncate">
                  next: {p.nextSteps.slice(0, 2).map((n) => n.title).join(" · ")}
                </p>
              )}
            </div>
          ))}
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
    ? display.toLocaleString() + (suffix ?? "")
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

function RecDetailPanel({ rec }: { rec: Recommendation }) {
  // Fallback naar default hints wanneer rec ze niet expliciet meegaf.
  const hints = defaultActionHints(rec.kind);
  const needs = rec.needs ?? hints.needs;
  const details = rec.details ?? hints.details;
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
      {rec.link && (
        <Link
          href={rec.link}
          className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--color-accent)] hover:underline pt-1"
        >
          Open the tool <ArrowRight className="size-3.5" />
        </Link>
      )}
    </div>
  );
}

function RecHeadlineExpandable({ rec, onBossOpen }: { rec: Recommendation; onBossOpen: (slug: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <HeadlineCard rec={rec} onBossOpen={onBossOpen} />
      <div className="flex justify-end mt-1.5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors inline-flex items-center gap-1"
        >
          {open ? "Hide details" : "Show details"}
          <ChevronRight
            className={cn("size-3 transition-transform", open && "rotate-90")}
          />
        </button>
      </div>
      {open && <RecDetailPanel rec={rec} />}
    </div>
  );
}

function RecRowExpandable({ rec, onBossOpen }: { rec: Recommendation; onBossOpen: (slug: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <RecRow rec={rec} onBossOpen={onBossOpen} />
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-1 text-[10.5px] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors inline-flex items-center gap-1"
      >
        {open ? "Hide" : "Details"}
        <ChevronRight
          className={cn("size-2.5 transition-transform", open && "rotate-90")}
        />
      </button>
      {open && <RecDetailPanel rec={rec} />}
    </div>
  );
}
