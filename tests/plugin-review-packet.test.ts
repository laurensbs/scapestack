import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import {
  DEFAULT_PR_BODY_FILE,
  DEFAULT_REVIEWER_PACKET_FILE,
  buildPluginPrBodyReplacement,
  buildPluginPrBodyUpdateCommand,
  buildPluginReviewerHandoffCommand,
  buildPluginReviewerReplyCommand,
  buildPluginReviewerPacket
} from "@/lib/plugin-review-packet";
import type { PluginHubStatus } from "@/lib/plugin-hub-status";

const CLI_TIMEOUT_MS = 20_000;

const status: PluginHubStatus = {
  state: "open",
  tone: "accent",
  label: "Plugin Hub PR #12536 open",
  detail: "Awaiting RuneLite maintainer review.",
  checkSummary: "Build is passing; RuneLite Plugin Hub Checks is the maintainer review gate.",
  submittedCommit: "39931dc965e4e9f01bf549bdc192b85c4cd6c1fc",
  standaloneCommit: "39931dc965e4e9f01bf549bdc192b85c4cd6c1fc",
  pinSummary: "Plugin Hub pin matches standalone repo head 39931dc.",
  reviewCopySummary: "Live PR body still needs review-copy fixes: auto-sync defaults, token transport.",
  reviewCopyIssues: ["auto-sync defaults", "token transport"],
  updatedAt: "2026-05-26T13:57:13Z",
  reviewCount: 0,
  reviewSummary: null,
  url: "https://github.com/runelite/plugin-hub/pull/12536"
};

const changesRequestedStatus: PluginHubStatus = {
  ...status,
  detail: "1 review recorded. Track GitHub for requested changes before Plugin Hub install.",
  reviewCount: 1,
  reviewSummary: "RuneLite review requested changes. Update the standalone plugin repo, move the Plugin Hub pin, then reply with the reviewer packet."
};

