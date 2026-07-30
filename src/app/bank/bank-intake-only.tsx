"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Intake } from "@/components/intake";
import { getActiveAccount } from "@/lib/account-storage";
import { playerToolSectionPath, type PlayerToolSection } from "@/lib/player-tool-route";
import { loadSavedRsn } from "@/lib/saved-bank";

export function BankIntakeOnly({ section }: { section: PlayerToolSection }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const knownRsn = getActiveAccount()?.rsn || loadSavedRsn() || "";
    if (knownRsn.trim()) router.replace(playerToolSectionPath(knownRsn, section));
  }, [router, section]);

  const openPlayerPage = (_input: string, _junkFilter: boolean, rsn: string) => {
    const cleanRsn = rsn.trim().slice(0, 12);
    if (!cleanRsn) {
      setError("Add your OSRS name so this bank has one player page.");
      return;
    }
    setError(null);
    startTransition(() => router.push(playerToolSectionPath(cleanRsn, section)));
  };

  return (
    <main className="scape-page max-w-3xl">
      <section aria-labelledby="bank-intake-title" className="scape-dialog mx-auto overflow-hidden">
        <div className="border-b border-[var(--color-border)] px-5 py-4 sm:px-6">
          <p className="eyebrow">Bank setup</p>
          <h1 id="bank-intake-title" className="mt-1 text-[28px] font-semibold leading-none text-[var(--color-text)] sm:text-[34px]">
            Add bank once
          </h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-[var(--color-text-dim)]">
            Add your name and RuneLite bank export. The answer opens on that player page.
          </p>
        </div>
        <div className="p-5 sm:p-6">
          <Intake
            onSubmit={openPlayerPage}
            onSaveOnly={(input, rsn) => openPlayerPage(input, false, rsn)}
            loading={pending}
            error={error}
            askRsn
            compactSave
            saveLabel="Open player page"
          />
          <p className="mt-4 text-[11.5px] leading-relaxed text-[var(--color-text-muted)]">
            Saved on this device only. For automatic bank updates, use the RuneLite sync from your player page.
          </p>
          <Link href="/" className="mt-4 inline-flex min-h-11 items-center text-[12px] font-semibold text-[var(--color-accent)] hover:underline">
            Back
          </Link>
        </div>
      </section>
    </main>
  );
}
