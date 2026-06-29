"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Target } from "lucide-react";
import { track } from "@/lib/analytics";

const HERO_BOSS_TRIPS = [
  {
    label: "Bossing",
    title: "Push Vardorvis to 50 KC",
    boss: "vardorvis",
    name: "Vardorvis",
    meta: "45-90 min",
    why: "Started KC. Clean stop point.",
    start: "Check kill setup, then do one trip."
  },
  {
    label: "GP",
    title: "Run Vorkath for a clean trip",
    boss: "vorkath",
    name: "Vorkath",
    meta: "30-60 min",
    why: "Simple banking, steady GP, easy stop point.",
    start: "Check bolts, antifire and crumble undead."
  },
  {
    label: "Bossing",
    title: "Send a Zulrah block",
    boss: "zulrah",
    name: "Zulrah",
    meta: "30-45 min",
    why: "Fast kills, clear rhythm, good backup route.",
    start: "Bank switches, then stop after the first clean block."
  },
  {
    label: "Task",
    title: "Use Hydra while the task is live",
    boss: "hydra",
    name: "Alchemical Hydra",
    meta: "60-90 min",
    why: "Slayer task bossing beats random KC hopping.",
    start: "Bring task gear, then stop when supplies feel messy."
  },
  {
    label: "Group",
    title: "Pick a Nex mass or small team",
    boss: "nex",
    name: "Nex",
    meta: "45-90 min",
    why: "Big-ticket bossing when you want action.",
    start: "Check kill setup and join a stable world first."
  }
] as const;

const CYCLE_MS = 3800;

export function HeroBossTripPreview() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % HERO_BOSS_TRIPS.length);
    }, CYCLE_MS);
    return () => window.clearInterval(timer);
  }, [paused]);

  const active = HERO_BOSS_TRIPS[activeIndex];
  const backups = useMemo(() => {
    return [1, 2].map((offset) => HERO_BOSS_TRIPS[(activeIndex + offset) % HERO_BOSS_TRIPS.length]);
  }, [activeIndex]);

  const openBoss = (boss: string) => {
    track("homepage:sample", { source: "hero-boss-preview", boss });
    window.location.assign(`/dps?boss=${boss}`);
  };

  return (
    <aside
      aria-label="Live OSRS boss trip preview"
      className="relative overflow-hidden rounded-[28px] border border-[var(--color-border)] bg-[var(--color-panel)] p-4 text-left shadow-[0_28px_90px_-64px_rgba(0,0,0,0.92)] sm:p-5"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 22%, rgba(214,166,58,0.20), transparent 34%), radial-gradient(circle at 72% 84%, rgba(214,166,58,0.08), transparent 28%)"
        }}
      />

      <div className="relative flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-good)]/25 bg-[var(--color-good)]/10 px-2.5 py-1 text-[11px] font-bold text-[var(--color-good)]">
          <CheckCircle2 className="size-3.5" aria-hidden="true" />
          Live boss preview
        </div>
        <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg)]/55 px-2.5 py-1 text-[11px] font-bold text-[var(--color-text-dim)]">
          {active.meta}
        </span>
      </div>

      <button
        type="button"
        onClick={() => openBoss(active.boss)}
        className="group/boss relative mt-5 grid aspect-square w-full place-items-center overflow-hidden rounded-[32px] border border-[var(--color-accent)]/18 bg-[var(--color-bg)]/72 shadow-[inset_0_1px_0_rgba(245,241,232,0.05),0_24px_70px_-50px_rgba(214,166,58,0.55)] outline-none transition-colors hover:border-[var(--color-accent)]/42 focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/60"
        aria-label={`Open ${active.name} kill check`}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(214,166,58,0.18),transparent_58%)]" />
        {HERO_BOSS_TRIPS.map((trip, index) => (
          <img
            key={trip.boss}
            src={`/sprites/bosses/${trip.boss}.png`}
            alt=""
            aria-hidden={index === activeIndex ? undefined : "true"}
            loading="eager"
            className="absolute inset-0 h-full w-full object-contain p-3 transition-all duration-700 ease-out group-hover/boss:scale-[1.03] sm:p-4"
            style={{
              opacity: index === activeIndex ? 1 : 0,
              filter: "drop-shadow(0 18px 26px rgb(0 0 0 / 0.66))",
              transform: index === activeIndex ? "scale(1)" : "scale(0.96)"
            }}
          />
        ))}
        <div className="pointer-events-none absolute inset-x-4 bottom-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)]/78 px-3 py-2 backdrop-blur-sm">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-accent)]">
            {active.name}
          </div>
          <div className="mt-0.5 truncate text-[13px] font-bold text-[var(--color-text)]">
            Click to check setup
          </div>
        </div>
      </button>

      <div className="relative mt-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)]/48 p-4">
        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-accent)]/22 bg-[var(--color-accent)]/8 px-2.5 py-1 text-[11px] font-bold text-[var(--color-accent)]">
          <Target className="size-3.5" aria-hidden="true" />
          Do this first
        </div>
        <h2 className="mt-2.5 text-[27px] font-semibold leading-tight text-[var(--color-text)]">
          {active.title}
        </h2>
        <p className="mt-2 text-[13px] font-semibold leading-relaxed text-[var(--color-text-dim)]">
          {active.why}
        </p>
        <p className="mt-3 rounded-xl border border-[var(--color-accent)]/16 bg-[var(--color-accent)]/7 px-3 py-2 text-[12.5px] font-bold leading-snug text-[var(--color-text)]">
          Start: {active.start}
        </p>
      </div>

      <div className="relative mt-3 grid gap-2">
        {backups.map((session) => (
          <button
            key={session.boss}
            type="button"
            onClick={() => openBoss(session.boss)}
            className="grid grid-cols-[54px_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)]/42 px-3 py-2.5 text-left transition-colors hover:border-[var(--color-accent)]/35"
            aria-label={`Open ${session.name} kill check`}
          >
            <span className="relative grid size-12 place-items-center overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)]/75">
              <img
                src={`/sprites/bosses/${session.boss}.png`}
                alt=""
                aria-hidden="true"
                loading="eager"
                className="h-full w-full object-contain p-1.5"
              />
            </span>
            <span className="min-w-0">
              <span className="block text-[10.5px] font-bold uppercase tracking-[0.16em] text-[var(--color-accent)]">
                {session.label}
              </span>
              <span className="mt-0.5 block truncate text-[13px] font-bold text-[var(--color-text)]">
                {session.title}
              </span>
            </span>
            <span className="text-[11px] font-bold text-[var(--color-text-muted)]">
              {session.meta}
            </span>
          </button>
        ))}
      </div>

      <div className="relative mt-3 rounded-2xl border border-[var(--color-good)]/22 bg-[var(--color-good)]/8 px-3 py-2">
        <div className="flex items-start gap-2 text-[12.5px] font-bold leading-snug text-[var(--color-good)]">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          <span>RuneLite can quietly avoid bosses, quests, diary steps and Slayer calls you already handled.</span>
        </div>
      </div>
    </aside>
  );
}
