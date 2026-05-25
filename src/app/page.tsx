import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { TOOLS, type Tool } from "@/lib/tools";
import { cn, ICON_URL } from "@/lib/utils";
import { BuyMeCoffee } from "@/components/buy-me-coffee";
import { SampleBankLink } from "@/components/sample-bank-link";
import { BossArena } from "@/components/boss-arena";

export default function HomePage() {
  const liveTools = TOOLS.filter((t) => t.status === "live");
  const soonTools = TOOLS.filter((t) => t.status === "soon");
  // plannedTools removed — Roadmap section dropped per STRATEGY.md.

  return (
    <main className="relative z-10 mx-auto max-w-6xl px-5 sm:px-8 py-14 pb-24">
      {/* Hero */}
      <section className="mb-20">
        <div className="grid lg:grid-cols-[1.1fr_1fr] gap-12 items-center">
          <div>
            <div
              className="eyebrow flex items-center gap-2 mb-5"
              style={{ animation: "hero-fade 0.65s cubic-bezier(0.22,1,0.36,1) 0.05s both" }}
            >
              <span className="size-1.5 rounded-full bg-[var(--color-accent)] animate-[mint-pulse-dot_2.6s_ease-in-out_infinite]" />
              <span>v0.4 · OSRS toolkit</span>
            </div>
            <h1
              className="text-[44px] sm:text-[64px] lg:text-[72px] font-bold leading-[0.95] tracking-[-0.02em] text-[var(--color-text)]"
              // Longer duration + later start gives the headline its own moment;
              // the eyebrow above settles first, then the title lifts in.
              style={{ animation: "hero-fade 0.85s cubic-bezier(0.22,1,0.36,1) 0.15s both" }}
            >
              Less bank standing,<br />
              <span className="text-gold-gradient">more Gielinor.</span>
            </h1>
            <p
              className="mt-6 text-[16px] sm:text-[17px] text-[var(--color-text-dim)] max-w-xl leading-relaxed"
              style={{ animation: "hero-fade 0.7s cubic-bezier(0.22,1,0.36,1) 0.32s both" }}
            >
              <span className="text-[var(--color-text)] font-medium">
                One page that looks at your account and tells you what's worth doing next.
              </span>
              {" "}Goals you're close to, bosses your stats now support, drops you're statistically due. Free, no account, no plugin.
            </p>
            <div
              className="mt-8 flex flex-wrap items-center gap-3"
              style={{ animation: "hero-fade 0.7s cubic-bezier(0.22,1,0.36,1) 0.48s both" }}
            >
              <Link href="/next" className="btn-primary group">
                What should I do next?
                <ArrowRight className="size-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <SampleBankLink />
            </div>
          </div>

          {/* Boss arena — the hero visual. Eight wiki portraits orbit a
              central CTA. Replaces the old BankPreview (kept lower down
              on the page in case we want it back; the new homepage
              priority is /next, not the bank organizer). Plausible
              traffic data after the v0.4 launch made the call: visitors
              hit the homepage and stalled — the visual was selling the
              wrong thing. The arena sells what we actually do: pick a
              boss, get a plan. */}
          <div className="relative" style={{ animation: "hero-fade 0.7s cubic-bezier(0.22,1,0.36,1) 0.32s both" }}>
            <BossArena />
          </div>
        </div>
      </section>

      {/* More tools — secondary tools beneath the /next hero. Per
          docs/STRATEGY.md /next is the identity of Scapestack; the
          Bank Organizer, Goal Tracker, DPS Calculator, and Hiscore
          lookup are useful niche tools but no longer the main offer.
          The /next card is filtered out — it lives in the hero. */}
      <section className="mb-16">
        <SectionLabel delay={0.45}>More tools</SectionLabel>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {liveTools.filter((t) => t.slug !== "next").map((tool, i) => (
            <ToolCard key={tool.slug} tool={tool} index={i} />
          ))}
        </div>
      </section>

      {/* "In progress" only rendered if any soon-tools survive; currently
          empty after STRATEGY.md dropped GP and GE Price trackers. */}
      {soonTools.length > 0 && (
        <section className="mb-16">
          <SectionLabel delay={0.55}>In progress</SectionLabel>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {soonTools.map((tool, i) => (
              <ToolCard key={tool.slug} tool={tool} index={i + liveTools.length} />
            ))}
          </div>
        </section>
      )}

      {/* Roadmap section removed per STRATEGY.md — Quest / Skill / Diary
          recs live inside /next. The /quests, /skills, /diary, /gp, /ge
          routes are now 308 redirects to /next so cached links don't 404. */}

      <footer className="mt-24 pt-10 border-t border-[var(--color-border)]">
        <div className="relative overflow-hidden rounded-2xl max-w-3xl mx-auto bg-gradient-to-br from-[var(--color-panel)] to-[var(--color-bg-2)] border border-[var(--color-accent)]/25 animate-[slide-up_0.5s_cubic-bezier(0.22,1,0.36,1)_0.2s_both]">
          <div
            className="absolute inset-x-0 top-0 h-px"
            style={{ background: "linear-gradient(to right, transparent, rgba(230, 165, 47,0.5), transparent)" }}
          />
          <div
            className="absolute -bottom-32 -right-24 size-80 rounded-full blur-3xl opacity-25 pointer-events-none"
            style={{ background: "rgba(230, 165, 47, 0.5)" }}
          />

          <div className="relative p-8 sm:p-10 grid sm:grid-cols-[1fr_auto] items-center gap-6">
            <div>
              <div className="eyebrow mb-2" style={{ color: "var(--color-accent)" }}>
                Solo project · No ads · No accounts
              </div>
              <h3 className="text-[22px] sm:text-[26px] font-bold text-[var(--color-text)] tracking-tight leading-tight">
                Help keep Scapestack going.
              </h3>
              <p className="mt-2.5 text-[14px] text-[var(--color-text-dim)] leading-relaxed max-w-md">
                I build these tools in my evenings, between job and family. Every coffee
                covers a hosting bill and buys an hour to ship the next tool.
                If something here saved you a trip, it would mean a lot.
              </p>
            </div>
            <div className="flex flex-col items-start sm:items-end gap-2 shrink-0">
              <BuyMeCoffee />
              <span className="text-[11px] text-[var(--color-text-muted)] tracking-wide">
                One-time · from €1 · takes 20 seconds
              </span>
            </div>
          </div>
        </div>
        {/* Bottom tagline removed — the global footer in app/layout.tsx
            ("Built by Webstability — made for Gielinor") sits below the
            BMC block and provides the page's final outro. Having a second
            tagline strip here made the global footer disappear from sight. */}
      </footer>
    </main>
  );
}

