# Privacy and security threat model

## Data inventory

- RSN and display name: used to attach Hiscores, RuneLite sync and browser
  pairing to the same account.
- Plugin claim token: sent only as `Authorization: Bearer ...` on claim/sync
  requests. Scapestack stores only `sha256(token)`.
- Browser account session: stored as an HttpOnly, SameSite=Lax cookie. The
  database stores only a hash of the browser session secret.
- Latest RuneLite state: current skills, quests, diaries, clog item IDs, boss
  KC, Slayer, plugin version and optional bank item IDs/names/quantities.
- Historical snapshots: account progress summaries and compact bank summaries.
  Full historical banks are not copied into snapshot history.
- Recommendation history: typed decisions, trip lifecycle events, matched
  outcomes and preference choices.
- Bank share links: compact Bank Tags snapshots. They are not account-auth
  material and must not expose credentials or plugin tokens.

## Main threats and controls

- Account overwrite: `/api/sync` requires the bearer token bound by
  `/api/sync/claim`; a rival token for the same RSN is rejected.
- Claim replay/takeover: raw claim tokens are never stored, same-token reclaims
  are idempotent, different-token conflicts return 409.
- Account enumeration: browser history and deletion require a connected session;
  delete never accepts a target RSN from query/body.
- CSRF on destructive browser routes: `DELETE /api/account/delete` rejects
  cross-origin browser requests and the account cookie is SameSite=Lax.
- Oversized payloads: claim and sync routes reject oversized declared or actual
  bodies before persistence.
- Secret leakage: player-facing responses and tests must not include raw claim
  tokens, browser session hashes, raw plugin payloads or complete historical
  bank contents.
- Retention creep: snapshot history stores progress and compact bank summaries;
  explicit privacy deletion cascades through account identity, latest sync,
  claim, snapshots, decisions, trip events, outcomes, preferences and retention
  metadata.

## Deletion behavior

Disconnecting a browser at `/api/account/me` only revokes that browser session.
Deleting account history is separate and destructive: `DELETE /api/account/delete`
uses the currently connected account, deletes server-side history for that
account, revokes the browser session and clears the cookie.
