"use client";

import { Suspense, useState, useTransition, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Intro } from "@/components/intro";
import { Intake } from "@/components/intake";
import { BankResult } from "@/components/bank-result";
import { ToolHeader } from "@/components/tool-header";
import { SavedBankBanner } from "@/components/saved-bank-banner";
import { SAMPLE_BANKTAGS } from "@/lib/utils";
import { organizeAction } from "../actions";
import { inferArchetype, saveArchetype, type Archetype } from "@/lib/archetype";
import { fetchHiscores, computeCombatLevel, computeTotalLevel, type HiscoreSkill } from "@/lib/hiscores";
import { loadSavedBank, saveSavedBank, saveSavedRsn, type SavedBank } from "@/lib/saved-bank";
import type { OrganizeResult } from "@/lib/organizer";

type View = "intake" | "result";

// Next.js 16 refuses to statically prerender any component that calls
// useSearchParams() unless it sits inside a <Suspense> boundary — without
// one, the production build aborts at /bank with "useSearchParams() should
// be wrapped in a suspense boundary". So the default export is just a
// Suspense wrapper around the real page content.
export default function BankPage() {
  return (
    <Suspense fallback={<BankPageFallback />}>
      <BankPageContent />
    </Suspense>
  );
}

// Minimal placeholder while Suspense resolves the searchParams snapshot.
// Matches the page's <main> wrapper so layout doesn't jump.
function BankPageFallback() {
  return <main className="relative z-10 mx-auto max-w-6xl px-5 py-7 pb-20" />;
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
  // Welcome-back banner state. We populate this once on mount when a saved
  // bank is found, then the user either reuses it ("Use saved bank") or
  // dismisses it ("Start fresh" / "Don't save on this device"). Lives at
  // the page level because the banner needs to drive a programmatic submit.
  const [savedBank, setSavedBank] = useState<SavedBank | null>(null);
  // Drives the Intro step rail: 0 = reading instructions, 2 = a valid bank
  // is in the textarea (steps 1-2 done, on step 3). Lifted here so the
  // instructions and the live form move together.
  const [pasted, setPasted] = useState(false);
  const onPasteStateChange = useCallback((isPasted: boolean) => setPasted(isPasted), []);

  // Resolve archetype from RSN (if provided) via Hiscores, else "unspecified".
  const resolveArchetype = async (rsn: string): Promise<{ archetype: Archetype; rsn: string | null; skills: HiscoreSkill[] | null }> => {
    if (!rsn) return { archetype: "unspecified", rsn: null, skills: null };
    const hiscores = await fetchHiscores(rsn);
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
      setView("result");
      // Auto-save on a successful organize. The module respects the
      // session opt-out flag; if the user clicked "Don't save on this
      // device" earlier this session it's a no-op. We skip the sample
      // banktags — pinning the demo string as a "saved bank" would mean
      // every welcome-back banner shows the sample, which is misleading.
      if (input !== SAMPLE_BANKTAGS) {
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
  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams.get("sample") === "1" && view === "intake" && !pending) {
      onSample();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Welcome-back: look up a saved bank on mount. Skip when the URL is in
  // sample-mode (the sample-bank effect above will take precedence) — we
  // don't want to fight that flow with a banner that says "use your old
  // bank instead." Only the intake view shows the banner.
  useEffect(() => {
    if (searchParams.get("sample") === "1") return;
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
          view === "intake" ? (
            <button onClick={onSample} className="btn-ghost">
              <Sparkles className="size-3.5" /> Try sample
            </button>
          ) : null
        }
      />
      {view === "intake" && (
        <>
          {savedBank && (
            <SavedBankBanner
              saved={savedBank}
              loading={pending}
              onUse={() => onUseSavedBank(savedBank)}
              onDismiss={() => setSavedBank(null)}
            />
          )}
          <Intro flowStep={pasted ? 2 : 0} />
          <Intake
            key={sampleInput ?? "fresh"}
            onSubmit={onIntakeSubmit}
            loading={pending}
            error={error}
            askRsn
            onPasteStateChange={onPasteStateChange}
          />
        </>
      )}
      {view === "result" && result && (
        <BankResult
          initial={result}
          initialStrings={strings}
          onEditInput={() => setView("intake")}
          inferredArchetype={inferredArchetype}
          inferredRsn={inferredRsn}
          hiscoreSkills={hiscoreSkills}
        />
      )}
    </main>
  );
}
