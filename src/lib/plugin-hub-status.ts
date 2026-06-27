export const PLUGIN_HUB_PR_NUMBER = 12536;
export const PLUGIN_HUB_PR_URL = `https://github.com/runelite/plugin-hub/pull/${PLUGIN_HUB_PR_NUMBER}`;

const PR_API_URL = `https://api.github.com/repos/runelite/plugin-hub/pulls/${PLUGIN_HUB_PR_NUMBER}`;
const REVIEWS_API_URL = `${PR_API_URL}/reviews`;
const FILES_API_URL = `${PR_API_URL}/files`;
const STANDALONE_COMMIT_API_URL = "https://api.github.com/repos/laurensbs/scapestack-runelite-plugin/commits/main";

type GitHubPullRequest = {
  state?: unknown;
  draft?: unknown;
  merged_at?: unknown;
  updated_at?: unknown;
  html_url?: unknown;
  body?: unknown;
  head?: {
    sha?: unknown;
  };
};

type GitHubReview = {
  id?: unknown;
  state?: unknown;
};

type GitHubCheckRun = {
  name?: unknown;
  conclusion?: unknown;
  status?: unknown;
};

type GitHubPullRequestFile = {
  filename?: unknown;
  patch?: unknown;
};

type GitHubCommit = {
  sha?: unknown;
};

export type PluginHubStatusTone = "good" | "warning" | "danger" | "accent";

export interface PluginHubStatus {
  state: "open" | "merged" | "closed" | "unknown";
  tone: PluginHubStatusTone;
  label: string;
  detail: string;
  checkSummary: string | null;
  submittedCommit: string | null;
  standaloneCommit: string | null;
  pinSummary: string | null;
  reviewCopySummary: string | null;
  reviewCopyIssues: string[];
  updatedAt: string | null;
  reviewCount: number | null;
  reviewSummary: string | null;
  url: string;
}

export type PluginHubReviewReadinessState = "installable" | "review-blocked" | "pending-review" | "closed" | "unknown";

export interface PluginHubReviewReadiness {
  state: PluginHubReviewReadinessState;
  tone: PluginHubStatusTone;
  label: string;
  detail: string;
  blockers: string[];
  playerInstallReady: boolean;
}

export type PluginHubMaintainerReviewGateState =
  | "unreviewed"
  | "changes-requested"
  | "approved"
  | "reviewed"
  | "closed"
  | "unknown";

export interface PluginHubMaintainerReviewGate {
  state: PluginHubMaintainerReviewGateState;
  tone: PluginHubStatusTone;
  title: string;
  body: string;
  nextAction: string;
}

const FALLBACK_STATUS: PluginHubStatus = {
  state: "unknown",
  tone: "accent",
  label: `Plugin Hub PR #${PLUGIN_HUB_PR_NUMBER}`,
  detail: "Live GitHub status unavailable right now — open the PR for the source of truth.",
  checkSummary: null,
  submittedCommit: null,
  standaloneCommit: null,
  pinSummary: null,
  reviewCopySummary: null,
  reviewCopyIssues: [],
  updatedAt: null,
  reviewCount: null,
  reviewSummary: null,
  url: PLUGIN_HUB_PR_URL
};

export function pluginHubReviewReadiness(status: PluginHubStatus): PluginHubReviewReadiness {
  if (status.state === "merged") {
    return {
      state: "installable",
      tone: "good",
      label: "Plugin Hub install can be advertised",
      detail: "RuneLite has merged the submission. Players can use the Plugin Hub install path, then verify a payload before trusting coverage labels.",
      blockers: [],
      playerInstallReady: true
    };
  }

  if (status.state === "closed") {
    return {
      state: "closed",
      tone: "danger",
      label: "Plugin Hub submission is closed",
      detail: "Do not send normal players to Plugin Hub. Use the local developer path until the upstream submission is restored.",
      blockers: ["PR is closed"],
      playerInstallReady: false
    };
  }

  if (status.state === "unknown") {
    return {
      state: "unknown",
      tone: "warning",
      label: "Plugin Hub install readiness unknown",
      detail: "GitHub status could not prove install readiness. Keep the player path on web recommendations and use the PR as source of truth.",
      blockers: ["Live Plugin Hub state unavailable"],
      playerInstallReady: false
    };
  }

  const blockers = [
    ...status.reviewCopyIssues.map((issue) => `PR body: ${issue}`),
    status.pinSummary?.includes("behind standalone repo head") ? "Plugin Hub pin is behind standalone repo head" : null,
    status.reviewSummary?.includes("requested changes") ? "RuneLite review requested changes" : null
  ].filter((blocker): blocker is string => Boolean(blocker));

  if (blockers.length > 0) {
    return {
      state: "review-blocked",
      tone: "warning",
      label: "Review handoff is not clean yet",
      detail: "The plugin can be tested locally, but normal players should not be sent to Plugin Hub while reviewer-facing copy or the pinned commit is stale.",
      blockers,
      playerInstallReady: false
    };
  }

  return {
    state: "pending-review",
    tone: "accent",
    label: "Ready for maintainer review, not player install",
    detail: "The handoff appears clean, but RuneLite has not merged it yet. Keep normal players on web recommendations until the PR is merged.",
    blockers: ["Awaiting RuneLite maintainer review"],
    playerInstallReady: false
  };
}

