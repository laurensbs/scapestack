import Link from "next/link";
import { ArrowRight, CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";
import { BRAND_STATE_SYSTEM, BRAND_UI_SURFACES, BRAND_VOICE_RULES } from "@/lib/brand";
import { cn } from "@/lib/utils";

const SURFACE_LINKS: Record<string, string> = {
  Homepage: "/",
  "/bank": "/bank",
  "/next": "/next",
  "/dps": "/dps",
  "/plugin": "/plugin",
  Profile: "/hiscore"
};

const STATE_ACCENTS: Record<(typeof BRAND_STATE_SYSTEM)[number]["state"], string> = {
  Empty: "border-[var(--color-warning)]/25 bg-[var(--color-warning)]/8 text-[var(--color-warning)]",
  Loading: "border-[var(--color-accent)]/25 bg-[var(--color-accent)]/8 text-[var(--color-accent)]",
  Error: "border-[var(--color-danger)]/25 bg-[var(--color-danger)]/8 text-[var(--color-danger)]",
  Mobile: "border-[var(--color-good)]/25 bg-[var(--color-good)]/8 text-[var(--color-good)]"
};

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
            UI system
          </div>
          <div>
            <h2
              id="command-system-title"
              className="max-w-xl text-[30px] font-black leading-[1.02] tracking-[-0.04em] text-[var(--color-text)] sm:text-[44px]"
            >
              A PvM prep room, not a SaaS dashboard.
            </h2>
            <p className="mt-4 max-w-xl text-[14.5px] leading-relaxed text-[var(--color-text-dim)]">
              Scapestack should feel like RuneLite, OSRS Wiki and a gear tab collapsed into one
              decision surface. Every card answers what to do, why it matters, what data was used,
              and which button moves the account forward.
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)]/45 p-4">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
              <ShieldCheck className="size-4 text-[var(--color-good)]" />
              Voice contract
            </div>
            <ul className="mt-3 space-y-2">
              {BRAND_VOICE_RULES.slice(0, 4).map((rule) => (
                <li key={rule} className="flex gap-2 text-[12.5px] leading-relaxed text-[var(--color-text-dim)]">
                  <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-[var(--color-good)]" />
                  {rule}
                </li>
              ))}
            </ul>
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

          <div className="grid gap-2 sm:grid-cols-4" aria-label="Scapestack state system">
            {BRAND_STATE_SYSTEM.map((state) => (
              <div
                key={state.state}
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]/45 p-3"
              >
                <div className={cn("inline-flex rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.16em]", STATE_ACCENTS[state.state])}>
                  {state.state}
                </div>
                <div className="mt-2 text-[12px] font-bold text-[var(--color-text)]">{state.label}</div>
                <p className="mt-1 text-[10.8px] leading-relaxed text-[var(--color-text-muted)]">{state.copy}</p>
                <div className="mt-2 text-[10.5px] font-bold text-[var(--color-accent)]">{state.action}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
