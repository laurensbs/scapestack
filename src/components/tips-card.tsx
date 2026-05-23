"use client";

import { useState, useMemo } from "react";
import { Lightbulb, X, ChevronDown, ChevronUp, ChevronRight, ChevronLeft, Coins, Sparkles, Wrench, Trophy } from "lucide-react";
import type { BankTip } from "@/lib/tips";
import { ICON_URL, cn } from "@/lib/utils";

interface TipsCardProps {
  tips: BankTip[];
}

// Per-kind metadata: icon, label, colour accent. Used by both individual tips
// and the group-row headers.
const KIND_META: Record<BankTip["kind"], { icon: typeof Lightbulb; label: string; accent: string }> = {
  decant:              { icon: Coins,    label: "Decant",  accent: "text-amber-400" },
  "stack-merge":       { icon: Wrench,   label: "Merge",   accent: "text-sky-400" },
  "outfit-incomplete": { icon: Sparkles, label: "Outfit",  accent: "text-violet-400" },
  "untradeable-pickup":{ icon: Trophy,   label: "Pickup",  accent: "text-emerald-400" }
};

// A grouped tip entry — either a single standalone tip or a header for a
// collection of related tips (e.g. "Decant jewellery: 5 items").
interface TipGroup {
  /** Unique identifier for the group (used as React key + dismissal target). */
  key: string;
  kind: BankTip["kind"];
  /** Display label for the group header. */
  label: string;
  /** Optional secondary subline shown on the header row. */
  subline: string;
  /** Tips contained in this group. Always at least 1. */
  tips: BankTip[];
  /** True when only one tip is in the group — renders as a flat row. */
  isStandalone: boolean;
  /** Combined slot-saving across all tips in the group. */
  slotsFreed: number;
}

function groupTips(tips: BankTip[]): TipGroup[] {
  // Buckets we want to *always* collapse, even when only one tip is present:
  //   - "decant" + subKind=jewellery → "Decant jewellery"
  //   - "decant" + subKind=potions   → "Decant potions"
  //   - "outfit-incomplete"          → "Incomplete skilling outfits"
  // Everything else renders as a standalone row.
  const groupedDecantJew: BankTip[] = [];
  const groupedDecantPot: BankTip[] = [];
  const groupedOutfits: BankTip[] = [];
  const standalone: BankTip[] = [];

  for (const t of tips) {
    if (t.kind === "decant" && t.subKind === "jewellery") groupedDecantJew.push(t);
    else if (t.kind === "decant" && t.subKind === "potions") groupedDecantPot.push(t);
    else if (t.kind === "outfit-incomplete") groupedOutfits.push(t);
    else standalone.push(t);
  }

  const out: TipGroup[] = [];

  if (groupedDecantJew.length > 0) {
    const slots = groupedDecantJew.reduce((s, t) => s + (t.slotsFreed ?? 0), 0);
    out.push({
      key: "group:decant:jewellery",
      kind: "decant",
      label: "Decant jewellery",
      subline: `${groupedDecantJew.length} item${groupedDecantJew.length === 1 ? "" : "s"} with mixed charge states`,
      tips: groupedDecantJew,
      isStandalone: false,
      slotsFreed: slots
    });
  }

  if (groupedDecantPot.length > 0) {
    const slots = groupedDecantPot.reduce((s, t) => s + (t.slotsFreed ?? 0), 0);
    out.push({
      key: "group:decant:potions",
      kind: "decant",
      label: "Decant potions",
      subline: `${groupedDecantPot.length} potion${groupedDecantPot.length === 1 ? "" : "s"} split across dose states`,
      tips: groupedDecantPot,
      isStandalone: false,
      slotsFreed: slots
    });
  }

  if (groupedOutfits.length > 0) {
    out.push({
      key: "group:outfit-incomplete",
      kind: "outfit-incomplete",
      label: "Incomplete skilling outfits",
      subline: `${groupedOutfits.length} set${groupedOutfits.length === 1 ? "" : "s"} a few pieces away`,
      tips: groupedOutfits,
      isStandalone: false,
      slotsFreed: 0
    });
  }

  // Standalone tips keep their original order.
  for (const t of standalone) {
    out.push({
      key: t.id,
      kind: t.kind,
      label: t.title,
      subline: t.detail,
      tips: [t],
      isStandalone: true,
      slotsFreed: t.slotsFreed ?? 0
    });
  }

  return out;
}

