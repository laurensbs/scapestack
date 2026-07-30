# Phase 7 — plugin value and Plugin Hub warning

Date: 2026-07-30. Candidate remains `0.4.0` / snapshot contract `4`, deliberately
unsubmitted.

## What the unsubmitted candidate now contains

The candidate's 225px panel leads with the answer rather than transport plumbing: `NOW`, a
trip, its account-specific reason, `Stop at`, `Now`, `Left`, herb/bird-house
timers, a bank-affordability sentence when it is provable, and `Something else`.
The fallback before the first receipt is `Get answer`; old servers that omit the
new optional receipt continue to sync normally.

`Turn everything on` and the bank toggle are gone from the panel. The single
`Sync on login` control changes only `autoSync`. Browser pairing remains behind
one compact disclosure because removing it here would break the paired-owner
flow delivered in earlier phases.

When the player has explicitly enabled both login sync and bank checks, opening
the bank requests a fresh answer. On a normal account, that is the point at which the plugin can say,
for example, `14,500,000 gp banked. Ahrim's robeskirt — 1,572,490 gp. That
finishes Ahrim's.` The sentence reuses the existing live-GE affordability
engine; a missing/slow price feed or an iron account produces no GE-buying claim.

The previous chat fix is preserved: `Scapestack is syncing your progress...`
remains guarded by `manual`. Bank-open and other background refreshes update the
panel without restoring the 15-minute chat message.

## Plugin Hub warning audit

The contribution rules do not publish a field-by-field list that decides the
warning. They require reviewable source, a pinned immutable commit and Hub CI,
and leave review/warning wording to the behavior under review. The decisive
evidence is the Hub's current manifests:

- [Scapestack Sync's manifest](https://github.com/runelite/plugin-hub/blob/master/plugins/scapestack-sync)
  warns about both IP address and comprehensive account data.
- [Kill Clog's manifest](https://github.com/runelite/plugin-hub/blob/master/plugins/kill-clog)
  carries an IP-only third-party-server warning. This proves that removing
  account fields does not remove the base warning.
- [WikiSync's manifest](https://github.com/runelite/plugin-hub/blob/master/plugins/wikisync)
  uses warning copy specific to the data it broadcasts.
- The [official contribution rules](https://github.com/runelite/plugin-hub/blob/master/README.md)
  describe the immutable-build and review requirements but no safe field
  threshold.

Exact conclusion: the network request is the trigger. HTTPS necessarily exposes
the connection IP to `scapestack.org`. RSN, skill/XP, quests, diaries, collection
log, boss KC, Slayer, timers and bank contents determine how severe and specific
the rest of the warning is; none is a magic threshold. Sending less can remove
`comprehensive account data` from the wording if reviewers agree the remaining
set is narrow, but it cannot remove the third-party/IP warning while the plugin
contacts Scapestack. A warning-free version must be local-only and make no
third-party requests.

## Contract-bump decision for every proposal

| Proposal | Contract bump? | Reason |
|---|---:|---|
| Render compact next-trip answer in the panel | No | Additive optional server response; request contract unchanged. |
| Show herbs and birdhouses separately | No | Already read and sent by prepared contract 4; panel also renders the local snapshot directly. |
| Replace four-setting button with `Sync on login` | No | Existing `autoSync` configuration key only. |
| Return up to three answers for `Something else` | No | Additive optional response member ignored by older plugins. |
| Return the existing bank-affordability sentence | No | Uses bank items already in the request and an additive response member. |
| Refresh after bank open when login sync + bank are enabled | No | New trigger over the existing request shape. |
| Send fewer already-optional domains | No, if only existing opt-outs are used | The current contract already states unavailable/permission-off coverage. The warning remains. |
| Delete required snapshot domains to narrow the payload | Yes | That changes the validated request schema and its coverage guarantees. It still would not remove the base network warning. |
| Build a genuinely local-only, warning-free edition | Not a server-contract evolution | It would remove the sync product and needs a separate product/review decision, not contract 5. |

## Smallest plugin worth installing with no website

Honest answer: **the in-client answer receipt is the minimum if “no website”
means the player never has to open a browser.** It needs only the panel answer,
bank-open refresh, local herb/bird-house timers, bank-affordability line,
`Something else`, and the single login toggle. The Scapestack service still
computes the receipt in the background.

If “no website” means **no Scapestack server at all**, the honest answer is
**none yet**. Timers alone duplicate RuneLite Time Tracking, and local bank
arithmetic alone is not enough to beat Quest Helper or Jagex's Activity Adviser.
A valuable fully local edition would have to ship the recommendation engine,
goal data and a price source inside the plugin; that is materially larger than
this phase and is not being disguised as complete.

Laurens submits to the Plugin Hub. Nothing in this phase submits, pushes or
changes the published `0.3.0` / contract `3` entry.
