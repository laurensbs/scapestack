"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { CheckCircle2, ChevronDown, Menu, Package, PlugZap, Plus, RefreshCw, UserRound, X } from "lucide-react";
import { ACCOUNT_EVENT, getActiveAccount, loadAccountStore, removeAccount, setActiveAccount, type ScapestackAccount } from "@/lib/account-storage";
import { contextualNavHref } from "@/lib/nav-context";
import { clearSavedRsn, describeSavedAt, loadSavedBank, loadSavedRsn, saveSavedRsn, SAVED_BANK_EVENT } from "@/lib/saved-bank";
import { getPrimaryNavTools } from "@/lib/tools";
import { cn } from "@/lib/utils";
import { AddBankModal } from "./add-bank-modal";
import { BuyMeCoffee } from "./buy-me-coffee";

const LOOP_STEPS = [
  { label: "Trip", href: "/next" },
  { label: "Setup", href: "/bank" },
  { label: "Boss", href: "/dps" }
];

export function Header() {
  const pathname = usePathname();
  const [contextQuery, setContextQuery] = useState("");
  const [activeRsn, setActiveRsn] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileNavId = "scapestack-mobile-nav";

  useEffect(() => {
    const syncQuery = () => setContextQuery(window.location.search);
    syncQuery();
    window.addEventListener("popstate", syncQuery);
    return () => window.removeEventListener("popstate", syncQuery);
  }, [pathname]);

  useEffect(() => {
    const syncAccount = () => {
      const active = getActiveAccount();
      const legacy = loadSavedRsn();
      if (active?.rsn) {
        setActiveRsn(active.rsn);
      } else if (legacy) {
        saveSavedRsn(legacy);
        setActiveRsn(legacy);
      } else {
        setActiveRsn("");
      }
    };
    syncAccount();
    window.addEventListener(ACCOUNT_EVENT, syncAccount);
    window.addEventListener(SAVED_BANK_EVENT, syncAccount);
    window.addEventListener("storage", syncAccount);
    return () => {
      window.removeEventListener(ACCOUNT_EVENT, syncAccount);
      window.removeEventListener(SAVED_BANK_EVENT, syncAccount);
      window.removeEventListener("storage", syncAccount);
    };
  }, []);

  const navTools = getPrimaryNavTools();
  const currentTool = navTools.find((t) => pathname.startsWith(t.href));
  const title = currentTool?.name;
  // Home indicator — pathname is the root.
  const onHome = pathname === "/";

  return (
    <header
      className={cn(
        "sticky top-0 z-30 h-14 shrink-0",
        "border-b border-[var(--color-parchment-edge)]/70 bg-[var(--color-parchment-dark)]/92 shadow-[0_14px_42px_-34px_rgba(0,0,0,0.9)] backdrop-blur-md"
      )}
    >
      <div className="mx-auto max-w-7xl h-full px-4 sm:px-6 flex items-center justify-between gap-3">
        {/* Wordmark + page title. Lowercase text keeps the header quiet;
            the route accent handles identity without a heavy logo tile. */}
        <div className="flex items-baseline gap-3 min-w-0">
          <Link
            href="/"
            aria-label="Scapestack home"
            className={cn(
              "group flex items-baseline shrink-0 leading-none",
              "text-[18px] font-semibold tracking-normal lowercase drop-shadow-[1px_1px_0_rgba(0,0,0,0.85)]"
            )}
          >
            <span
              className="text-[var(--color-text)] group-hover:text-[var(--color-text-secondary)] transition-colors"
              style={{ animation: "hero-fade 0.55s cubic-bezier(0.22,1,0.36,1) 0.05s both" }}
            >
              scape
            </span>
            <span
              className="text-[var(--color-gold)] group-hover:brightness-110 transition-[filter]"
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
              <span className="font-medium text-[var(--color-text-secondary)] truncate tracking-normal">{title}</span>
            </div>
          )}
        </div>

        {/* Desktop nav — primary live tools + a discreet BMC icon. The icon
            variant stays muted until hover so it doesn't compete with the
            page content, but is always one click away from anywhere in
            the app. */}
        <nav className="hidden sm:flex items-center gap-1" aria-label="Primary trip actions">
          {navTools.map((tool, i) => {
            const Icon = tool.icon;
            const href = contextualNavHref(tool.href, pathname, contextQuery, activeRsn);
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
                    ? "bg-[var(--color-accent)]/13 text-[var(--color-text)] ring-1 ring-[var(--color-accent)]/35"
                    : "text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:bg-[var(--color-parchment)]/70"
                )}
              >
                <Icon data-tool-icon={tool.slug} className={cn("size-3.5", active && "text-[var(--color-accent)]")} />
                {tool.navLabel ?? tool.name}
              </Link>
            );
          })}
          <AccountSwitcher activeRsn={activeRsn} onActiveRsnChange={setActiveRsn} />
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
        <div className="fixed inset-x-0 top-14 z-40 border-t border-[var(--color-parchment-edge)]/70 bg-[var(--color-parchment-dark)] shadow-[0_22px_50px_-36px_rgba(0,0,0,0.82)] sm:hidden">
          <nav id={mobileNavId} className="px-4 py-3 space-y-1" aria-label="Mobile trip actions">
            <div className="mb-3 rounded-lg border border-[var(--color-parchment-edge)]/70 bg-[var(--color-parchment)] p-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-gold)]">
                Your account
              </div>
              <div className="mt-2">
                <AccountSwitcher activeRsn={activeRsn} onActiveRsnChange={setActiveRsn} compact />
              </div>
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                {LOOP_STEPS.map((step) => (
                  <Link
                    key={step.href}
                    href={contextualNavHref(step.href, pathname, contextQuery, activeRsn)}
                    onClick={() => setMobileOpen(false)}
                    aria-label={`${step.label} in Scapestack loop`}
                    className="rounded-lg border border-[var(--color-parchment-edge)]/70 bg-[var(--color-parchment-dark)]/45 px-2 py-2 text-center text-[11.5px] font-bold text-[var(--color-text)] transition-colors hover:border-[var(--color-accent)]/45 hover:text-[var(--color-accent)]"
                  >
                    {step.label}
                  </Link>
                ))}
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-[var(--color-text-muted)]">
                Saved once. Used for the next trip.
              </p>
            </div>
            {navTools.map((tool) => {
              const Icon = tool.icon;
              const href = contextualNavHref(tool.href, pathname, contextQuery, activeRsn);
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

function AccountSwitcher({
  activeRsn,
  onActiveRsnChange,
  compact = false
}: {
  activeRsn: string;
  onActiveRsnChange: (rsn: string) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [accounts, setAccounts] = useState<ScapestackAccount[]>([]);
  const [draft, setDraft] = useState(activeRsn);
  const [hasSavedSetup, setHasSavedSetup] = useState(false);
  const [bankSavedAt, setBankSavedAt] = useState<number | null>(null);
  const [bankModalOpen, setBankModalOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = () => {
    const store = loadAccountStore();
    setAccounts(store.accounts);
    const active = getActiveAccount();
    const nextRsn = active?.rsn ?? loadSavedRsn() ?? "";
    const savedBank = loadSavedBank(nextRsn);
    onActiveRsnChange(nextRsn);
    setDraft(nextRsn);
    setHasSavedSetup(Boolean(active?.bankSavedAt || savedBank));
    setBankSavedAt(active?.bankSavedAt ?? savedBank?.savedAt ?? null);
  };

  useEffect(() => {
    refresh();
    window.addEventListener(ACCOUNT_EVENT, refresh);
    window.addEventListener(SAVED_BANK_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(ACCOUNT_EVENT, refresh);
      window.removeEventListener(SAVED_BANK_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setDraft(activeRsn);
  }, [activeRsn]);

  const saveAccount = (event: FormEvent) => {
    event.preventDefault();
    const clean = draft.trim();
    if (!clean) return;
    saveSavedRsn(clean);
    setActiveAccount(clean);
    onActiveRsnChange(clean);
    refresh();
    setOpen(false);
  };

  const pickAccount = (rsn: string) => {
    setActiveAccount(rsn);
    saveSavedRsn(rsn);
    onActiveRsnChange(rsn);
    refresh();
    setOpen(false);
  };

  const removeSavedAccount = (rsn: string) => {
    const confirmed = window.confirm(`Remove ${rsn} from Scapestack on this device?`);
    if (!confirmed) return;
    const removingActive = rsn === activeRsn;
    const removingLegacy = loadSavedRsn()?.trim().toLowerCase() === rsn.trim().toLowerCase();
    if (removingActive || removingLegacy) clearSavedRsn();
    removeAccount(rsn);
    const nextActive = getActiveAccount();
    if (nextActive?.rsn) saveSavedRsn(nextActive.rsn);
    refresh();
  };

  const focusRsnInput = () => {
    setOpen(true);
    window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
  };

  const accountLabel = activeRsn || "Add RSN";
  const pluginHref = activeRsn ? `/plugin?rsn=${encodeURIComponent(activeRsn)}#verify-sync` : "/plugin#verify-sync";
  const activeAccount = accounts.find((account) => account.rsn === activeRsn);
  const runeliteReady = Boolean(activeAccount?.runeliteCheckedAt);
  const bankStatusLabel = hasSavedSetup ? "Bank added" : runeliteReady ? "Open bank" : "Add bank";
  const bankFreshness = bankSavedAt ? `Bank saved ${describeSavedAt(bankSavedAt)}` : bankStatusLabel;
  const runeliteLabel = runeliteReady ? "Refresh RuneLite" : "Add RuneLite";

  return (
    <div className={cn("relative", compact ? "w-full" : "hidden sm:block")}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "scapestack-account-pill px-2.5 py-1.5 text-[12px] font-semibold transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]",
          activeRsn ? "text-[var(--color-text)]" : "text-[var(--color-text-dim)]",
          compact && "w-full justify-between px-3 py-2"
        )}
        aria-expanded={open}
        aria-label={activeRsn ? `Current account ${activeRsn}` : "Add OSRS account"}
      >
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <UserRound className="size-3.5 shrink-0 text-[var(--color-accent)]" />
          <span className="max-w-[120px] truncate">{accountLabel}</span>
        </span>
        <ChevronDown className={cn("size-3.5 shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className={cn(
          "scapestack-modal z-40 mt-2 p-3",
          compact ? "w-full" : "absolute right-0 w-[340px]"
        )}>
          <form onSubmit={saveAccount} className="space-y-2">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                id="header-account-rsn"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Type RSN"
                maxLength={12}
                autoComplete="off"
                spellCheck={false}
                className="min-w-0 flex-1 rounded-md border border-[var(--color-parchment-edge)]/70 bg-[var(--color-bg)] px-3 py-2 text-[13px] font-semibold text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]/55"
              />
              <button
                type="submit"
                disabled={!draft.trim()}
                className="btn-primary px-3 py-2 text-[12px] disabled:opacity-50"
              >
                <Plus className="size-3.5" />
                Use
              </button>
            </div>
          </form>

          {accounts.length > 0 && (
            <div className="mt-3 space-y-1">
              {accounts.map((account) => (
                <div key={account.id} className="flex items-center gap-1 rounded-lg hover:bg-[var(--color-bg)]/60">
                  <button
                    type="button"
                    onClick={() => pickAccount(account.rsn)}
                    className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-[12.5px] font-semibold text-[var(--color-text-dim)] transition-colors hover:text-[var(--color-text)]"
                  >
                    <span className="truncate">{account.rsn}</span>
                    {account.rsn === activeRsn && <CheckCircle2 className="size-3.5 text-[var(--color-good)]" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeSavedAccount(account.rsn)}
                    className="mr-1 inline-flex size-7 shrink-0 items-center justify-center rounded-md text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-danger)]/10 hover:text-[var(--color-danger)]"
                    aria-label={`Remove ${account.rsn}`}
                    title="Remove account"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {activeRsn && (
            <div className="mt-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/45 px-3 py-2 text-[11.5px] font-semibold text-[var(--color-text-muted)]">
              <span className="text-[var(--color-text)]">{activeRsn}</span>
              <span className="mx-1.5 text-[var(--color-border-strong)]">·</span>
              <span title={bankFreshness} className="inline-flex items-center gap-1">
                {hasSavedSetup && <CheckCircle2 className="size-3 text-[var(--color-accent)]" />}
                {bankStatusLabel}
              </span>
              <span className="mx-1.5 text-[var(--color-border-strong)]">·</span>
              <span className="inline-flex items-center gap-1">
                {runeliteReady && <CheckCircle2 className="size-3 text-[var(--color-accent)]" />}
                {runeliteLabel}
              </span>
            </div>
          )}

          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-[var(--color-border)] pt-3">
            <button
              type="button"
              onClick={focusRsnInput}
              className="grid min-h-[76px] place-items-center rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]/45 px-2 py-3 text-center text-[11px] font-bold text-[var(--color-text-dim)] transition-colors hover:border-[var(--color-accent)]/55 hover:text-[var(--color-accent)]"
            >
              <UserRound className="mb-1 size-5" />
              RSN
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setBankModalOpen(true);
              }}
              className="grid min-h-[76px] place-items-center rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]/45 px-2 py-3 text-center text-[11px] font-bold text-[var(--color-text-dim)] transition-colors hover:border-[var(--color-accent)]/55 hover:text-[var(--color-accent)]"
            >
              <Package className="mb-1 size-5" />
              <span title={bankFreshness} className="inline-flex items-center gap-1">
                {hasSavedSetup && <CheckCircle2 className="size-3 text-[var(--color-accent)]" />}
                {bankStatusLabel}
              </span>
            </button>
            <Link
              href={pluginHref}
              onClick={() => setOpen(false)}
              className="grid min-h-[76px] place-items-center rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]/45 px-2 py-3 text-center text-[11px] font-bold text-[var(--color-text-dim)] transition-colors hover:border-[var(--color-accent)]/55 hover:text-[var(--color-accent)]"
            >
              {runeliteReady ? <RefreshCw className="mb-1 size-5" /> : <PlugZap className="mb-1 size-5" />}
              <span className="inline-flex items-center gap-1">
                {runeliteReady && <CheckCircle2 className="size-3 text-[var(--color-accent)]" />}
                {runeliteLabel}
              </span>
            </Link>
          </div>
        </div>
      )}
      <AddBankModal
        open={bankModalOpen}
        onClose={() => setBankModalOpen(false)}
        rsn={activeRsn}
        source="header"
      />
    </div>
  );
}
