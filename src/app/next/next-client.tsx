"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  ArrowRight, Edit3, Target, Sword, TrendingUp, Layers, Sparkles, Trophy,
  Gamepad2, Coins, Scroll, Map as MapIcon, Dices
} from "lucide-react";
import { SupportCard } from "@/components/support-card";
import { organizeAction, nextUpAction } from "@/app/actions";
import { fetchHiscores, type HiscoreSkill } from "@/lib/hiscores";
import { unlockedFromHiscores } from "@/lib/goals";
import type { Recommendation, RecKind, NextUpResult } from "@/lib/next-up";
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
  const [view, setView] = useState<"intake" | "result">("intake");
  const [result, setResult] = useState<NextUpResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // When the user came from /bank's "What should I do next?" handoff,
  // we surface a small banner on the intake so they know the bank is
  // already loaded — they only need to add an RSN for stat-aware advice.
  // Avoids `useSearchParams` (which would need a Suspense wrapper at the
  // page level, as we discovered with /bank).
  const [fromBank, setFromBank] = useState<{ items: Array<{ id: number; name: string }> } | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!new URLSearchParams(window.location.search).has("from")) return;
    try {
      const raw = sessionStorage.getItem("scapestack:next:bank");
      if (!raw) return;
      const items = JSON.parse(raw);
      if (Array.isArray(items) && items.length > 0) setFromBank({ items });
      // We deliberately DON'T clear sessionStorage here — if the user
      // refreshes /next during the same tab session the banner stays.
    } catch { /* malformed payload — silently ignore, fall back to intake */ }
  }, []);

  // Three intake paths feed the same engine: RSN-only (no bank),
  // RSN + bank (full data), or sample data (demo). A fourth, hidden
  // path: pre-parsed `bankItems` from /bank's "What should I do next?"
  // handoff via sessionStorage — skips the textarea + organizeAction
  // round-trip entirely. Each path builds the same engine input shape;
  // we branch at the edges, not in the engine.
  const run = (opts: { input?: string; rsn?: string; bankItems?: Array<{ id: number; name: string }> }) => {
    setError(null);
    startTransition(async () => {
      const rsn = (opts.rsn ?? "").trim();
      const input = (opts.input ?? "").trim();

      // Hiscores fetch is best-effort. If RSN was given but the lookup
      // fails, we still build something useful from the bank alone.
      const hiscores = rsn ? await fetchHiscores(rsn) : null;

      // Three ways to fill `bank`: pre-parsed handoff, paste-string, or
      // empty. organizeAction is only called for the paste-string path.
      let bank: Array<{ id: number; name: string }> = opts.bankItems ?? [];
      if (bank.length === 0 && input) {
        const bankRes = await organizeAction(input, { junkFilter: false, includePrices: false });
        if (bankRes.error || !bankRes.result) {
          setError(bankRes.error || "Couldn't read that bank — check the paste.");
          return;
        }
        bank = bankRes.result.tabs.flatMap((t) =>
          t.items.map((it) => ({ id: it.id, name: it.name }))
        );
      }

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

      // If neither RSN nor bank gave us anything, that's an error worth
      // showing (sample path should never hit this).
      if (skills.length === 0 && bank.length === 0) {
        setError("Enter your OSRS name or paste a bank to get advice.");
        return;
      }

      setResult(await nextUpAction({ skills, bank, questPoints, bossKc }));
      setView("result");
    });
  };

  if (view === "intake") {
    return (
      <NextIntake
        onRun={run}
        loading={pending}
        error={error}
        fromBank={fromBank}
      />
    );
  }

  return result ? (
    <ResultView result={result} onEdit={() => setView("intake")} />
  ) : null;
}

