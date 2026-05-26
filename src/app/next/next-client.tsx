"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  ArrowRight, Edit3, Target, Sword, TrendingUp, Layers, Sparkles, Trophy,
  Gamepad2, Coins, Scroll, Map as MapIcon, Dices
} from "lucide-react";
import { SupportCard } from "@/components/support-card";
import { SavedBankBanner } from "@/components/saved-bank-banner";
import { BossSprite } from "@/components/boss-picker";
import { KcProbabilityGraph } from "@/components/kc-probability-graph";
import { XpDropLoader } from "@/components/xp-drop-loader";
import { BossDetailModal } from "@/components/boss-detail-modal";
import { PathOverview } from "@/components/path-overview";
import { TypingTitle } from "@/components/typing-title";
import { BOSSES, type Boss } from "@/lib/bosses";
import { ownedGear, type GearItem } from "@/lib/gear";
import { organizeAction, nextUpAction, hiscoresAction, womAction, collectionLogAction, templeAction, syncedPlayerAction } from "@/app/actions";
import { type HiscoreSkill } from "@/lib/hiscores";
import { unlockedFromHiscores, GOAL_SETS, normaliseCompletion, type SetCompletion } from "@/lib/goals";
import { loadSavedBank, loadSavedRsn, saveSavedRsn, type SavedBank } from "@/lib/saved-bank";
import { track } from "@/lib/analytics";
import type { Recommendation, RecKind, NextUpResult } from "@/lib/next-up";
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
    <section className="animate-[slide-up_0.4s_ease-out] max-w-2xl mx-auto">
      <header className="mb-6">
        <h2 className="text-[24px] sm:text-[28px] font-bold text-[var(--color-text)] tracking-tight leading-tight">
          What should you do next in Old School?
        </h2>
        <p className="mt-2 text-[14px] text-[var(--color-text-dim)] leading-relaxed">
          Type your OSRS name. We&apos;ll read your stats and rank what&apos;s worth doing —
          goals you&apos;re close to, bosses your stats now support, drops you&apos;re
          statistically due.
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

      {/* Primary path: RSN-only lookup */}
      <form onSubmit={submitRsn} className="surface p-5">
        <label className="block">
          <span className="text-[12px] font-semibold tracking-tight text-[var(--color-text)]">
            OSRS name
          </span>
          {/* On mobile (≤640px) the RSN input and submit button stack
              vertically so the focus-shadow can't push the button to a
              new row mid-interaction (audit finding #7). sm: restores
              the inline row at 640px+. */}
          <div className="mt-2 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
            <input
              type="text"
              value={rsn}
              onChange={(e) => setRsn(e.target.value)}
              placeholder="e.g. Lynx Titan"
              autoFocus
              className="sm:flex-1 sm:min-w-[180px] rounded-md bg-[var(--color-bg)] border border-[var(--color-border)] focus:border-[var(--color-accent)] outline-none px-3 py-2 text-[14px] font-mono text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]"
            />
            <button
              type="submit"
              // Allow submit on an empty RSN when we already have a bank
              // from the /bank handoff — the engine works with one alone.
              disabled={loading || (!rsn.trim() && !fromBank)}
              className="btn-primary group w-full sm:w-auto justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <XpDropLoader /> : "Show me what to do"}
              {!loading && <ArrowRight className="size-4 group-hover:translate-x-0.5 transition-transform" />}
            </button>
          </div>
        </label>

        {/* Secondary: optional bank paste for sharper advice */}
        <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
          {showBankField ? (
            <label className="block">
              <span className="text-[12px] font-semibold tracking-tight text-[var(--color-text)]">
                Bank export <span className="text-[var(--color-text-muted)] font-normal">(optional — sharper advice)</span>
              </span>
              <textarea
                value={bank}
                onChange={(e) => setBank(e.target.value)}
                placeholder="Paste your RuneLite Bank Memory export here…"
                rows={4}
                className="mt-2 w-full rounded-md bg-[var(--color-bg)] border border-[var(--color-border)] focus:border-[var(--color-accent)] outline-none px-3 py-2 text-[12px] font-mono text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] resize-y"
              />
              <button
                type="button"
                onClick={() => { setShowBankField(false); setBank(""); }}
                className="mt-2 text-[11.5px] text-[var(--color-text-muted)] hover:text-[var(--color-text-dim)] transition-colors"
              >
                Skip the bank — just use my stats
              </button>
            </label>
          ) : (
            <button
              type="button"
              onClick={() => setShowBankField(true)}
              className="text-[12.5px] text-[var(--color-accent)] hover:underline"
            >
              + Add my bank for sharper advice
            </button>
          )}
        </div>

        {error && (
          <p className="mt-3 text-[12px] text-[var(--color-warning)]">{error}</p>
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

  // Group the checklist by kind so the eye reads "all the boss ideas", etc.
  const grouped = useMemo(() => {
    const by = new Map<RecKind, Recommendation[]>();
    for (const r of rest) {
      if (!by.has(r.kind)) by.set(r.kind, []);
      by.get(r.kind)!.push(r);
    }
    return by;
  }, [rest]);

  const basisNote =
    summary.basis === "full" ? "Based on your Hiscores and your bank."
    : summary.basis === "hiscores-only" ? "Based on your Hiscores. Paste a bank for gear-aware advice."
    : summary.basis === "bank-only" ? "Based on your bank. Add your OSRS name for stat-aware advice."
    : "Add your OSRS name or a bank for tailored advice.";

  return (
    <div>
      {/* Header — account read-out + re-run. No outer slide-up anymore;
          the choreographed typing title + Path-to-Max reveal carry the
          intro motion themselves. */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
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

      {/* Tonight's pick — one concrete action for tonight. The headline
          from the recommendation engine, framed as a single-task focus
          card so the player has something to do *now* before they zoom
          out to the long-term paths. */}
      {headline ? (
        <section className="mb-10">
          <h3 className="eyebrow mb-3 text-[var(--color-accent)]">Tonight&apos;s pick</h3>
          <HeadlineCard rec={headline} onBossOpen={onBossOpen} />
        </section>
      ) : (
        <div className="mb-10 surface p-8 text-center text-[var(--color-text-muted)] text-[13px]">
          Nothing urgent to flag right now — your account looks well on top of things.
          Scroll down for the long-term path overview.
        </div>
      )}

      {/* Mood-driven suggestie. Optioneel — kies een mood + tijd en
          zie 1 hoofdsuggestie + 2 alternatieven gefilterd op vibe.
          Tonight's pick blijft hierboven als "objectief beste" anchor. */}
      <MoodSection
        allRecs={headline ? [headline, ...rest] : rest}
        onBossOpen={onBossOpen}
      />

      {/* Bank-readiness chips — alleen wanneer er bank-data is.
          Surfaceert "je bent dicht bij completen van deze N goal sets". */}
      <ReadinessSection readiness={result.readiness} />

      {/* Path-to-Max — the long-term shape of the account. Four cards
          (Skills / Quests / Diaries / Bosses) with progress + next-steps,
          drill-in modal per path. */}
      <PathOverview data={result.pathProgress} />

      {/* "Also worth knowing" — the leftover recommendations the engine
          generated that didn't fit into a path. Collapsed inside a
          <details> so they're available but don't compete with the
          path overview for the player's attention. */}
      {rest.length > 0 && (
        <details className="mt-10 group/also">
          <summary className="cursor-pointer list-none flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-2)]/40 hover:border-[var(--color-border-strong)] px-4 py-3 transition-colors">
            <div>
              <h3 className="text-[12px] uppercase tracking-[0.18em] font-bold text-[var(--color-accent)]">Also worth knowing</h3>
              <p className="text-[11.5px] text-[var(--color-text-muted)] mt-0.5">
                {rest.length} more idea{rest.length === 1 ? "" : "s"} — quick wins, money ideas, drop chances
              </p>
            </div>
            <ArrowRight className="size-4 text-[var(--color-text-muted)] group-open/also:rotate-90 transition-transform" />
          </summary>
          <div className="mt-4 space-y-5">
            {[...grouped.entries()].map(([kind, recs]) => (
              <div key={kind}>
                <div className="flex items-center gap-2 mb-2">
                  <KindGlyph kind={kind} size={16} />
                  <span className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-text-muted)] font-semibold">
                    {KIND_META[kind].label}
                  </span>
                </div>
                <div className="grid sm:grid-cols-2 gap-2.5">
                  {recs.map((r) => <RecRow key={r.id} rec={r} onBossOpen={onBossOpen} />)}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      <div className="mt-10">
        <SupportCard />
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
  { value: 60,  label: "1 uur"  },
  { value: 120, label: "2 uur"  },
];

function MoodSection({
  allRecs,
  onBossOpen
}: {
  allRecs: Recommendation[];
  onBossOpen: (slug: string) => void;
}) {
  const [mood, setMood] = useState<Mood | null>(null);
  const [minutes, setMinutes] = useState<TimeBudget>(60);
  /** Vorige sessie — pas na mount gezet (SSR-veilig). Drijft welkom-
   *  terug banner én pre-selecteert mood/minutes. */
  const [prev, setPrev] = useState<MoodSession | null>(null);
  const [dismissedBanner, setDismissedBanner] = useState(false);

  // Eénmalige hydration uit localStorage. Niet via useState-initializer
  // omdat dat tijdens SSR crasht.
  useEffect(() => {
    const last = loadMood();
    if (last) {
      setPrev(last);
      setMood(last.mood);
      setMinutes(last.minutes);
    }
  }, []);

  const pick = useMemo(
    () => (mood ? pickForMood(allRecs, mood, minutes) : null),
    [allRecs, mood, minutes]
  );

  // Sla op zodra mood + pick stabiel zijn. Debounced naar effects om
  // dubbele writes te voorkomen bij tijd-toggles.
  useEffect(() => {
    if (!mood || !pick) return;
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
    <section className="mb-10">
      <h3 className="eyebrow mb-3 text-[var(--color-accent)]">Waar heb je zin in?</h3>

      {/* Welkom-terug banner — toont alleen op de tweede+ bezoek wanneer
          er een vorige mood-sessie in localStorage staat. Pre-selecteert
          de mood/tijd automatisch hierboven. Dismissable. */}
      {showBanner && prev && (
        <div className="mb-3 flex items-baseline justify-between gap-3 px-3 py-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-2)]/60 text-[12px]">
          <div>
            <span className="text-[var(--color-text-muted)]">Welkom terug — </span>
            <span className="text-[var(--color-text-dim)]">
              {relativeSince(prev.savedAt)} keek je naar{" "}
              <span className="text-[var(--color-text)]">{prev.lastHeadlineTitle}</span>
              {" "}({MOOD_LABEL[prev.mood].name.toLowerCase()}, {prev.minutes} min).
            </span>
          </div>
          <button
            type="button"
            onClick={() => setDismissedBanner(true)}
            className="text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] shrink-0"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* Mood-chips row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        {MOODS.map((m) => {
          const label = MOOD_LABEL[m];
          const active = mood === m;
          return (
            <button
              key={m}
              type="button"
              onClick={() => setMood(active ? null : m)}
              className={cn(
                "px-3 py-3 rounded-lg border text-left transition-all",
                active
                  ? "border-[var(--color-accent)]/60 bg-[var(--color-accent)]/10"
                  : "border-[var(--color-border)] bg-[var(--color-panel)] hover:border-[var(--color-border-strong)]"
              )}
            >
              <div className="flex items-baseline gap-2">
                <span className="text-[16px]">{label.emoji}</span>
                <span className={cn(
                  "text-[13.5px] font-semibold",
                  active ? "text-[var(--color-accent)]" : "text-[var(--color-text)]"
                )}>
                  {label.name}
                </span>
              </div>
              <p className="text-[11px] text-[var(--color-text-muted)] mt-1">{label.tagline}</p>
            </button>
          );
        })}
      </div>

      {/* Time-budget row — alleen relevant zodra mood gekozen */}
      {mood && (
        <div className="flex items-center gap-2 flex-wrap mb-4">
          <span className="text-[10.5px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
            Tijd
          </span>
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
      )}

      {/* Resultaat — hoofdsuggestie groot, alternatieven klein */}
      {pick && (
        <div className="space-y-3">
          <div>
            <div className="text-[10.5px] uppercase tracking-[0.18em] text-[var(--color-text-muted)] mb-2">
              Voor {MOOD_LABEL[pick.mood].name.toLowerCase()} · {TIME_OPTIONS.find((t) => t.value === pick.minutes)?.label}
            </div>
            <HeadlineCard rec={pick.headline} onBossOpen={onBossOpen} />
          </div>
          {pick.alternatives.length > 0 && (
            <div>
              <div className="text-[10.5px] uppercase tracking-[0.18em] text-[var(--color-text-muted)] mb-2 mt-4">
                Of liever iets anders?
              </div>
              <div className="grid sm:grid-cols-2 gap-2.5">
                {pick.alternatives.map((r) => <RecRow key={r.id} rec={r} onBossOpen={onBossOpen} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// ── Bank readiness ─────────────────────────────────────────────────────────
// Toont "je bent dicht bij completen van deze sets" als chip-row.
// Klik op een chip → expandeert + toont wat er nog mist. Geen visual
// noise wanneer de bank leeg is.

function ReadinessSection({ readiness }: { readiness: SetCompletion[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  if (readiness.length === 0) return null;

  return (
    <section className="mb-10">
      <h3 className="eyebrow mb-1 text-[var(--color-accent)]">Bijna klaar</h3>
      <p className="text-[11.5px] text-[var(--color-text-muted)] mb-3">
        Sets waar je het dichtsbij voltooien bent — klik voor wat er nog mist.
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
              {set.name} — nog te halen
            </div>
            {missing.length === 0 ? (
              <p className="text-[12px] text-[var(--color-good)]">
                Eigenlijk compleet — vermoedelijk een tiered set waar je al de top-tier hebt.
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
