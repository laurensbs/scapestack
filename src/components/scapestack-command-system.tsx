import Link from "next/link";
import {
  ArrowRight,
  Clock3,
  Coins,
  Crosshair,
  ListChecks,
  Sparkles,
  Target
} from "lucide-react";
import { BRAND_PLAYER_PROMPTS } from "@/lib/brand";

const PROMPT_ICONS = [Clock3, Coins, Crosshair, ListChecks, Target, Sparkles] as const;
const PLAYER_VIBE_PROMPTS = BRAND_PLAYER_PROMPTS.slice(0, 6);

export function ScapestackCommandSystem() {
  return (
    <section
      id="command-system"
      aria-labelledby="command-system-title"
      className="mb-20 rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)]/68 p-4 shadow-[0_20px_70px_rgba(0,0,0,0.22)] sm:p-5"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-sm">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[var(--color-accent)]/25 bg-[var(--color-accent)]/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--color-accent)]">
            <Sparkles className="size-3.5" />
            Session vibe
          </div>
          <h2
            id="command-system-title"
            className="text-[24px] font-black leading-tight tracking-normal text-[var(--color-text)] sm:text-[30px]"
          >
            Pick the kind of session you want.
          </h2>
          <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-text-dim)]">
            Same account, different mood. Let /next bias the plan without turning this into setup.
          </p>
        </div>

        <div className="grid flex-1 gap-2 sm:grid-cols-2 xl:grid-cols-3" aria-label="OSRS session vibe prompts">
          {PLAYER_VIBE_PROMPTS.map((prompt, index) => {
            const Icon = PROMPT_ICONS[index] ?? Sparkles;
            return (
              <Link
                key={prompt.label}
                href={prompt.href}
                className="group/prompt flex min-h-[72px] items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]/42 px-3 py-2.5 transition-colors hover:border-[var(--color-accent)]/45 hover:bg-[var(--color-bg)]/65 focus:outline-none focus-visible:border-[var(--color-accent)]/65 focus-visible:shadow-[0_0_0_3px_rgba(31, 182, 166,0.14)]"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-[var(--color-accent)]/20 bg-[var(--color-accent)]/8 text-[var(--color-accent)]">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[12.5px] font-black leading-tight text-[var(--color-text)]">{prompt.label}</span>
                  <span className="mt-1 line-clamp-2 block text-[11px] leading-snug text-[var(--color-text-dim)]">{prompt.copy}</span>
                </span>
                <ArrowRight className="ml-auto size-3.5 shrink-0 text-[var(--color-text-muted)] transition-transform group-hover/prompt:translate-x-0.5 group-hover/prompt:text-[var(--color-accent)]" />
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
