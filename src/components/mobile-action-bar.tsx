"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardPaste, PlugZap, Sparkles } from "lucide-react";
import { ACCOUNT_EVENT, getActiveAccount, type ScapestackAccount } from "@/lib/account-storage";
import { loadMood } from "@/lib/mood-storage";
import { loadSavedBank, loadSavedRsn, SAVED_BANK_EVENT } from "@/lib/saved-bank";
import { cn } from "@/lib/utils";
import { SessionMoodPicker } from "./session-mood-picker";

function moodLabel(mood?: string): string {
  switch (mood) {
    case "chill": return "Chill";
    case "cash": return "GP";
    case "bossing": return "Boss";
    case "unlock":
    case "quest": return "Unlock";
    case "afk": return "AFK";
    case "short": return "Short";
    default: return "Mood";
  }
}

export function MobileActionBar() {
  const pathname = usePathname();
  const [account, setAccount] = useState<ScapestackAccount | null>(null);
  const [rsn, setRsn] = useState("");
  const [hasBank, setHasBank] = useState(false);
  const [mood, setMood] = useState("Mood");

  useEffect(() => {
    const refresh = () => {
      const active = getActiveAccount();
      const nextRsn = active?.rsn ?? loadSavedRsn() ?? "";
      const savedBank = loadSavedBank(nextRsn);
      const savedMood = loadMood(nextRsn);
      setAccount(active);
      setRsn(nextRsn);
      setHasBank(Boolean(active?.bankSavedAt || savedBank));
      setMood(moodLabel(savedMood?.mood));
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

  const rsnQuery = rsn ? `?rsn=${encodeURIComponent(rsn)}` : "";
  const bankHref = rsn ? `/bank?rsn=${encodeURIComponent(rsn)}&from=mobile` : "/bank?from=mobile";
  const pluginHref = rsn ? `/plugin?rsn=${encodeURIComponent(rsn)}&from=mobile#verify-sync` : "/plugin?from=mobile#verify-sync";
  const actions = [
    {
      href: `/next${rsnQuery}`,
      label: "Plan",
      helper: rsn || "RSN",
      icon: Sparkles,
      active: true
    },
    {
      href: bankHref,
      label: hasBank ? "Bank" : "Add bank",
      helper: hasBank ? "Added" : "Paste",
      icon: ClipboardPaste,
      active: hasBank
    },
    {
      href: pluginHref,
      label: "RuneLite",
      helper: account?.runeliteCheckedAt ? "Checked" : "Later",
      icon: PlugZap,
      active: Boolean(account?.runeliteCheckedAt)
    }
  ];

  if (pathname === "/") return null;

  return (
    <nav
      aria-label="Mobile quick actions"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-parchment-edge)]/70 bg-[var(--color-parchment-dark)]/94 px-2 pb-[calc(env(safe-area-inset-bottom)+0.45rem)] pt-2 shadow-[0_-18px_50px_-36px_rgba(0,0,0,0.95)] backdrop-blur-md sm:hidden"
    >
      <div className="mx-auto grid max-w-md grid-cols-4 gap-1.5">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              className={cn(
                "flex min-h-[54px] flex-col items-center justify-center rounded-xl border px-1.5 text-center transition-colors",
                action.active
                  ? "border-[var(--color-accent)]/45 bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                  : "border-transparent text-[var(--color-text-dim)] hover:border-[var(--color-accent)]/30 hover:text-[var(--color-accent)]"
              )}
            >
              <Icon className="size-4" />
              <span className="mt-1 max-w-full truncate text-[11px] font-bold leading-none">{action.label}</span>
              <span className="mt-0.5 max-w-full truncate text-[9.5px] font-semibold leading-none opacity-70">{action.helper}</span>
            </Link>
          );
        })}
        <SessionMoodPicker rsn={rsn} label={mood} mobileTile />
      </div>
    </nav>
  );
}
