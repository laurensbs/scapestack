"use client";

import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { unlinkServerAccount } from "@/lib/account-storage";

type DeleteState = "idle" | "deleting" | "deleted" | "error";

export function DeleteAccountDataButton() {
  const [state, setState] = useState<DeleteState>("idle");
  const [message, setMessage] = useState("");

  const remove = async () => {
    if (!window.confirm("Forget everything Scapestack knows about you?")) return;
    setState("deleting");
    setMessage("");
    try {
      const response = await fetch("/api/account/delete", { method: "DELETE" });
      const body = await response.json().catch(() => ({})) as { error?: string; account?: { rsn?: string } };
      if (!response.ok) throw new Error(body.error || "Could not delete your data");
      if (body.account?.rsn) unlinkServerAccount(body.account.rsn);
      setState("deleted");
      setMessage("Forgotten. Nothing of yours is left here.");
    } catch (cause) {
      setState("error");
      setMessage(cause instanceof Error ? cause.message : "Could not delete your data");
    }
  };

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => void remove()}
        disabled={state === "deleting" || state === "deleted"}
        className="btn-ghost min-h-11 px-4 text-[12px] font-bold disabled:opacity-50"
      >
        {state === "deleting" ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Trash2 className="size-4" aria-hidden="true" />}
        {state === "deleted" ? "Forgotten" : "Forget me"}
      </button>
      {message ? (
        <p role="status" className="mt-2 text-[12px] leading-relaxed text-[var(--color-text-muted)]">{message}</p>
      ) : null}
    </div>
  );
}
