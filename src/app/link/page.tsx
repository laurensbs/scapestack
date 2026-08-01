import type { Metadata } from "next";
import Link from "next/link";
import { LinkAccountForm } from "@/components/link-account-form";
import { normalizePairingCode } from "@/lib/account-pairing";

export const metadata: Metadata = {
  title: "Connect RuneLite",
  description: "Connect this browser to the OSRS account open in RuneLite.",
  robots: { index: false, follow: false },
  referrer: "no-referrer"
};

type SearchParams = Record<string, string | string[] | undefined>;

function firstSearchParam(searchParams: SearchParams, key: string): string {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function LinkPage({
  searchParams
}: {
  searchParams: Promise<SearchParams>;
}) {
  const query = await searchParams;
  const code = normalizePairingCode(firstSearchParam(query, "code"));

  return (
    <main className="scape-page scape-page--reading pb-28 pt-10 sm:px-8 sm:pt-16">
      <section className="mx-auto max-w-lg border-y border-[var(--color-border-strong)] py-6" aria-labelledby="link-account-title">
        <p className="eyebrow">RuneLite connection</p>
        <h1 id="link-account-title" className="mt-2 font-serif text-[36px] font-bold leading-tight text-[var(--color-text)] sm:text-[48px]">
          Connect this browser.
        </h1>
        <p className="mt-4 text-[14px] font-semibold leading-relaxed text-[var(--color-text-dim)]">
          RuneLite opened this link for the account you are playing. Approve it here to unlock that account&apos;s private Scapestack page.
        </p>
        <LinkAccountForm code={code} />
        <p className="mt-5 border-t border-[var(--color-border)] pt-4 text-[12px] leading-relaxed text-[var(--color-text-muted)]">
          Browser blocked? Use <strong className="text-[var(--color-text)]">Connect this browser</strong> in the account menu, then type that code into the plugin.
        </p>
        <Link href="/plugin" className="mt-3 inline-flex min-h-11 items-center text-[12px] font-bold text-[var(--color-accent)] hover:underline">
          How the plugin works
        </Link>
      </section>
    </main>
  );
}
