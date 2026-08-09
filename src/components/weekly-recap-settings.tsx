"use client";

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";

/**
 * Turning the Sunday recap on (SPEC §3.3).
 *
 * Paired accounts only, which the API enforces — this control renders nothing
 * at all for anyone else rather than offering a field that would 401.
 */

type State = "loading" | "off" | "ready" | "saving" | "error";

interface RecapResponse {
  ok?: boolean;
  enabled?: boolean;
  /** Already redacted by the server: "discord.com/…/1234…". */
  discord?: string | null;
  error?: string;
}

export function WeeklyRecapSettings() {
  const [state, setState] = useState<State>("loading");
  const [enabled, setEnabled] = useState(true);
  const [saved, setSaved] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const response = await fetch("/api/account/recap");
        if (!live) return;
        // 401 is the normal case for an unpaired browser, not a failure worth
        // an error message. The control simply is not for them yet.
        if (response.status === 401) { setState("off"); return; }
        const body = await response.json().catch(() => ({})) as RecapResponse;
        if (!response.ok) throw new Error(body.error || "Could not load your recap settings");
        setEnabled(body.enabled !== false);
        setSaved(body.discord ?? null);
        setState("ready");
      } catch {
        if (live) setState("off");
      }
    })();
    return () => { live = false; };
  }, []);

  if (state === "loading" || state === "off") return null;

  const save = async (payload: { enabled: boolean; discordWebhookUrl?: string | null }) => {
    setState("saving");
    setMessage("");
    try {
      const response = await fetch("/api/account/recap", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      const body = await response.json().catch(() => ({})) as RecapResponse;
      if (!response.ok) throw new Error(body.error || "Could not save that");
      setEnabled(body.enabled !== false);
      setSaved(body.discord ?? null);
      setDraft("");
      setState("ready");
      setMessage(body.discord ? "Saved. Next recap goes out Sunday." : "Saved.");
    } catch (cause) {
      setState("error");
      setMessage(cause instanceof Error ? cause.message : "Could not save that");
    }
  };

  const busy = state === "saving";

  return (
    <div className="mt-3" data-weekly-recap-settings="true">
      <label className="flex items-start gap-2 text-[13px] leading-relaxed text-[var(--color-text-muted)]">
        <input
          type="checkbox"
          checked={enabled}
          disabled={busy}
          onChange={(event) => void save({ enabled: event.target.checked })}
          className="mt-0.5 size-4 accent-[var(--color-accent)]"
        />
        <span>Send me a Sunday recap of what I banked this week.</span>
      </label>

      {enabled && (
        <div className="mt-2">
          <label htmlFor="recap-webhook" className="sr-only">Discord webhook URL</label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              id="recap-webhook"
              type="url"
              inputMode="url"
              value={draft}
              disabled={busy}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={saved ?? "https://discord.com/api/webhooks/…"}
              className="min-h-11 min-w-0 flex-1 border border-[var(--color-border)] bg-[var(--color-slot)] px-3 py-2 font-mono text-[12px] text-[var(--color-text)] placeholder:text-[var(--color-text-dim)]/60 focus:border-[var(--color-gold-soft)] focus:outline-none"
            />
            <button
              type="button"
              disabled={busy || draft.trim().length === 0}
              onClick={() => void save({ enabled: true, discordWebhookUrl: draft.trim() })}
              className="btn-ghost min-h-11 px-4 text-[12px] font-bold disabled:opacity-50"
            >
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Check className="size-4" aria-hidden="true" />}
              Save
            </button>
            {saved && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void save({ enabled: true, discordWebhookUrl: "" })}
                className="btn-ghost min-h-11 px-4 text-[12px] font-bold disabled:opacity-50"
              >
                Remove
              </button>
            )}
          </div>
          <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--color-text-muted)]">
            Discord → Server Settings → Integrations → Webhooks → New Webhook → Copy Webhook URL. A quiet week is not sent.
          </p>
        </div>
      )}

      {message ? (
        <p role="status" className="mt-2 text-[12px] leading-relaxed text-[var(--color-text-muted)]">{message}</p>
      ) : null}
    </div>
  );
}