export function pluginHubMaintainerReviewGate(status: PluginHubStatus | null): PluginHubMaintainerReviewGate {
  if (!status || status.state === "unknown") {
    return {
      state: "unknown",
      tone: "warning",
      title: "Maintainer review not proven",
      body: "Scapestack cannot prove RuneLite review state right now. Treat Plugin Hub as unavailable until the live PR confirms review progress.",
      nextAction: "Open the live PR before changing player-facing install copy."
    };
  }

  if (status.state === "merged") {
    return {
      state: "approved",
      tone: "good",
      title: "Maintainer review complete",
      body: "RuneLite merged the Plugin Hub submission. Player install can be advertised after a payload is verified for the same RSN.",
      nextAction: "Keep the verify step visible so install never implies account-state proof."
    };
  }

  if (status.state === "closed") {
    return {
      state: "closed",
      tone: "danger",
      title: "Maintainer review path closed",
      body: "The Plugin Hub PR is closed. Public RuneLite install is not available from this submission.",
      nextAction: "Keep players on web recommendations and restore the upstream PR path first."
    };
  }

  const reviewSummary = status.reviewSummary?.toLowerCase() ?? "";
  if (reviewSummary.includes("requested changes")) {
    return {
      state: "changes-requested",
      tone: "warning",
      title: "Maintainer changes requested",
      body: status.reviewSummary ?? "RuneLite review requested changes on the Plugin Hub submission.",
      nextAction: "Update the standalone plugin, move the Plugin Hub pin, then reply with the reviewer packet."
    };
  }

  if (reviewSummary.includes("approval recorded")) {
    return {
      state: "approved",
      tone: "accent",
      title: "Maintainer approval recorded",
      body: status.reviewSummary ?? "RuneLite approval is recorded, but the PR still needs to merge before public install copy is safe.",
      nextAction: "Wait for merge before advertising Plugin Hub install to normal players."
    };
  }

  if (status.reviewCount === 0) {
    return {
      state: "unreviewed",
      tone: "warning",
      title: "No maintainer review yet",
      body: "GitHub shows 0 RuneLite reviews. This is submitted, not evaluated: do not treat Plugin Hub as a soft launch.",
      nextAction: "Keep players on bank paste and /next; keep the PR body, pin and reviewer packet ready for the first maintainer pass."
    };
  }

  if (typeof status.reviewCount === "number") {
    return {
      state: "reviewed",
      tone: "accent",
      title: `${status.reviewCount} review event${status.reviewCount === 1 ? "" : "s"} recorded`,
      body: status.reviewSummary ?? "RuneLite review activity exists on the Plugin Hub PR. Check GitHub before changing player-facing install copy.",
      nextAction: "Resolve any maintainer feedback before using Plugin Hub as the normal player path."
    };
  }

  return {
    state: "unknown",
    tone: "warning",
    title: "Review count unavailable",
    body: "The PR is open, but Scapestack could not prove whether RuneLite maintainers have reviewed it.",
    nextAction: "Use the live PR as source of truth and keep public install copy disabled."
  };
}

