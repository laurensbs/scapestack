"use client";

import { useState } from "react";

type ShareState =
  | { kind: "idle" }
  | { kind: "working"; action: "create" | "publish" | "unpublish" }
  | { kind: "private"; shareId: string }
  | { kind: "public"; shareId: string; publicPath: string; copied: boolean }
  | { kind: "error"; message: string };

async function responseError(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.json() as { error?: unknown };
    return typeof body.error === "string" ? body.error : fallback;
  } catch {
    return fallback;
  }
}

export function BankShareControl() {
  const [state, setState] = useState<ShareState>({ kind: "idle" });
  const [consent, setConsent] = useState(false);

  async function createPrivate(): Promise<void> {
    setState({ kind: "working", action: "create" });
    const response = await fetch("/api/account/bank-share", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}"
    }).catch(() => null);
    if (!response?.ok) {
      setState({ kind: "error", message: response ? await responseError(response, "Could not create the private image") : "Could not reach Scapestack" });
      return;
    }
    const body = await response.json() as { share?: { shareId?: unknown } };
    const shareId = body.share?.shareId;
    if (typeof shareId !== "string") {
      setState({ kind: "error", message: "Scapestack returned an incomplete image" });
      return;
    }
    setConsent(false);
    setState({ kind: "private", shareId });
  }

  async function publish(shareId: string): Promise<void> {
    if (!consent) return;
    setState({ kind: "working", action: "publish" });
    const response = await fetch("/api/account/bank-share", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ shareId, publish: true })
    }).catch(() => null);
    if (!response?.ok) {
      setState({ kind: "error", message: response ? await responseError(response, "Could not publish the image") : "Could not reach Scapestack" });
      return;
    }
    const body = await response.json() as { share?: { publicPath?: unknown } };
    if (typeof body.share?.publicPath !== "string") {
      setState({ kind: "error", message: "Scapestack returned an incomplete public link" });
      return;
    }
    setState({ kind: "public", shareId, publicPath: body.share.publicPath, copied: false });
  }

  async function unpublish(shareId: string): Promise<void> {
    setState({ kind: "working", action: "unpublish" });
    const response = await fetch("/api/account/bank-share", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ shareId })
    }).catch(() => null);
    if (!response?.ok) {
      setState({ kind: "error", message: response ? await responseError(response, "Could not make the image private") : "Could not reach Scapestack" });
      return;
    }
    setConsent(false);
    setState({ kind: "private", shareId });
  }

  async function copy(publicPath: string, shareId: string): Promise<void> {
    const url = new URL(publicPath, window.location.origin).toString();
    await navigator.clipboard.writeText(url);
    setState({ kind: "public", shareId, publicPath, copied: true });
  }

  return (
    <div className="mt-4 border-t border-[var(--color-border)] pt-4" data-bank-share-control="true">
      {state.kind === "idle" || state.kind === "error" ? (
        <>
          <button type="button" className="btn-ghost min-h-11 px-4 text-[12.5px] font-bold" onClick={() => void createPrivate()}>
            Create private image
          </button>
          <p className="mt-2 text-[12px] leading-relaxed text-[var(--color-text-muted)]">
            This freezes the set names, missing pieces and exact prices above. It is private until you publish this image.
          </p>
          {state.kind === "error" && <p role="alert" className="mt-2 text-[12px] text-[var(--color-danger)]">{state.message}</p>}
        </>
      ) : state.kind === "working" ? (
        <p className="text-[12.5px] text-[var(--color-text-muted)]">
          {state.action === "create" ? "Creating private image…" : state.action === "publish" ? "Publishing image…" : "Making image private…"}
        </p>
      ) : state.kind === "private" ? (
        <div>
          <p className="text-[12.5px] font-semibold text-[var(--color-text)]">Private image created.</p>
          <label className="mt-3 flex items-start gap-2 text-[12px] leading-relaxed text-[var(--color-text-dim)]">
            <input type="checkbox" className="mt-0.5" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
            <span>I understand anyone with the link can see these set names, missing pieces and prices.</span>
          </label>
          <button
            type="button"
            className="btn-primary mt-3 min-h-11 px-4 text-[12.5px] font-bold disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!consent}
            onClick={() => void publish(state.shareId)}
          >
            Make this image public
          </button>
        </div>
      ) : (
        <div>
          <p className="text-[12.5px] font-semibold text-[var(--color-text)]">Public image ready.</p>
          <a className="mt-2 block break-all text-[12px] text-[var(--color-accent)] underline" href={state.publicPath} target="_blank" rel="noopener noreferrer">
            {state.publicPath}
          </a>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="btn-primary min-h-11 px-4 text-[12.5px] font-bold" onClick={() => void copy(state.publicPath, state.shareId)}>
              {state.copied ? "Link copied" : "Copy link"}
            </button>
            <button type="button" className="btn-ghost min-h-11 px-4 text-[12.5px] font-bold" onClick={() => void unpublish(state.shareId)}>
              Make private
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
