import { ToolHeader } from "@/components/tool-header";
import { NextClient } from "./next-client";

export const metadata = {
  title: "What to do now",
  description: "Stuck in OSRS? Paste your bank and look up your stats — get a clear, ranked list of what's worth doing next, tuned to your account."
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

export default async function NextPage({
  searchParams
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const queryString = queryStringFromSearchParams(await (searchParams ?? Promise.resolve({})));

  return (
    <main className="relative z-10 mx-auto max-w-6xl px-5 py-7 pb-20">
      <ToolHeader slug="next" />
      <NextClient initialQueryString={queryString} />
    </main>
  );
}
