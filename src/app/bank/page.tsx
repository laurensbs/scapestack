"use client";

import Link from "next/link";
import { useState, useTransition, useCallback, useEffect } from "react";
import { ArrowRight, DatabaseZap, ShieldCheck, Sparkles } from "lucide-react";
import { Intro } from "@/components/intro";
import { Intake } from "@/components/intake";
import { BankResult } from "@/components/bank-result";
import { ToolHeader } from "@/components/tool-header";
import { SavedBankBanner } from "@/components/saved-bank-banner";
import { DropCelebration } from "@/components/drop-celebration";
import { BankPluginOnboarding } from "@/components/bank-plugin-onboarding";
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
  diffIconicItems,
  type SavedBank,
  type IconicItem
} from "@/lib/saved-bank";
import { persistBankHandoffPayload } from "@/lib/next-bank-handoff";
import { bankReturnContextFromSource, type BankReturnContext } from "@/lib/bank-return-context";
import { buildBankPluginIntakeBridge } from "@/lib/bank-plugin-intake-bridge";
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

function bankReturnContextFromUrl(): BankReturnContext | null {
  if (typeof window === "undefined") return null;
  return bankReturnContextFromSource(new URLSearchParams(window.location.search).get("from"));
}

function BankPageContent() {
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
  // Drives the Intro step rail: 0 = reading instructions, 2 = a valid bank
  // is in the textarea (steps 1-2 done, on step 3). Lifted here so the
  // instructions and the live form move together.
  const [pasted, setPasted] = useState(false);
  const [returnContext, setReturnContext] = useState<BankReturnContext | null>(null);
  const onPasteStateChange = useCallback((isPasted: boolean) => setPasted(isPasted), []);

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
        // Diff iconics *before* we overwrite the saved bank. Only fires
        // celebrations on the second+ paste; first visit returns [].
        const prev = loadSavedBank();
        if (prev?.banktags && prev.banktags !== input) {
          const fresh = diffIconicItems(prev.banktags, input);
          if (fresh.length > 0) setFreshIconics(fresh);
        }
        saveSavedBank(input);
        if (resolvedRsn) saveSavedRsn(resolvedRsn);
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
    setPrefilledRsn(rsnFromUrl());
    setReturnContext(bankReturnContextFromUrl());
  }, []);

  // Welcome-back: look up a saved bank on mount. Skip when the URL is in
  // sample-mode (the sample-bank effect above will take precedence) — we
  // don't want to fight that flow with a banner that says "use your old
  // bank instead." Only the intake view shows the banner.
  useEffect(() => {
    if (isSampleMode()) return;
    setSavedBank(loadSavedBank());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onUseSavedBank = useCallback((bank: SavedBank) => {
    setSavedBank(null);
    onIntakeSubmit(bank.banktags, false, "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="relative z-10 mx-auto max-w-6xl px-5 py-7 pb-20">
      <ToolHeader
        slug="bank"
        actions={
          view === "intake" && !savedBank ? (
            <button type="button" onClick={onSample} className="btn-ghost">
              <Sparkles className="size-3.5" /> Try sample
            </button>
          ) : null
        }
      />
      {view === "intake" && (
        <>
          <details className="mb-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)]/70 p-4">
            <summary className="flex items-center justify-between gap-3 text-[13px] font-bold text-[var(--color-text)]">
              <span>RuneLite can skip finished stuff later</span>
              <span className="text-[11px] font-semibold text-[var(--color-accent)]">Optional</span>
            </summary>
            <div className="mt-4">
              <BankPluginOnboarding />
            </div>
          </details>
          {returnContext && (
            <BankReturnContextBanner context={returnContext} rsn={prefilledRsn} />
          )}
          {returnContext?.source === "plugin" && (
            <PluginBankIntakeBridge rsn={prefilledRsn} />
          )}
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
          <Intro flowStep={pasted ? 2 : 0} />
          <Intake
            key={sampleInput ?? "fresh"}
            onSubmit={onIntakeSubmit}
            loading={pending}
            error={error}
            askRsn
            initialRsn={prefilledRsn}
            onPasteStateChange={onPasteStateChange}
          />
        </>
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
          />
          <details className="mt-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)]/55 p-3">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[13px] font-semibold text-[var(--color-text)] marker:hidden">
              <span>Planning context</span>
              <span className="text-[11px] font-medium text-[var(--color-text-muted)]">RSN and RuneLite can improve later</span>
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

function PluginBankIntakeBridge({ rsn }: { rsn: string }) {
  const bridge = buildBankPluginIntakeBridge(rsn);

  return (
    <section
      data-testid="plugin-bank-intake-bridge"
      className="mb-4 rounded-2xl border border-[var(--color-accent)]/25 bg-[var(--color-panel)]/80 px-4 py-3.5 shadow-[0_18px_50px_-36px_rgba(0,0,0,0.75)]"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-3">
          <span className="mt-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-[var(--color-accent)]/25 bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
            <DatabaseZap className="size-5" />
          </span>
          <div className="min-w-0">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-[var(--color-accent)]">
              {bridge.eyebrow}
            </div>
            <h2 className="mt-1 text-[16px] font-bold tracking-normal text-[var(--color-text)]">
              {bridge.title}
            </h2>
            <p className="mt-1 max-w-3xl text-[12.5px] leading-relaxed text-[var(--color-text-dim)]">
              {bridge.body}
            </p>
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              {bridge.signals.map((signal) => (
                <div
                  key={signal.label}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]/35 px-3 py-2"
                >
                  <div className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
                    {signal.label}
                  </div>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--color-text)]">
                    {signal.value}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-[var(--color-good)]/20 bg-[var(--color-good)]/8 px-2.5 py-1 text-[10.5px] font-semibold text-[var(--color-good)]">
              <ShieldCheck className="size-3.5" />
              {bridge.safety}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 lg:max-w-[230px]">
          {bridge.actions.map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className={[
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-bold transition-colors",
                action.primary
                  ? "border border-[var(--color-accent)]/35 bg-[var(--color-accent)]/12 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/18"
                  : "border border-[var(--color-border)] bg-[var(--color-bg)]/45 text-[var(--color-text)] hover:border-[var(--color-accent)]/45 hover:text-[var(--color-accent)]"
              ].join(" ")}
            >
              {action.label}
              <ArrowRight className="size-3.5" />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function BankReturnContextBanner({
  context,
  rsn
}: {
  context: BankReturnContext;
  rsn: string;
}) {
  return (
    <section
      data-testid="bank-return-context-banner"
      className="mb-4 rounded-xl border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/8 px-4 py-3"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-[var(--color-accent)]">
            {context.label}
          </div>
          <h2 className="mt-1 text-[14px] font-semibold text-[var(--color-text)]">
            {context.title}
          </h2>
          <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-[var(--color-text-dim)]">
            {context.body}
          </p>
        </div>
        {rsn.trim() && (
          <span className="inline-flex shrink-0 rounded-full border border-[var(--color-border)] bg-[var(--color-bg)]/45 px-2.5 py-1 text-[11px] font-semibold text-[var(--color-text-muted)]">
            RSN: <span className="ml-1 text-[var(--color-text)]">{rsn.trim()}</span>
          </span>
        )}
      </div>
    </section>
  );
}
