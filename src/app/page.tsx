import { HeroIntake } from "@/components/hero-intake";
import { HomeSpecimen } from "@/components/home-specimen";
import { BOSSES } from "@/lib/bosses";

// This page has no server data. Keeping it as one immutable deployment
// artifact prevents an ISR regeneration from rendering pathname-dependent
// client chrome differently from the client bundle during hydration.
export const dynamic = "force-static";

// Counted at build from the engine's own table so the claim cannot drift away
// from what the tool actually checks.
const BOSS_COUNT = BOSSES.length;

export default function HomePage() {
  return (
    <main className="scape-page pb-16 pt-8 sm:px-8 sm:pt-12">
      {/* Direction B: a reference document gets to the point. The masthead is
          a heading, one line and a rule — the specimen's own structure — and
          the intake is the next thing on the page, not the thing you scroll
          to. Three elements came out to get here and none went in: the
          full-viewport hero, the category eyebrow above a headline that already
          said the same thing, and the rotating boss illustration.

          The illustration is the one worth naming. It cycled five bosses on a
          3.6s interval, forever, on a page whose whole job is answering a
          question once — the same loop the token pass already removed from
          the headline shimmer. It was also the reason the layout needed a
          440px second column and a 100vh section. Direction B has no
          atmosphere to keep, so it went. */}
      <section className="home-hero mx-auto w-full min-w-0 max-w-[46rem]">
        <div className="home-hero-intro min-w-0 border-b border-[var(--color-border)] pb-5">
          <h1
            aria-label="Stop bankstanding. Pick the next trip."
            className="max-w-[20ch] break-words text-[30px] font-semibold leading-[1.04] text-[var(--color-text)] sm:text-[40px]"
          >
            {/* Opacity only, and it ends. WCAG 2.3.3 does not class an opacity
                change as motion animation, so this needs no reduced-motion
                substitute — and nothing here loops. */}
            <span
              className="block"
              style={{ animation: "hero-fade 220ms cubic-bezier(0.05,0.7,0.1,1) both" }}
            >
              Stop bankstanding.
            </span>
            <span
              className="block text-route-gradient"
              style={{ animation: "hero-fade 220ms cubic-bezier(0.05,0.7,0.1,1) 60ms both" }}
            >
              Pick the next trip.
            </span>
          </h1>

          <p
            className="mt-3 max-w-[52ch] text-[15px] leading-[1.55] text-[var(--color-text-secondary)] sm:text-[16px]"
            style={{ animation: "hero-fade 220ms cubic-bezier(0.05,0.7,0.1,1) 120ms both" }}
          >
            Type your OSRS name. Scapestack opens one clean trip and tells you when to stop.
          </p>
        </div>

        <div
          className="home-hero-intake mt-5 min-w-0"
          style={{ animation: "hero-fade 240ms cubic-bezier(0.05,0.7,0.1,1) 180ms both" }}
        >
          <HeroIntake />
        </div>

        {/* Direction B argues that the data is the design, so the homepage has
            to show data rather than describe it. Every number in this table is
            the real engine answering about the reference account Scapestack
            already ships behind "Try a sample plan", computed at build time.
            The account is named on the page so nobody reads it as their own. */}
        <HomeSpecimen />

        {/* The specimen's closing note: what the numbers are computed from and
            what they cannot see. The worn-gear clause is the same sentence the
            verdict engine puts under every boss — the plugin does not read worn
            equipment and, by a promise in both READMEs, will not. */}
        <p className="scape-table-note home-hero-basis mt-6 border-t border-[var(--color-border)] pt-4">
          {BOSS_COUNT} bosses, checked against the gear in your bank.{" "}
          Worn gear is not counted — Scapestack only sees your bank.
        </p>
      </section>
    </main>
  );
}
