"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BossRoster } from "@/components/boss-roster";
import { BankerDialog } from "@/components/rebrand/banker-dialog";
import { GoalRoster } from "@/components/goal-roster";
import { Intake } from "@/components/intake";
import { SlayerMasterReference } from "@/components/slayer-master-reference";
import { getActiveAccount } from "@/lib/account-storage";
import { playerToolSectionPath, type PlayerToolSection } from "@/lib/player-tool-route";
import { loadSavedRsn } from "@/lib/saved-bank";

/**
 * What each entry point is actually about.
 *
 * "Boss", "Task" and "Setup" in the nav all landed here, and `section` was
 * used only to decide where to route AFTER a paste — so the three labels
 * rendered byte-identical copy: "Bank setup / Add bank once". A visitor who
 * clicked Boss got a paste field and no bosses.
 *
 * Each section now says what it answers and shows the roster that answers it.
 * The roster components already existed and were written for exactly this
 * ("The always-visible boss roster on /dps"); they were orphaned when the
 * tool pages became redirects, and have rendered on no page since.
 */
const SECTION_COPY: Record<PlayerToolSection, { eyebrow: string; title: string; blurb: string }> = {
  bosses: {
    eyebrow: "Bosses",
    title: "Can I kill this?",
    blurb: "Every boss with what the game requires to get in. Add your bank and the requirements become a verdict about your account."
  },
  task: {
    eyebrow: "Slayer",
    title: "Is this task worth it?",
    blurb: "Every master and what they hand out. Add your bank and Scapestack answers for the task you actually have."
  },
  sets: {
    eyebrow: "Sets",
    title: "What can this bank finish?",
    blurb: "The gear sets worth completing and what each one unlocks. Add your bank and the missing pieces get named."
  },
  money: {
    eyebrow: "Money",
    title: "What pays for my account?",
    blurb: "Add your bank and your name, and the routes get ranked by what you can actually run."
  }
};

function SectionRoster({ section }: { section: PlayerToolSection }) {
  // interactive={false}: every tile links to /dps?boss=<slug>, and /dps reads
  // only `rsn`. It drops the slug and redirects an anonymous visitor back to
  // this exact page — a round trip that changes nothing except losing their
  // scroll position in a 59-row grid.
  if (section === "bosses") return <BossRoster interactive={false} />;
  if (section === "task") return <SlayerMasterReference />;
  if (section === "sets") return <GoalRoster />;
  return null;
}

export function BankIntakeOnly({
  section,
  requested = true
}: {
  section: PlayerToolSection;
  /**
   * Whether the visitor actually asked for a section.
   *
   * sectionFromBankQuery defaults to "sets" so a paste always has somewhere to
   * land, which is right for routing and wrong for copy — bare /bank is the
   * nav's "Setup" and it started rendering "What can this bank finish?".
   */
  requested?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const knownRsn = getActiveAccount()?.rsn || loadSavedRsn() || "";
    if (knownRsn.trim()) router.replace(playerToolSectionPath(knownRsn, section));
  }, [router, section]);

  const openPlayerPage = (_input: string, _junkFilter: boolean, rsn: string) => {
    const cleanRsn = rsn.trim().slice(0, 12);
    if (!cleanRsn) {
      setError("Add your OSRS name so this bank has one player page.");
      return;
    }
    setError(null);
    startTransition(() => router.push(playerToolSectionPath(cleanRsn, section)));
  };

  // Bare /bank is bank setup, which is what its nav label says.
  const copy = requested
    ? SECTION_COPY[section]
    : {
        eyebrow: "Bank setup",
        title: "Add bank once",
        blurb: "Add your name and paste your bank from RuneLite. The answer opens on that player page."
      };

  return (
    <main className="scape-page max-w-3xl" data-bank-section={section}>
      <section aria-labelledby="bank-intake-title" className="scape-dialog mx-auto overflow-hidden">
        <div className="border-b border-[var(--color-border)] px-5 py-4 sm:px-6">
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1 id="bank-intake-title" className="mt-1 text-[28px] font-semibold leading-none text-[var(--color-text)] sm:text-[34px]">
            {copy.title}
          </h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-[var(--color-text-dim)]">
            {copy.blurb}
          </p>
        </div>
        <div className="p-5 sm:p-6">
          {/* REBRAND.md 5.4 / 6.3. The paste field stays — pasting is what the
              player actually does, and swapping a working control for a
              costume is the "renamed tool" failure wearing the other hat. What
              changes is the frame: a speaker, a name plate and one line of
              speech, which is a better container for "here is what I need from
              you" than a form legend.

              The privacy line is inside it and verbatim (§9.3). */}
          <BankerDialog
            speaker="Banker"
            says="Show me what you are carrying and I will tell you what it finishes."
            footnote="Saved on this device only. For automatic bank updates, use the RuneLite sync from your player page."
          >
            <Intake
              onSubmit={openPlayerPage}
              onSaveOnly={(input, rsn) => openPlayerPage(input, false, rsn)}
              loading={pending}
              error={error}
              askRsn
              compactSave
              saveLabel="Open player page"
            />
          </BankerDialog>
          <Link href="/" className="mt-4 inline-flex min-h-11 items-center text-[12px] font-semibold text-[var(--color-accent)] hover:underline">
            Back
          </Link>
        </div>
      </section>

      {/* The content the label promised, before the paste rather than after
          it. A page about bosses with no bosses on it is the "dashboardy and
          empty" complaint in its purest form. */}
      {requested && (
        <div className="mt-8" data-section-roster={section}>
          <SectionRoster section={section} />
        </div>
      )}
    </main>
  );
}
