"use client";

import { useState, useMemo, type MouseEvent } from "react";
import { Lightbulb, X, ChevronDown, ChevronUp, ChevronRight, ChevronLeft, Coins, Sparkles, Wrench, Trophy, ExternalLink, Copy, CheckCheck, ListChecks } from "lucide-react";
import type { BankTip } from "@/lib/tips";
import { cn } from "@/lib/utils";
import { buildTipAction, formatTipActionPlan, type BankTipAction } from "@/lib/tip-actions";
import { copyText } from "@/lib/clipboard";
import { ItemSprite } from "@/components/item-sprite";
import { wikiSearchUrl } from "@/lib/wiki";
import { bankSearchQueryForItems } from "@/lib/bank-search";

interface TipsCardProps {
  tips: BankTip[];
  onSearchItems?: (query: string, sourceLabel?: string) => void;
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

function groupAction(group: TipGroup): BankTipAction {
  return buildTipAction(group.tips[0]);
}

function itemRefsForTips(tips: BankTip[], limit = 8): Array<{ id: number; name: string }> {
  const seen = new Set<number>();
  const out: Array<{ id: number; name: string }> = [];
  for (const tip of tips) {
    const refs = tip.itemRefs ?? tip.itemIds.map((id) => ({ id, name: `Item ID ${id}` }));
    for (const ref of refs) {
      if (seen.has(ref.id)) continue;
      seen.add(ref.id);
      out.push(ref);
      if (out.length >= limit) return out;
    }
  }
  return out;
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

export function TipsCard({ tips, onSearchItems }: TipsCardProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState(false);
  const [lastDismissedTip, setLastDismissedTip] = useState<{ ids: string[]; label: string } | null>(null);
  // Drill-in state. When set, the grid hides every other card and shows
  // only this group's items in a focused panel. Click "back" to return
  // to the overview. Every card drills in so tips always have an action,
  // not just a dismiss X.
  const [focusedGroupKey, setFocusedGroupKey] = useState<string | null>(null);
  const tipsBodyId = "bank-tips-body";

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
  const dismissTip = (id: string) => {
    const tip = tips.find((entry) => entry.id === id);
    setLastDismissedTip({ ids: [id], label: tip?.title ?? "Bank tip" });
    setDismissed((s) => {
      const next = new Set(s);
      next.add(id);
      return next;
    });
  };

  // Dismiss every tip inside a group (used by the group-level X button).
  const dismissGroup = (g: TipGroup) => {
    setLastDismissedTip({ ids: g.tips.map((tip) => tip.id), label: g.label });
    setDismissed((s) => {
      const next = new Set(s);
      for (const t of g.tips) next.add(t.id);
      return next;
    });
    // If we were focused on this group, exit drill-in.
    if (focusedGroupKey === g.key) setFocusedGroupKey(null);
  };

  const restoreTips = () => {
    setDismissed(new Set());
    setLastDismissedTip(null);
    setFocusedGroupKey(null);
    setCollapsed(false);
  };

  const restoreLastDismissedTip = () => {
    if (!lastDismissedTip) return;
    setDismissed((s) => {
      const next = new Set(s);
      for (const id of lastDismissedTip.ids) next.delete(id);
      return next;
    });
    setLastDismissedTip(null);
    setFocusedGroupKey(null);
    setCollapsed(false);
  };

  const totalSlots = visibleTips.reduce((s, t) => s + (t.slotsFreed ?? 0), 0);
  const undoDismissBanner = lastDismissedTip ? (
    <div
      role="status"
      aria-live="polite"
      className="mx-3.5 mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--color-accent)]/25 bg-[var(--color-accent)]/8 px-3 py-2 text-[11.5px] text-[var(--color-text-dim)]"
    >
      <span>
        Hidden for now:{" "}
        <span className="font-semibold text-[var(--color-text)]">{lastDismissedTip.label}</span>.
      </span>
      <button
        type="button"
        onClick={restoreLastDismissedTip}
        aria-label={`Restore hidden tip group ${lastDismissedTip.label}`}
        className="rounded-md border border-[var(--color-accent)]/35 bg-[var(--color-accent)]/10 px-2.5 py-1 text-[11px] font-semibold text-[var(--color-accent)] hover:bg-[var(--color-accent)]/15 transition-colors"
      >
        Undo hide
      </button>
    </div>
  ) : null;

  if (tips.length === 0) return null;

  if (groups.length === 0) {
    return (
      <section
        className={cn(
          "mb-5 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)]",
          "animate-[fade-in_0.25s_ease-out]"
        )}
        aria-label="Bank tips"
      >
        <div className="flex items-center gap-2.5 border-b border-[var(--color-border)] px-3.5 py-2.5">
          <Lightbulb className="size-3.5 text-[var(--color-accent)]" />
          <span className="text-[12.5px] font-semibold tracking-normal">
            All bank tips are hidden
          </span>
          <span className="text-[11px] text-[var(--color-text-muted)]">
            · {dismissed.size} dismissed
          </span>
        </div>
        {undoDismissBanner}
        <div className="px-3.5 py-3">
          <div className="rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-bg-2)]/35 px-3 py-2.5 text-[12px] text-[var(--color-text-dim)]">
            <div className="font-semibold text-[var(--color-text)]">No visible tips right now.</div>
            <p className="mt-1">
              Restore them if you want Scapestack to show the decant, merge and pickup actions for this bank again.
            </p>
            <button
              type="button"
              onClick={restoreTips}
              aria-label="Restore every hidden bank tip"
              className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-[var(--color-accent)]/35 bg-[var(--color-accent)]/10 px-2.5 py-1.5 text-[11.5px] font-semibold text-[var(--color-accent)] hover:bg-[var(--color-accent)]/15 transition-colors"
            >
              Restore tips
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className={cn(
        "mb-5 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)]",
        "animate-[fade-in_0.25s_ease-out]"
      )}
      aria-label="Bank tips"
    >
      <button
        type="button"
        className={cn(
          "flex w-full items-center gap-2.5 px-3.5 py-2.5 cursor-pointer select-none text-left",
          "focus:outline-none focus-visible:shadow-[0_0_0_3px_rgba(15, 118, 110,0.2)]",
          collapsed ? "" : "border-b border-[var(--color-border)]"
        )}
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
        aria-controls={tipsBodyId}
        aria-label={`${collapsed ? "Expand" : "Collapse"} bank tips. ${groups.length} tip${groups.length === 1 ? "" : "s"} available.`}
      >
        <Lightbulb className="size-3.5 text-[var(--color-accent)]" />
        <span className="text-[12.5px] font-semibold tracking-normal">
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
      </button>

      {undoDismissBanner}

      {!collapsed && !focusedGroup && (
        // Overview — grid of cards. Clicking a group card drills in.
        <ul
          id={tipsBodyId}
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
              onSearchItems={onSearchItems}
            />
          ))}
        </ul>
      )}

      {!collapsed && focusedGroup && (
        // Drill-in view — only the focused group's tips, with a back button.
        <TipFocusedView
          panelId={tipsBodyId}
          group={focusedGroup}
          onBack={() => setFocusedGroupKey(null)}
          onDismissTip={dismissTip}
          onDismissGroup={() => dismissGroup(focusedGroup)}
          onSearchItems={onSearchItems}
        />
      )}
    </section>
  );
}