export function TipsCard({ tips }: TipsCardProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState(false);
  // Drill-in state. When set, the grid hides every other card and shows
  // only this group's items in a focused panel. Click "back" to return
  // to the overview. Standalone tips never drill in — they just dismiss.
  const [focusedGroupKey, setFocusedGroupKey] = useState<string | null>(null);

  const visibleTips = useMemo(
    () => tips.filter((t) => !dismissed.has(t.id)),
    [tips, dismissed]
  );
  const groups = useMemo(() => groupTips(visibleTips), [visibleTips]);

  // If the focused group becomes empty (all its tips dismissed) or no longer
  // exists, pop back to the overview automatically.
  const focusedGroup = focusedGroupKey
    ? groups.find((g) => g.key === focusedGroupKey) ?? null
    : null;
  if (focusedGroupKey && !focusedGroup) {
    // Side-effect during render is fine here — we want immediate fallback.
    // No-op; the conditional below renders the overview because focusedGroup
    // is null.
  }

  if (groups.length === 0) return null;

  const dismissTip = (id: string) =>
    setDismissed((s) => {
      const next = new Set(s);
      next.add(id);
      return next;
    });

  // Dismiss every tip inside a group (used by the group-level X button).
  const dismissGroup = (g: TipGroup) => {
    setDismissed((s) => {
      const next = new Set(s);
      for (const t of g.tips) next.add(t.id);
      return next;
    });
    // If we were focused on this group, exit drill-in.
    if (focusedGroupKey === g.key) setFocusedGroupKey(null);
  };

  const totalSlots = visibleTips.reduce((s, t) => s + (t.slotsFreed ?? 0), 0);

  return (
    <section
      className={cn(
        "mb-5 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)]",
        "animate-[fade-in_0.25s_ease-out]"
      )}
      aria-label="Bank tips"
    >
      <header
        className={cn(
          "flex items-center gap-2.5 px-3.5 py-2.5 cursor-pointer select-none",
          collapsed ? "" : "border-b border-[var(--color-border)]"
        )}
        onClick={() => setCollapsed((c) => !c)}
        role="button"
        aria-expanded={!collapsed}
      >
        <Lightbulb className="size-3.5 text-[var(--color-accent)]" />
        <span className="text-[12.5px] font-semibold tracking-tight">
          {groups.length} tip{groups.length === 1 ? "" : "s"} for your bank
        </span>
        {totalSlots > 0 && (
          <span className="text-[11px] text-[var(--color-text-muted)]">
            · up to <strong className="text-[var(--color-text-secondary)]">{totalSlots}</strong> slot{totalSlots === 1 ? "" : "s"} to reclaim
          </span>
        )}
        <span className="ml-auto text-[var(--color-text-muted)]">
          {collapsed
            ? <ChevronDown className="size-3.5" />
            : <ChevronUp className="size-3.5" />}
        </span>
      </header>

      {!collapsed && !focusedGroup && (
        // Overview — grid of cards. Clicking a group card drills in.
        <ul
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: "8px",
            padding: "10px 12px",
            listStyle: "none",
            margin: 0
          }}
        >
          {groups.map((g) => (
            <TipGroupRow
              key={g.key}
              group={g}
              onOpen={() => setFocusedGroupKey(g.key)}
              onDismissGroup={() => dismissGroup(g)}
              onDismissTip={dismissTip}
            />
          ))}
        </ul>
      )}

      {!collapsed && focusedGroup && (
        // Drill-in view — only the focused group's tips, with a back button.
        <TipFocusedView
          group={focusedGroup}
          onBack={() => setFocusedGroupKey(null)}
          onDismissTip={dismissTip}
          onDismissGroup={() => dismissGroup(focusedGroup)}
        />
      )}
    </section>
  );
}

