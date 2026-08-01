import Link from "next/link";
import { JournalItemSprite, JournalStatusMark } from "@/components/journal-primitives";
import type { UnlockRouteNode } from "@/lib/unlock-route-path";

function RouteNodeMarker({ node }: { node: UnlockRouteNode }) {
  if (node.state === "done") return <JournalStatusMark done />;
  if (node.state === "future") return <JournalStatusMark done={false} />;
  if (node.state === "current") {
    return (
      <span
        role="img"
        aria-label="Current step"
        className="inline-flex size-[1.35rem] items-center justify-center border border-[var(--color-parchment-edge)] bg-[var(--color-slot)] text-[length:var(--text-label)] font-black text-[var(--color-text)]"
      >
        <span aria-hidden="true">▶</span>
      </span>
    );
  }
  if (node.state === "unknown") return (
    <span
      role="img"
      aria-label="Not verified"
      className="inline-flex size-[1.35rem] items-center justify-center border border-[var(--color-border-strong)] bg-[var(--color-slot)] text-[length:var(--text-micro)] font-black text-[var(--color-text-secondary)]"
    >
      <span aria-hidden="true">?</span>
    </span>
  );
  return <JournalStatusMark done={false} />;
}

function routeNodeLabel(node: UnlockRouteNode): string {
  if (node.state === "done") return "Done";
  if (node.state === "current") return "Current";
  if (node.state === "future") return "Later";
  if (node.state === "unknown") return "Not verified";
  return "Later";
}

export function UnlockRoutePath({
  id,
  title,
  payoff,
  iconItemId,
  nodes,
  showHeader = true
}: {
  id: string;
  title: string;
  payoff: string;
  iconItemId?: number;
  nodes: readonly UnlockRouteNode[];
  showHeader?: boolean;
}) {
  const titleId = `unlock-route-path-${id}`;
  return (
    <section
      data-unlock-route-path="true"
      aria-labelledby={titleId}
      className="border-y border-[var(--color-border-strong)] py-4"
    >
      {showHeader ? (
        <header className="flex items-center gap-3">
          {iconItemId ? <JournalItemSprite id={iconItemId} /> : null}
          <span className="min-w-0">
            <h3 id={titleId} className="text-[length:var(--text-subject)] font-semibold text-[var(--color-text)]">{title}</h3>
            <span className="mt-0.5 block text-[length:var(--text-micro)] leading-snug text-[var(--color-text-muted)]">{payoff}</span>
          </span>
        </header>
      ) : (
        <h3 id={titleId} className="sr-only">{title}</h3>
      )}

      <ol className={showHeader ? "mt-4" : undefined} aria-label={`${title} steps`}>
        {nodes.map((node, index) => (
          <li
            key={node.id}
            data-route-node-state={node.state}
            aria-current={node.state === "current" ? "step" : undefined}
            className="relative grid min-h-14 grid-cols-[1.35rem_minmax(0,1fr)] gap-3 pb-3 last:min-h-0 last:pb-0"
          >
            {index < nodes.length - 1 ? (
              <span aria-hidden="true" className="absolute bottom-0 left-[0.65rem] top-[1.35rem] border-l border-[var(--color-border-strong)]" />
            ) : null}
            <span className="relative z-10"><RouteNodeMarker node={node} /></span>
            <span className="min-w-0">
              <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                {node.href ? (
                  <Link href={node.href} className="text-[length:var(--text-body)] font-semibold leading-snug text-[var(--color-text)] underline-offset-4 hover:underline">
                    {node.title}
                  </Link>
                ) : (
                  <span className="text-[length:var(--text-body)] font-semibold leading-snug text-[var(--color-text)]">{node.title}</span>
                )}
                <span className="text-[length:var(--text-label)] font-bold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
                  {routeNodeLabel(node)}
                </span>
              </span>
              <span className="mt-0.5 block text-[length:var(--text-micro)] leading-snug text-[var(--color-text-muted)]">{node.requirement}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
