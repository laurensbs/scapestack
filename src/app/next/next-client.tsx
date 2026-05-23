"use client";

import { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import {
  ArrowRight, Edit3, Target, Sword, TrendingUp, Layers, Sparkles, Trophy,
  Gamepad2, Coins, Scroll, Map as MapIcon, Dices
} from "lucide-react";
import { Intake } from "@/components/intake";
import { SupportCard } from "@/components/support-card";
import { organizeAction, nextUpAction } from "@/app/actions";
import { fetchHiscores, type HiscoreSkill } from "@/lib/hiscores";
import { unlockedFromHiscores } from "@/lib/goals";
import type { Recommendation, RecKind, NextUpResult } from "@/lib/next-up";
import { cn, ICON_URL } from "@/lib/utils";

// Per-kind visual identity — icon + accent. Keeps the headline card and the
// checklist rows consistent and instantly scannable by category.
const KIND_META: Record<RecKind, { icon: typeof Target; label: string }> = {
  goal:      { icon: Target,     label: "Goal" },
  quest:     { icon: Scroll,     label: "Quest" },
  diary:     { icon: MapIcon,    label: "Diary" },
  boss:      { icon: Sword,      label: "Boss" },
  kc:        { icon: Dices,      label: "Drop chance" },
  minigame:  { icon: Gamepad2,   label: "Minigame" },
  money:     { icon: Coins,      label: "Money" },
  skill:     { icon: TrendingUp, label: "Skill" },
  bank:      { icon: Layers,     label: "Bank" },
  milestone: { icon: Trophy,     label: "Milestone" }
};

export function NextClient() {
  const [view, setView] = useState<"intake" | "result">("intake");
  const [result, setResult] = useState<NextUpResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (input: string, _junkFilter: boolean, rsn: string) => {
    setError(null);
    startTransition(async () => {
      // Bank + Hiscores in parallel, mirroring the Goal Tracker's intake.
      const [bankRes, hiscores] = await Promise.all([
        organizeAction(input, { junkFilter: false, includePrices: false }),
        rsn.trim() ? fetchHiscores(rsn.trim()) : Promise.resolve(null)
      ]);
      if (bankRes.error || !bankRes.result) {
        setError(bankRes.error || "Couldn't read that bank — check the paste.");
        return;
      }
      // Flatten the bank, then fold in 99-skill capes synthesised from the
      // Hiscores so goal-completion reflects what the player has *earned*.
      const bank = bankRes.result.tabs.flatMap((t) =>
        t.items.map((it) => ({ id: it.id, name: it.name }))
      );
      const skills: HiscoreSkill[] = hiscores?.skills ?? [];
      if (skills.length > 0) {
        const seen = new Set(bank.map((it) => it.id));
        for (const cape of unlockedFromHiscores(skills)) {
          if (!seen.has(cape.id)) { bank.push(cape); seen.add(cape.id); }
        }
      }
      // Pull Quest points + every positive boss KC from the Hiscores
      // activities list. QP gates quest recs; boss KC feeds the kcRecs
      // ("142 Vorkath KC ≈ 0.85 visages expected") drop-rate insight.
      const qpActivity = hiscores?.activities.find((a) => a.name === "Quest points");
      const questPoints = qpActivity && qpActivity.score >= 0 ? qpActivity.score : 0;
      const bossKc: Record<string, number> = {};
      for (const a of hiscores?.activities ?? []) {
        if (a.score > 0) bossKc[a.name] = a.score;
      }
      setResult(await nextUpAction({ skills, bank, questPoints, bossKc }));
      setView("result");
    });
  };

  if (view === "intake") {
    return (
      <>
        <IntroCard />
        <Intake onSubmit={run} loading={pending} error={error} askRsn />
      </>
    );
  }

  return result ? (
    <ResultView result={result} onEdit={() => setView("intake")} />
  ) : null;
}

// Short framing card above the intake — sets expectations for what the hub
// does, so a first-time visitor knows why it's asking for a bank + RSN.
function IntroCard() {
  return (
    <section className="surface p-5 mb-5 animate-[slide-up_0.4s_ease-out]">
      <div className="flex items-start gap-3.5">
        <div className="size-10 shrink-0 rounded-lg flex items-center justify-center bg-[var(--color-accent)]/12 text-[var(--color-accent)] border border-[var(--color-accent)]/30">
          <Sparkles className="size-5" strokeWidth={1.75} />
        </div>
        <div>
          <h2 className="text-[15px] font-semibold text-[var(--color-text)] tracking-tight">
            No idea what to do next?
          </h2>
          <p className="mt-1 text-[13px] leading-relaxed text-[var(--color-text-dim)] max-w-2xl">
            Paste your bank and add your OSRS name below. The hub reads your
            stats, your gear and 30+ goal sets, then ranks what&apos;s actually
            worth doing right now — and links you straight to the tool to do it.
            More data in = sharper advice; either one alone still works.
          </p>
        </div>
      </div>
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
                  {(() => { const I = KIND_META[kind].icon; return <I className="size-3.5 text-[var(--color-text-muted)]" />; })()}
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
  const Icon = KIND_META[rec.kind].icon;
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
        style={{ background: "linear-gradient(to right, transparent, rgba(0,226,154,0.55), transparent)" }}
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
            <Icon className="size-6" strokeWidth={1.75} />
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
  const Icon = KIND_META[rec.kind].icon;
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
            <Icon className="size-4" strokeWidth={1.75} />
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