function TipGroupRow({ group, onOpen, onDismissGroup, onDismissTip, onSearchItems }: {
  group: TipGroup;
  /** For grouped cards: drill in to a focused view. Ignored for standalones. */
  onOpen: () => void;
  onDismissGroup: () => void;
  onDismissTip: (id: string) => void;
  onSearchItems?: (query: string, sourceLabel?: string) => void;
}) {
  const meta = KIND_META[group.kind];
  const Icon = meta.icon;
  const headerPreviewItems = useMemo(
    () => itemRefsForTips(group.tips, 6),
    [group]
  );

  const cardBase: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    width: "100%",
    margin: 0,
    listStyle: "none"
  };

  // STANDALONE — single-tip card, still drills in to show the exact action.
  if (group.isStandalone) {
    const action = groupAction(group);
    return (
      <li style={cardBase}>
        <div
          className={cn(
            "rounded-md border border-[var(--color-border)] bg-[var(--color-bg)]/40",
            "px-3 py-2.5 transition-colors hover:border-[var(--color-accent)] hover:bg-[var(--color-bg)]/70",
            "h-full flex flex-col"
          )}>
          <CardHeader
            meta={meta} Icon={Icon}
            label={meta.label}
            countText={null}
            slotsFreed={group.slotsFreed}
            onDismiss={() => onDismissTip(group.tips[0].id)}
            dismissLabel={`Dismiss ${group.label} tip`}
          />
          <button
            type="button"
            onClick={onOpen}
            aria-label={`Open action steps for ${group.label}`}
            className={cn(
              "mt-1.5 block w-full flex-1 cursor-pointer rounded-sm text-left",
              "focus:outline-none focus-visible:shadow-[0_0_0_3px_rgba(15, 118, 110,0.2)]"
            )}
          >
            <div className="text-[12.5px] font-medium leading-snug text-[var(--color-text)]">{group.label}</div>
            <div className="text-[11px] text-[var(--color-text-muted)] leading-snug mt-1">{group.subline}</div>
            <div className="mt-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-2)]/45 px-2 py-1.5 text-[10.5px] leading-snug text-[var(--color-text-dim)]">
              <span className="text-[var(--color-accent)] font-semibold">Action:</span> {action.instruction}
            </div>
          </button>
          {headerPreviewItems.length > 0 && (
            <div className="flex items-center gap-1 mt-2 flex-wrap">
              {headerPreviewItems.map((item) => (
                <a
                  key={item.id}
                  href={wikiSearchUrl(item.name)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(event) => event.stopPropagation()}
                  className="rounded-sm bg-[var(--color-bg)] border border-[var(--color-border)] p-0.5 hover:border-[var(--color-accent)] transition-colors"
                  title={`${item.name} · ID ${item.id}`}
                  aria-label={`Open ${item.name} on OSRS Wiki`}
                >
                  <ItemSprite
                    id={item.id}
                    alt=""
                    size={20}
                  />
                </a>
              ))}
            </div>
          )}
          <TipCardActions
            action={action}
            tips={group.tips}
            actionLabel={group.label}
            onOpen={onOpen}
            onSearchItems={onSearchItems}
            onMarkDone={() => onDismissTip(group.tips[0].id)}
          />
        </div>
      </li>
    );
  }

  // GROUPED — clicking the card drills into a focused view. We deliberately
  // do NOT expand inline anymore: long lists were collapsing the grid
  // visually because one card became much taller than its neighbours.
  const action = groupAction(group);
  return (
    <li style={cardBase}>
      <div
        className={cn(
          "text-left rounded-md border border-[var(--color-border)] bg-[var(--color-bg)]/40",
          "px-3 py-2.5 transition-colors hover:border-[var(--color-accent)] hover:bg-[var(--color-bg)]/70",
          "h-full flex flex-col w-full"
        )}
      >
        <CardHeader
          meta={meta} Icon={Icon}
          label={meta.label}
          countText={`${group.tips.length} item${group.tips.length === 1 ? "" : "s"}`}
          slotsFreed={group.slotsFreed}
          expandIndicator="closed"
          onDismiss={onDismissGroup}
          dismissLabel={`Dismiss ${group.label} tips`}
        />
        <button
          type="button"
          onClick={onOpen}
          aria-haspopup="dialog"
          aria-label={`Open action steps for ${group.label}`}
          className={cn(
            "mt-1.5 block w-full flex-1 cursor-pointer rounded-sm text-left",
            "focus:outline-none focus-visible:shadow-[0_0_0_3px_rgba(15, 118, 110,0.2)]"
          )}
        >
          <div className="text-[12.5px] font-medium leading-snug text-[var(--color-text)]">{group.label}</div>
          <div className="text-[11px] text-[var(--color-text-muted)] leading-snug mt-1">{group.subline}</div>
          <div className="mt-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-2)]/45 px-2 py-1.5 text-[10.5px] leading-snug text-[var(--color-text-dim)]">
            <span className="text-[var(--color-accent)] font-semibold">Action:</span> {action.instruction}
          </div>
        </button>
        {headerPreviewItems.length > 0 && (
          <div className="flex items-center gap-1 mt-2 flex-wrap">
            {headerPreviewItems.map((item) => (
              <a
                key={item.id}
                href={wikiSearchUrl(item.name)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(event) => event.stopPropagation()}
                className="rounded-sm bg-[var(--color-bg)] border border-[var(--color-border)] p-0.5 hover:border-[var(--color-accent)] transition-colors"
                title={`${item.name} · ID ${item.id}`}
                aria-label={`Open ${item.name} on OSRS Wiki`}
              >
                <ItemSprite
                  id={item.id}
                  alt=""
                  size={20}
                />
              </a>
            ))}
          </div>
        )}
        <TipCardActions
          action={action}
          tips={group.tips}
          actionLabel={group.label}
          onOpen={onOpen}
          onSearchItems={onSearchItems}
          onMarkDone={onDismissGroup}
        />
      </div>
    </li>
  );
}

