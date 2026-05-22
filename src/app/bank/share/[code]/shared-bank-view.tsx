"use client";

import { useRouter } from "next/navigation";
import { BankResult } from "@/components/bank-result";
import type { OrganizeResult } from "@/lib/organizer";

interface Props {
  result: OrganizeResult;
  strings: string[];
}

export function SharedBankView({ result, strings }: Props) {
  const router = useRouter();
  return (
    <BankResult
      initial={result}
      initialStrings={strings}
      onEditInput={() => router.push("/bank")}
    />
  );
}
