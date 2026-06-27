import { CURRENT_PLUGIN_VERSION } from "./plugin-sync";
import { PLUGIN_HUB_PR_NUMBER, type PluginHubStatus } from "./plugin-hub-status";

export const DEFAULT_PR_BODY_FILE = "/tmp/scapestack-plugin-pr-body.md";
export const DEFAULT_REVIEWER_PACKET_FILE = "/tmp/scapestack-plugin-reviewer-packet.md";

const DATA_SENT = [
  "RSN used for the claim",
  "Plugin version and sync status",
  "Quest and diary completion",
  "Loaded collection-log item IDs",
  "Slayer task, points, streak and block-list state",
  "Local install token only as Authorization bearer on claim/sync requests"
];

const DATA_NEVER_SENT = [
  "RuneScape password or account login",
  "bank, inventory, equipment or GE offers",
  "chat messages, friends list or private messages",
  "mouse clicks, key presses or gameplay inputs",
  "screenshots, client files, config folders, IP or machine fingerprint"
];

const GAME_INTEGRITY = [
  "Read-only plugin: it reads RuneLite client state and never clicks, types, swaps menus, changes prayers, moves the player or performs game actions.",
  "No overlays, alerts or in-client recommendations that could automate gameplay decisions; recommendations live in the external web app after opt-in sync.",
  "No item, inventory, equipment, bank, trade, GE offer or wealth data is collected by the plugin."
];

const WEB_APP_MERGE_CONTRACT = [
  "The plugin is an account-progress verifier, not a bank uploader.",
  "Successful sync chat links to `/next?rsn=...&source=plugin-sync&bank=none` so the web app treats RuneLite payloads as bankless by default.",
  "`source=plugin-sync` tells Scapestack to load the verified account payload for coverage labels; it does not remove bank, gear or tracker caveats by itself.",
  "`bank=none` prevents stale browser bank context from being silently reused after a plugin-only sync.",
  "Players who want gear-aware advice paste Bank Memory or Bank Tags into the web app separately; that browser-only bank context is never sent back to RuneLite.",
  "/next, /slayer, /dps, /goals and player profiles all show readiness rails so players can see Bank, RSN and RuneLite sync as separate evidence signals."
];

const STALE_PR_BODY_REPLACEMENTS = [
  "Replace “Auto-sync defaults to on” with “Auto-sync on login defaults off and requires explicit player opt-in.”",
  "Replace “raw token never leaves the install” with “raw token is sent only as an Authorization bearer for claim/sync; Scapestack stores sha256(token).”",
  "Replace “POSTs on every login + quest-complete chat messages” with “POSTs only after opt-in; quest-complete POST also defaults off and requires Auto-sync on login.”",
  "Replace the old capture list with the current opt-in payload: quests, diaries, collection-log item IDs and Slayer task, points, streak and block-list state.",
  "Keep “No IP, no machine fingerprint, no chat-log content” and add “no bank, inventory, equipment, GE offers, screenshots, inputs or account login.”"
];

export function buildPluginReviewerPacket(status: PluginHubStatus): string {
  const lines = [
    `Scapestack Sync v${CURRENT_PLUGIN_VERSION} — RuneLite Plugin Hub PR #${PLUGIN_HUB_PR_NUMBER}`,
    "",
    "Review summary",
    `- PR status: ${status.label}`,
    `- Live detail: ${status.detail}`,
    status.reviewSummary ? `- Review decision: ${status.reviewSummary}` : null,
    status.checkSummary ? `- Checks: ${status.checkSummary}` : null,
    status.pinSummary ? `- Pin: ${status.pinSummary}` : null,
    status.reviewCopySummary ? `- PR body copy: ${status.reviewCopySummary}` : null,
    status.submittedCommit ? `- Plugin Hub pin: ${status.submittedCommit}` : null,
    status.standaloneCommit ? `- Standalone head: ${status.standaloneCommit}` : null,
    "- Use this packet to replace stale PR-body copy if GitHub still says auto-sync defaults on or implies the raw token never leaves the client.",
    "",
    "Stale PR-body replacements",
    ...STALE_PR_BODY_REPLACEMENTS.map((item) => `- ${item}`),
    "",
    "Player consent",
    "- Auto-sync on login defaults off.",
    "- Sync on quest complete defaults off.",
    "- Quest-complete sync is also gated behind Auto-sync on login; enabling the quest-complete setting alone never sends a payload.",
    "- No progress POST happens until the player enables Auto-sync on login in RuneLite settings.",
    "",
    "Data sent after opt-in",
    ...DATA_SENT.map((item) => `- ${item}`),
    "",
    "Data never sent",
    ...DATA_NEVER_SENT.map((item) => `- ${item}`),
    "",
    "Game integrity",
    ...GAME_INTEGRITY.map((item) => `- ${item}`),
    "",
    "Threading and recovery",
    "- Token claim, readiness check and sync POST run on a background Thread, not on RuneLite's client thread.",
    "- The sync worker is a named daemon thread; shutdown cancels the active OkHttp call and suppresses chat feedback while the worker returns normally.",
    "- The server stores sha256(token) for the RSN claim; the raw token is sent only as Authorization on claim/sync requests.",
    "- If a claim gets rejected, the player can toggle Force claim retry once; the plugin keeps the same local token and retries the safe claim step.",
    "",
    "Web-app merge behavior",
    "- The web app keeps working with Hiscores, bank paste and public trackers while review is pending.",
    "- After sync, /next labels quest, diary, collection-log and Slayer coverage as verified, partial or missing from the RuneLite payload.",
    "- Successful sync chat includes the verified /next URL for that RSN with source=plugin-sync&bank=none; local Sync endpoints produce local /next links for testers.",
    "- Bank handoff remains browser-only; the plugin never receives bank, inventory, equipment, screenshots, clicks or account login.",
    "",
    "Web-app merge contract",
    ...WEB_APP_MERGE_CONTRACT.map((item) => `- ${item}`)
  ].filter((line): line is string => line !== null);

  return lines.join("\n");
}

