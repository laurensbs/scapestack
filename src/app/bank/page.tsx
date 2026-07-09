"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, useCallback, useEffect } from "react";
import { Check, PencilLine, X } from "lucide-react";
import { Intake } from "@/components/intake";
import { BankResult } from "@/components/bank-result";
import { DropCelebration } from "@/components/drop-celebration";
import { ScapestackReadinessRail } from "@/components/scapestack-readiness-rail";
import { SAMPLE_BANKTAGS } from "@/lib/utils";
import { organizeAction } from "../actions";
import { inferArchetype, saveArchetype, type Archetype } from "@/lib/archetype";
import { computeCombatLevel, computeTotalLevel, type HiscoreSkill } from "@/lib/hiscores";
import { hiscoresAction } from "@/app/actions";
import {
  loadSavedBank,
  describeSavedAt,
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
const LAST_BANK_INPUT_KEY = "osrs-bank-organizer:last-input";

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

function modeFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const mode = (new URLSearchParams(window.location.search).get("mode") ?? "").trim();
  return mode || null;
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

function clearLastBankPaste(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(LAST_BANK_INPUT_KEY);
  } catch {
  }
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
  // Saved-bank state. When a bank is found, /bank opens the organiser
  // directly; the intake only stays visible for a short loading state or
  // when the player explicitly chooses to paste a different bank.
  const [savedBank, setSavedBank] = useState<SavedBank | null>(null);
  const [replaceSavedBank, setReplaceSavedBank] = useState(false);
  const [autoLoadedSavedBank, setAutoLoadedSavedBank] = useState(false);
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
    setReplaceSavedBank(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (autoLoadedSavedBank || replaceSavedBank || pending || view !== "intake" || !savedBank) return;
    setAutoLoadedSavedBank(true);
    onIntakeSubmit(savedBank.banktags, false, prefilledRsn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoadedSavedBank, pending, prefilledRsn, replaceSavedBank, savedBank, view]);

  const onSaveBankOnly = useCallback((_input: string, rsn: string) => {
    const targetRsn = rsn.trim() || prefilledRsn;
    router.push(bankCloseHref(targetRsn));
  }, [prefilledRsn, router]);

  const closeHref = bankCloseHref(prefilledRsn);
  const openingSavedBank = Boolean(savedBank && !replaceSavedBank && !isSampleMode());

  return (
    <main className="relative z-10 mx-auto max-w-6xl px-5 py-7 pb-20">
      {view === "intake" && (
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="bank-popup-title"
          data-testid="bank-save-popup"
          className="scapestack-plan-panel mx-auto max-w-2xl overflow-hidden"
        >
          <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] px-5 py-4 sm:px-6">
            <div>
              <p className="eyebrow text-[var(--color-accent)]">Bank setup</p>
              <h1 id="bank-popup-title" className="mt-1 text-[28px] font-semibold leading-none text-[var(--color-text)] sm:text-[34px]">
                {openingSavedBank ? "Opening bank organizer" : "Add bank"}
              </h1>
              <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-[var(--color-text-dim)]">
                {openingSavedBank
                  ? "Loading your saved bank straight into RuneLite tab setup."
                  : "Paste once. Save. Better trips everywhere."}
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
          <div className="p-5 pb-24 sm:p-6">
          {openingSavedBank ? (
            <SavedBankOpeningState
              saved={savedBank as SavedBank}
              loading={pending}
              onReplace={() => {
                clearLastBankPaste();
                setSavedBank(null);
                setReplaceSavedBank(true);
              }}
            />
          ) : (
            <>
              <Intake
                key={sampleInput ?? (replaceSavedBank ? "replace-bank" : "fresh")}
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
            </>
          )}
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
            initialMode={modeFromUrl()}
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

function SavedBankOpeningState({
  saved,
  loading,
  onReplace
}: {
  saved: SavedBank;
  loading: boolean;
  onReplace: () => void;
}) {
  return (
    <div data-testid="saved-bank-auto-open" className="rounded-xl border border-[var(--color-accent)]/40 bg-black/20 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-[var(--color-accent)]/35 bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
          <Check className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-serif text-[23px] font-bold leading-tight text-[var(--color-text)]">
            Setting up your RuneLite tabs
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-[var(--color-text-dim)]">
            Saved bank from {describeSavedAt(saved.savedAt)} is opening in the organizer.
          </p>
        </div>
      </div>
      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-[12px] font-semibold text-[var(--color-text-muted)]">
          {loading ? "Loading bank grid..." : "Opening organizer..."}
        </span>
        <button
          type="button"
          onClick={onReplace}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-2 text-[12px] font-bold text-[var(--color-text)] transition-colors hover:border-[var(--color-accent)]/45"
        >
          <PencilLine className="size-4" />
          Paste different bank
        </button>
      </div>
    </div>
  );
}