function decodeHtmlText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function summarizePluginHubPublicHtml(html: string): PluginHubStatus | null {
  if (!html.trim()) return null;
  const text = decodeHtmlText(html);
  const lower = text.toLowerCase();
  if (!lower.includes(`add scapestack-sync#${PLUGIN_HUB_PR_NUMBER}`) && !lower.includes(`add scapestack-sync #${PLUGIN_HUB_PR_NUMBER}`)) {
    return null;
  }

  const state: PluginHubStatus["state"] = lower.includes(`plugin hub pr #${PLUGIN_HUB_PR_NUMBER} merged`)
    ? "merged"
    : lower.includes(`plugin hub pr #${PLUGIN_HUB_PR_NUMBER} closed`)
      ? "closed"
      : lower.includes(`plugin hub pr #${PLUGIN_HUB_PR_NUMBER} open`)
        ? "open"
        : lower.includes("awaiting runelite maintainer review")
          ? "open"
        : lower.includes(" merged ")
          ? "merged"
          : lower.includes(" closed ")
            ? "closed"
            : lower.includes(" open ")
              ? "open"
              : "unknown";
  const reviewCopyIssues = reviewCopyIssuesFromBody(text);
  const reviewCopySummary = summarizeReviewCopy(text, reviewCopyIssues);
  const reviewCount = lower.includes("no reviews") ? 0 : null;
  const submittedCommit =
    html.match(/scapestack-runelite-plugin\/tree\/([a-f0-9]{40})/i)?.[1]
    ?? text.match(/scapestack-runelite-plugin\/tree\/([a-f0-9]{40})/i)?.[1]
    ?? null;

  return {
    state,
    tone: reviewCopyIssues.length > 0 ? "warning" : state === "merged" ? "good" : "accent",
    label: state === "merged"
      ? `Plugin Hub PR #${PLUGIN_HUB_PR_NUMBER} merged`
      : state === "closed"
        ? `Plugin Hub PR #${PLUGIN_HUB_PR_NUMBER} closed`
        : state === "open"
          ? `Plugin Hub PR #${PLUGIN_HUB_PR_NUMBER} open`
          : `Plugin Hub PR #${PLUGIN_HUB_PR_NUMBER}`,
    detail: reviewCount === 0
      ? "GitHub API is unavailable, but the public PR page still shows the submission open with no reviews."
      : "GitHub API is unavailable, but the public PR page is readable. Open the PR for the final source of truth.",
    checkSummary: lower.includes("this plugin requires a review from a plugin hub maintainer")
      ? "Public PR page shows the RuneLite maintainer-review gate."
      : null,
    submittedCommit,
    standaloneCommit: null,
    pinSummary: null,
    reviewCopySummary,
    reviewCopyIssues,
    updatedAt: null,
    reviewCount,
    reviewSummary: reviewCount === 0
      ? "No RuneLite reviews recorded yet. Keep the PR body, pinned commit and reviewer packet ready before a maintainer starts review."
      : null,
    url: PLUGIN_HUB_PR_URL
  };
}

function submittedCommitFromFiles(files: GitHubPullRequestFile[] | null): string | null {
  if (!Array.isArray(files)) return null;
  const pluginFile = files.find((file) => file.filename === "plugins/scapestack-sync");
  const patch = typeof pluginFile?.patch === "string" ? pluginFile.patch : "";
  const match = patch.match(/^\+commit=([a-f0-9]{40})$/m);
  return match?.[1] ?? null;
}

function summarizeCheckRuns(checks: GitHubCheckRun[] | null): string | null {
  if (!Array.isArray(checks) || checks.length === 0) return null;

  const normalized = checks.map((check) => ({
    name: typeof check.name === "string" ? check.name : "",
    conclusion: typeof check.conclusion === "string" ? check.conclusion.toLowerCase() : "",
    status: typeof check.status === "string" ? check.status.toLowerCase() : ""
  }));

  const build = normalized.find((check) => check.name === "build");
  const pluginHubGate = normalized.find((check) => check.name === "RuneLite Plugin Hub Checks");
  const failingNonReviewChecks = normalized.filter((check) => {
    if (check.name === "RuneLite Plugin Hub Checks") return false;
    return ["failure", "cancelled", "timed_out", "action_required"].includes(check.conclusion);
  });

  if (failingNonReviewChecks.length > 0) {
    return `${failingNonReviewChecks.length} CI check${failingNonReviewChecks.length === 1 ? "" : "s"} need attention before Plugin Hub review.`;
  }

  if (build?.conclusion === "success" && pluginHubGate?.conclusion === "failure") {
    return "Build is passing; RuneLite Plugin Hub Checks is the maintainer review gate.";
  }

  if (build?.conclusion === "success") {
    return "Build is passing for the pinned Plugin Hub commit.";
  }

  if (normalized.some((check) => check.status !== "completed")) {
    return "GitHub checks are still running.";
  }

  return null;
}

function summarizePinStatus(submittedCommit: string | null, standaloneCommit: string | null): string | null {
  if (!submittedCommit || !standaloneCommit) return null;
  if (submittedCommit === standaloneCommit) {
    return `Plugin Hub pin matches standalone repo head ${submittedCommit.slice(0, 7)}.`;
  }
  return `Plugin Hub pin ${submittedCommit.slice(0, 7)} is behind standalone repo head ${standaloneCommit.slice(0, 7)}. Update the PR pin before review.`;
}

