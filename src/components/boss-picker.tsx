"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { Search, ChevronDown, X } from "lucide-react";
import { ItemSprite } from "@/components/item-sprite";
import { BOSSES, BOSS_CATEGORIES, type Boss, type BossCategory } from "@/lib/bosses";
import { bossSpriteUrl } from "@/lib/sprites";
import { cn } from "@/lib/utils";

// Reusable boss sprite. Local boss artwork is the primary path so the UI stays
// fast and deterministic; signature drops use the item-sprite proxy fallback.
export function BossSprite({ boss, size = 28 }: { boss: Boss; size?: number }) {
  const localSprite = bossSpriteUrl(boss.slug);
  const [stage, setStage] = useState<"local" | "drop" | "dot">(localSprite ? "local" : "drop");
  useEffect(() => {
    setStage(localSprite ? "local" : "drop");
  }, [localSprite, boss.iconItemId]);

  if (stage === "dot" || (!boss.iconItemId && stage !== "local")) {
    const fallbackLabel = `${boss.name} sprite unavailable · boss ${boss.slug}`;
    return (
      <span
        role="img"
        aria-label={fallbackLabel}
        title={fallbackLabel}
        data-boss-sprite-fallback="missing"
        data-boss-sprite-missing-slug={boss.slug}
        className="inline-flex items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-accent)]/14 text-[9px] font-black leading-none text-[var(--color-accent)] shadow-[0_0_10px_rgba(134, 166, 217,0.25)]"
        style={{ width: Math.max(16, size * 0.65), height: Math.max(16, size * 0.65) }}
      >
        <span aria-hidden="true">?</span>
      </span>
    );
  }
  if (stage === "drop" && boss.iconItemId) {
    return (
      <ItemSprite
        id={boss.iconItemId}
        alt=""
        style={{
          maxWidth: "80%",
          maxHeight: "80%",
          width: undefined,
          height: undefined
        }}
      />
    );
  }
  return (
    <img
      src={localSprite ?? ""}
      alt={boss.name}
      style={{
        maxWidth: "92%",
        maxHeight: "92%",
        objectFit: "contain"
      }}
      onError={() => setStage(boss.iconItemId ? "drop" : "dot")}
    />
  );
}

interface Props {
  selected: Boss;
  onSelect: (boss: Boss) => void;
  className?: string;
  /** Optional sort hook — for the DPS page we sort by current DPS desc. */
  sortKey?: (boss: Boss) => number;
}

