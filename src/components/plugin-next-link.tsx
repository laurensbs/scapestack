"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { readBankHandoffPayload } from "@/lib/next-bank-handoff";
import { nextUrlFromPluginSearch } from "@/lib/plugin-sync-actions";

export function PluginNextLink({
  children,
  className
}: {
  children: React.ReactNode;
  className: string;
}) {
  const [href, setHref] = useState("/next?from=plugin&bank=none");

  useEffect(() => {
    let hasBankContext = false;
    try {
      const params = new URLSearchParams(window.location.search);
      hasBankContext = params.get("bank") !== "none" && readBankHandoffPayload(window).length > 0;
    } catch {
    }
    setHref(nextUrlFromPluginSearch(window.location.search, { hasBankContext }));
  }, []);

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
