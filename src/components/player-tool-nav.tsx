import type { PlayerToolSection } from "@/lib/player-tool-route";

const SECTIONS: Array<{ id: PlayerToolSection; label: string; question: string }> = [
  { id: "bosses", label: "Bosses", question: "What can this bank kill?" },
  { id: "sets", label: "Sets", question: "What can this bank finish?" },
  { id: "task", label: "Task", question: "What is the current task?" },
  { id: "money", label: "Money", question: "What can this bank start?" }
];

export function PlayerToolNav() {
  return (
    <nav aria-label="Questions about this bank" className="mb-2 mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-border)] sm:grid-cols-4">
      {SECTIONS.map((section) => (
        <a
          key={section.id}
          href={`#${section.id}`}
          className="min-w-0 bg-[var(--color-panel)] px-3 py-3 text-left transition-colors hover:bg-[var(--color-panel-2)]"
        >
          <span className="block text-[length:var(--text-body)] font-semibold text-[var(--color-text)]">{section.label}</span>
          <span className="mt-1 block text-[length:var(--text-micro)] font-normal leading-snug text-[var(--color-text-muted)]">{section.question}</span>
        </a>
      ))}
    </nav>
  );
}
