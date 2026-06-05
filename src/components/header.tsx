"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { contextualNavHref } from "@/lib/nav-context";
import { getPrimaryNavTools } from "@/lib/tools";
import { cn } from "@/lib/utils";
import { BuyMeCoffee } from "./buy-me-coffee";

const LOOP_STEPS = [
  { label: "Bank", href: "/bank" },
  { label: "Next", href: "/next" },
  { label: "Sync", href: "/plugin" }
];
const LOOP_LABEL = "Recommended OSRS loop: Bank → Next → Sync";

export function Header() {
  const pathname = usePathname();
  const [contextQuery, setContextQuery] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileNavId = "scapestack-mobile-nav";

  useEffect(() => {
    const syncQuery = () => setContextQuery(window.location.search);
    syncQuery();
    window.addEventListener("popstate", syncQuery);
    return () => window.removeEventListener("popstate", syncQuery);
  }, [pathname]);

  const navTools = getPrimaryNavTools();
  const currentTool = navTools.find((t) => pathname.startsWith(t.href));
  const title = currentTool?.name;
  // Home indicator — pathname is the root.
  const onHome = pathname === "/";

  return (
    <header
      className={cn(
        "sticky top-0 z-30 h-14 shrink-0",
        "border-b border-[var(--color-border)] bg-[var(--color-bg)]/85 backdrop-blur-md"
      )}
    >
      <div className="mx-auto max-w-7xl h-full px-4 sm:px-6 flex items-center justify-between gap-3">
        {/* Wordmark + page title. No icon-tile anymore — the wordmark itself
            is the brand. Lowercase 'scapestack' with the last four letters
            in mint accent reads as a single shape, lighter than the old
            icon+text combo, and matches the editorial "Linear / Vercel /
            Resend" feel the rest of the UI leans into. */}
        <div className="flex items-baseline gap-3 min-w-0">
          <Link
            href="/"
            aria-label="Scapestack home"
            className={cn(
              "group flex items-baseline shrink-0 leading-none",
              "text-[18px] font-semibold tracking-[-0.025em] lowercase"
            )}
          >
            <span
              className="text-[var(--color-text)] group-hover:text-[var(--color-text-secondary)] transition-colors"
              style={{ animation: "hero-fade 0.55s cubic-bezier(0.22,1,0.36,1) 0.05s both" }}
            >
              scape
            </span>
            <span
              className="text-[var(--color-accent)] group-hover:brightness-110 transition-[filter]"
              style={{ animation: "hero-fade 0.55s cubic-bezier(0.22,1,0.36,1) 0.18s both" }}
            >
              stack
            </span>
          </Link>
          {/* Breadcrumb-style page label on desktop only — fades in after
              the wordmark settles so the eye lands on the brand first. */}
          {title && (
            <div
              className="hidden sm:flex items-baseline gap-2 text-[12px] text-[var(--color-text-muted)] truncate"
              style={{ animation: "hero-fade 0.5s cubic-bezier(0.22,1,0.36,1) 0.32s both" }}
            >
              <span className="text-[var(--color-border-strong)]">·</span>
              <span className="font-medium text-[var(--color-text-secondary)] truncate tracking-tight">{title}</span>
            </div>
          )}
        </div>

        <Link
          href={contextualNavHref("/next", pathname, contextQuery)}
          aria-label="Start Scapestack loop: paste bank, plan next, verify RuneLite sync"
          title="Recommended loop: paste bank context, plan the next session, then verify RuneLite sync when available."
          className="hidden lg:flex min-w-0 items-center gap-2 rounded-full border border-[var(--color-accent)]/25 bg-[var(--color-accent)]/8 px-3 py-1.5 text-[11.5px] font-semibold text-[var(--color-accent)] transition-colors hover:border-[var(--color-accent)]/45 hover:bg-[var(--color-accent)]/12"
          style={{ animation: "hero-fade 0.5s cubic-bezier(0.22,1,0.36,1) 0.36s both" }}
        >
          <span className="size-1.5 shrink-0 rounded-full bg-[var(--color-accent)]" aria-hidden="true" />
          <span className="truncate">{LOOP_LABEL}</span>
        </Link>

        {/* Desktop nav — primary live tools + a discreet BMC icon. The icon
            variant stays muted until hover so it doesn't compete with the
            page content, but is always one click away from anywhere in
            the app. */}
        <nav className="hidden sm:flex items-center gap-1" aria-label="Primary Scapestack tools">
          {navTools.map((tool, i) => {
            const Icon = tool.icon;
            const href = contextualNavHref(tool.href, pathname, contextQuery);
            const active =
              currentTool?.slug === tool.slug ||
              (tool.href === "/" && onHome);
            return (
              <Link
                key={tool.slug}
                href={href}
                title={tool.short}
                aria-current={active ? "page" : undefined}
                aria-label={`${tool.navLabel ?? tool.name}: ${tool.short}`}
                // Staggered fade-in, starting after the wordmark.
                style={{ animation: `hero-fade 0.5s cubic-bezier(0.22,1,0.36,1) ${0.4 + i * 0.07}s both` }}
                className={cn(
                  "group/tool inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12.5px] font-medium transition-colors",
                  active
                    ? "bg-[var(--color-panel-2)] text-[var(--color-text)]"
                    : "text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:bg-[var(--color-panel-2)]/60"
                )}
              >
                <Icon data-tool-icon={tool.slug} className={cn("size-3.5", active && "text-[var(--color-accent)]")} />
                {tool.navLabel ?? tool.name}
              </Link>
            );
          })}
          <span
            className="mx-2 h-5 w-px bg-[var(--color-border)]"
            aria-hidden="true"
            style={{ animation: `hero-fade 0.4s ease-out ${0.4 + navTools.length * 0.07}s both` }}
          />
          <span style={{ animation: `hero-fade 0.5s cubic-bezier(0.22,1,0.36,1) ${0.4 + navTools.length * 0.07 + 0.06}s both` }}>
            <BuyMeCoffee variant="icon" className="!size-8" />
          </span>
        </nav>

        {/* Mobile hamburger */}
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="sm:hidden size-9 rounded-md flex items-center justify-center border border-[var(--color-border)] text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:border-[var(--color-border-strong)]"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-controls={mobileNavId}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
        </button>
      </div>

      {/* Mobile drawer — shown when hamburger is open. Slides down from
          beneath the header bar; click anywhere inside to navigate. */}
      {mobileOpen && (
        <div className="sm:hidden border-t border-[var(--color-border)] bg-[var(--color-panel)] animate-[fade-in_0.18s_ease-out]">
          <nav id={mobileNavId} className="px-4 py-3 space-y-1" aria-label="Mobile Scapestack tools">
            <div className="mb-3 rounded-xl border border-[var(--color-accent)]/25 bg-[var(--color-accent)]/8 p-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-accent)]">
                Recommended OSRS loop
              </div>
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                {LOOP_STEPS.map((step) => (
                  <Link
                    key={step.href}
                    href={contextualNavHref(step.href, pathname, contextQuery)}
                    onClick={() => setMobileOpen(false)}
                    aria-label={`${step.label} in Scapestack loop`}
                    className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/45 px-2 py-2 text-center text-[11.5px] font-bold text-[var(--color-text)] transition-colors hover:border-[var(--color-accent)]/45 hover:text-[var(--color-accent)]"
                  >
                    {step.label}
                  </Link>
                ))}
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-[var(--color-text-muted)]">
                Paste bank context, plan tonight, verify RuneLite sync when the payload is ready.
              </p>
            </div>
            {navTools.map((tool) => {
              const Icon = tool.icon;
              const href = contextualNavHref(tool.href, pathname, contextQuery);
              const active = currentTool?.slug === tool.slug;
              return (
                <Link
                  key={tool.slug}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  aria-current={active ? "page" : undefined}
                  aria-label={`${tool.name}: ${tool.short}`}
                  className={cn(
                    "group/tool flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium",
                    active
                      ? "bg-[var(--color-panel-2)] text-[var(--color-text)]"
                      : "text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:bg-[var(--color-panel-2)]/60"
                  )}
                >
                  <Icon data-tool-icon={tool.slug} className={cn("size-4", active && "text-[var(--color-accent)]")} />
                  {tool.name}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </header>
  );
}
