import { Suspense } from "react";
import { updatesSince } from "@/lib/game-updates";
import { loadPlanningContext } from "@/lib/planning-context";
import { LastTripLine } from "@/components/last-trip-line";
import { classifyAbsence, isReturningAbsence, latestActivity } from "@/lib/returning-player";
import { resolveViewerRsn } from "@/lib/viewer-account";
import { ReturningBriefing } from "@/components/returning-briefing";
import { NextClient } from "./next-client";

export const metadata = {
  title: "What should I do next in OSRS?",
  description: "Enter your OSRS name and get one clean next trip with bank and RuneLite context when it matters."
};

type SearchParams = Record<string, string | string[] | undefined>;

function queryStringFromSearchParams(searchParams: SearchParams): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, item);
    } else if (value !== undefined) {
      params.set(key, value);
    }
  }
  return params.toString();
}

async function NextPlanBootstrap({
  queryString,
  rsn,
  preferScapestack
}: {
  queryString: string;
  rsn: string;
  preferScapestack: boolean;
}) {
  // /next is a public URL, so the snapshot in the RSC payload is redacted
  // unless this browser is paired to the account being looked up.
  const viewerRsn = rsn ? await resolveViewerRsn() : null;
  const initialPlanningContext = rsn
    ? await loadPlanningContext(rsn, { preferScapestack, viewerRsn }).catch(() => null)
    : null;

  // Answered here rather than inside NextClient, because it is a different
  // question from "what next" and needs no browser state at all. Rendering it
  // in this Server Component keeps it in the streamed HTML.
  // The freshest of the two signals, never WOM alone: a plugin snapshot proves
  // the client was open, and a WOM record nobody updates does not prove the
  // opposite. See latestActivity in returning-player.ts.
  const absence = classifyAbsence(latestActivity(
    initialPlanningContext?.wom?.lastChangedAt,
    initialPlanningContext?.scapestackSync?.syncedAt
  ));
  const completedQuestNames = initialPlanningContext?.scapestackSync?.questsCompleted;
  const updates = isReturningAbsence(absence.band)
    ? updatesSince(absence.since, {
        completedQuestNames: completedQuestNames?.length
          ? new Set(completedQuestNames)
          : undefined
      })
    : null;

  return (
    <>
      {updates && (
        <ReturningBriefing
          absence={absence}
          updates={updates}
          displayName={initialPlanningContext?.wom?.displayName}
        />
      )}
      <LastTripLine outcome={initialPlanningContext?.lastTripOutcome ?? null} />
      <NextClient
        initialQueryString={queryString}
        initialPlanningContext={initialPlanningContext}
      />
    </>
  );
}

function NextPlanLoadingShell() {
  return (
    <section
      className="mx-auto flex min-h-[52vh] max-w-3xl items-center justify-center px-4 text-center"
      aria-label="Picking your next trip"
      aria-live="polite"
    >
      <div>
        <p className="eyebrow">Checking your account</p>
        <h1 className="mt-3 text-[30px] font-semibold leading-tight text-[var(--color-text)] sm:text-[42px]">
          Picking your next trip...
        </h1>
      </div>
    </section>
  );
}

export default async function NextPage({
  searchParams
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearchParams: SearchParams = await (
    searchParams ?? Promise.resolve({} as SearchParams)
  );
  const queryString = queryStringFromSearchParams(resolvedSearchParams);
  const rsnValue = resolvedSearchParams.rsn;
  const rsn = (Array.isArray(rsnValue) ? rsnValue[0] : rsnValue)?.trim().slice(0, 12) ?? "";
  const sourceValue = resolvedSearchParams.source;
  const fromValue = resolvedSearchParams.from;
  const source = (Array.isArray(sourceValue) ? sourceValue[0] : sourceValue)?.trim().toLowerCase();
  const from = (Array.isArray(fromValue) ? fromValue[0] : fromValue)?.trim().toLowerCase();
  const preferScapestack = source === "plugin-sync" || from === "plugin";

  return (
    <main className="scape-page">
      <Suspense key={queryString} fallback={<NextPlanLoadingShell />}>
        <NextPlanBootstrap
          queryString={queryString}
          rsn={rsn}
          preferScapestack={preferScapestack}
        />
      </Suspense>
    </main>
  );
}
