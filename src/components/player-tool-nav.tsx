import type { PlayerToolSection } from "@/lib/player-tool-route";

// Labels only. Each question used to appear here AND as the heading of the
// section it links to — "What can this bank finish?" was on screen twice,
// character for character. The anchors are load-bearing (/dps, /goals,
// /slayer and /bank?section= all redirect into them), the questions were not.
const SECTIONS: Array<{ id: PlayerToolSection; label: string }> = [
  { id: "bosses", label: "Bosses" },
  { id: "sets", label: "Sets" },
  { id: "task", label: "Task" },
  { id: "money", label: "Money" }
];

export function PlayerToolNav() {
  return (
    <nav aria-label="Questions about this bank" className="mb-2 mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-none border border-[var(--color-border)] bg-[var(--color-border)] sm:grid-cols-4">
      {SECTIONS.map((section) => (
        <a
          key={section.id}
          href={`#${section.id}`}
          className="min-w-0 bg-[var(--color-panel)] px-3 py-3 text-left transition-colors hover:bg-[var(--color-panel-2)]"
        >
          <span className="block text-[length:var(--text-body)] font-semibold text-[var(--color-text)]">{section.label}</span>
        </a>
      ))}
    </nav>
  );
}
