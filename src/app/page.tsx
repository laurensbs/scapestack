import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { TOOLS, type Tool } from "@/lib/tools";
import { cn, ICON_URL } from "@/lib/utils";
import { BuyMeCoffee } from "@/components/buy-me-coffee";

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
              <Link href="/bank?sample=1" className="btn-ghost">
                <Sparkles className="size-3.5" />
                See it with a sample bank
              </Link>
            </div>
          </div>

          {/* Live bank preview */}
          <div className="relative" style={{ animation: "hero-fade 0.7s cubic-bezier(0.22,1,0.36,1) 0.32s both" }}>
            <div
              className="absolute inset-0 -inset-x-8 -inset-y-8 pointer-events-none"
              style={{
                background: "radial-gradient(closest-side, rgba(230, 165, 47, 0.25) 0%, transparent 70%)",
                // Slow glow fade-in (1.4s) — the page seems to "warm up" as
                // the hero content settles. Sits at 30% opacity end-state.
                opacity: 0.3,
                animation: "glow-fade 1.4s ease-out 0.4s both"
              }}
            />
            <BankPreview />
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

// ── Bank preview ────────────────────────────────────────────────────────────
// Static mock of what the Bank Organizer produces, for the hero.

const PREVIEW_TABS = [
  { name: "Currency", icon: 995 },
  { name: "Combat", icon: 4151 },
  { name: "Range", icon: 20997 },
  { name: "Magic", icon: 24424 },
  { name: "Food", icon: 13441 },
  { name: "Potions", icon: 6685 }
];

const PREVIEW_ITEMS: Array<{ id: number; qty?: string }> = [
  { id: 4151 },           // Whip
  { id: 11802 },          // Armadyl GS
  { id: 13652 },          // Dragon claws
  { id: 22324 },          // Ghrazi rapier
  { id: 26219 },          // Osmumten's fang
  { id: 22325 },          // Scythe of vitur
  { id: 11804 },          // Bandos GS
  { id: 28688 },          // Blazing blowpipe

  { id: 11832 },          // Bandos chestplate
  { id: 11834 },          // Bandos tassets
  { id: 11836 },          // Bandos boots
  { id: 21018, qty: "1" },// Helm of neitiznot
  { id: 19553 },          // Amulet of torture
  { id: 21295 },          // Infernal cape
  { id: 7462 },           // Barrows gloves
  { id: 28307 },          // Ultor ring

  { id: 12625, qty: "120" }, // Stam pot
  { id: 6685, qty: "240" },  // Saradomin brew
  { id: 3024, qty: "80" },   // Super restore
  { id: 2434, qty: "150" },  // Prayer pot
  { id: 13441, qty: "300" }, // Anglerfish
  { id: 385, qty: "500" },   // Shark
  { id: 560, qty: "5000" },  // Death rune
  { id: 565, qty: "1.2K" }   // Blood rune
];

function BankPreview() {
  return (
    <div
      className="relative rounded-xl overflow-hidden"
      style={{
        background: "var(--color-osrs-wood)",
        border: "1px solid var(--color-border-strong)",
        boxShadow: "0 24px 60px -24px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(230, 165, 47, 0.08)"
      }}
    >
      {/* Title bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--color-osrs-wood-edge)]">
        <span className="text-[10px] uppercase tracking-[0.22em] font-semibold text-[var(--color-accent)]">
          The Bank
        </span>
        <span className="text-[11px] font-mono font-semibold text-[var(--color-text-dim)] tabular-nums">
          1.84B gp
        </span>
      </div>

      {/* Tab strip */}
      <div className="flex items-end gap-1 px-3 pt-2 -mb-px">
        {PREVIEW_TABS.map((tab, i) => (
          <div
            key={tab.name}
            className="relative flex items-center justify-center rounded-t-md"
            style={{
              width: "40px",
              height: "32px",
              background: i === 1 ? "var(--color-osrs-tab-active)" : "var(--color-osrs-tab-inactive)",
              border: `1px solid ${i === 1 ? "var(--color-accent)" : "var(--color-osrs-slot-edge)"}`,
              borderBottom: "none"
            }}
          >
            <img
              src={ICON_URL(tab.icon)}
              alt=""
              loading="lazy"
              className="pixelated"
              style={{
                maxWidth: "24px",
                maxHeight: "24px",
                width: "auto",
                height: "auto",
                imageRendering: "pixelated"
              }}
            />
            {i === 1 && (
              <span
                className="absolute -bottom-px inset-x-1 h-[2px] rounded-full"
                style={{ background: "var(--color-accent)" }}
              />
            )}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-8 bg-[var(--color-osrs-bank-bg)] border-t border-[var(--color-osrs-wood-edge)]">
        {PREVIEW_ITEMS.map((item, i) => (
          <div
            key={`${item.id}-${i}`}
            className="relative aspect-square flex items-center justify-center border border-[var(--color-osrs-slot-edge)]/40"
            style={{
              // Cascade tiles in left-to-right, top-to-bottom for a slick first paint.
              // 0.45s base delay so the entire BankPreview shell appears first.
              animation: `tile-rise 0.42s cubic-bezier(0.22,1,0.36,1) ${0.45 + i * 0.022}s both`
            }}
          >
            <img
              src={ICON_URL(item.id)}
              alt=""
              loading="lazy"
              className="pixelated absolute"
              style={{
                maxWidth: "28px",
                maxHeight: "28px",
                width: "auto",
                height: "auto",
                imageRendering: "pixelated"
              }}
            />
            {item.qty && (
              <span
                className="absolute top-0.5 left-1 text-[9px] font-bold pointer-events-none"
                style={{
                  color: "var(--color-osrs-qty-yellow)",
                  textShadow: "1px 1px 0 rgb(0 0 0)"
                }}
              >
                {item.qty}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Footer hint */}
      <div className="px-4 py-2 text-[10.5px] text-[var(--color-text-muted)] text-center bg-[var(--color-bg-2)] border-t border-[var(--color-border)]">
        24 of 778 items shown · paste your bank to see yours
      </div>
    </div>
  );
}
