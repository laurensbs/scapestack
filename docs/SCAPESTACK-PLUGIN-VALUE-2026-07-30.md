# Phase 7 — plugin value and Plugin Hub warning

Updated: 2026-08-01 for Journal Phase 7. Candidate remains `0.4.0` / snapshot contract `4`, deliberately
unsubmitted.

## What the unsubmitted candidate now contains

The candidate's 225px panel leads with the answer rather than transport plumbing: `NOW`,
the next step, the pinned goal it moves, that goal's fraction, `Stop at`, an item
sprite, herb/bird-house timers, a bank-affordability sentence when it is provable,
and `Something else`.
The fallback before the first receipt is `Get answer`; old servers that omit the
new optional receipt continue to sync normally.

`Turn everything on` and the bank toggle are gone from the panel. The single
`Sync on login` control changes only `autoSync`. `Connect` now asks the authenticated
pairing endpoint for a short-lived `/link?code=XXXXXXXX` URL and opens it through
RuneLite's `LinkBrowser`. `Enter code instead` preserves the typed-code fallback for
players whose browser open was blocked.

Opening the bank now computes one useful sentence locally, before and independently
of any sync. On a normal account that owns three Ahrim pieces and can afford the last,
the panel can say `Ahrim's robeskirt is 1,572,490. You have 14,500,000. That
finishes Ahrim's set.` Item identity comes from RuneLite's pinned `ItemID` catalogue,
degraded variants go through `ItemManager.canonicalize`, and the price comes from
RuneLite's `ItemManager`. Unknown prices, insufficient coins, iron accounts, and banks
more than one piece short produce no claim. If login sync and bank transmission are
also enabled, the existing background refresh still requests the broader server answer.

The previous chat fix is preserved: `Scapestack is syncing your progress...`
remains guarded by `manual`. Bank-open and other background refreshes update the
panel without restoring the 15-minute chat message.

## Plugin Hub warning audit

The contribution rules do not publish a field-by-field list or an automated threshold
that decides warning copy. They require reviewable source, a pinned immutable commit
and Hub CI, and leave warning wording to maintainer review. The exact evidence available
for Scapestack is the original review plus current manifests:

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
- In [Scapestack's original Plugin Hub review](https://github.com/runelite/plugin-hub/pull/12536#discussion_r3454303987),
  the maintainer added `comprehensive account data` when the submitted payload named
  RSN, quest and diary completion, loaded collection-log item IDs, Slayer task/points/
  streak/blocks, plugin status, and an install bearer. That reviewed version explicitly
  did **not** send bank, skill, boss-KC or farming-timer data.

Exact conclusion: HTTPS to Scapestack necessarily exposes the connection IP, so any
networked edition retains at least the third-party/IP warning. The reviewed combination
of RSN + quests + diaries + collection-log IDs + Slayer state was already enough for
`comprehensive account data`; bank contents were not the trigger. Skills/XP, boss KC,
timers and optional bank contents only broaden that reviewed set. The public rules do
not let us honestly name one magic field or promise that deleting one field removes the
word `comprehensive`. Sending a much narrower event can plausibly reduce the wording to
IP-only—Kill Clog proves that category exists—but only a maintainer review decides it.
A warning-free edition must be local-only and make no third-party requests.

## Contract-bump decision for every proposal

| Proposal | Contract bump? | Reason |
|---|---:|---|
| Orient the compact panel answer to the account's private pinned goal | No | Private server lookup plus additive response fields; request contract unchanged. |
| Add the pinned-goal sprite to the panel | No | Additive optional response member ignored by older plugins. |
| Show herbs and birdhouses separately | No | Already read and sent by prepared contract 4; panel also renders the local snapshot directly. |
| Replace four-setting button with `Sync on login` | No | Existing `autoSync` configuration key only. |
| Open `/link?code=XXXXXXXX` with RuneLite `LinkBrowser` | No | Uses the already-shipped pairing endpoint; snapshot request contract is unchanged. |
| Keep typed-code approval as browser-blocked fallback | No | Existing pairing request, only moved behind explicit fallback copy. |
| Return up to three answers for `Something else` | No | Additive optional response member ignored by older plugins. |
| Return the existing bank-affordability sentence | No | Uses bank items already in the request and an additive response member. |
| Compute the exact Ahrim completion sentence on bank open | No | Reads RuneLite's local bank and price service; sends nothing and changes no payload. |
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

If “no website” means **no Scapestack server at all**, the honest answer remains
**none yet**. The new live-bank Ahrim sentence proves that local value is possible,
but one exact set check is not a plugin worth installing. Timers duplicate RuneLite
Time Tracking, and isolated bank arithmetic does not beat Quest Helper or Jagex's
Activity Adviser. A valuable fully local edition would have to ship a bounded goal
catalogue and enough recommendation logic to answer several common bank-completion
questions; that is materially larger than this phase and is not being disguised as
complete.

Laurens submits to the Plugin Hub. Nothing in this phase submits, pushes or
changes the published `0.3.0` / contract `3` entry.
