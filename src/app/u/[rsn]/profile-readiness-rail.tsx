"use client";

import { useEffect, useState } from "react";
import { ScapestackReadinessRail } from "@/components/scapestack-readiness-rail";
import { latestSnapshot } from "@/lib/snapshot-history";

interface ProfileReadinessRailProps {
  rsn: string;
}

export function ProfileReadinessRail({ rsn }: ProfileReadinessRailProps) {
  const [hasLocalBank, setHasLocalBank] = useState(false);

  useEffect(() => {
    const snapshot = latestSnapshot(rsn);
    setHasLocalBank(Boolean(snapshot && snapshot.items.length > 0));
  }, [rsn]);

  return (
    <ScapestackReadinessRail
      surface="profile"
      hasBankContext={hasLocalBank}
      hasRsn
      rsn={rsn}
    />
  );
}
