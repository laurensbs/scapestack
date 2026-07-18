"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Loader2, PlugZap, X } from "lucide-react";
import {
  completeBrowserPairing,
  startBrowserPairing,
  type PairingHandle
} from "@/lib/account-connection";
import { useDialogA11y } from "@/lib/use-dialog-a11y";

export function ConnectBrowserModal({
  open,
  rsn,
  onClose,
  onConnected
}: {
  open: boolean;
  rsn: string;
  onClose: () => void;
  onConnected: () => void;
}) {
  const [pairing, setPairing] = useState<PairingHandle | null>(null);
  const [state, setState] = useState<"idle" | "starting" | "waiting" | "connected" | "error">("idle");
  const [error, setError] = useState("");
  const dialogRef = useDialogA11y<HTMLElement>(open, onClose);

  useEffect(() => {
    if (!open) {
      setPairing(null);
      setState("idle");
      setError("");
    }
  }, [open]);

  useEffect(() => {
    if (!open || state !== "waiting" || !pairing) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const result = await completeBrowserPairing(pairing);
        if (cancelled || result === "pending") return;
        setState("connected");
        onConnected();
      } catch (cause) {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : "Create a new connection code");
        setState("error");
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 1_500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [open, onConnected, pairing, state]);

  if (!open) return null;

  const start = async () => {
    if (!rsn) return;
    setState("starting");
    setError("");
    try {
      const handle = await startBrowserPairing(rsn);
      setPairing(handle);
      setState("waiting");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create a connection code");
      setState("error");
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[180] flex items-end justify-center overflow-y-auto bg-black/78 p-0 sm:items-center sm:p-4" role="presentation" onMouseDown={onClose}>
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="connect-browser-title"
        aria-describedby="connect-browser-description"
        tabIndex={-1}
        className="scape-dialog max-w-lg"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-[var(--color-parchment-edge)] px-5 py-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-gold)]">RuneLite proof</p>
            <h2 id="connect-browser-title" className="mt-1 font-serif text-2xl text-[var(--color-text)]">Connect this browser</h2>
            <p id="connect-browser-description" className="sr-only">
              Connect RuneLite to this browser for the current player.
            </p>
          </div>
          <button type="button" onClick={onClose} className="icon-btn" aria-label="Close connection dialog">
            <X className="size-4" />
          </button>
        </header>

        <div className="p-5">
          {state === "connected" ? (
            <div className="py-5 text-center">
              <CheckCircle2 className="mx-auto size-10 text-[var(--color-gold)]" />
              <h3 className="mt-3 font-serif text-xl text-[var(--color-text)]">{rsn} is connected</h3>
              <p className="mt-2 text-sm text-[var(--color-text-muted)]">This browser can now reopen the same Scapestack history.</p>
              <button type="button" onClick={onClose} className="btn-primary mt-5 w-full justify-center">Continue</button>
            </div>
          ) : pairing && state === "waiting" ? (
            <div>
              <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
                Open <strong className="text-[var(--color-text)]">Scapestack Sync</strong> in RuneLite, enter this code under <strong className="text-[var(--color-text)]">Connect this browser</strong>, then press Connect browser.
              </p>
              <div className="my-6 rounded-lg border border-[var(--color-gold)]/55 bg-[var(--color-bg)] px-4 py-5 text-center font-mono text-3xl font-bold tracking-[0.16em] text-[var(--color-gold)]">
                {pairing.code}
              </div>
              <div className="flex items-center justify-center gap-2 text-sm text-[var(--color-text-muted)]">
                <Loader2 className="size-4 animate-spin text-[var(--color-gold)]" />
                Waiting for RuneLite
              </div>
            </div>
          ) : (
            <div>
              <div className="flex gap-3">
                <div className="grid size-11 shrink-0 place-items-center rounded-lg border border-[var(--color-parchment-edge)] bg-[var(--color-bg)]">
                  <PlugZap className="size-5 text-[var(--color-gold)]" />
                </div>
                <div>
                  <h3 className="font-semibold text-[var(--color-text)]">Keep {rsn || "this player"} on this device</h3>
                  <p className="mt-1 text-sm leading-relaxed text-[var(--color-text-muted)]">
                    RuneLite confirms the player. No email, password or RuneScape login.
                  </p>
                </div>
              </div>
              {error && <p role="alert" className="mt-4 rounded-md border border-[var(--color-danger)]/35 bg-[var(--color-danger)]/10 px-3 py-2 text-sm text-[var(--color-text)]">{error}</p>}
              <button type="button" onClick={() => void start()} disabled={!rsn || state === "starting"} className="btn-primary mt-5 w-full justify-center disabled:opacity-50">
                {state === "starting" && <Loader2 className="size-4 animate-spin" />}
                Get connection code
              </button>
            </div>
          )}
        </div>
      </section>
    </div>,
    document.body
  );
}
