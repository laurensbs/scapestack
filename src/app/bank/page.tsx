"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, useCallback, useEffect } from "react";
import { X } from "lucide-react";
import { Intake } from "@/components/intake";
import { BankResult } from "@/components/bank-result";
import { SavedBankBanner } from "@/components/saved-bank-banner";
import { DropCelebration } from "@/components/drop-celebration";
import { ScapestackReadinessRail } from "@/components/scapestack-readiness-rail";
import { SAMPLE_BANKTAGS } from "@/lib/utils";
import { organizeAction } from "../actions";
import { inferArchetype, saveArchetype, type Archetype } from "@/lib/archetype";
import { computeCombatLevel, computeTotalLevel, type HiscoreSkill } from "@/lib/hiscores";
import { hiscoresAction } from "@/app/actions";
import {
  loadSavedBank,
  saveSavedBank,
  saveSavedRsn,
  loadSavedRsn,
  diffIconicItems,
  type SavedBank,
  type IconicItem
} from "@/lib/saved-bank";
import { getActiveAccount } from "@/lib/account-storage";
import { persistBankHandoffPayload } from "@/lib/next-bank-handoff";
import type { OrganizeResult } from "@/lib/organizer";

type View = "intake" | "result";

export default function BankPage() {
  return <BankPageContent />;
}

function isSampleMode(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("sample") === "1";
}

function rsnFromUrl(): string {
  if (typeof window === "undefined") return "";
  return (new URLSearchParams(window.location.search).get("rsn") ?? "").trim().slice(0, 12);
}

function bossFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const boss = (new URLSearchParams(window.location.search).get("boss") ?? "").trim();
  return boss || null;
}

function sourceFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("from");
}

function bankCloseHref(rsn: string): string {
  const cleanRsn = rsn.trim();
  const source = sourceFromUrl();
  const suffix = cleanRsn ? `?rsn=${encodeURIComponent(cleanRsn)}&bank=local` : "?bank=local";
  if (source === "dps") return cleanRsn ? `/dps?rsn=${encodeURIComponent(cleanRsn)}&from=bank` : "/dps?from=bank";
  if (source === "goals") return cleanRsn ? `/goals?rsn=${encodeURIComponent(cleanRsn)}&from=bank` : "/goals?from=bank";
  return `/next${suffix}`;
}

