"use client";

import { useState, useEffect } from "react";
import { ChevronRight, Check, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface Step {
  n: number;
  title: string;
  short: string;
  body: string;
  illustration: React.ReactNode;
  actionLabel: string;
  actionTargetId: string;
  helperLabel?: string;
  helperHref?: string;
}

interface IntroProps {
  // 0-based index of the step the actual intake flow is on. When the user
  // pastes a valid bank below, the parent bumps this so the rail advances
  // on its own — the instructions and the live form stay in lock-step.
  flowStep?: number;
}

export function Intro({ flowStep = 0 }: IntroProps) {
  const [active, setActive] = useState(0);
  // Highest step the user has reached — every step at or below this index
  // is treated as "seen / done" and gets a checkmark. Advancing only ever
  // grows this, so the progress rail never visually regresses when the
  // user clicks back to re-read an earlier step.
  const [reached, setReached] = useState(0);

  const goTo = (i: number) => {
    setActive(i);
    setReached((r) => Math.max(r, i));
  };

  const jumpTo = (id: string) => {
    const el = document.getElementById(id);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (el instanceof HTMLElement) {
      window.setTimeout(() => el.focus(), 220);
    }
  };

  // Auto-advance: when the live intake reports progress (e.g. a bank got
  // pasted → flowStep 2), pull the rail forward to that step and select it,
  // so the user sees the flow move without clicking.
  useEffect(() => {
    if (flowStep > 0) {
      setActive(flowStep);
      setReached((r) => Math.max(r, flowStep));
    }
  }, [flowStep]);

  const steps: Step[] = [
    {
      n: 1,
      title: "Open Bank Memory in RuneLite",
      short: "Bank Memory",
      body: "Plugin Hub → install \"Bank Memory\" for bank items. This is separate from Scapestack Sync, which only adds verified account coverage.",
      illustration: <RuneLiteSideBar />,
      actionLabel: "I have a bank export",
      actionTargetId: "bank-paste-input",
      helperLabel: "Open Bank Memory page",
      helperHref: "https://runelite.net/plugin-hub/show/bank-memory"
    },
    {
      n: 2,
      title: "Right-click → Copy to clipboard",
      short: "Copy bank",
      body: "In the side panel, right-click your saved bank → Copy item data to clipboard.",
      illustration: <ContextMenu />,
      actionLabel: "Paste it here",
      actionTargetId: "bank-paste-input",
      helperLabel: "Need the exact menu?",
      helperHref: "https://github.com/runelite/runelite/wiki/Bank-Tags"
    },
    {
      n: 3,
      title: "Paste it below",
      short: "Paste here",
      body: "⌘V (or Ctrl+V) into the box below — the format is auto-detected.",
      illustration: <PasteBox />,
      actionLabel: "Jump to paste box",
      actionTargetId: "bank-paste-input",
      helperLabel: "Accepted formats",
      helperHref: "#bank-paste-input"
    },
    {
      n: 4,
      title: "Copy organized tabs back",
      short: "Copy back",
      body: "Per tab: copy the Bank Tags string → in RuneLite, Bank Tags → Import tag tab.",
      illustration: <CopyTabs />,
      actionLabel: "Organize now",
      actionTargetId: "bank-organize-button",
      helperLabel: "Bank Tags import help",
      helperHref: "https://github.com/runelite/runelite/wiki/Bank-Tags"
    }
  ];

  const last = steps.length - 1;

  return (
    <section className="mb-8 animate-[slide-up_0.4s_ease-out]">
      <div className="mb-4">
        <h2 className="eyebrow mb-1">How it works</h2>
        <p className="text-[13px] text-[var(--color-text-dim)]">
          Four steps, about a minute. Tap through them or just paste your bank below.
        </p>
      </div>

      {/* Step rail — numbered nodes joined by a progress line. Each step
          owns the connector that runs to its RIGHT, drawn from the node's
          edge to the column edge so the line starts/ends at the rings and
          never passes through them. The connector fills teal once the
          step before it is done, so the rail visibly "flows" forward. */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-0 gap-y-4 mb-4">
        {steps.map((step, i) => {
          const done = i < reached;
          const current = i === active;
          // Connector to the right of THIS node is "lit" once this node's
          // step is complete (i.e. the user has reached a later step).
          const linkLit = i < reached;
          return (
            <button
              type="button"
              key={step.n}
              onClick={() => goTo(i)}
              className="group relative flex flex-col items-center gap-2 px-1 text-center"
              aria-current={current ? "step" : undefined}
              aria-label={`Show bank setup step ${step.n}: ${step.title}`}
            >
              {/* Connector — only between nodes, never after the last one.
                  top-[15px] aligns with the 30px ring's vertical centre.
                  left starts at 50%+15px (node edge), runs to 100%+15px so
                  it meets the next node's left edge across the gutter. */}
              {i < last && (
                <span
                  aria-hidden="true"
                  className="hidden sm:block absolute top-[15px] h-[2px] rounded-full overflow-hidden"
                  style={{ left: "calc(50% + 17px)", right: "calc(-50% + 17px)" }}
                >
                  <span className="absolute inset-0 bg-[var(--color-border)]" />
                  <span
                    className={cn(
                      "absolute inset-y-0 left-0 bg-[var(--color-accent)] transition-[width] duration-500 ease-out",
                      linkLit ? "w-full" : "w-0"
                    )}
                  />
                </span>
              )}
              <span
                className={cn(
                  "relative z-10 shrink-0 size-[30px] rounded-full flex items-center justify-center text-[12.5px] font-semibold border-2 transition-all duration-200",
                  done && "bg-[var(--color-accent)] text-[var(--color-bg)] border-[var(--color-accent)] shadow-[0_0_0_4px_rgba(15, 118, 110,0.12)]",
                  current && !done && "bg-[var(--color-accent)]/15 text-[var(--color-accent)] border-[var(--color-accent)] shadow-[0_0_0_4px_rgba(15, 118, 110,0.1)]",
                  !current && !done && "bg-[var(--color-bg-2)] text-[var(--color-text-muted)] border-[var(--color-border)] group-hover:border-[var(--color-border-strong)] group-hover:text-[var(--color-text-dim)]"
                )}
              >
                {done ? <Check className="size-4" strokeWidth={3} /> : step.n}
              </span>
              <span
                className={cn(
                  "text-[12px] font-medium leading-tight transition-colors",
                  current || done
                    ? "text-[var(--color-text)]"
                    : "text-[var(--color-text-dim)] group-hover:text-[var(--color-text)]"
                )}
              >
                {step.short}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active step content */}
      <div className="surface overflow-hidden">
        <div className="grid md:grid-cols-[1fr_1.1fr] gap-0">
          <div
            key={active}
            className="flex items-center justify-center p-5 min-h-[180px] animate-[fade-in_0.25s_ease-out]"
            style={{ background: "var(--color-bg)" }}
          >
            {steps[active].illustration}
          </div>
          <div className="p-5 flex flex-col justify-center">
            <div className="eyebrow mb-1.5">
              Step {steps[active].n} of {steps.length}
            </div>
            <h3 className="text-[15px] font-semibold text-[var(--color-text)] mb-2 tracking-normal">
              {steps[active].title}
            </h3>
            <p className="text-[13px] leading-relaxed text-[var(--color-text-dim)] mb-4">
              {steps[active].body}
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => jumpTo(steps[active].actionTargetId)}
                aria-label={`${steps[active].actionLabel}: jump to ${steps[active].actionTargetId}`}
                className="flex items-center gap-1.5 rounded-full border border-[var(--color-accent)]/35 bg-[var(--color-accent)]/10 px-3 py-1.5 text-[12px] font-semibold text-[var(--color-accent)] hover:bg-[var(--color-accent)]/16 transition-colors"
              >
                {steps[active].actionLabel}
              </button>
              {steps[active].helperHref && steps[active].helperLabel && (
                <a
                  href={steps[active].helperHref}
                  target={steps[active].helperHref.startsWith("http") ? "_blank" : undefined}
                  rel={steps[active].helperHref.startsWith("http") ? "noopener noreferrer" : undefined}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-2)]/50 px-3 py-1.5 text-[12px] font-semibold text-[var(--color-text-dim)] transition-colors hover:border-[var(--color-accent)]/40 hover:text-[var(--color-accent)]"
                  aria-label={`${steps[active].helperLabel} for step ${steps[active].n}`}
                >
                  {steps[active].helperLabel}
                  {steps[active].helperHref.startsWith("http") && <ExternalLink className="size-3" />}
                </a>
              )}
              {active > 0 && (
                <button
                  type="button"
                  onClick={() => goTo(active - 1)}
                  aria-label={`Back to bank setup step ${steps[active - 1].n}: ${steps[active - 1].title}`}
                  className="text-[12px] font-medium text-[var(--color-text-dim)] hover:text-[var(--color-text)] transition-colors"
                >
                  Back
                </button>
              )}
              {active < last ? (
                <button
                  type="button"
                  onClick={() => goTo(active + 1)}
                  aria-label={`Next bank setup step ${steps[active + 1].n}: ${steps[active + 1].title}`}
                  className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--color-accent)] hover:gap-2 transition-all"
                >
                  Next step <ChevronRight className="size-3.5" />
                </button>
              ) : (
                <p className="text-[11px] italic text-[var(--color-text-muted)]">
                  That&apos;s it — paste your bank below.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Illustrations ──────────────────────────────────────────────────────────

// Common wrapper: small bezel + soft route glow so the screenshot blends with
// the surrounding dark Scapestack surfaces. The image is shown at its
// natural pixel size — small upscaling on a low-res screenshot looks grainy,
// so we let it sit centred inside the frame instead.
function ScreenshotFrame({ src, alt, w, h }: { src: string; alt: string; w: number; h: number }) {
  return (
    <div className="relative rounded-lg overflow-hidden border border-[var(--color-border-strong)] bg-[var(--color-bg-2)] shadow-[0_18px_40px_-20px_rgb(0_0_0/0.7),0_0_0_1px_rgba(15, 118, 110,0.08)] p-4 flex items-center justify-center">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: "linear-gradient(to right, transparent, rgba(15, 118, 110,0.45), transparent)" }}
      />
      <img
        src={src}
        alt={alt}
        width={w}
        height={h}
        loading="lazy"
        decoding="async"
        className="block max-w-full h-auto"
      />
    </div>
  );
}

// Step 1: Bank Memory plugin tile screenshot (239×101)
function RuneLiteSideBar() {
  return <ScreenshotFrame src="/intro/step1.png" alt="Bank Memory plugin tile in RuneLite Plugin Hub" w={239} h={101} />;
}

// Step 2: right-click context menu screenshot (273×204)
function ContextMenu() {
  return <ScreenshotFrame src="/intro/step2.png" alt="Right-click menu on a saved bank — Copy item data to clipboard" w={273} h={204} />;
}

// Step 3: paste-box illustration in the Scapestack route palette
function PasteBox() {
  return (
    <svg viewBox="0 0 240 160" className="w-full max-w-[260px] h-auto">
      <defs>
        <linearGradient id="paste-top" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="rgba(15, 118, 110,0)" />
          <stop offset="0.5" stopColor="rgba(15, 118, 110,0.45)" />
          <stop offset="1" stopColor="rgba(15, 118, 110,0)" />
        </linearGradient>
      </defs>
      {/* Outer card — matches .surface */}
      <rect x="4" y="4" width="232" height="152" rx="8" fill="#FFFCF6" stroke="#DED2BE" strokeWidth="1" />
      {/* Subtle accent line at top edge */}
      <rect x="4" y="4" width="232" height="1" fill="url(#paste-top)" />
      {/* Inner textarea — bg-2 */}
      <rect x="14" y="18" width="212" height="98" rx="6" fill="#F5F0E6" stroke="#DED2BE" />
      {/* Mock TSV content — compact planner palette */}
      <text x="22" y="32" fontSize="7" fontFamily="ui-monospace, monospace" fill="#91A09A">Item id  Item name        Qty</text>
      <line x1="22" y1="36" x2="218" y2="36" stroke="#DED2BE" strokeWidth="0.5" />
      <text x="22" y="48" fontSize="7" fontFamily="ui-monospace, monospace" fill="#17211E">4151     Abyssal whip      1</text>
      <text x="22" y="60" fontSize="7" fontFamily="ui-monospace, monospace" fill="#17211E">11802    Armadyl godsword  1</text>
      <text x="22" y="72" fontSize="7" fontFamily="ui-monospace, monospace" fill="#17211E">995      Coins        <tspan fill="#00E29A">12,345k</tspan></text>
      <text x="22" y="84" fontSize="7" fontFamily="ui-monospace, monospace" fill="#17211E">560      Death rune     5000</text>
      <text x="22" y="96" fontSize="7" fontFamily="ui-monospace, monospace" fill="#17211E">385      Shark           250</text>
      <text x="22" y="108" fontSize="7" fontFamily="ui-monospace, monospace" fill="#91A09A">…</text>
      {/* ⌘V key-cap — route pill */}
      <g transform="translate(96, 124)">
        <rect x="0" y="0" width="48" height="22" rx="6" fill="var(--color-accent)" />
        <text x="24" y="15" textAnchor="middle" fontSize="11" fontFamily="ui-monospace, monospace" fill="#F5F0E6" fontWeight="700">⌘V</text>
      </g>
      <text x="120" y="153" textAnchor="middle" fontSize="8" fontFamily="ui-monospace, monospace" fill="#65736D">Paste anywhere on the page</text>
    </svg>
  );
}

// Step 4: copy-tab button + arrow back to RuneLite
function CopyTabs() {
  return (
    <svg viewBox="0 0 240 160" className="w-full max-w-[260px] h-auto">
      <defs>
        <linearGradient id="copy-route" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#14B8A6" />
          <stop offset="1" stopColor="#0F766E" />
        </linearGradient>
      </defs>
      {/* Tab list — matches the export rows in .surface bg */}
      <g transform="translate(8, 12)">
        {/* Tab 1 — copy button highlighted */}
        <rect x="0" y="0" width="124" height="22" rx="6" fill="#FFFCF6" stroke="#DED2BE" />
        <text x="8" y="14" fontSize="8" fontFamily="ui-sans-serif" fill="#17211E" fontWeight="600">1/9 · Combat</text>
        <rect x="86" y="3" width="34" height="16" rx="4" fill="url(#copy-route)" />
        <text x="103" y="14" textAnchor="middle" fontSize="7" fontFamily="ui-sans-serif" fill="#F5F0E6" fontWeight="700">Copy</text>

        {/* Tab 2 — done check */}
        <rect x="0" y="26" width="124" height="22" rx="6" fill="#FFFCF6" stroke="#DED2BE" />
        <text x="8" y="40" fontSize="8" fontFamily="ui-sans-serif" fill="#17211E" fontWeight="600">2/9 · Range</text>
        <rect x="86" y="29" width="34" height="16" rx="4" fill="rgba(15, 118, 110,0.15)" stroke="var(--color-good)" />
        <text x="103" y="40" textAnchor="middle" fontSize="9" fontFamily="ui-sans-serif" fill="var(--color-good)" fontWeight="700">✓</text>

        {/* Tab 3 — neutral */}
        <rect x="0" y="52" width="124" height="22" rx="6" fill="#F5F0E6" stroke="#DED2BE" />
        <text x="8" y="66" fontSize="8" fontFamily="ui-sans-serif" fill="#65736D">3/9 · Magic</text>

        {/* Tab 4 — placeholder */}
        <rect x="0" y="78" width="124" height="22" rx="6" fill="#F5F0E6" stroke="#DED2BE" opacity="0.6" />
        <text x="8" y="92" fontSize="8" fontFamily="ui-sans-serif" fill="#91A09A">…</text>
      </g>

      {/* Arrow — route accent */}
      <g transform="translate(138, 60)">
        <path d="M0 10 L40 10 M30 0 L40 10 L30 20" fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </g>

      {/* RuneLite import target */}
      <g transform="translate(184, 30)">
        <rect x="0" y="0" width="46" height="80" rx="6" fill="#FFFCF6" stroke="#DED2BE" />
        <text x="23" y="12" textAnchor="middle" fontSize="7" fontFamily="ui-sans-serif" fill="var(--color-accent)" fontWeight="600">RuneLite</text>
        <line x1="4" y1="16" x2="42" y2="16" stroke="#DED2BE" />
        <rect x="6" y="22" width="34" height="16" rx="4" fill="#F7F1E7" />
        <text x="23" y="33" textAnchor="middle" fontSize="6.5" fontFamily="ui-sans-serif" fill="#17211E">Import</text>
        <rect x="6" y="42" width="34" height="16" rx="4" fill="#F7F1E7" />
        <text x="23" y="53" textAnchor="middle" fontSize="6.5" fontFamily="ui-sans-serif" fill="#17211E">tag tab</text>
        <rect x="6" y="62" width="34" height="12" rx="3" fill="#F5F0E6" opacity="0.7" />
      </g>

      <text x="120" y="148" textAnchor="middle" fontSize="9" fontFamily="ui-sans-serif" fill="#65736D">Repeat per tab</text>
    </svg>
  );
}
