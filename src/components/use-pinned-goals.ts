"use client";

import { useEffect, useState } from "react";
import {
  loadPinnedGoals,
  PINNED_GOALS_EVENT,
  type PinnedGoal
} from "@/lib/pinned-goals";

export function usePinnedGoals(rsn: string): PinnedGoal[] {
  const [goals, setGoals] = useState<PinnedGoal[]>([]);

  useEffect(() => {
    const refresh = () => setGoals(loadPinnedGoals(rsn));
    refresh();
    window.addEventListener(PINNED_GOALS_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(PINNED_GOALS_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [rsn]);

  return goals;
}
