import { Suspense } from "react";
import { loadPlanningContext } from "@/lib/planning-context";
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
  rsn
}: {
  queryString: string;
  rsn: string;
}) {
  const initialPlanningContext = rsn
    ? await loadPlanningContext(rsn).catch(() => null)
    : null;

  return (
    <NextClient
      initialQueryString={queryString}
      initialPlanningContext={initialPlanningContext}
    />
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
        <p className="eyebrow text-[var(--color-accent)]">Checking your account</p>
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

  return (
    <main className="scape-page">
      <Suspense key={queryString} fallback={<NextPlanLoadingShell />}>
        <NextPlanBootstrap queryString={queryString} rsn={rsn} />
      </Suspense>
    </main>
  );
}