export function buildPluginPrBodyReplacement(status: PluginHubStatus): string {
  const lines = [
    `Adds Scapestack Sync v${CURRENT_PLUGIN_VERSION}, a RuneLite plugin that syncs opt-in account-progress signals to Scapestack so /next can stop guessing from public Hiscores alone.`,
    "",
    "## Current review state",
    `- Plugin Hub PR: #${PLUGIN_HUB_PR_NUMBER}`,
    `- Status: ${status.label}`,
    `- Detail: ${status.detail}`,
    status.reviewSummary ? `- Review decision: ${status.reviewSummary}` : null,
    status.checkSummary ? `- Checks: ${status.checkSummary}` : null,
    status.pinSummary ? `- Pin: ${status.pinSummary}` : null,
    status.reviewCopySummary ? `- PR body copy: ${status.reviewCopySummary}` : null,
    status.submittedCommit ? `- Plugin Hub pin: ${status.submittedCommit}` : null,
    status.standaloneCommit ? `- Standalone repo head: ${status.standaloneCommit}` : null,
    "",
    "## What it captures after player opt-in",
    ...DATA_SENT.map((item) => `- ${item}`),
    "",
    "## What it never captures",
    ...DATA_NEVER_SENT.map((item) => `- ${item}`),
    "",
    "## Game integrity",
    ...GAME_INTEGRITY.map((item) => `- ${item}`),
    "",
    "## Consent defaults",
    "- Auto-sync on login defaults off.",
    "- Sync on quest complete defaults off.",
    "- Quest-complete sync is also gated behind Auto-sync on login; enabling the quest-complete setting alone never sends a payload.",
    "- No progress POST happens until the player enables Auto-sync on login from RuneLite settings.",
    "- Show chat feedback defaults on so players see when sync starts, succeeds, fails, or needs a fresh claim.",
    "",
    "## Network and auth",
    "- Default endpoint: `https://www.scapestack.org/api/sync`.",
    "- The claim endpoint is derived as `/api/sync/claim` from the configured sync URL.",
    "- The raw local install token is sent only as an `Authorization: Bearer <token>` for claim/sync requests.",
    "- Scapestack stores `sha256(token)` for the RSN claim; it does not store the raw token.",
    "- HTTP claim/readiness/sync work runs on a background Thread, not RuneLite's client thread.",
    "- Shutdown cancels the active OkHttp call and suppresses further chat feedback while the background worker returns normally.",
    "",
    "## Web-app merge behavior",
    "- Successful sync chat includes the verified `/next?rsn=...&source=plugin-sync&bank=none` link for that RSN.",
    "- `bank=none` is intentional: RuneLite sync does not send bank, inventory, equipment, GE offers or wealth.",
    "- Players can still paste a bank into the web app separately; that browser-only bank context is never sent to the plugin.",
    "- While Plugin Hub review is pending, Scapestack still works with Hiscores, bank paste, TempleOSRS, WOM and collectionlog.net.",
    "",
    "## Web-app merge contract",
    ...WEB_APP_MERGE_CONTRACT.map((item) => `- ${item}`)
  ].filter((line): line is string => line !== null);

  return lines.join("\n");
}

export function buildPluginPrBodyUpdateCommand({
  filePath = DEFAULT_PR_BODY_FILE,
  offline = false
}: { filePath?: string; offline?: boolean } = {}): string {
  const bodyCommand = offline
    ? "npm run --silent plugin:pr-body -- --offline"
    : "npm run --silent plugin:pr-body";
  return `${bodyCommand} > ${filePath} && gh pr edit ${PLUGIN_HUB_PR_NUMBER} --repo runelite/plugin-hub --body-file ${filePath}`;
}

export function buildPluginReviewerReplyCommand({
  filePath = DEFAULT_REVIEWER_PACKET_FILE,
  offline = false
}: { filePath?: string; offline?: boolean } = {}): string {
  const packetCommand = offline
    ? "npm run --silent plugin:review-packet -- --offline"
    : "npm run --silent plugin:review-packet";
  return `${packetCommand} > ${filePath} && gh pr comment ${PLUGIN_HUB_PR_NUMBER} --repo runelite/plugin-hub --body-file ${filePath}`;
}

export function buildPluginReviewerHandoffCommand({
  prBodyFilePath = DEFAULT_PR_BODY_FILE,
  reviewerPacketFilePath = DEFAULT_REVIEWER_PACKET_FILE,
  offline = false
}: { prBodyFilePath?: string; reviewerPacketFilePath?: string; offline?: boolean } = {}): string {
  const prBodyCommand = offline
    ? "npm run --silent plugin:pr-body -- --offline"
    : "npm run --silent plugin:pr-body";
  const packetCommand = offline
    ? "npm run --silent plugin:review-packet -- --offline"
    : "npm run --silent plugin:review-packet";
  return [
    `${prBodyCommand} > ${prBodyFilePath}`,
    `${packetCommand} > ${reviewerPacketFilePath}`,
    `gh pr edit ${PLUGIN_HUB_PR_NUMBER} --repo runelite/plugin-hub --body-file ${prBodyFilePath}`,
    `gh pr comment ${PLUGIN_HUB_PR_NUMBER} --repo runelite/plugin-hub --body-file ${reviewerPacketFilePath}`
  ].join(" && ");
}
