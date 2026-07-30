import { redirect } from "next/navigation";
import { HeroIntake } from "@/components/hero-intake";
import { playerPath } from "@/lib/player-route";
import { resolveViewerRsn } from "@/lib/viewer-account";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const viewerRsn = await resolveViewerRsn();
  if (viewerRsn) redirect(playerPath(viewerRsn));

  return (
    <main className="scape-page pb-16 pt-8 sm:px-8 sm:pt-12">
      <section className="home-hero mx-auto w-full min-w-0 max-w-[46rem]">
        <h1 className="max-w-[24ch] text-[30px] font-semibold leading-[1.04] text-[var(--color-text)] sm:text-[40px]">
          Stop bankstanding and pick the next trip.
        </h1>
        <p className="mt-3 max-w-[52ch] text-[15px] leading-[1.55] text-[var(--color-text-secondary)] sm:text-[16px]">
          Enter your OSRS name for one bank-aware answer and a clear stop point.
        </p>
        <div className="mt-5 min-w-0">
          <HeroIntake />
        </div>
      </section>
    </main>
  );
}