// ── Intake UI ─────────────────────────────────────────────────────────────
// Three paths, surfaced explicitly — that's the whole point of the empty-
// state redesign. RSN-only is the lightest entry (most returning players
// can't export a bank from a session they haven't started). Sample data
// gives a "show me what this looks like" preview. Adding a bank is opt-in
// for sharper advice.
const SAMPLE_RSN = "Lynx Titan";
function NextIntake({
  onRun, loading, error, fromBank
}: {
  onRun: (opts: { input?: string; rsn?: string; bankItems?: Array<{ id: number; name: string }> }) => void;
  loading: boolean;
  error: string | null;
  fromBank: { items: Array<{ id: number; name: string }> } | null;
}) {
  const [rsn, setRsn] = useState("");
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
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={rsn}
              onChange={(e) => setRsn(e.target.value)}
              placeholder="e.g. Lynx Titan"
              autoFocus
              className="flex-1 min-w-[200px] rounded-md bg-[var(--color-bg)] border border-[var(--color-border)] focus:border-[var(--color-accent)] outline-none px-3 py-2 text-[14px] font-mono text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]"
            />
            <button
              type="submit"
              // Allow submit on an empty RSN when we already have a bank
              // from the /bank handoff — the engine works with one alone.
              disabled={loading || (!rsn.trim() && !fromBank)}
              className="btn-primary group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Reading account…" : "Show me what to do"}
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

function ResultView({ result, onEdit }: { result: NextUpResult; onEdit: () => void }) {
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
    <div className="animate-[slide-up_0.35s_ease-out]">
      {/* Header — account read-out + re-run */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-[20px] font-semibold tracking-tight text-[var(--color-text)] leading-tight">
            Here&apos;s what to do now
          </h2>
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

      {/* Headline pick — the single strongest recommendation */}
      {headline ? (
        <HeadlineCard rec={headline} />
      ) : (
        <div className="surface p-8 text-center text-[var(--color-text-muted)] text-[13px]">
          Nothing to flag right now — your account looks well on top of things.
          Try pasting a fuller bank or looking up your stats for more ideas.
        </div>
      )}

      {/* The rest — a grouped checklist */}
      {rest.length > 0 && (
        <div className="mt-8">
          <h3 className="eyebrow mb-3">Also worth doing</h3>
          <div className="space-y-5">
            {[...grouped.entries()].map(([kind, recs]) => (
              <div key={kind}>
                <div className="flex items-center gap-2 mb-2">
                  <KindGlyph kind={kind} size={16} />
                  <span className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-text-muted)] font-semibold">
                    {KIND_META[kind].label}
                  </span>
                </div>
                <div className="grid sm:grid-cols-2 gap-2.5">
                  {recs.map((r) => <RecRow key={r.id} rec={r} />)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-10">
        <SupportCard />
      </div>
    </div>
  );
}

// The headline — the one thing the hub most wants the player to do. Big,
// mint-accented, with the payoff and a direct link into the relevant tool.
function HeadlineCard({ rec }: { rec: Recommendation }) {
  const card = (
    <article
      className={cn(
        "group relative overflow-hidden rounded-xl p-6",
        "border border-[var(--color-accent)]/30 bg-gradient-to-br from-[var(--color-accent)]/12 to-transparent",
        rec.link && "surface-interactive cursor-pointer transition-transform duration-200 hover:-translate-y-0.5"
      )}
    >
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: "linear-gradient(to right, transparent, rgba(230, 165, 47,0.55), transparent)" }}
      />
      <div className="flex items-start gap-4">
        <div className="size-12 shrink-0 rounded-lg flex items-center justify-center bg-[var(--color-accent)]/15 border border-[var(--color-accent)]/30 text-[var(--color-accent)]">
          {rec.iconItemId ? (
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
          {rec.link && (
            <div className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--color-accent)] group-hover:gap-2 transition-all">
              Open the tool <ArrowRight className="size-4" />
            </div>
          )}
        </div>
      </div>
    </article>
  );
  return rec.link ? <Link href={rec.link}>{card}</Link> : card;
}

// One checklist row — compact, linkable.
function RecRow({ rec }: { rec: Recommendation }) {
  const inner = (
    <article
      className={cn(
        "group h-full rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] p-3.5",
        rec.link && "cursor-pointer transition-colors hover:border-[var(--color-accent)]/40"
      )}
    >
      <div className="flex items-start gap-3">
        <div className="size-9 shrink-0 rounded-md flex items-center justify-center bg-[var(--color-bg-2)] border border-[var(--color-border)] text-[var(--color-accent)]">
          {rec.iconItemId ? (
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
        </div>
        {rec.link && (
          <ArrowRight className="size-3.5 text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)] transition-colors shrink-0 mt-0.5" />
        )}
      </div>
    </article>
  );
  return rec.link ? <Link href={rec.link}>{inner}</Link> : inner;
}
