import type { Metadata } from "next";
import Image from "next/image";
import { AdventureBrief } from "@/components/rebrand/adventure-brief";
import { BankerDialog } from "@/components/rebrand/banker-dialog";
import { Bestiary, type BestiaryEntry } from "@/components/rebrand/bestiary";
import { RecapNumber, ScrollRecap } from "@/components/rebrand/scroll-recap";
import { SkillShowcase, type ShowcaseSkill } from "@/components/rebrand/skill-showcase";
import { Numeral, ParchmentNote, Ratio, StonePanel } from "@/components/rebrand/stone";

/**
 * The component library, on one page, with nothing wired to real data.
 *
 * This exists because the failure mode it guards against is specific and this
 * repo has already had it: a design system that lives only inside the pages
 * that use it drifts, because nobody ever sees the pieces side by side and a
 * second slightly-different panel looks fine in isolation.
 *
 * Every block below renders twice — once wide, once in a 380px column — so a
 * component that only works at one width cannot pass review. That is not
 * decoration: the chosen direction was picked BECAUSE its signature element
 * gets stronger at phone width, and a styleguide that only shows the wide case
 * would never have caught the boss being clipped out of the mobile hero.
 *
 * Deliberately not in the sitemap and not linked from the product. It is a
 * workbench, like /dev/layout.
 */

export const metadata: Metadata = {
  title: "Style guide",
  // A workbench is not a landing page. Keeping it out of the index means the
  // sitemap stays a list of pages a player would want.
  robots: { index: false, follow: false }
};

const SKILLS: ShowcaseSkill[] = [
  { name: "Attack", level: 90 },
  { name: "Strength", level: 90 },
  { name: "Defence", level: 80 },
  { name: "Ranged", level: 92 },
  { name: "Magic", level: 85 },
  { name: "Slayer", level: 93, levelledUp: true },
  { name: "Herblore", level: 78 },
  { name: "Farming", level: 75 },
  { name: "Construction", level: 75 }
];

function skillSprite(name: string) {
  return (
    <Image
      src={`/api/sprite/stat/${name.toLowerCase()}`}
      alt=""
      aria-hidden="true"
      width={20}
      height={20}
      className="pixelated"
      unoptimized
    />
  );
}

function bossSprite(slug: string) {
  return (
    <Image
      src={`/api/sprite/boss/${slug}`}
      alt=""
      aria-hidden="true"
      width={32}
      height={32}
      className="pixelated object-contain"
      unoptimized
    />
  );
}

/**
 * Every slug here has a REAL render.
 *
 * The first draft used Obor, Bryophyta and The Whisperer, and their frames
 * came out empty: /api/sprite/boss returns a deliberate 68-byte transparent
 * 1x1 PNG for a boss it has no art for, which keeps next/image on one code
 * path. Sample data that silently shows the fallback is a styleguide lying
 * about what the component does — the whole reason this page exists is to
 * judge the pieces, and three of seven rows would have been judged empty.
 */
const BOSSES: BestiaryEntry[] = [
  { slug: "general-graardor", name: "General Graardor", requirement: "Combat 70+", band: "in-reach", sprite: bossSprite("general-graardor") },
  { slug: "zulrah", name: "Zulrah", requirement: "Regicide", band: "in-reach", sprite: bossSprite("zulrah") },
  { slug: "vorkath", name: "Vorkath", requirement: "Dragon Slayer II", band: "almost", sprite: bossSprite("vorkath") },
  { slug: "vardorvis", name: "Vardorvis", requirement: "Desert Treasure II", band: "almost", sprite: bossSprite("vardorvis") },
  { slug: "nex", name: "Nex", requirement: "Combat 120+", band: "a-dream", sprite: bossSprite("nex") }
];

/** One component, rendered wide and then narrow. */
function Specimen({ name, note, children }: { name: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="mt-12 first:mt-0" data-specimen={name}>
      <h2 className="font-[family-name:var(--font-display)] text-[length:var(--text-answer)] font-semibold leading-tight text-[var(--stone-text)]">
        {name}
      </h2>
      {note && (
        <p className="mt-1 max-w-[62ch] text-[length:var(--text-micro)] font-normal text-[var(--stone-text-muted)]">
          {note}
        </p>
      )}

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div data-specimen-width="wide">
          <p className="mb-1.5 text-[length:var(--text-label)] font-normal uppercase tracking-[0.18em] text-[var(--stone-text-muted)]">
            Wide
          </p>
          {children}
        </div>
        <div data-specimen-width="narrow">
          <p className="mb-1.5 text-[length:var(--text-label)] font-normal uppercase tracking-[0.18em] text-[var(--stone-text-muted)]">
            380px
          </p>
          {children}
        </div>
      </div>
    </section>
  );
}

