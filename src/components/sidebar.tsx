"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { BRAND_TAGLINE } from "@/lib/brand";
import { contextualNavHref } from "@/lib/nav-context";
import { getPrimaryNavTools } from "@/lib/tools";
import { cn } from "@/lib/utils";
import { LayersAnim, TargetAnim, SwordAnim } from "./sidebar-icons";
import type { SVGProps } from "react";

// Per-slug custom icon component that ships its own per-element animation.
// Falls back to the generic Lucide icon from tools.ts when not in this map.
const ANIMATED_ICONS: Record<string, (props: SVGProps<SVGSVGElement>) => React.JSX.Element> = {
  bank:  LayersAnim,
  goals: TargetAnim,
  dps:   SwordAnim
};

export function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [contextQuery, setContextQuery] = useState("");

  useEffect(() => {
    const syncQuery = () => setContextQuery(window.location.search);
    syncQuery();
    window.addEventListener("popstate", syncQuery);
    return () => window.removeEventListener("popstate", syncQuery);
  }, [pathname]);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  useEffect(() => {
    if (mobileOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [mobileOpen]);

  return (
    <>
      {/* Mobile topbar */}
      <div className="sm:hidden fixed top-0 inset-x-0 z-40 h-12 flex items-center justify-between px-4 bg-[var(--color-bg)]/90 backdrop-blur-md border-b border-[var(--color-border)]">
        <Link href="/" className="flex items-center gap-2">
          <BrandMark />
          <span className="text-[14px] font-semibold tracking-normal text-[var(--color-text)]">Scapestack</span>
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="size-9 rounded-md flex items-center justify-center border border-[var(--color-border)] text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:border-[var(--color-border-strong)]"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
        </button>
      </div>
      <div className="sm:hidden h-12 shrink-0" aria-hidden="true" />

      {/* Mobile drawer */}
      {mobileOpen && (
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="sm:hidden fixed inset-0 z-40 bg-black/70 backdrop-blur-sm animate-[pop-in_0.15s_ease-out]"
          aria-label="Close menu"
        />
      )}
      <aside className={cn(
        "sm:hidden fixed top-12 left-0 bottom-0 z-50 w-64 flex flex-col",
        "bg-[var(--color-panel)] border-r border-[var(--color-border)]",
        "transition-transform duration-200 ease-out",
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <SidebarNav contextQuery={contextQuery} pathname={pathname} expanded />
      </aside>

      {/* Desktop sidebar — auto-collapse. Default state shows only icons
          (56px wide) so the content area has more breathing room; hovering
          (or focus-within for keyboard) expands to 224px with labels. The
          aside is `group/sidebar` and uses sibling-hover styling instead of
          state-driven re-renders so the transition feels CSS-smooth and the
          hover affordance never gets out of sync with the actual width. */}
      <aside
        className={cn(
          "group/sidebar",
          "hidden sm:flex shrink-0 flex-col z-30 fixed top-0 left-0 bottom-0",
          "border-r border-[var(--color-border)] bg-[var(--color-panel)]",
          // Width transition: 56px → 224px on hover/focus-within. We keep
          // the transition on width only (not transform) so the content
          // beside us doesn't get pushed — see the spacer further down.
          "w-14 hover:w-56 focus-within:w-56",
          "transition-[width] duration-200 ease-out",
          "overflow-hidden"
        )}
      >
        <Link
          href="/"
          className="flex items-center gap-2.5 px-4 py-4 border-b border-[var(--color-border)] hover:bg-[var(--color-panel-2)] transition-colors"
        >
          <BrandMark />
          <div className={cn(
            "flex-1 min-w-0 whitespace-nowrap",
            // Label fades in once the sidebar is wide enough that the text
            // wouldn't get clipped. opacity transition matches width timing.
            "opacity-0 group-hover/sidebar:opacity-100 group-focus-within/sidebar:opacity-100",
            "transition-opacity duration-150 delay-75"
          )}>
            <div className="text-[14px] font-semibold leading-tight text-[var(--color-text)] tracking-normal">Scapestack</div>
            <div className="text-[10.5px] text-[var(--color-text-muted)] mt-0.5 tracking-wide">{BRAND_TAGLINE}</div>
          </div>
        </Link>
        <SidebarNav contextQuery={contextQuery} pathname={pathname} expanded />
      </aside>

      {/* Spacer — reserves the collapsed-width column in the page-flow so
          the content always starts at 56px and stays pinned there even
          when the sidebar overlays out to 224px on hover. */}
      <div className="hidden sm:block shrink-0 w-14" aria-hidden="true" />
    </>
  );
}

function BrandMark() {
  return (
    <div
      className="size-8 shrink-0 rounded-md flex items-center justify-center font-bold text-[14px]"
      style={{
        background: "linear-gradient(135deg, var(--color-accent-soft) 0%, var(--color-accent) 54%, var(--color-gold-deep) 100%)",
        color: "#FFFCF6",
        boxShadow: "0 0 16px -4px rgba(15, 118, 110, 0.4)"
      }}
    >
      S
    </div>
  );
}

function SidebarNav({
  contextQuery,
  pathname,
  expanded
}: {
  contextQuery: string;
  pathname: string;
  expanded: boolean;
}) {
  return (
    <>
      <nav aria-label="Scapestack sidebar tools" className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto overscroll-contain">
        {getPrimaryNavTools().map((tool) => {
          const Icon = ANIMATED_ICONS[tool.slug] ?? tool.icon;
          const active =
            tool.href === "/" ? pathname === "/" :
            pathname === tool.href || pathname.startsWith(tool.href + "/");
          const disabled = tool.status !== "live";
          const href = contextualNavHref(tool.href, pathname, contextQuery);

          const inner = (
            <div className={cn(
              "group/nav flex items-center gap-2.5 rounded-md px-2.5 py-1.5 relative",
              "transition-colors duration-200",
              active && "bg-[var(--color-panel-2)] text-[var(--color-text)]",
              !active && !disabled && "text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:bg-[var(--color-panel-2)]/60",
              !active && disabled && "text-[var(--color-text-muted)]"
            )}>
              {active && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r"
                  style={{ background: "var(--color-accent)" }}
                />
              )}
              <Icon
                className={cn(
                  "size-4 shrink-0 transition-all duration-200",
                  active && "text-[var(--color-accent)]",
                  // Hover: icon nudges right and lights up mint, with a brief
                  // wiggle so the affordance is unmistakable.
                  !disabled && "group-hover/nav:text-[var(--color-accent)] group-hover/nav:translate-x-0.5 group-hover/nav:scale-110"
                )}
              />
              <span className={cn(
                "text-[13px] font-medium flex-1 min-w-0 truncate whitespace-nowrap",
                "transition-[transform,opacity] duration-200 group-hover/nav:translate-x-0.5",
                // Hide labels when sidebar is collapsed; fade in on
                // sidebar-hover so the labels appear together with the width
                // animation. On the mobile drawer (`expanded`) labels are
                // always visible.
                !expanded && "opacity-0 group-hover/sidebar:opacity-100 group-focus-within/sidebar:opacity-100 delay-75"
              )}>
                {tool.name}
              </span>
              {tool.status === "soon" && (
                <span className={cn(
                  "text-[9.5px] font-semibold tracking-wider text-[var(--color-text-muted)] uppercase whitespace-nowrap",
                  !expanded && "opacity-0 group-hover/sidebar:opacity-100 group-focus-within/sidebar:opacity-100 delay-75"
                )}>
                  Soon
                </span>
              )}
            </div>
          );

          return disabled ? (
            <div
              key={tool.slug}
              title={`${tool.name} — ${tool.status === "soon" ? "Coming soon" : "Planned"}`}
              aria-disabled="true"
              className="cursor-default"
            >
              {inner}
            </div>
          ) : (
            <Link
              key={tool.slug}
              href={href}
              title={tool.short}
              aria-label={`${tool.navLabel ?? tool.name}: ${tool.short}`}
              aria-current={active ? "page" : undefined}
            >
              {inner}
            </Link>
          );
        })}
      </nav>

      {/* Footer — kept tiny on purpose. BMC asks live near the value moments
          (after a successful organize / scan), not as a sidebar afterthought.
          The text fades with the sidebar's collapsed state. */}
      <div className="border-t border-[var(--color-border)] px-3 py-3">
        <div className={cn(
          "text-[10px] text-[var(--color-text-muted)] tracking-wide leading-relaxed whitespace-nowrap",
          !expanded && "opacity-0 group-hover/sidebar:opacity-100 group-focus-within/sidebar:opacity-100 transition-opacity duration-150 delay-75"
        )}>
          Built solo · Live OSRS data
        </div>
      </div>
    </>
  );
}