function TipGroupRow({ group, onOpen, onDismissGroup, onDismissTip }: {
  group: TipGroup;
  /** For grouped cards: drill in to a focused view. Ignored for standalones. */
  onOpen: () => void;
  onDismissGroup: () => void;
  onDismissTip: (id: string) => void;
}) {
  const meta = KIND_META[group.kind];
  const Icon = meta.icon;
  const headerPreviewIds = useMemo(
    () => Array.from(new Set(group.tips.flatMap((t) => t.itemIds))).slice(0, 6),
    [group]
  );

  const cardBase: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    width: "100%",
    margin: 0,
    listStyle: "none"
  };

  // STANDALONE — single-tip card, no drill-in.
  if (group.isStandalone) {
    return (
      <li style={cardBase}>
        <div className={cn(
          "rounded-md border border-[var(--color-border)] bg-[var(--color-bg)]/40",
          "px-3 py-2.5 transition-colors hover:border-[var(--color-border-strong)] hover:bg-[var(--color-bg)]/70",
          "h-full flex flex-col"
        )}>
          <CardHeader
            meta={meta} Icon={Icon}
            label={meta.label}
            countText={null}
            slotsFreed={group.slotsFreed}
            onDismiss={() => onDismissTip(group.tips[0].id)}
          />
          <div className="text-[12.5px] font-medium leading-snug mt-1.5 text-[var(--color-text)]">{group.label}</div>
          <div className="text-[11px] text-[var(--color-text-muted)] leading-snug mt-1 flex-1">{group.subline}</div>
          {headerPreviewIds.length > 0 && (
            <div className="flex items-center gap-1 mt-2 flex-wrap">
              {headerPreviewIds.slice(0, 6).map((id) => (
                <img
                  key={id}
                  src={ICON_URL(id)}
                  alt=""
                  className="size-5 rounded-sm bg-[var(--color-bg)] border border-[var(--color-border)] p-0.5"
                />
              ))}
            </div>
          )}
        </div>
      </li>
    );
  }

  // GROUPED — clicking the card drills into a focused view. We deliberately
  // do NOT expand inline anymore: long lists were collapsing the grid
  // visually because one card became much taller than its neighbours.
  return (
    <li style={cardBase}>
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "text-left rounded-md border border-[var(--color-border)] bg-[var(--color-bg)]/40",
          "px-3 py-2.5 transition-colors hover:border-[var(--color-accent)] hover:bg-[var(--color-bg)]/70",
          "focus:outline-none focus-visible:border-[var(--color-accent)] focus-visible:shadow-[0_0_0_3px_rgba(230, 165, 47,0.2)]",
          "h-full flex flex-col w-full cursor-pointer"
        )}
        aria-haspopup="dialog"
      >
        <CardHeader
          meta={meta} Icon={Icon}
          label={meta.label}
          countText={`${group.tips.length} item${group.tips.length === 1 ? "" : "s"}`}
          slotsFreed={group.slotsFreed}
          expandIndicator="closed"
          onDismiss={onDismissGroup}
        />
        <div className="text-[12.5px] font-medium leading-snug mt-1.5 text-[var(--color-text)]">{group.label}</div>
        <div className="text-[11px] text-[var(--color-text-muted)] leading-snug mt-1 flex-1">{group.subline}</div>
        {headerPreviewIds.length > 0 && (
          <div className="flex items-center gap-1 mt-2 flex-wrap">
            {headerPreviewIds.slice(0, 6).map((id) => (
              <img
                key={id}
                src={ICON_URL(id)}
                alt=""
                className="size-5 rounded-sm bg-[var(--color-bg)] border border-[var(--color-border)] p-0.5"
              />
            ))}
          </div>
        )}
        <div className="mt-2 text-[10.5px] text-[var(--color-accent)] font-medium opacity-80 group-hover:opacity-100">
          Open ›
        </div>
      </button>
    </li>
  );
}

// Drill-in panel — renders only the focused group's items, with a back
// button up top. Replaces the inline-expansion that was making the grid
// look broken when a single card grew to many rows.
function TipFocusedView({ group, onBack, onDismissTip, onDismissGroup }: {
  group: TipGroup;
  onBack: () => void;
  onDismissTip: (id: string) => void;
  onDismissGroup: () => void;
}) {
  const meta = KIND_META[group.kind];
  const Icon = meta.icon;
  return (
    <div className="px-3.5 py-3 animate-[fade-in_0.18s_ease-out]">
      <div className="flex items-center gap-2 mb-3">
        <button
          type="button"
          onClick={onBack}
          className={cn(
            "inline-flex items-center gap-1 text-[11.5px] font-medium",
            "text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors",
            "px-2 py-1 rounded hover:bg-[var(--color-panel-2)]/40"
          )}
          aria-label="Back to tips overview"
        >
          <ChevronLeft className="size-3.5" />
          Back to tips
        </button>
        <span className="ml-1 flex items-center gap-1.5">
          <span className={cn(
            "size-5 rounded flex items-center justify-center",
            "bg-[var(--color-bg)] border border-[var(--color-border)]",
            meta.accent
          )}>
            <Icon className="size-3" />
          </span>
          <span className="text-[12px] font-semibold text-[var(--color-text)]">{group.label}</span>
          <span className="text-[10.5px] text-[var(--color-text-muted)]">
            · {group.tips.length} item{group.tips.length === 1 ? "" : "s"}
          </span>
          {group.slotsFreed > 0 && (
            <span className="text-[10.5px] text-[var(--color-accent)] font-semibold">
              · −{group.slotsFreed} slot{group.slotsFreed === 1 ? "" : "s"}
            </span>
          )}
        </span>
        <button
          type="button"
          onClick={() => { onDismissGroup(); onBack(); }}
          className={cn(
            "ml-auto inline-flex items-center gap-1 text-[10.5px] font-medium",
            "text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors",
            "px-2 py-1 rounded hover:bg-[var(--color-panel-2)]/40"
          )}
        >
          Dismiss all
          <X className="size-3" />
        </button>
      </div>

      <ul className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)]/40 divide-y divide-[var(--color-border)]/50 overflow-hidden">
        {group.tips.map((t) => (
          <TipChildRow
            key={t.id}
            tip={t}
            // Reserve a fixed icon strip width equal to the largest row in
            // this drill-in. Result: every row's title starts at the same
            // x-coordinate regardless of how many icons it shows, so the
            // list reads as a tidy vertical column instead of a ragged edge.
            iconSlots={Math.min(8, Math.max(...group.tips.map((tt) => tt.itemIds.length)))}
            onDismiss={() => onDismissTip(t.id)}
          />
        ))}
      </ul>
    </div>
  );
}