export default function StyleguidePage() {
  return (
    <main className="scape-page pb-24 pt-8 sm:px-8 sm:pt-12">
      <header className="border-b border-[var(--stone-800)] pb-6">
        <p className="eyebrow">Workbench</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-[length:var(--text-page)] font-semibold leading-[1.06] text-[var(--stone-text)]">
          The parts, laid out
        </h1>
        <p className="mt-3 max-w-[62ch] text-[length:var(--text-body)] font-normal leading-relaxed text-[var(--stone-text-muted)]">
          Every component with sample data, each one wide and again at 380px. Nothing here is wired to an account —
          the numbers are invented so the pieces can be judged as pieces.
        </p>
      </header>

      <Specimen
        name="StonePanel"
        note="The base container. Studded title bar, carved edge, optional tally footer. Everything that is not prose sits on one of these."
      >
        <StonePanel title="Your kit" footer={<>Slots used <Ratio>28</Ratio> of <Ratio>28</Ratio></>}>
          <p className="text-[length:var(--text-body)] font-normal text-[var(--stone-text-muted)]">
            A panel holds anything. Depth is a hard bevel — a lit top-left edge and a dark bottom-right one — never a blur.
          </p>
        </StonePanel>
      </Specimen>

      <Specimen
        name="ParchmentNote"
        note="The reading surface, rationed. Prose a player acts on goes here; everything else stays on stone. The warning variant marks the binding edge rather than bolting a coloured strip to a card."
      >
        <div className="space-y-3">
          <ParchmentNote>
            Bring an antifire and one Saradomin brew. Vorkath’s first phase is the only part that punishes a mistake.
          </ParchmentNote>
          <ParchmentNote variant="warning">
            Worn gear is not counted. Scapestack only sees your bank, so anything equipped when you exported is invisible to it.
          </ParchmentNote>
        </div>
      </Specimen>

      <Specimen
        name="BankerDialog"
        note="Replaces the paste form's framing. The field stays — pasting is what a player actually does — but a speaker, a name plate and one line of speech carry the ask better than a form legend."
      >
        <BankerDialog
          speaker="Banker"
          says="Show me what you are carrying and I will tell you what it finishes."
          footnote="Saved on this device only."
        >
          <div
            className="flex h-24 items-center justify-center border border-[var(--parchment-300)] bg-[var(--parchment-200)] px-3 text-[length:var(--text-micro)] font-normal italic text-[var(--ink-500)]"
            style={{ borderRadius: "var(--radius-sm)" }}
          >
            (the paste field goes here — not wired on this page)
          </div>
        </BankerDialog>
      </Specimen>

      <Specimen
        name="AdventureBrief"
        note="Replaces the Start / Stop-at table. The same two facts told as an errand rather than a spreadsheet row, because a trip is an errand."
      >
        <AdventureBrief
          title="Push Vardorvis to 50 KC"
          why="Vardorvis is already at 15 KC, and this fits an unlock-shaped hour."
          setOff="Check Vardorvis and lock the Blazing blowpipe."
          comeHome="After 10–25 kills, without changing the goal mid-session."
          footnote="Free. Your bank stays in this browser."
        />
      </Specimen>

      <Specimen
        name="Bestiary"
        note="Grouped, never flat. Told nothing about the player the groups describe the game's own gates; given a combat level the same three groups describe the player, and only then is a verdict shown."
      >
        <div className="space-y-6">
          <Bestiary entries={BOSSES} title="Bestiary · nobody known" />
          <Bestiary entries={BOSSES} combatLevel={112} title="Bestiary · combat 112" />
        </div>
      </Specimen>

      <Specimen
        name="ScrollRecap"
        note="The Sunday recap as it appears on the site. The bar is drawn in CSS, floored, so a full bar always means done."
      >
        <ScrollRecap
          rsn="lauky"
          lines={[
            { label: "XP", value: <RecapNumber>+1.2M</RecapNumber> },
            { label: "Slayer", value: <RecapNumber>93</RecapNumber> },
            { label: "Zulrah", value: <RecapNumber>+12</RecapNumber> },
            { label: "Collection log", value: <RecapNumber>+3</RecapNumber> }
          ]}
          goal={{ target: "99 Slayer", percent: 82, remainder: "1.2M XP" }}
        />
      </Specimen>

      <Specimen
        name="SkillShowcase"
        note="The one place Pixelify Sans earns its keep: a level is a single labelled quantity with no ratio to misread. Hover turns the number the game's own yellow; a fresh level flashes green."
      >
        <SkillShowcase
          skills={SKILLS.map((skill) => ({ ...skill, sprite: skillSprite(skill.name) }))}
          total={1687}
          title="Skills"
        />
      </Specimen>

      <Specimen
        name="Numeral and Ratio"
        note="Two number styles with one rule between them. A single labelled quantity may be Pixelify; every ratio, fraction, drop rate and price is Fraunces with tabular lining figures, because Pixelify renders 5 as an S and 7 as a bare stem."
      >
        <StonePanel title="Numbers">
          <dl className="space-y-2 text-[length:var(--text-body)]">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-[var(--stone-text-muted)]">Slayer level</dt>
              <dd><Numeral>93</Numeral></dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-[var(--stone-text-muted)]">Zulrah KC</dt>
              <dd><Numeral>812</Numeral></dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-[var(--stone-text-muted)]">Tanzanite fang drop rate</dt>
              <dd className="text-[var(--stone-text)]"><Ratio>1/1,024</Ratio></dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-[var(--stone-text-muted)]">Slayer task progress</dt>
              <dd className="text-[var(--stone-text)]"><Ratio>68/70</Ratio></dd>
            </div>
          </dl>
        </StonePanel>
      </Specimen>
    </main>
  );
}
