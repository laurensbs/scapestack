import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatGpExact } from "@/lib/bank-affordability";
import { loadPublicBankShare } from "./data";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ shareId: string }>;
}

const privateRobots: Metadata["robots"] = {
  index: false,
  follow: false,
  googleBot: { index: false, follow: false }
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { shareId } = await params;
  const share = await loadPublicBankShare(shareId);
  if (!share) return { title: "Private bank image · Scapestack", robots: privateRobots };
  const title = `What ${share.snapshot.displayName}'s bank can finish`;
  return {
    title,
    description: `${share.snapshot.rows.length} priced OSRS sets, missing pieces, exact cost and verdict.`,
    robots: privateRobots,
    openGraph: {
      title,
      description: `${formatGpExact(share.snapshot.gp)} banked. Real Grand Exchange prices captured for this image.`,
      images: [{
        url: `/share/bank/${shareId}/opengraph-image`,
        width: 1200,
        height: 630,
        alt: title
      }]
    }
  };
}

export default async function PublicBankSharePage({ params }: Props) {
  const { shareId } = await params;
  const share = await loadPublicBankShare(shareId);
  if (!share) notFound();
  const { snapshot } = share;

  return (
    <main className="scape-page max-w-4xl" data-public-bank-share="true">
      <header className="border-b border-[var(--color-border)] pb-5">
        <p className="eyebrow">Shared bank answer</p>
        <h1 className="mt-1 text-3xl font-semibold text-[var(--color-text)] sm:text-5xl">
          What {snapshot.displayName}&apos;s bank can finish
        </h1>
        <p className="mt-3 text-[14px] text-[var(--color-text-dim)]">
          <span className="font-semibold tabular-nums text-[var(--color-text)]">{formatGpExact(snapshot.gp)}</span> banked.
          Prices were frozen for this image on {new Date(snapshot.pricedAt).toLocaleDateString("en-GB")}.
        </p>
      </header>

      <div className="scape-table-wrap mt-6">
        <table className="scape-table" aria-label="Sets this bank can finish">
          <thead>
            <tr>
              <th scope="col">Set</th>
              <th scope="col">Missing</th>
              <th scope="col" data-num>Cost</th>
              <th scope="col">Verdict</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.rows.map((row) => (
              <tr key={`${row.setName}:${row.owned}:${row.total}`}>
                <th scope="row">
                  {row.setName} <span className="font-normal text-[var(--color-text-muted)]">{row.owned}/{row.total}</span>
                </th>
                <td>{row.missing.join(", ")}</td>
                <td data-num>{formatGpExact(row.cost)}</td>
                <td><span className="scape-verdict" data-gate={row.gate}>{row.verdict}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="scape-table-note mt-3">
        Live Grand Exchange prices, insta-buy side, frozen when the owner created this image. This page contains the answer above, not the raw bank.
      </p>
      <Link href="/" className="btn-ghost mt-7 inline-flex min-h-11 px-4 text-[12.5px] font-bold">
        Check another player
      </Link>
    </main>
  );
}