// Shared header row: kind icon + label chip + slot badge + dismiss X.
function CardHeader({ meta, Icon, label, countText, slotsFreed, expandIndicator, onDismiss }: {
  meta: { accent: string };
  Icon: typeof Lightbulb;
  label: string;
  countText: string | null;
  slotsFreed: number;
  expandIndicator?: "open" | "closed";
  onDismiss: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn(
        "size-6 rounded-md flex items-center justify-center shrink-0",
        "bg-[var(--color-bg)] border border-[var(--color-border)]",
        meta.accent
      )}>
        <Icon className="size-3" />
      </span>
      <span className="text-[10px] uppercase tracking-[0.14em] font-semibold text-[var(--color-text-muted)]">
        {label}
      </span>
      {countText && (
        <span className="text-[10px] text-[var(--color-text-muted)]">{countText}</span>
      )}
      {slotsFreed > 0 && (
        <span className="text-[10px] text-[var(--color-accent)] font-semibold">
          −{slotsFreed} slot{slotsFreed === 1 ? "" : "s"}
        </span>
      )}
      <span className="ml-auto flex items-center gap-1">
        {expandIndicator && (
          <ChevronRight className={cn(
            "size-3 text-[var(--color-text-muted)] transition-transform",
            expandIndicator === "open" && "rotate-90"
          )} />
        )}
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); onDismiss(); }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              onDismiss();
            }
          }}
          aria-label="Dismiss"
          className="size-5 rounded flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)] cursor-pointer"
        >
          <X className="size-3" />
        </span>
      </span>
    </div>
  );
}

function TipChildRow({ tip, iconSlots = 4, onDismiss }: {
  tip: BankTip;
  /**
   * Fixed number of icon-cells to render. Filled left-to-right with the
   * tip's items; remaining cells are empty placeholders that keep the
   * title aligned with siblings that have more icons. Defaults to 4 when
   * the parent doesn't compute a group max.
   */
  iconSlots?: number;
  onDismiss: () => void;
}) {
  const previewIds = tip.itemIds.slice(0, iconSlots);
  // Build an array of length `iconSlots` so the column always reserves the
  // same horizontal space — empty cells become invisible spacers.
  const cells: Array<number | null> = Array.from({ length: iconSlots }, (_, i) =>
    previewIds[i] ?? null
  );
  return (
    <li className="px-3 py-2 flex items-center gap-3 border-b border-[var(--color-border)]/40 last:border-b-0">
      {/* Fixed-width icon strip — left-aligned items, transparent spacers
          fill the remaining cells. All rows in the drill-in share the same
          iconSlots count so titles land on a single vertical line. */}
      <div className="flex items-center gap-1 shrink-0">
        {cells.map((id, i) => (
          <span
            key={i}
            className={cn(
              "size-9 rounded-md flex items-center justify-center",
              id !== null
                ? "bg-[var(--color-bg)] border border-[var(--color-border)]"
                : "border border-transparent"
            )}
            aria-hidden={id === null}
          >
            {id !== null && (
              <img
                src={ICON_URL(id)}
                alt=""
                className="pixelated"
                style={{
                  maxWidth: "80%",
                  maxHeight: "80%",
                  imageRendering: "pixelated",
                  filter: "drop-shadow(1px 1px 0 rgb(0 0 0 / 0.9))"
                }}
              />
            )}
          </span>
        ))}
      </div>

      {/* Title + detail to the right of the icon strip. */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <div className="text-[12.5px] font-medium leading-snug text-[var(--color-text)]">{tip.title}</div>
          {tip.slotsFreed ? (
            <span className="text-[10px] text-[var(--color-accent)] font-semibold">
              −{tip.slotsFreed} slot{tip.slotsFreed === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>
        <div className="text-[11px] text-[var(--color-text-muted)] leading-snug mt-0.5">{tip.detail}</div>
      </div>

      <button
        onClick={onDismiss}
        aria-label="Dismiss this tip"
        className="size-6 rounded flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)] shrink-0"
      >
        <X className="size-3" />
      </button>
    </li>
  );
}
