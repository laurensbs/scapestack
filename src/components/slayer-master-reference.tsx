"use client";

// The Slayer master reference, shown before the player has told us anything.
//
// /slayer used to answer before it was asked. Its combat and Slayer levels
// default to 3 and 1, those defaults were fed straight into rankMasters, and
// the page stated "Turael is the strongest available master from the levels
// and quests currently known" to a visitor who had entered nothing.
//
// On a product whose whole claim is "we know your account", asserting a
// conclusion from placeholder values is the worst possible first impression —
// and it lands on the one route that answers a question players ask several
// times a session.
//
// So: no verdict without input. What the game requires is real, useful and
// true for everyone, so show that instead and let the account turn it into a
// recommendation.

import { MASTERS } from "@/lib/slayer/masters";

const ORDER = ["turael", "mazchna", "vannaka", "chaeldar", "duradel"] as const;

/** Quest ids in the master data are slugs; these are the player-facing names. */
const QUEST_LABEL: Record<string, string> = {
  priest_in_peril: "Priest in Peril",
  lost_city: "Lost City",
  shilo_village: "Shilo Village"
};

function requirementLine(combat: number, slayer: number, quests: string[]): string {
  const parts: string[] = [];
  if (combat > 0) parts.push(`Combat ${combat}`);
  if (slayer > 0) parts.push(`Slayer ${slayer}`);
  for (const quest of quests) parts.push(QUEST_LABEL[quest] ?? quest);
  return parts.length > 0 ? parts.join(" · ") : "No requirements";
}

export function SlayerMasterReference() {
  return (
    <section className="mt-6">
      <h2 className="text-[19px] font-bold tracking-normal text-[var(--color-text)]">
        Slayer masters
      </h2>
      <p className="mt-0.5 text-[13px] text-[var(--color-text-dim)]">
        What each one needs. Add your name and Scapestack picks the one worth using.
      </p>

      <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {ORDER.map((id) => {
          const master = MASTERS[id];
          if (!master) return null;
          return (
            <li
              key={id}
              className="rounded-xl border border-[var(--color-accent)]/15 bg-[var(--color-bg)]/40 px-3.5 py-3"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[14px] font-semibold text-[var(--color-text)]">
                  {master.name}
                </span>
                <span className="shrink-0 text-[11.5px] text-[var(--color-text-dim)]">
                  {master.location}
                </span>
              </div>
              <p className="mt-1 text-[12px] text-[var(--color-text-dim)]">
                {requirementLine(
                  master.combatRequirement,
                  master.slayerRequirement,
                  master.questRequirements
                )}
              </p>
              <p className="mt-0.5 text-[12px] text-[var(--color-text-dim)]">
                Tasks of {master.taskQuantity.min}–{master.taskQuantity.max}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