describe("plugin reviewer packet", () => {
  it("formats a copyable maintainer review summary", () => {
    const packet = buildPluginReviewerPacket(status);

    expect(packet).toContain("Scapestack Sync v0.2.0");
    expect(packet).toContain("RuneLite Plugin Hub PR #12536");
    expect(packet).toContain("Auto-sync on login defaults off");
    expect(packet).toContain("Sync on quest complete defaults off");
    expect(packet).toContain("quest-complete POST also defaults off and requires Auto-sync on login");
    expect(packet).toContain("Quest-complete sync is also gated behind Auto-sync on login");
    expect(packet).toContain("enabling the quest-complete setting alone never sends a payload");
    expect(packet).toContain("No progress POST happens until the player enables Auto-sync on login");
    expect(packet).toContain("replace stale PR-body copy");
    expect(packet).toContain("PR body copy: Live PR body still needs review-copy fixes");
    expect(packet).toContain("Stale PR-body replacements");
    expect(packet).toContain("Replace “Auto-sync defaults to on”");
    expect(packet).toContain("requires explicit player opt-in");
    expect(packet).toContain("Replace “raw token never leaves the install”");
    expect(packet).toContain("raw token is sent only as an Authorization bearer");
    expect(packet).toContain("POSTs only after opt-in");
    expect(packet).toContain("Replace the old capture list with the current opt-in payload");
    expect(packet).toContain("Slayer task, points, streak and block-list state");
    expect(packet).toContain("no bank, inventory, equipment, GE offers, screenshots, inputs or account login");
    expect(packet).toContain("Authorization on claim/sync requests");
    expect(packet).toContain("Quest and diary completion");
    expect(packet).toContain("Slayer task, points, streak and block-list state");
    expect(packet).toContain("RuneScape password or account login");
    expect(packet).toContain("bank, inventory, equipment or GE offers");
    expect(packet).toContain("Game integrity");
    expect(packet).toContain("Read-only plugin");
    expect(packet).toContain("never clicks, types, swaps menus");
    expect(packet).toContain("No overlays, alerts or in-client recommendations");
    expect(packet).toContain("recommendations live in the external web app");
    expect(packet).toContain("background Thread, not on RuneLite's client thread");
    expect(packet).toContain("named daemon thread");
    expect(packet).toContain("cancels the active OkHttp call");
    expect(packet).not.toContain("interrupt");
    expect(packet).toContain("sha256(token)");
    expect(packet).toContain("raw token is sent only as Authorization on claim/sync requests");
    expect(packet).not.toContain("first-claim security");
    expect(packet).toContain("labels quest, diary, collection-log and Slayer coverage as verified, partial or missing");
    expect(packet).not.toContain("/next uses exact quest, diary, collection-log and Slayer signals instead of inference");
    expect(packet).toContain("Successful sync chat includes the verified /next URL");
    expect(packet).not.toContain("Successful sync chat includes the exact /next URL");
    expect(packet).toContain("source=plugin-sync&bank=none");
    expect(packet).toContain("plugin never receives bank, inventory, equipment, screenshots, clicks or account login");
    expect(packet).toContain("Web-app merge contract");
    expect(packet).toContain("account-progress verifier, not a bank uploader");
    expect(packet).toContain("prevents stale browser bank context from being silently reused");
    expect(packet).toContain("readiness rails");
  });

  it("carries RuneLite review decisions into the maintainer handoff", () => {
    const packet = buildPluginReviewerPacket(changesRequestedStatus);
    const body = buildPluginPrBodyReplacement(changesRequestedStatus);

    expect(packet).toContain("Review decision: RuneLite review requested changes");
    expect(packet).toContain("move the Plugin Hub pin");
    expect(packet).toContain("reply with the reviewer packet");
    expect(body).toContain("Review decision: RuneLite review requested changes");
    expect(body).toContain("PR body copy: Live PR body still needs review-copy fixes");
  });

  it("prints the same reviewer packet from the CLI in offline mode", () => {
    const output = execFileSync("npx", ["tsx", "scripts/print-plugin-review-packet.ts", "--offline"], {
      encoding: "utf8"
    });

    expect(output).toContain("Scapestack Sync v0.2.0");
    expect(output).toContain("Offline reviewer packet");
    expect(output).toContain("Auto-sync on login defaults off");
    expect(output).toContain("Quest-complete sync is also gated behind Auto-sync on login");
    expect(output).toContain("enabling the quest-complete setting alone never sends a payload");
    expect(output).toContain("replace stale PR-body copy");
    expect(output).toContain("Stale PR-body replacements");
    expect(output).toContain("Replace “Auto-sync defaults to on”");
    expect(output).toContain("Replace the old capture list with the current opt-in payload");
    expect(output).toContain("background Thread, not on RuneLite's client thread");
    expect(output).toContain("cancels the active OkHttp call");
    expect(output).not.toContain("interrupt");
    expect(output).toContain("source=plugin-sync&bank=none");
  }, CLI_TIMEOUT_MS);

  it("formats a full PR-body replacement with current consent and handoff wording", () => {
    const body = buildPluginPrBodyReplacement(status);

    expect(body).toContain("Adds Scapestack Sync v0.2.0");
    expect(body).toContain("## Current review state");
    expect(body).toContain("Status: Plugin Hub PR #12536 open");
    expect(body).toContain("PR body copy: Live PR body still needs review-copy fixes");
    expect(body).toContain("## What it captures after player opt-in");
    expect(body).toContain("Slayer task, points, streak and block-list state");
    expect(body).toContain("## What it never captures");
    expect(body).toContain("screenshots, client files, config folders, IP or machine fingerprint");
    expect(body).toContain("## Game integrity");
    expect(body).toContain("Read-only plugin");
    expect(body).toContain("No overlays, alerts or in-client recommendations");
    expect(body).toContain("Auto-sync on login defaults off");
    expect(body).toContain("Sync on quest complete defaults off");
    expect(body).toContain("Quest-complete sync is also gated behind Auto-sync on login");
    expect(body).toContain("enabling the quest-complete setting alone never sends a payload");
    expect(body).toContain("Authorization: Bearer <token>");
    expect(body).toContain("Scapestack stores `sha256(token)`");
    expect(body).toContain("for the RSN claim");
    expect(body).not.toContain("first-claim security");
    expect(body).toContain("background Thread, not RuneLite's client thread");
    expect(body).toContain("Shutdown cancels the active OkHttp call");
    expect(body).not.toContain("interrupt");
    expect(body).toContain("/next?rsn=...&source=plugin-sync&bank=none");
    expect(body).toContain("Successful sync chat includes the verified `/next");
    expect(body).not.toContain("Successful sync chat includes the exact `/next");
    expect(body).toContain("bank context is never sent to the plugin");
    expect(body).toContain("## Web-app merge contract");
    expect(body).toContain("The plugin is an account-progress verifier, not a bank uploader.");
    expect(body).toContain("Players who want gear-aware advice paste Bank Memory or Bank Tags");
    expect(body).toContain("/next, /slayer, /dps, /goals and player profiles all show readiness rails");
  });

  it("prints the PR-body replacement from the CLI", () => {
    const output = execFileSync("npx", ["tsx", "scripts/print-plugin-review-packet.ts", "--offline", "--body"], {
      encoding: "utf8"
    });

    expect(output).toContain("Adds Scapestack Sync v0.2.0");
    expect(output).toContain("Offline reviewer packet");
    expect(output).toContain("Auto-sync on login defaults off");
    expect(output).toContain("Quest-complete sync is also gated behind Auto-sync on login");
    expect(output).toContain("Authorization: Bearer <token>");
    expect(output).toContain("bank context is never sent to the plugin");
    expect(output).toContain("Web-app merge contract");
    expect(output).toContain("source=plugin-sync");
    expect(output).toContain("bank=none");
  }, CLI_TIMEOUT_MS);

  it("builds a safe GitHub CLI command for replacing stale PR body copy", () => {
    const command = buildPluginPrBodyUpdateCommand();

    expect(command).toContain(`npm run --silent plugin:pr-body > ${DEFAULT_PR_BODY_FILE}`);
    expect(command).not.toContain("--offline");
    expect(command).toContain("gh pr edit 12536 --repo runelite/plugin-hub --body-file");
    expect(command).toContain(DEFAULT_PR_BODY_FILE);
  });

  it("can still build an explicit offline PR update command for no-network prep", () => {
    const command = buildPluginPrBodyUpdateCommand({ offline: true });

    expect(command).toContain(`npm run --silent plugin:pr-body -- --offline > ${DEFAULT_PR_BODY_FILE}`);
    expect(command).toContain("gh pr edit 12536 --repo runelite/plugin-hub --body-file");
  });

  it("builds a safe GitHub CLI command for adding the reviewer packet as a maintainer reply", () => {
    const command = buildPluginReviewerReplyCommand();

    expect(command).toContain(`npm run --silent plugin:review-packet > ${DEFAULT_REVIEWER_PACKET_FILE}`);
    expect(command).not.toContain("--offline");
    expect(command).toContain("gh pr comment 12536 --repo runelite/plugin-hub --body-file");
    expect(command).toContain(DEFAULT_REVIEWER_PACKET_FILE);
  });

  it("can build an offline reviewer reply command for no-network prep", () => {
    const command = buildPluginReviewerReplyCommand({ offline: true });

    expect(command).toContain(`npm run --silent plugin:review-packet -- --offline > ${DEFAULT_REVIEWER_PACKET_FILE}`);
    expect(command).toContain("gh pr comment 12536 --repo runelite/plugin-hub --body-file");
  });

  it("builds one authenticated GitHub CLI handoff command for body plus reviewer comment", () => {
    const command = buildPluginReviewerHandoffCommand();

    expect(command).toContain(`npm run --silent plugin:pr-body > ${DEFAULT_PR_BODY_FILE}`);
    expect(command).toContain(`npm run --silent plugin:review-packet > ${DEFAULT_REVIEWER_PACKET_FILE}`);
    expect(command).toContain(`gh pr edit 12536 --repo runelite/plugin-hub --body-file ${DEFAULT_PR_BODY_FILE}`);
    expect(command).toContain(`gh pr comment 12536 --repo runelite/plugin-hub --body-file ${DEFAULT_REVIEWER_PACKET_FILE}`);
    expect(command).not.toContain("--offline");
  });

  it("can build an offline reviewer handoff command for no-network prep", () => {
    const command = buildPluginReviewerHandoffCommand({ offline: true });

    expect(command).toContain(`npm run --silent plugin:pr-body -- --offline > ${DEFAULT_PR_BODY_FILE}`);
    expect(command).toContain(`npm run --silent plugin:review-packet -- --offline > ${DEFAULT_REVIEWER_PACKET_FILE}`);
    expect(command).toContain("gh pr edit 12536 --repo runelite/plugin-hub --body-file");
    expect(command).toContain("gh pr comment 12536 --repo runelite/plugin-hub --body-file");
  });

  it("prints the PR update command from the CLI", () => {
    const output = execFileSync("npx", ["tsx", "scripts/print-plugin-review-packet.ts", "--gh-command"], {
      encoding: "utf8"
    });

    expect(output).toContain("npm run --silent plugin:pr-body >");
    expect(output).toContain("gh pr edit 12536 --repo runelite/plugin-hub --body-file");
    expect(output).not.toContain("--offline");
    expect(output).not.toContain("Adds Scapestack Sync v0.2.0");
  }, CLI_TIMEOUT_MS);

  it("prints an offline PR update command from the CLI when requested", () => {
    const output = execFileSync("npx", ["tsx", "scripts/print-plugin-review-packet.ts", "--gh-command", "--offline"], {
      encoding: "utf8"
    });

    expect(output).toContain("npm run --silent plugin:pr-body -- --offline >");
    expect(output).toContain("gh pr edit 12536 --repo runelite/plugin-hub --body-file");
    expect(output).not.toContain("Adds Scapestack Sync v0.2.0");
  }, CLI_TIMEOUT_MS);

  it("prints the reviewer reply command from the CLI", () => {
    const output = execFileSync("npx", ["tsx", "scripts/print-plugin-review-packet.ts", "--reply-command"], {
      encoding: "utf8"
    });

    expect(output).toContain("npm run --silent plugin:review-packet >");
    expect(output).toContain("gh pr comment 12536 --repo runelite/plugin-hub --body-file");
    expect(output).not.toContain("--offline");
    expect(output).not.toContain("Scapestack Sync v0.2.0");
  }, CLI_TIMEOUT_MS);

  it("prints an offline reviewer reply command from the CLI when requested", () => {
    const output = execFileSync("npx", ["tsx", "scripts/print-plugin-review-packet.ts", "--reply-command", "--offline"], {
      encoding: "utf8"
    });

    expect(output).toContain("npm run --silent plugin:review-packet -- --offline >");
    expect(output).toContain("gh pr comment 12536 --repo runelite/plugin-hub --body-file");
    expect(output).not.toContain("Scapestack Sync v0.2.0");
  }, CLI_TIMEOUT_MS);

  it("prints the combined reviewer handoff command from the CLI", () => {
    const output = execFileSync("npx", ["tsx", "scripts/print-plugin-review-packet.ts", "--handoff-command"], {
      encoding: "utf8"
    });

    expect(output).toContain("npm run --silent plugin:pr-body >");
    expect(output).toContain("npm run --silent plugin:review-packet >");
    expect(output).toContain("gh pr edit 12536 --repo runelite/plugin-hub --body-file");
    expect(output).toContain("gh pr comment 12536 --repo runelite/plugin-hub --body-file");
    expect(output).not.toContain("--offline");
    expect(output).not.toContain("Scapestack Sync v0.2.0");
  }, CLI_TIMEOUT_MS);

  it("prints an offline combined reviewer handoff command from the CLI when requested", () => {
    const output = execFileSync("npx", ["tsx", "scripts/print-plugin-review-packet.ts", "--handoff-command", "--offline"], {
      encoding: "utf8"
    });

    expect(output).toContain("npm run --silent plugin:pr-body -- --offline >");
    expect(output).toContain("npm run --silent plugin:review-packet -- --offline >");
    expect(output).toContain("gh pr edit 12536 --repo runelite/plugin-hub --body-file");
    expect(output).toContain("gh pr comment 12536 --repo runelite/plugin-hub --body-file");
    expect(output).not.toContain("Scapestack Sync v0.2.0");
  }, CLI_TIMEOUT_MS);
});
