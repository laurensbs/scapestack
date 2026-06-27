import { ToolHeader } from "@/components/tool-header";
import { NextClient } from "./next-client";

export const metadata = {
  title: "What should I do next in OSRS?",
  description: "Enter your OSRS name and get one clear next move, two backups, and optional bank or RuneLite context."
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
