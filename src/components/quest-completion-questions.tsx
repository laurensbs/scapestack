import type { QuestCompletionQuestion } from "@/lib/next-up";

export function QuestCompletionQuestions({
  questions,
  pending,
  onAnswer
}: {
  questions: QuestCompletionQuestion[];
  pending: boolean;
  onAnswer: (quest: string, completed: boolean) => void;
}) {
  return (
    <section aria-labelledby="quest-check-title" className="border-y border-[var(--color-border-strong)] py-4">
      <h2 id="quest-check-title" className="text-[length:var(--text-subject)] font-semibold text-[var(--color-text)]">
        Check finished quests
      </h2>
      <p className="mt-1 max-w-[65ch] text-[length:var(--text-micro)] font-normal leading-relaxed text-[var(--color-text-muted)]">
        Hiscores do not show quest completion. Answer these before a quest can become your next action.
      </p>
      <div className="mt-3 divide-y divide-[var(--color-border)]">
        {questions.slice(0, 3).map((question) => (
          <div key={question.quest} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
            <p className="min-w-0 flex-1 text-[length:var(--text-body)] font-semibold text-[var(--color-text)]">
              {question.prompt}
            </p>
            <div className="flex shrink-0 gap-2" aria-label={question.prompt}>
              <button
                type="button"
                disabled={pending}
                onClick={() => onAnswer(question.quest, true)}
                className="btn-ghost min-h-10 px-3 text-[length:var(--text-body)] font-semibold disabled:opacity-50"
              >
                Yes
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => onAnswer(question.quest, false)}
                className="btn-ghost min-h-10 px-3 text-[length:var(--text-body)] font-semibold disabled:opacity-50"
              >
                No
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
