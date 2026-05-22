"use client";

import { useState, useTransition, useCallback } from "react";
import { Sparkles } from "lucide-react";
import { Intro } from "@/components/intro";
import { Intake } from "@/components/intake";
import { BankResult } from "@/components/bank-result";
import { ToolHeader } from "@/components/tool-header";
import { SAMPLE_BANKTAGS } from "@/lib/utils";
import { organizeAction } from "../actions";
import { inferArchetype, saveArchetype, type Archetype } from "@/lib/archetype";
import { fetchHiscores, computeCombatLevel, computeTotalLevel, type HiscoreSkill } from "@/lib/hiscores";
import type { OrganizeResult } from "@/lib/organizer";

type View = "intake" | "result";

export default function BankPage() {
  const [view, setView] = useState<View>("intake");
  const [result, setResult] = useState<OrganizeResult | null>(null);
  const [strings, setStrings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [sampleInput, setSampleInput] = useState<string | null>(null);
  const [inferredArchetype, setInferredArchetype] = useState<Archetype | null>(null);
  const [inferredRsn, setInferredRsn] = useState<string | null>(null);
  const [hiscoreSkills, setHiscoreSkills] = useState<HiscoreSkill[] | null>(null);
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
    });
  };

  const onSample = () => {
    setSampleInput(SAMPLE_BANKTAGS);
    onIntakeSubmit(SAMPLE_BANKTAGS, false, "");
  };

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
