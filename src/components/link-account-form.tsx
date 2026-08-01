"use client";

import { useActionState } from "react";
import { Link2, Loader2 } from "lucide-react";
import {
  approveBrowserLink,
  INITIAL_LINK_ACCOUNT_STATE
} from "@/app/link/actions";

export function LinkAccountForm({ code }: { code: string }) {
  const [state, formAction, pending] = useActionState(
    approveBrowserLink,
    INITIAL_LINK_ACCOUNT_STATE
  );
  const ready = code.length === 8;

  return (
    <form action={formAction} className="mt-6">
      <input type="hidden" name="code" value={code} />
      <button
        type="submit"
        disabled={!ready || pending}
        className="btn-primary min-h-11 w-full justify-center disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Link2 className="size-4" aria-hidden="true" />}
        {pending ? "Connecting…" : "Approve connection"}
      </button>
      {!ready ? (
        <p role="alert" className="mt-3 text-[12.5px] leading-relaxed text-[var(--color-warning)]">
          Open this page from the Connect button in RuneLite.
        </p>
      ) : null}
      {state.status === "error" ? (
        <p role="alert" className="mt-3 text-[12.5px] leading-relaxed text-[var(--color-warning)]">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
