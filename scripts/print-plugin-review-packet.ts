#!/usr/bin/env tsx

import {
  buildPluginPrBodyReplacement,
  buildPluginPrBodyUpdateCommand,
  buildPluginReviewerHandoffCommand,
  buildPluginReviewerReplyCommand,
  buildPluginReviewerPacket
} from "../src/lib/plugin-review-packet";
import {
  getPluginHubStatus,
  PLUGIN_HUB_PR_NUMBER,
  PLUGIN_HUB_PR_URL,
  type PluginHubStatus
} from "../src/lib/plugin-hub-status";

const offlineStatus: PluginHubStatus = {
  state: "open",
  tone: "accent",
  label: `Plugin Hub PR #${PLUGIN_HUB_PR_NUMBER} open`,
  detail: "Offline reviewer packet. Run without --offline for live GitHub status when API quota is available.",
  checkSummary: "Run npm run plugin:release-check:live to confirm current GitHub checks and pin status.",
  submittedCommit: null,
  standaloneCommit: null,
  pinSummary: null,
  reviewCopySummary: "Offline mode cannot inspect live PR body copy.",
  reviewCopyIssues: [],
  updatedAt: null,
  reviewCount: null,
  reviewSummary: null,
  url: PLUGIN_HUB_PR_URL
};

const offline = process.argv.includes("--offline");
const bodyOnly = process.argv.includes("--body");
const ghCommandOnly = process.argv.includes("--gh-command");
const replyCommandOnly = process.argv.includes("--reply-command");
const handoffCommandOnly = process.argv.includes("--handoff-command");
const status = offline ? offlineStatus : await getPluginHubStatus();

console.log(
  handoffCommandOnly
    ? buildPluginReviewerHandoffCommand({ offline })
    : replyCommandOnly
    ? buildPluginReviewerReplyCommand({ offline })
    : ghCommandOnly
    ? buildPluginPrBodyUpdateCommand({ offline })
    : bodyOnly
      ? buildPluginPrBodyReplacement(status)
      : buildPluginReviewerPacket(status)
);