function TipCardActions({
  action,
  tips,
  actionLabel,
  onOpen,
  onSearchItems,
  onMarkDone
}: {
  action: BankTipAction;
  tips: BankTip[];
  actionLabel: string;
  onOpen: () => void;
  onSearchItems?: (query: string, sourceLabel?: string) => void;
  onMarkDone?: () => void;
}) {
  const searchQuery = bankSearchQueryForItems(itemRefsForTips(tips));
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {onSearchItems && searchQuery && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onSearchItems(searchQuery, tips.length === 1 ? tips[0].title : `${tips.length} bank tips`);
          }}
          className="inline-flex items-center gap-1 rounded border border-[var(--color-accent)]/35 bg-[var(--color-accent)]/10 px-2 py-1 text-[10.5px] font-semibold text-[var(--color-accent)] hover:bg-[var(--color-accent)]/15 transition-colors"
          title={`Search bank for ${searchQuery}`}
          aria-label={`Find affected bank items for ${actionLabel}`}
        >
          Find items
          <ListChecks className="size-3" />
        </button>
      )}
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onOpen();
        }}
        className="inline-flex items-center gap-1 rounded border border-[var(--color-accent)]/35 bg-[var(--color-accent)]/10 px-2 py-1 text-[10.5px] font-semibold text-[var(--color-accent)] hover:bg-[var(--color-accent)]/15 transition-colors"
        aria-label={`Open step-by-step action plan for ${actionLabel}`}
      >
        Open steps
        <ChevronRight className="size-3" />
      </button>
      {action.href && (
        <a
          href={action.href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(event) => event.stopPropagation()}
          className="inline-flex items-center gap-1 rounded border border-[var(--color-border)] px-2 py-1 text-[10.5px] font-semibold text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:border-[var(--color-border-strong)] transition-colors"
          title={action.label}
          aria-label={action.label}
        >
          Wiki guide
          <ExternalLink className="size-3" />
        </a>
      )}
      {onMarkDone && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onMarkDone();
          }}
          className="inline-flex items-center gap-1 rounded border border-[var(--color-good)]/35 bg-[var(--color-good)]/10 px-2 py-1 text-[10.5px] font-semibold text-[var(--color-good)] hover:bg-[var(--color-good)]/15 transition-colors"
          aria-label={`Mark ${actionLabel} tip as done`}
        >
          Mark done
          <CheckCheck className="size-3" />
        </button>
      )}
      <TipCopyButton tips={tips} label="Copy plan" />
    </div>
  );
}