function reviewCopyIssuesFromBody(body: unknown): string[] {
  if (typeof body !== "string" || !body.trim()) return [];
  const normalized = body.toLowerCase().replace(/[‐‑‒–—]/g, "-");
  const issues: string[] = [];

  if (normalized.includes("auto-sync defaults to on")
    || (normalized.includes("auto") && normalized.includes("defaults to on"))) {
    issues.push("auto-sync defaults");
  }
  if (normalized.includes("raw token never leaves")) {
    issues.push("token transport");
  }
  if (normalized.includes("post `https://www.scapestack.org/api/sync` on every login")
    || normalized.includes("post https://www.scapestack.org/api/sync on every login")
    || normalized.includes("on every login + on quest-complete")) {
    issues.push("POST timing");
  }
  if (normalized.includes("shutdown interrupts")
    || normalized.includes("thread interrupt")
    || normalized.includes("interrupts the named daemon")
    || normalized.includes("interrupts that worker")
    || normalized.includes("interrupts it")) {
    issues.push("shutdown thread interrupt");
  }
  if (!normalized.includes("sync on quest complete defaults off")
    || !normalized.includes("quest-complete sync is also gated behind auto-sync on login")) {
    issues.push("quest-complete opt-in gate");
  }
  if (!normalized.includes("slayer")) {
    issues.push("Slayer payload");
  }
  if (!normalized.includes("bank") || !normalized.includes("inventory") || !normalized.includes("equipment")) {
    issues.push("bank/inventory/equipment exclusion");
  }

  return issues;
}

function summarizeReviewCopy(body: unknown, issues = reviewCopyIssuesFromBody(body)): string | null {
  if (typeof body !== "string" || !body.trim()) return null;
  if (issues.length === 0) return "Live PR body appears aligned with current consent, token, data and web-handoff wording.";
  return `Live PR body still needs review-copy fixes: ${issues.join(", ")}.`;
}

function summarizeReviews(reviews: GitHubReview[] | null): string | null {
  if (!Array.isArray(reviews)) return null;
  if (reviews.length === 0) {
    return "No RuneLite reviews recorded yet. Keep the PR body, pinned commit and reviewer packet ready before a maintainer starts review.";
  }

  const states = reviews
    .map((review) => typeof review.state === "string" ? review.state.toUpperCase() : "")
    .filter(Boolean);
  if (states.includes("CHANGES_REQUESTED")) {
    return "RuneLite review requested changes. Update the standalone plugin repo, move the Plugin Hub pin, then reply with the reviewer packet.";
  }
  if (states.includes("APPROVED")) {
    return "RuneLite approval recorded. Watch the PR for merge before advertising Plugin Hub install to normal players.";
  }
  if (states.includes("COMMENTED")) {
    return "RuneLite reviewer comments recorded. Check GitHub for questions before pushing another Plugin Hub pin.";
  }
  return `${states.length} review event${states.length === 1 ? "" : "s"} recorded on GitHub.`;
}

