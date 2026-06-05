"use client";

import { useState, useEffect } from "react";
import { MessageSquare, Check, X, Loader2, AlertCircle, Trash2, Edit3 } from "lucide-react";
import {
  loadWebhookConfig, saveWebhookConfig, clearWebhookConfig,
  isValidDiscordWebhook, pingWebhook, type WebhookConfig
} from "@/lib/discord";
import { cn } from "@/lib/utils";

interface Props {
  /** Called after the user confirms setup so the host page can immediately fire a notification. */
  onConfigured?: (config: WebhookConfig) => void;
}

type Phase =
  | { kind: "loading" }
  | { kind: "no-config" }
  | { kind: "editing"; url: string; label: string; rsn: string; status?: string; pinging?: boolean }
  | { kind: "active"; config: WebhookConfig };

export function DiscordWebhookCard({ onConfigured }: Props) {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  // Default-collapsed when nothing's configured — it's a "nice to have"
  // feature that shouldn't dominate the bank result UI.
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    const config = loadWebhookConfig();
    if (config && config.enabled) {
      setPhase({ kind: "active", config });
    } else if (config && !config.enabled) {
      // Disabled — treat as no-config but pre-fill the form if they re-open
      setPhase({ kind: "no-config" });
    } else {
      setPhase({ kind: "no-config" });
    }
  }, []);

  if (phase.kind === "loading") return null;

  if (phase.kind === "no-config" && collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className="text-[11.5px] text-[var(--color-text-dim)] hover:text-[var(--color-text)] underline-offset-2 hover:underline mb-3"
      >
        Enable Discord notifications
      </button>
    );
  }

  if (phase.kind === "no-config") {
    return (
      <div className={cn(
        "mb-5 rounded-xl p-3.5 flex items-start gap-3",
        "bg-gradient-to-br from-[var(--color-panel)] to-[var(--color-bg-2)]",
        "border border-[var(--color-border)]"
      )}>
        <div className="size-9 rounded-lg flex items-center justify-center bg-[oklch(0.32_0.05_280/0.3)] text-[oklch(0.74_0.13_280)] shrink-0">
          <MessageSquare className="size-4" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[12.5px] font-semibold text-[var(--color-text)] mb-0.5">
            Send bank updates to Discord
          </h3>
          <p className="text-[11.5px] text-[var(--color-text-dim)] leading-relaxed">
            Drop a webhook URL — Scapestack will post a clean embed every time you re-organize. Stored in your browser only, never sent to our server.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setPhase({ kind: "editing", url: "", label: "", rsn: "" })}
            className={cn(
              "px-3 py-1.5 rounded-lg text-[12px] font-semibold",
              "bg-gradient-to-b from-[oklch(0.92_0.14_85)] to-[oklch(0.62_0.16_65)]",
              "text-[oklch(0.15_0.02_50)] border border-[oklch(0.46_0.13_60)]",
              "shadow-[0_2px_0_oklch(0_0_0/0.4)]",
              "hover:brightness-110"
            )}
          >
            Set up
          </button>
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="size-7 rounded flex items-center justify-center text-[var(--color-text-dim)]/60 hover:text-[var(--color-text)]"
            title="Hide for now"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>
    );
  }

  if (phase.kind === "editing") {
    const valid = isValidDiscordWebhook(phase.url);

    const onSave = async () => {
      if (!valid) {
        setPhase({ ...phase, status: "That doesn't look like a Discord webhook URL" });
        return;
      }
      setPhase({ ...phase, pinging: true, status: undefined });
      const result = await pingWebhook(phase.url);
      if (!result.ok) {
        setPhase({ ...phase, pinging: false, status: `Discord rejected the URL: ${result.error || result.status}` });
        return;
      }
      const config: WebhookConfig = {
        url: phase.url.trim(),
        enabled: true,
        label: phase.label.trim() || undefined,
        rsn: phase.rsn.trim() || undefined
      };
      saveWebhookConfig(config);
      setPhase({ kind: "active", config });
      onConfigured?.(config);
    };

    return (
      <div className={cn(
        "mb-5 rounded-xl p-4",
        "bg-gradient-to-br from-[var(--color-panel)] to-[var(--color-bg-2)]",
        "border border-[var(--color-gold-soft)]/40"
      )}>
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare className="size-4 text-[var(--color-gold-soft)]" />
          <h3 className="text-[12.5px] font-semibold text-[var(--color-text)]">Discord webhook</h3>
        </div>

        <div className="space-y-2.5">
          <div>
            <label className="block text-[11px] text-[var(--color-text-dim)] mb-1">
              Webhook URL
              <a
                href="https://support.discord.com/hc/en-us/articles/228383668"
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 text-[10px] text-[var(--color-gold-soft)] hover:underline"
              >
                How to get one
              </a>
            </label>
            <input
              type="url"
              value={phase.url}
              onChange={(e) => setPhase({ ...phase, url: e.target.value, status: undefined })}
              placeholder="https://discord.com/api/webhooks/123.../abc..."
              className={cn(
                "w-full px-3 py-2 rounded-md text-[12px] font-mono",
                "bg-[var(--color-slot)] border",
                phase.url && !valid ? "border-[var(--color-danger)]" : "border-[var(--color-border)]",
                "text-[var(--color-text)] placeholder:text-[var(--color-text-dim)]/60",
                "focus:outline-none focus:border-[var(--color-gold-soft)]"
              )}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] text-[var(--color-text-dim)] mb-1">Your RSN</label>
              <input
                type="text"
                value={phase.rsn}
                onChange={(e) => setPhase({ ...phase, rsn: e.target.value })}
                placeholder="Optional"
                maxLength={12}
                className="w-full px-3 py-2 rounded-md text-[12px] bg-[var(--color-slot)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-gold-soft)]"
              />
            </div>
            <div>
              <label className="block text-[11px] text-[var(--color-text-dim)] mb-1">Clan / label</label>
              <input
                type="text"
                value={phase.label}
                onChange={(e) => setPhase({ ...phase, label: e.target.value })}
                placeholder="Optional"
                maxLength={30}
                className="w-full px-3 py-2 rounded-md text-[12px] bg-[var(--color-slot)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-gold-soft)]"
              />
            </div>
          </div>

          {phase.status && (
            <div className="flex items-start gap-1.5 text-[11px] text-[var(--color-danger)]">
              <AlertCircle className="size-3 mt-0.5 shrink-0" />
              <span>{phase.status}</span>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={onSave}
              disabled={!phase.url || phase.pinging}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold",
                "bg-gradient-to-b from-[oklch(0.92_0.14_85)] to-[oklch(0.62_0.16_65)]",
                "text-[oklch(0.15_0.02_50)] border border-[oklch(0.46_0.13_60)]",
                "shadow-[0_2px_0_oklch(0_0_0/0.4)]",
                "hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {phase.pinging
                ? <><Loader2 className="size-3.5 animate-spin" /> Testing…</>
                : <><Check className="size-3.5" /> Test &amp; save</>
              }
            </button>
            <button
              type="button"
              onClick={() => setPhase({ kind: "no-config" })}
              className="px-3 py-1.5 rounded-lg text-[12px] bg-transparent border border-[var(--color-border)] text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:border-[var(--color-border-strong)]"
            >
              Cancel
            </button>
            <span className="ml-auto text-[10.5px] text-[var(--color-text-dim)]/70">
              Stored locally only
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Active
  const { config } = phase;
  return (
    <div className={cn(
      "mb-5 rounded-xl p-3 flex items-center gap-3",
      "bg-gradient-to-br from-[oklch(0.22_0.06_280/0.18)] to-[var(--color-bg-2)]",
      "border border-[oklch(0.74_0.13_280)]/40"
    )}>
      <div className="size-8 rounded-lg flex items-center justify-center bg-[oklch(0.32_0.05_280/0.4)] text-[oklch(0.84_0.13_280)] shrink-0">
        <MessageSquare className="size-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[12.5px] font-semibold text-[var(--color-text)] flex items-center gap-2">
          Discord notifications on
          <Check className="size-3 text-[var(--color-good)]" />
        </div>
        <div className="text-[11px] text-[var(--color-text-dim)] truncate">
          {config.label || "Posting to webhook"}
          {config.rsn && <span> · as <span className="text-[var(--color-gold-soft)]">{config.rsn}</span></span>}
        </div>
      </div>
      <button
        type="button"
        onClick={() => setPhase({ kind: "editing", url: config.url, label: config.label || "", rsn: config.rsn || "" })}
        className="size-7 rounded flex items-center justify-center text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:bg-[var(--color-border)]"
        title="Edit"
      >
        <Edit3 className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={() => { clearWebhookConfig(); setPhase({ kind: "no-config" }); }}
        className="size-7 rounded flex items-center justify-center text-[var(--color-text-dim)] hover:text-[var(--color-danger)] hover:bg-[var(--color-border)]"
        title="Disconnect"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}
