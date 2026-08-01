"use client";

import { useMemo } from "react";
import { JournalItemSprite, JournalStatusMark } from "@/components/journal-primitives";
import {
  buildPinnedGoalRoute,
  type CompanionRoute,
  type CompanionRouteNode,
  type UnlockRouteSource
} from "@/lib/companion-routes";
import { usePinnedGoals } from "@/components/use-pinned-goals";

function RouteNodeMarker({ node }: { node: CompanionRouteNode }) {
  if (node.state === "done") return <JournalStatusMark done />;
  if (node.state === "future") return <JournalStatusMark done={false} />;
  if (node.state === "current") {
    return (
      <span role="img" aria-label="Current step" className="inline-flex size-5 items-center justify-center border border-[var(--color-parchment-edge)] bg-[var(--color-slot)] text-[length:var(--text-label)] font-semibold text-[var(--color-text)]">
        <span aria-hidden="true">▶</span>
      </span>
    );
  }
  return (
    <span role="img" aria-label="Not verified" className="inline-flex size-5 items-center justify-center border border-[var(--color-border-strong)] bg-[var(--color-slot)] text-[length:var(--text-micro)] font-semibold text-[var(--color-text-secondary)]">
      <span aria-hidden="true">?</span>
    </span>
  );
}

function RouteNodeList({ nodes, start = 1 }: { nodes: readonly CompanionRouteNode[]; start?: number }) {
  return (
    <ol start={start} className="mt-3" aria-label="Route steps">
      {nodes.map((node, index) => (
        <li key={node.id} data-route-node-state={node.state} aria-current={node.state === "current" ? "step" : undefined} className="relative grid min-h-16 grid-cols-[3rem_1.25rem_minmax(0,1fr)] gap-3 pb-4 last:min-h-0 last:pb-0">
          {index < nodes.length - 1 && <span aria-hidden="true" className="absolute bottom-0 left-[3.6rem] top-5 border-l border-[var(--color-border-strong)]" />}
          <JournalItemSprite id={node.iconItemId} />
          <span className="relative z-10"><RouteNodeMarker node={node} /></span>
          <span className="min-w-0">
            <span className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span className="text-[length:var(--text-subject)] font-semibold leading-tight text-[var(--color-text)]">{node.title}</span>
              <span className="tabular-nums text-[length:var(--text-body)] font-semibold text-[var(--color-data-level)]">{node.metric}</span>
            </span>
            <span className="mt-1 block max-w-[65ch] tabular-nums text-[length:var(--text-micro)] font-normal leading-relaxed text-[var(--color-text-muted)]">{node.detail}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

function RouteCard({ route }: { route: CompanionRoute }) {
  const firstNodes = route.kind === "max" ? route.nodes.slice(0, 3) : route.nodes;
  const remainingNodes = route.kind === "max" ? route.nodes.slice(3) : [];
  return (
    <article className="border-b border-[var(--color-border)] py-5 last:border-b-0" data-companion-route-kind={route.kind}>
      <h3 className="text-[length:var(--text-subject)] font-semibold text-[var(--color-text)]">{route.title}</h3>
      <p className="mt-1 max-w-[65ch] tabular-nums text-[length:var(--text-body)] font-normal leading-relaxed text-[var(--color-text-dim)]">{route.summary}</p>
      {firstNodes.length > 0 ? <RouteNodeList nodes={firstNodes} /> : (
        <p className="mt-3 text-[length:var(--text-body)] font-normal text-[var(--color-text-muted)]">No route nodes are available from this scan.</p>
      )}
      {remainingNodes.length > 0 && (
        <details className="mt-3 border-t border-[var(--color-border)] pt-3">
          <summary className="min-h-11 cursor-pointer tabular-nums text-[length:var(--text-body)] font-normal text-[var(--color-text-secondary)]">
            Show {remainingNodes.length} more skill{remainingNodes.length === 1 ? "" : "s"}
          </summary>
          <RouteNodeList nodes={remainingNodes} start={4} />
        </details>
      )}
    </article>
  );
}

export function PlayerRoutesPanel({
  rsn,
  maxRoute,
  collectionRoute,
  unlockRoutes
}: {
  rsn: string;
  maxRoute: CompanionRoute;
  collectionRoute: CompanionRoute;
  unlockRoutes: readonly UnlockRouteSource[];
}) {
  const pinnedGoals = usePinnedGoals(rsn);
  const pinnedRoute = useMemo(() => {
    for (const goal of pinnedGoals) {
      const route = buildPinnedGoalRoute(goal, unlockRoutes);
      if (route) return route;
    }
    return null;
  }, [pinnedGoals, unlockRoutes]);

  return (
    <section className="mt-8 border-t border-[var(--color-border)] pt-6" aria-labelledby="player-routes-title" data-player-routes="true">
      <h2 id="player-routes-title" className="text-[length:var(--text-label)] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-muted)]">Your routes</h2>
      {!pinnedRoute && (
        <p className="mt-2 max-w-[65ch] text-[length:var(--text-body)] font-normal text-[var(--color-text-muted)]">Pin an unlock goal to put its quest chain here.</p>
      )}
      {pinnedRoute && <RouteCard route={pinnedRoute} />}
      <RouteCard route={maxRoute} />
      <RouteCard route={collectionRoute} />
    </section>
  );
}