function BankPageContent() {
  const router = useRouter();
  const [view, setView] = useState<View>("intake");
  const [result, setResult] = useState<OrganizeResult | null>(null);
  const [strings, setStrings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [sampleInput, setSampleInput] = useState<string | null>(null);
  const [inferredArchetype, setInferredArchetype] = useState<Archetype | null>(null);
  const [inferredRsn, setInferredRsn] = useState<string | null>(null);
  const [hiscoreSkills, setHiscoreSkills] = useState<HiscoreSkill[] | null>(null);
  const [prefilledRsn, setPrefilledRsn] = useState("");
  // Welcome-back banner state. We populate this once on mount when a saved
  // bank is found, then the user either reuses it ("Use saved bank") or
  // dismisses it ("Start fresh" / "Don't save on this device"). Lives at
  // the page level because the banner needs to drive a programmatic submit.
  const [savedBank, setSavedBank] = useState<SavedBank | null>(null);
  // New iconic items detected by diffing the fresh paste against the
  // previously-saved bank. Drives the one-shot drop-celebration banner
  // above BankResult. Set right before we overwrite the saved bank;
  // cleared when the user leaves the result view.
  const [freshIconics, setFreshIconics] = useState<IconicItem[]>([]);
  const [returnBossSlug, setReturnBossSlug] = useState<string | null>(null);

  // Resolve archetype from RSN (if provided) via Hiscores, else "unspecified".
  const resolveArchetype = async (rsn: string): Promise<{ archetype: Archetype; rsn: string | null; skills: HiscoreSkill[] | null }> => {
    if (!rsn) return { archetype: "unspecified", rsn: null, skills: null };
    const hiscores = await hiscoresAction(rsn);
    if (!hiscores) return { archetype: "unspecified", rsn: null, skills: null };
    const archetype = inferArchetype({
      totalLevel: computeTotalLevel(hiscores.skills),
      combatLevel: computeCombatLevel(hiscores.skills),
      skills: hiscores.skills
    });
    return { archetype, rsn: hiscores.name, skills: hiscores.skills };
  };

  const onIntakeSubmit = (input: string, junkFilter: boolean, rsn: string) => {
    setError(null);
    startTransition(async () => {
      const { archetype, rsn: resolvedRsn, skills } = await resolveArchetype(rsn);
      saveArchetype(archetype);
      setInferredArchetype(archetype);
      setInferredRsn(resolvedRsn);
      setHiscoreSkills(skills);

      const res = await organizeAction(input, { junkFilter, includePrices: true, archetype });
      if (res.error || !res.result) {
        setError(res.error || "Failed to organize");
        return;
      }
      setResult(res.result);
      setStrings(res.strings || []);
      try {
        persistBankHandoffPayload(res.result.tabs, window);
      } catch {
        // Cross-tool handoff is best-effort; the bank result still renders locally.
      }
      setView("result");
      // Auto-save on a successful organize. The module respects the
      // session opt-out flag; if the user clicked "Don't save on this
      // device" earlier this session it's a no-op. We skip the sample
      // banktags — pinning the demo string as a "saved bank" would mean
      // every welcome-back banner shows the sample, which is misleading.
      if (input !== SAMPLE_BANKTAGS) {
        const bankRsn = resolvedRsn ?? rsn.trim() ?? "";
        // Diff iconics *before* we overwrite the saved bank. Only fires
        // celebrations on the second+ paste; first visit returns [].
        const prev = loadSavedBank(bankRsn);
        if (prev?.banktags && prev.banktags !== input) {
          const fresh = diffIconicItems(prev.banktags, input);
          if (fresh.length > 0) setFreshIconics(fresh);
        }
        saveSavedBank(input, bankRsn);
        if (bankRsn) saveSavedRsn(bankRsn);
      }
    });
  };

  const onSample = useCallback(() => {
    setSampleInput(SAMPLE_BANKTAGS);
    onIntakeSubmit(SAMPLE_BANKTAGS, false, "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Deep-link from the homepage: /bank?sample=1 auto-organises the sample
  // bank so a first-time visitor sees the actual output without installing
  // a RuneLite plugin. The biggest bouncer in the old flow was "do four
  // steps before you see anything"; this collapses that to one click.
  useEffect(() => {
    if (isSampleMode() && view === "intake" && !pending) {
      onSample();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const initialRsn = rsnFromUrl() || getActiveAccount()?.rsn || loadSavedRsn() || "";
    setPrefilledRsn(initialRsn);
    setReturnBossSlug(bossFromUrl());
  }, []);

  // Welcome-back: look up a saved bank on mount. Skip when the URL is in
  // sample-mode (the sample-bank effect above will take precedence) — we
  // don't want to fight that flow with a banner that says "use your old
  // bank instead." Only the intake view shows the banner.
  useEffect(() => {
    if (isSampleMode()) return;
    const initialRsn = rsnFromUrl() || getActiveAccount()?.rsn || loadSavedRsn() || "";
    setSavedBank(loadSavedBank(initialRsn));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onUseSavedBank = useCallback((bank: SavedBank) => {
    setSavedBank(null);
    saveSavedBank(bank.banktags, prefilledRsn || null);
    if (prefilledRsn) saveSavedRsn(prefilledRsn);
    router.push(bankCloseHref(prefilledRsn));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefilledRsn, router]);

  const onSaveBankOnly = useCallback((_input: string, rsn: string) => {
    const targetRsn = rsn.trim() || prefilledRsn;
    router.push(bankCloseHref(targetRsn));
  }, [prefilledRsn, router]);

  const closeHref = bankCloseHref(prefilledRsn);

  return (
    <main className="relative z-10 mx-auto max-w-6xl px-5 py-7 pb-20">
      {view === "intake" && (
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="bank-popup-title"
          data-testid="bank-save-popup"
          className="mx-auto max-w-3xl overflow-hidden rounded-[18px] border-2 border-[var(--color-accent)]/55 bg-[#2b2418] shadow-[0_30px_120px_-45px_rgba(0,0,0,0.95)]"
        >
          <div className="flex items-start justify-between gap-4 border-b border-[var(--color-accent)]/35 px-5 py-4 sm:px-7">
            <div>
              <p className="eyebrow text-[var(--color-accent)]">Bank setup</p>
              <h1 id="bank-popup-title" className="mt-1 font-serif text-[28px] font-bold leading-none text-[var(--color-text)] sm:text-[34px]">
                Add bank
              </h1>
              <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-[var(--color-text-dim)]">
                Paste your RuneLite bank once. Scapestack saves it on this device and uses it for trips, supplies and kill checks.
              </p>
            </div>
            <Link
              href={closeHref}
              aria-label="Close bank popup"
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-[var(--color-border)] text-[var(--color-text-dim)] transition-colors hover:border-[var(--color-accent)]/55 hover:text-[var(--color-accent)]"
            >
              <X className="size-5" />
            </Link>
          </div>
          <div className="p-5 sm:p-7">
          {savedBank && (
            <SavedBankBanner
              saved={savedBank}
              loading={pending}
              onUse={() => onUseSavedBank(savedBank)}
              onDismiss={() => setSavedBank(null)}
              tertiaryLabel="Try sample instead"
              onTertiary={() => {
                setSavedBank(null);
                onSample();
              }}
            />
          )}
          <Intake
            key={sampleInput ?? "fresh"}
            onSubmit={onIntakeSubmit}
            loading={pending}
            error={error}
            askRsn
            initialRsn={prefilledRsn}
            compactSave
            saveLabel="Save bank"
            onSaveOnly={onSaveBankOnly}
          />
            <button
              type="button"
              onClick={onSample}
              className="mt-4 inline-flex text-[12px] font-semibold text-[var(--color-text-muted)] underline decoration-dotted underline-offset-4 transition-colors hover:text-[var(--color-accent)]"
            >
              Try sample instead
            </button>
          </div>
        </section>
      )}
      {view === "result" && result && (
        <>
          {freshIconics.length > 0 && (
            // One-shot. The key forces a remount per submit so each new
            // drop gets a fresh entry animation; otherwise re-renders
            // would suppress it on subsequent organizes.
            <DropCelebration
              key={freshIconics.map((i) => i.needle).join("|")}
              items={freshIconics}
            />
          )}
          <BankResult
            initial={result}
            initialStrings={strings}
            onEditInput={() => { setFreshIconics([]); setView("intake"); }}
            inferredArchetype={inferredArchetype}
            inferredRsn={inferredRsn}
            hiscoreSkills={hiscoreSkills}
            returnBossSlug={returnBossSlug}
          />
          <details className="mt-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)]/55 p-3">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[13px] font-semibold text-[var(--color-text)] marker:hidden">
              <span>Make the next trip smarter</span>
              <span className="text-[11px] font-medium text-[var(--color-text-muted)]">Name/RuneLite only when they change the pick</span>
            </summary>
            <div className="mt-4">
              <ScapestackReadinessRail
                surface="bank"
                hasBankContext
                hasRsn={Boolean(inferredRsn)}
                rsn={inferredRsn}
              />
            </div>
          </details>
        </>
      )}
    </main>
  );
}