export function summarizePluginHubStatus(
  pr: GitHubPullRequest | null,
  reviews: GitHubReview[] | null,
  checks: GitHubCheckRun[] | null = null,
  files: GitHubPullRequestFile[] | null = null,
  standaloneCommit: string | null = null
): PluginHubStatus {
  if (!pr) return FALLBACK_STATUS;

  const url = typeof pr.html_url === "string" ? pr.html_url : PLUGIN_HUB_PR_URL;
  const updatedAt = typeof pr.updated_at === "string" ? pr.updated_at : null;
  const reviewCount = Array.isArray(reviews)
    ? new Set(reviews.map((review) => review.id).filter((id) => typeof id === "number" || typeof id === "string")).size
    : null;
  const checkSummary = summarizeCheckRuns(checks);
  const submittedCommit = submittedCommitFromFiles(files);
  const pinSummary = summarizePinStatus(submittedCommit, standaloneCommit);
  const reviewCopyIssues = reviewCopyIssuesFromBody(pr.body);
  const reviewCopySummary = summarizeReviewCopy(pr.body, reviewCopyIssues);
  const reviewSummary = summarizeReviews(reviews);

  if (typeof pr.merged_at === "string" && pr.merged_at.length > 0) {
    return {
      state: "merged",
      tone: "good",
      label: `Plugin Hub PR #${PLUGIN_HUB_PR_NUMBER} merged`,
      detail: "Approved upstream. Players should be able to install Scapestack Sync from RuneLite Plugin Hub once the hub refreshes.",
      checkSummary,
      submittedCommit,
      standaloneCommit,
      pinSummary,
      reviewCopySummary,
      reviewCopyIssues,
      updatedAt,
      reviewCount,
      reviewSummary,
      url
    };
  }

  if (pr.state === "closed") {
    return {
      state: "closed",
      tone: "danger",
      label: `Plugin Hub PR #${PLUGIN_HUB_PR_NUMBER} closed`,
      detail: "The Plugin Hub PR is closed. Use the developer install path until the upstream submission is restored.",
      checkSummary,
      submittedCommit,
      standaloneCommit,
      pinSummary,
      reviewCopySummary,
      reviewCopyIssues,
      updatedAt,
      reviewCount,
      reviewSummary,
      url
    };
  }

  if (pr.state === "open") {
    const draft = pr.draft === true;
    const reviewed = reviewCount !== null && reviewCount > 0;
    return {
      state: "open",
      tone: draft ? "warning" : "accent",
      label: draft
        ? `Plugin Hub PR #${PLUGIN_HUB_PR_NUMBER} draft`
        : `Plugin Hub PR #${PLUGIN_HUB_PR_NUMBER} open`,
      detail: reviewed
        ? `${reviewCount} review${reviewCount === 1 ? "" : "s"} recorded. Track GitHub for requested changes before Plugin Hub install.`
        : "Awaiting RuneLite maintainer review. Use developer install while the Plugin Hub submission is pending.",
      checkSummary,
      submittedCommit,
      standaloneCommit,
      pinSummary,
      reviewCopySummary,
      reviewCopyIssues,
      updatedAt,
      reviewCount,
      reviewSummary,
      url
    };
  }

  return { ...FALLBACK_STATUS, checkSummary, submittedCommit, standaloneCommit, pinSummary, reviewCopySummary, reviewCopyIssues, updatedAt, reviewCount, reviewSummary, url };
}

export async function getPluginHubStatus(): Promise<PluginHubStatus> {
  try {
    const [prResponse, reviewsResponse, filesResponse, standaloneResponse] = await Promise.all([
      fetch(PR_API_URL, {
        headers: {
          "accept": "application/vnd.github+json",
          "user-agent": "scapestack-plugin-status"
        },
        next: { revalidate: 300 }
      }),
      fetch(REVIEWS_API_URL, {
        headers: {
          "accept": "application/vnd.github+json",
          "user-agent": "scapestack-plugin-status"
        },
        next: { revalidate: 300 }
      }),
      fetch(FILES_API_URL, {
        headers: {
          "accept": "application/vnd.github+json",
          "user-agent": "scapestack-plugin-status"
        },
        next: { revalidate: 300 }
      }),
      fetch(STANDALONE_COMMIT_API_URL, {
        headers: {
          "accept": "application/vnd.github+json",
          "user-agent": "scapestack-plugin-status"
        },
        next: { revalidate: 300 }
      })
    ]);

    if (!prResponse.ok) {
      const publicResponse = await fetch(PLUGIN_HUB_PR_URL, {
        headers: {
          "accept": "text/html",
          "user-agent": "scapestack-plugin-status"
        },
        next: { revalidate: 300 }
      });
      if (publicResponse.ok) {
        const publicStatus = summarizePluginHubPublicHtml(await publicResponse.text());
        if (publicStatus) return publicStatus;
      }
      return FALLBACK_STATUS;
    }

    const pr = await prResponse.json() as GitHubPullRequest;
    const reviews = reviewsResponse.ok
      ? await reviewsResponse.json() as GitHubReview[]
      : null;
    const files = filesResponse.ok
      ? await filesResponse.json() as GitHubPullRequestFile[]
      : null;
    const standalone = standaloneResponse.ok
      ? await standaloneResponse.json() as GitHubCommit
      : null;
    const standaloneCommit = typeof standalone?.sha === "string" ? standalone.sha : null;
    const headSha = typeof pr.head?.sha === "string" ? pr.head.sha : null;
    const checks = headSha
      ? await fetch(`https://api.github.com/repos/runelite/plugin-hub/commits/${headSha}/check-runs`, {
          headers: {
            "accept": "application/vnd.github+json",
            "user-agent": "scapestack-plugin-status"
          },
          next: { revalidate: 300 }
        }).then(async (response) => {
          if (!response.ok) return null;
          const payload = await response.json() as { check_runs?: unknown };
          return Array.isArray(payload.check_runs) ? payload.check_runs as GitHubCheckRun[] : null;
        })
      : null;

    return summarizePluginHubStatus(pr, reviews, checks, files, standaloneCommit);
  } catch {
    return FALLBACK_STATUS;
  }
}