// Drill-in panel — renders only the focused group's items, with a back
// button up top. Replaces the inline-expansion that was making the grid
// look broken when a single card grew to many rows.
function TipFocusedView({ panelId, group, onBack, onDismissTip, onDismissGroup, onSearchItems }: {
  panelId: string;
  group: TipGroup;
  onBack: () => void;
  onDismissTip: (id: string) => void;
  onDismissGroup: () => void;
  onSearchItems?: (query: string, sourceLabel?: string) => void;
}) {
  const meta = KIND_META[group.kind];
  const Icon = meta.icon;
  const action = groupAction(group);
  const searchQuery = bankSearchQueryForItems(itemRefsForTips(group.tips));
  return (
    <div
      id={panelId}
      role="region"
      aria-label={`Action steps for ${group.label}`}
      className="px-3.5 py-3 animate-[fade-in_0.18s_ease-out]"
    >
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
          aria-label={`Dismiss all tips for ${group.label}`}
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

      <div className="mb-3 rounded-lg border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 p-3">
        <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-[var(--color-accent)]">
          Do this
        </div>
        <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--color-text)]">
          {action.instruction}
        </p>
        {action.href ? (
          <a
            href={action.href}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-[var(--color-accent)]/35 bg-[var(--color-bg)]/35 px-2.5 py-1.5 text-[11.5px] font-semibold text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 transition-colors"
            aria-label={`Open ${action.label} for ${group.label}`}
          >
            {action.label}
            <ExternalLink className="size-3" />
          </a>
        ) : (
          <div className="mt-2 text-[11.5px] text-[var(--color-text-muted)]">
            No external guide needed — the affected item variants are listed below.
          </div>
        )}
        <div className="mt-2">
          {onSearchItems && searchQuery && (
            <button
              type="button"
              onClick={() => onSearchItems(searchQuery, group.label)}
              className="mr-2 inline-flex items-center gap-1.5 rounded-md border border-[var(--color-accent)]/35 bg-[var(--color-bg)]/35 px-2.5 py-1.5 text-[11.5px] font-semibold text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 transition-colors"
              title={`Search bank for ${searchQuery}`}
              aria-label={`Find affected bank items for ${group.label}`}
            >
              Find affected items
              <ListChecks className="size-3" />
            </button>
          )}
          <TipCopyButton tips={group.tips} label="Copy action plan" />
          <button
            type="button"
            onClick={() => { onDismissGroup(); onBack(); }}
            className="ml-2 inline-flex items-center gap-1.5 rounded-md border border-[var(--color-good)]/35 bg-[var(--color-bg)]/35 px-2.5 py-1.5 text-[11.5px] font-semibold text-[var(--color-good)] hover:bg-[var(--color-good)]/10 transition-colors"
            aria-label={`Mark ${group.label} tip as done`}
          >
            Mark done
            <CheckCheck className="size-3" />
          </button>
        </div>
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
function CardHeader({ meta, Icon, label, countText, slotsFreed, expandIndicator, onDismiss, dismissLabel }: {
  meta: { accent: string };
  Icon: typeof Lightbulb;
  label: string;
  countText: string | null;
  slotsFreed: number;
  expandIndicator?: "open" | "closed";
  onDismiss: () => void;
  dismissLabel: string;
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
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDismiss(); }}
          aria-label={dismissLabel}
          className="size-5 rounded flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)] cursor-pointer"
        >
          <X className="size-3" />
        </button>
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
  const action = buildTipAction(tip);
  const previewItems = itemRefsForTips([tip], iconSlots);
  // Build an array of length `iconSlots` so the column always reserves the
  // same horizontal space — empty cells become invisible spacers.
  const cells: Array<{ id: number; name: string } | null> = Array.from({ length: iconSlots }, (_, i) =>
    previewItems[i] ?? null
  );
  return (
    <li className="px-3 py-2 flex items-center gap-3 border-b border-[var(--color-border)]/40 last:border-b-0">
      {/* Fixed-width icon strip — left-aligned items, transparent spacers
          fill the remaining cells. All rows in the drill-in share the same
          iconSlots count so titles land on a single vertical line. */}
      <div className="flex items-center gap-1 shrink-0">
        {cells.map((item, i) => (
          <span
            key={i}
            className={cn(
              "size-9 rounded-md flex items-center justify-center",
              item !== null
                ? "bg-[var(--color-bg)] border border-[var(--color-border)]"
                : "border border-transparent"
            )}
            aria-hidden={item === null}
          >
            {item !== null && (
              <a
                href={wikiSearchUrl(item.name)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex size-full items-center justify-center rounded-md hover:outline hover:outline-1 hover:outline-[var(--color-accent)]"
                title={`${item.name} · ID ${item.id}`}
                aria-label={`Open ${item.name} on OSRS Wiki`}
              >
                <ItemSprite
                  id={item.id}
                  alt=""
                  className="pixelated"
                  size={28}
                />
              </a>
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

      <div className="flex items-center gap-1.5 shrink-0">
        {action.href && (
          <a
            href={action.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded border border-[var(--color-border)] px-2 py-1 text-[10.5px] font-semibold text-[var(--color-text-dim)] hover:text-[var(--color-accent)] hover:border-[var(--color-accent)]/35"
            aria-label={`Open ${action.label} for ${tip.title}`}
          >
            Guide
            <ExternalLink className="size-3" />
          </a>
        )}
        <TipCopyButton tips={[tip]} label="Copy" compact />
        <button
          type="button"
          onClick={onDismiss}
          aria-label={`Dismiss ${tip.title} tip`}
          className="size-6 rounded flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)]"
        >
          <X className="size-3" />
        </button>
      </div>
    </li>
  );
}

function TipCopyButton({ tips, label, compact = false }: {
  tips: BankTip[];
  label: string;
  compact?: boolean;
}) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const [manualCopyText, setManualCopyText] = useState("");

  const copyPlan = async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const actionPlanText = formatTipActionPlan(
      tips,
      tips.length === 1 ? tips[0].title : `${tips.length} Scapestack bank tips`
    );
    const result = await copyText(actionPlanText);
    if (result !== "failed") {
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1500);
    } else {
      setManualCopyText(actionPlanText);
      setCopyState("error");
    }
  };

  return (
    <span className="inline-flex max-w-full flex-col gap-1.5" aria-live="polite">
      <button
        type="button"
        onClick={copyPlan}
        aria-label={`Copy action plan for ${tips.length === 1 ? tips[0].title : `${tips.length} Scapestack bank tips`}`}
        className={cn(
          "inline-flex items-center gap-1 rounded border border-[var(--color-border)] font-semibold text-[var(--color-text-dim)] hover:text-[var(--color-accent)] hover:border-[var(--color-accent)]/35 transition-colors",
          copyState === "error" && "border-[var(--color-danger)]/35 text-[var(--color-danger)]",
          compact ? "px-2 py-1 text-[10.5px]" : "px-2.5 py-1.5 text-[11.5px]"
        )}
      >
        {copyState === "copied" ? <CheckCheck className="size-3" /> : <Copy className="size-3" />}
        {copyState === "copied" ? "Copied" : copyState === "error" ? "Copy failed" : label}
      </button>
      {copyState === "error" && (
        <span className="block rounded-md border border-[var(--color-danger)]/25 bg-[var(--color-danger)]/8 p-2">
          <label className="mb-1 block text-[9.5px] font-bold uppercase tracking-[0.14em] text-[var(--color-danger)]">
            Clipboard failed — copy manually
          </label>
          <textarea
            readOnly
            value={manualCopyText}
            onFocus={(event) => event.currentTarget.select()}
            className={cn(
              "w-full resize-y rounded border border-[var(--color-border)] bg-[var(--color-bg)] p-2 font-mono leading-relaxed text-[var(--color-text)]",
              compact ? "min-h-[72px] text-[10px]" : "min-h-[92px] text-[10.5px]"
            )}
            aria-label={`Manual copy fallback for ${tips.length === 1 ? tips[0].title : `${tips.length} Scapestack bank tips`}`}
          />
        </span>
      )}
    </span>
  );
}