export function BossPicker({ selected, onSelect, className, sortKey }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const pickerId = "boss-picker-dialog";
  const searchId = "boss-picker-search";
  const statusId = "boss-picker-status";
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [anchor, setAnchor] = useState<{ left: number; top: number; width: number } | null>(null);

  // Close on outside click / escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (popoverRef.current?.contains(t) || buttonRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Compute popover anchor when opening + on resize/scroll.
  useEffect(() => {
    if (!open) return;
    const compute = () => {
      const r = buttonRef.current?.getBoundingClientRect();
      if (r) setAnchor({ left: r.left, top: r.bottom + 4, width: Math.max(r.width, 320) });
    };
    compute();
    window.addEventListener("resize", compute);
    window.addEventListener("scroll", compute, true);
    return () => {
      window.removeEventListener("resize", compute);
      window.removeEventListener("scroll", compute, true);
    };
  }, [open]);

  // Focus the search input when opening.
  useEffect(() => {
    if (open) {
      setQuery("");
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Filter + group by category.
  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? BOSSES.filter((b) =>
          b.name.toLowerCase().includes(q) ||
          b.slug.toLowerCase().includes(q) ||
          (b.notes ?? "").toLowerCase().includes(q)
        )
      : BOSSES.slice();

    if (sortKey) {
      filtered.sort((a, b) => sortKey(b) - sortKey(a));
      return [{ category: "all" as BossCategory | "all", label: "All bosses", items: filtered }];
    }

    const byCat = new Map<BossCategory, Boss[]>();
    for (const b of filtered) {
      const cat = (b.category ?? "misc") as BossCategory;
      if (!byCat.has(cat)) byCat.set(cat, []);
      byCat.get(cat)!.push(b);
    }
    const categoryOrder: BossCategory[] = [
      "raid", "gwd", "dt2", "slayer", "wildy", "world", "minigame", "skilling", "quest", "misc"
    ];
    return categoryOrder
      .filter((c) => byCat.has(c))
      .map((c) => ({ category: c as BossCategory | "all", label: BOSS_CATEGORIES[c], items: byCat.get(c)! }));
  }, [query, sortKey]);

  const totalCount = grouped.reduce((s, g) => s + g.items.length, 0);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Choose boss for DPS setup. Current boss: ${selected.name}`}
        aria-haspopup="dialog"
        aria-controls={open ? pickerId : undefined}
        aria-expanded={open}
        className={cn(
          "inline-flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[12.5px] font-medium transition-colors border",
          "bg-[var(--color-bg-2)] border-[var(--color-border)] text-[var(--color-text)] hover:border-[var(--color-border-strong)]",
          open && "border-[var(--color-accent)]/40",
          className
        )}
      >
        <span className="size-6 shrink-0 rounded bg-[var(--color-bg)] border border-[var(--color-border)] flex items-center justify-center overflow-hidden">
          <BossSprite boss={selected} size={24} />
        </span>
        <span className="truncate">{selected.name}</span>
        <ChevronDown
          className={cn(
            "size-3 text-[var(--color-text-muted)] transition-transform shrink-0",
            open && "rotate-180"
          )}
        />
      </button>

      {open && anchor && createPortal(
        <div
          id={pickerId}
          ref={popoverRef}
          role="dialog"
          aria-label="Choose boss for DPS setup"
          className="fixed z-[120] rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-panel)] shadow-[0_24px_60px_-20px_rgb(0_0_0/0.75)] animate-[pop-in_0.18s_ease-out] origin-top-left flex flex-col"
          style={{
            left: anchor.left,
            top: anchor.top,
            width: anchor.width,
            maxWidth: "calc(100vw - 24px)",
            maxHeight: "min(560px, calc(100vh - 80px))"
          }}
        >
          <div className="relative px-3 pt-3 pb-2 border-b border-[var(--color-border)]">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 size-3.5 text-[var(--color-text-muted)] mt-[3px]" />
            <label htmlFor={searchId} className="sr-only">Search bosses in picker</label>
            <input
              id={searchId}
              name="boss-picker-search"
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search bosses…"
              autoComplete="off"
              spellCheck={false}
              aria-describedby={statusId}
              className="w-full pl-7 pr-7 py-1.5 rounded-md text-[12.5px] bg-[var(--color-bg-2)] border border-[var(--color-border)] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] focus:shadow-[0_0_0_3px_rgba(134, 166, 217,0.12)]"
            />
            <p id={statusId} role="status" aria-live="polite" className="sr-only">
              {query
                ? `${totalCount} boss${totalCount === 1 ? "" : "es"} match ${query}.`
                : `${BOSSES.length} bosses available.`}
            </p>
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear boss picker search"
                className="absolute right-5 top-1/2 -translate-y-1/2 text-[var(--color-text-dim)] hover:text-[var(--color-text)] mt-[3px]"
                title="Clear"
              >
                <X className="size-3" />
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {totalCount === 0 ? (
              <div className="px-4 py-6 text-center text-[12px] text-[var(--color-text-muted)]">
                No bosses match &ldquo;{query}&rdquo;
              </div>
            ) : (
              grouped.map((g) => (
                <div key={g.category} className="py-1">
                  <div className="px-3 py-1.5 text-[9.5px] uppercase tracking-[0.16em] font-semibold text-[var(--color-text-muted)] sticky top-0 bg-[var(--color-panel)] z-10">
                    {g.label} · {g.items.length}
                  </div>
                  {g.items.map((b) => (
                    <BossRow
                      key={b.slug}
                      boss={b}
                      isSelected={b.slug === selected.slug}
                      onPick={() => {
                        onSelect(b);
                        setOpen(false);
                      }}
                    />
                  ))}
                </div>
              ))
            )}
          </div>

          <div className="px-3 py-2 border-t border-[var(--color-border)] text-[10px] text-[var(--color-text-muted)] flex items-center justify-between">
            <span>{totalCount} of {BOSSES.length} bosses</span>
            <span>Esc to close</span>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

function BossRow({ boss, isSelected, onPick }: { boss: Boss; isSelected: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={isSelected}
      aria-label={`${isSelected ? "Selected" : "Select"} ${boss.name}${boss.hp > 0 ? `, ${boss.hp} HP` : ""}`}
      className={cn(
        "w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors",
        isSelected
          ? "bg-[var(--color-accent)]/12"
          : "hover:bg-[var(--color-panel-2)]"
      )}
    >
      <span className="size-7 shrink-0 rounded bg-[var(--color-bg)] border border-[var(--color-border)] flex items-center justify-center overflow-hidden">
        <BossSprite boss={boss} size={28} />
      </span>
      <div className="flex-1 min-w-0">
        <div className={cn(
          "text-[12.5px] truncate",
          isSelected ? "text-[var(--color-accent)] font-semibold" : "text-[var(--color-text)]"
        )}>
          {boss.name}
        </div>
        {boss.notes && (
          <div className="text-[10.5px] text-[var(--color-text-muted)] truncate">{boss.notes}</div>
        )}
      </div>
      {boss.hp > 0 && (
        <span className="text-[10px] font-mono tabular-nums text-[var(--color-text-muted)] shrink-0">
          {boss.hp} hp
        </span>
      )}
    </button>
  );
}
