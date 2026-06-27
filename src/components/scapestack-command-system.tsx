import Link from "next/link";
import {
  ArrowRight,
  Clock3,
  Coins,
  Crosshair,
  ListChecks,
  Package,
  ShieldCheck,
  Sparkles,
  Target
} from "lucide-react";
import { BRAND_PLAYER_PROMPTS, BRAND_UI_SURFACES } from "@/lib/brand";

const SURFACE_LINKS: Record<string, string> = {
  Tonight: "/next",
  Bank: "/bank",
  Boss: "/dps",
  Slayer: "/slayer",
  Unlocks: "/goals",
  Sync: "/plugin"
};

const PROMPT_ICONS = [Clock3, Coins, Crosshair, ListChecks, Target, Sparkles, Package, ShieldCheck] as const;

export function ScapestackCommandSystem() {
  return (
    <section
      id="command-system"
      aria-labelledby="command-system-title"
      className="mb-20 rounded-3xl border border-[var(--color-border)] bg-[linear-gradient(135deg,rgba(230,165,47,0.08),rgba(15,18,23,0.86)_38%,rgba(12,10,7,0.96))] p-5 shadow-[0_30px_90px_rgba(0,0,0,0.32)] sm:p-7"
    >
      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-accent)]/25 bg-[var(--color-accent)]/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--color-accent)]">
            <Sparkles className="size-3.5" />
            Next moves
          </div>
          <div>
            <h2
              id="command-system-title"
              className="max-w-xl text-[30px] font-black leading-[1.02] tracking-[-0.04em] text-[var(--color-text)] sm:text-[44px]"
            >
              Tell Scapestack what you feel like doing.
            </h2>
            <p className="mt-4 max-w-xl text-[14.5px] leading-relaxed text-[var(--color-text-dim)]">
              Short session, GP, boss KC, Slayer task, unlock, upgrade or chill progress. Start
              with your RSN; add bank or sync only when it changes the route.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2" aria-label="OSRS login prompts">
            {BRAND_PLAYER_PROMPTS.map((prompt, index) => {
              const Icon = PROMPT_ICONS[index] ?? Sparkles;
              return (
                <Link
                  key={prompt.label}
                  href={prompt.href}
                  className="group/prompt rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)]/45 p-3 transition-colors hover:border-[var(--color-accent)]/45 hover:bg-[var(--color-bg)]/65 focus:outline-none focus-visible:border-[var(--color-accent)]/65 focus-visible:shadow-[0_0_0_3px_rgba(230,165,47,0.14)]"
                >
                  <div className="flex items-center gap-2 text-[12px] font-black text-[var(--color-text)]">
                    <Icon className="size-4 text-[var(--color-accent)]" aria-hidden="true" />
                    {prompt.label}
                  </div>
                  <p className="mt-2 text-[11.5px] leading-relaxed text-[var(--color-text-dim)]">{prompt.copy}</p>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {BRAND_UI_SURFACES.map((surface) => (
              <Link
                key={surface.page}
                href={SURFACE_LINKS[surface.page] ?? "/next"}
                className="group/surface rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)]/55 p-4 transition-all hover:-translate-y-0.5 hover:border-[var(--color-accent)]/45 hover:bg-[var(--color-panel-2)]/70 focus:outline-none focus-visible:border-[var(--color-accent)]/65 focus-visible:shadow-[0_0_0_3px_rgba(230,165,47,0.14)]"
                aria-label={`${surface.page}: ${surface.primaryAction}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-lg border border-[var(--color-accent)]/20 bg-[var(--color-accent)]/8 px-2.5 py-1 text-[11px] font-black text-[var(--color-accent)]">
                    {surface.page}
                  </span>
                  <ArrowRight className="size-3.5 text-[var(--color-text-muted)] transition-transform group-hover/surface:translate-x-0.5 group-hover/surface:text-[var(--color-accent)]" />
                </div>
                <p className="mt-3 text-[13px] font-bold leading-snug text-[var(--color-text)]">{surface.role}</p>
                <p className="mt-2 text-[11.5px] leading-relaxed text-[var(--color-text-dim)]">{surface.requiredFeeling}</p>
                <div className="mt-3 inline-flex rounded-md border border-[var(--color-border)] bg-[var(--color-bg)]/45 px-2 py-1 text-[10.5px] font-bold text-[var(--color-text-secondary)]">
                  {surface.primaryAction}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