function SectionLabel({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <div className="flex items-center gap-4 mb-5">
      <h2
        className="eyebrow"
        style={{ animation: `hero-fade 0.55s cubic-bezier(0.22,1,0.36,1) ${delay}s both` }}
      >
        {children}
      </h2>
      <span
        className="flex-1 section-divider"
        // Editorial detail: the line sweeps from left to right starting
        // slightly after the eyebrow text fades in. Pure CSS, no JS.
        style={{ animation: `divider-sweep 0.8s cubic-bezier(0.22,1,0.36,1) ${delay + 0.15}s both` }}
      />
    </div>
  );
}

function ToolCard({ tool, index }: { tool: Tool; index: number }) {
  const Icon = tool.icon;
  // Every tool surfaced on the homepage is now live — planned tools were
  // dropped per STRATEGY.md. "Soon" stays as a possible status so we can
  // tease a future tool inline without re-introducing a ComingSoon stub.
  const isSoon = tool.status === "soon";

  const inner = (
    <article
      // Premium staggered entry — cards drift up with a subtle blur-clear,
      // each one 40ms after the previous (was 60ms — denser cascade looks
      // more deliberate). 0.65s duration + long ease lets them *settle*
      // rather than land hard. tile-rise's fill-mode keeps the post-anim
      // transform stable.
      style={{ animation: `tile-rise 0.65s cubic-bezier(0.22,1,0.36,1) ${0.15 + index * 0.04}s both` }}
      className={cn(
        "group/tool relative overflow-hidden rounded-xl p-5 h-full surface",
        "surface-interactive cursor-pointer transition-colors duration-200 ease-out",
        isSoon && "opacity-80"
      )}
    >
      {/* Subtle gold glow on hover (matches the new accent). */}
      <div
        className="pointer-events-none absolute inset-0 opacity-0 group-hover/tool:opacity-100 transition-opacity duration-300"
        style={{
          background: "radial-gradient(360px 140px at 80% 0%, rgba(230, 165, 47,0.12), transparent 70%)"
        }}
      />
      <div className="relative flex items-start gap-3.5">
        <div className="shrink-0 size-10 rounded-lg flex items-center justify-center border border-[var(--color-border)] bg-[var(--color-panel-2)] text-[var(--color-accent)] group-hover/tool:bg-[var(--color-accent)]/15 group-hover/tool:border-[var(--color-accent)]/40 transition-colors duration-200">
          {/* Prefer the OSRS sprite when the tool ships one — gives the
              landing grid an unmistakable in-game feel. The Lucide icon
              still renders for tools without a signature item. Either way,
              `data-tool-icon` carries the per-tool hover animation hook
              from globals.css (icon-stack / icon-swing / icon-pulse / …). */}
          {tool.iconItemId ? (
            <img
              data-tool-icon={tool.slug}
              src={ICON_URL(tool.iconItemId)}
              alt=""
              className="pixelated"
              style={{
                maxWidth: "70%",
                maxHeight: "70%",
                imageRendering: "pixelated",
                filter: "drop-shadow(1px 1px 0 rgb(0 0 0 / 0.9))"
              }}
            />
          ) : (
            <Icon data-tool-icon={tool.slug} className="size-5" strokeWidth={1.75} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-[14px] font-semibold text-[var(--color-text)] tracking-tight">
              {tool.name}
            </h3>
            {isSoon && (
              <span className="px-1.5 py-0.5 rounded text-[9.5px] font-semibold tracking-wider uppercase bg-[var(--color-panel-2)] border border-[var(--color-border)] text-[var(--color-text-dim)]">
                Soon
              </span>
            )}
          </div>
          <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--color-text-dim)]">
            {tool.tagline}
          </p>
          <div className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-[var(--color-accent)] group-hover/tool:gap-1.5 transition-all">
            Open <ArrowRight className="size-3.5" />
          </div>
        </div>
      </div>
    </article>
  );

  return (
    <div style={{ animation: `slide-up 0.35s ease-out ${0.05 + index * 0.05}s both` }}>
      <Link href={tool.href}>{inner}</Link>
    </div>
  );
}

