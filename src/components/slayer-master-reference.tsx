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
      <h2 className="font-[family-name:var(--font-display)] text-[19px] font-bold tracking-normal text-[var(--color-text)]">
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
            <li key={id}>
              {/* REBRAND.md 5.4 / 6.5: an NPC plaque, not a card. The name is
                  a carved name plate on wood; the plaque itself is raised
                  stone. The task range is a Ratio and not a Numeral — Pixelify
                  renders "50–100" with a 5 that reads as an S (§10.2). */}
              <div
                data-master-plaque={id}
                className="h-full border-2 border-[var(--wood-700)] bg-[var(--stone-700)]"
                style={{
                  borderRadius: "var(--radius-md)",
                  boxShadow: "inset 1px 1px 0 var(--bevel-light), inset -1px -1px 0 var(--bevel-dark)"
                }}
              >
                <div
                  className="flex items-baseline justify-between gap-2 border-b border-[var(--stone-900)] bg-[var(--wood-500)] px-3 py-1.5"
                  style={{ boxShadow: "inset 0 1px 0 var(--bevel-light)" }}
                >
                  <span className="truncate font-[family-name:var(--font-display)] text-[length:var(--text-body)] font-bold text-[var(--gold-300)]">
                    {master.name}
                  </span>
                  <span className="shrink-0 text-[length:var(--text-label)] text-[var(--stone-text-muted)]">
                    {master.location}
                  </span>
                </div>
                <div className="px-3 py-2.5">
                  <p className="text-[length:var(--text-micro)] text-[var(--stone-text-muted)]">
                    {requirementLine(
                      master.combatRequirement,
                      master.slayerRequirement,
                      master.questRequirements
                    )}
                  </p>
                  <p className="mt-1 text-[length:var(--text-micro)] text-[var(--stone-text-muted)]">
                    Tasks of{" "}
                    <span style={{ fontVariantNumeric: "tabular-nums lining-nums" }} className="font-medium text-[var(--stone-text)]">
                      {master.taskQuantity.min}–{master.taskQuantity.max}
                    </span>
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
