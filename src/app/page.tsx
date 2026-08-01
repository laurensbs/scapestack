import { redirect } from "next/navigation";
import { HeroIntake } from "@/components/hero-intake";
import { buildHomepageProof } from "@/lib/homepage-proof";
import { playerPath } from "@/lib/player-route";
import { resolveViewerRsn } from "@/lib/viewer-account";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const viewerRsn = await resolveViewerRsn();
  if (viewerRsn) redirect(playerPath(viewerRsn));
  const proof = buildHomepageProof();

  return (
    <main data-home-page="true" className="scape-page pb-2 pt-2 sm:px-8 sm:pb-10 sm:pt-10">
      <section className="home-hero mx-auto w-full min-w-0 max-w-[52rem]">
        <div className="min-w-0 max-w-[36rem]">
          <h1 className="max-w-[20ch] text-[length:var(--text-page)] font-extrabold! leading-[1.04] text-[var(--color-text)]">
            Your OSRS companion.
          </h1>
          <p className="mt-3 max-w-[52ch] text-[length:var(--text-body)] font-normal leading-relaxed text-[var(--color-text-secondary)]">
            Scapestack remembers what you are working toward and tells you the next step.
          </p>
          <div className="mt-4 min-w-0">
            <HeroIntake />
          </div>
        </div>

        <ul
          aria-label="What Scapestack checks"
          className="mt-3 grid grid-cols-3 border-y border-[var(--color-border)] py-3 text-center sm:mt-6 sm:py-4"
        >
          <li className="border-r border-[var(--color-border)] px-2">
            <strong className="block tabular-nums text-[length:var(--text-subject)] font-semibold text-[var(--color-data-level)]">{proof.bossesChecked}</strong>
            <span className="text-[length:var(--text-micro)] font-semibold text-[var(--color-text-muted)]">bosses checked</span>
          </li>
          <li className="border-r border-[var(--color-border)] px-2">
            <strong className="block tabular-nums text-[length:var(--text-subject)] font-semibold text-[var(--color-data-combat)]">{proof.questsTracked}</strong>
            <span className="text-[length:var(--text-micro)] font-semibold text-[var(--color-text-muted)]">quests tracked</span>
          </li>
          <li className="px-2">
            <strong className="block tabular-nums text-[length:var(--text-subject)] font-semibold text-[var(--color-data-xp)]">{proof.itemsPriced.toLocaleString("en-GB")}</strong>
            <span className="text-[length:var(--text-micro)] font-semibold text-[var(--color-text-muted)]">items priced</span>
          </li>
        </ul>
      </section>
    </main>
  );
}
