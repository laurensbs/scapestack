"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CheckCircle2, ClipboardPaste, PlugZap, RefreshCw, Sparkles } from "lucide-react";
import { ACCOUNT_EVENT } from "@/lib/account-storage";
import { loadAccountSnapshot, type AccountSnapshot } from "@/lib/account-context";
import { SAVED_BANK_EVENT } from "@/lib/saved-bank";
import { cn } from "@/lib/utils";
import { SessionMoodPicker } from "./session-mood-picker";

export function MobileActionBar() {
  const pathname = usePathname();
  const [snapshot, setSnapshot] = useState<AccountSnapshot | null>(null);

  useEffect(() => {
    const refresh = () => {
      setSnapshot(loadAccountSnapshot());
    };
    refresh();
    window.addEventListener(ACCOUNT_EVENT, refresh);
    window.addEventListener(SAVED_BANK_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(ACCOUNT_EVENT, refresh);
      window.removeEventListener(SAVED_BANK_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const rsn = snapshot?.rsn ?? "";
  const hasBank = Boolean(snapshot?.hasBankContext);
  const hasRunelite = Boolean(snapshot?.hasRunelite);
  const nextHref = snapshot?.planHref ?? (rsn ? `/next?rsn=${encodeURIComponent(rsn)}` : "/next");
  const bankHref = rsn ? `/bank?rsn=${encodeURIComponent(rsn)}&from=mobile` : "/bank?from=mobile";
  const pluginHref = rsn ? `/plugin?rsn=${encodeURIComponent(rsn)}&from=mobile#verify-sync` : "/plugin?from=mobile#verify-sync";
  const actions = [
    {
      href: nextHref,
      label: "Trip",
      icon: Sparkles,
      selected: pathname === "/next",
      complete: false
    },
    {
      href: bankHref,
      label: "Bank",
      icon: ClipboardPaste,
      selected: pathname === "/bank",
      complete: hasBank
    },
    {
      href: pluginHref,
      label: "RuneLite",
      icon: hasRunelite ? RefreshCw : PlugZap,
      selected: pathname === "/plugin",
      complete: hasRunelite
    }
  ];

  if (pathname === "/") return null;

  return (
    <nav
      aria-label="Mobile quick actions"
      className="mobile-action-bar fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-parchment-edge)]/70 bg-[var(--color-parchment-dark)]/94 px-2 pt-2 shadow-[0_-18px_50px_-36px_rgba(0,0,0,0.95)] backdrop-blur-md sm:hidden"
    >
      <div className="mx-auto grid max-w-md grid-cols-4 gap-1.5">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              aria-current={action.selected ? "page" : undefined}
              className={cn(
                "relative flex min-h-14 flex-col items-center justify-center rounded-lg border px-1.5 text-center transition-colors",
                action.selected
                  ? "border-[var(--color-accent)]/45 bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                  : "border-transparent text-[var(--color-text-dim)] hover:border-[var(--color-accent)]/30 hover:text-[var(--color-accent)]"
              )}
            >
              <Icon className="size-[18px]" />
              {action.complete && (
                <CheckCircle2 className="absolute right-1.5 top-1.5 size-3.5 text-[var(--color-accent)]" />
              )}
              <span className="mt-1.5 max-w-full truncate text-[11.5px] font-bold leading-none">{action.label}</span>
            </Link>
          );
        })}
        <SessionMoodPicker rsn={rsn} label={snapshot?.moodLabel ?? "Mood"} mobileTile />
      </div>
    </nav>
  );
}
