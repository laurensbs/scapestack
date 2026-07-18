# Scapestack Sync (RuneLite plugin)

Syncs your OSRS account type, skills, XP, quest, diary, collection-log, boss KC RuneLite has seen, Slayer state, and bank items to
[scapestack.org](https://www.scapestack.org) after you opt in via
`Sync on login`, so Scapestack can label skill, quest, diary, collection-log,
bank gear/supplies and Slayer coverage from RuneLite instead of only
hiscores heuristics.

The plugin does not POST progress by default. Enable `Sync on login`
in RuneLite settings to send login snapshots. Bank items are included by default
with item IDs/names/quantities when your bank has been opened; turn off
`Use bank for trips` if you only want progress sync. Optionally enable
`Refresh after quests` for immediate quest refreshes.
Use `Sync now` when you want to refresh the planner on demand; the toggle
resets automatically after the sync starts.

When sync succeeds, RuneLite chat stays compact: it confirms that the Scapestack
planner was updated and tells the player to open `/next`. It does not show or ask
for a sync URL. The public plugin always uses the official
Scapestack endpoint automatically; normal players do not paste or configure a
sync URL. Local development can override it with the hidden
`-Dscapestack.syncUrl=http://127.0.0.1:4173/api/sync` JVM property.

For collection-log accuracy, open the in-game Collection Log once and click the
relevant tabs/categories before syncing. RuneLite only exposes collection-log
item widgets after the game has loaded them, so the plugin now tells you whether
the log was not opened, opened without item slots, or loaded correctly.

## Data contract

Sent after opt-in: RSN, plugin version, account type, skill levels and XP, quest and diary completion,
loaded collection-log item IDs, boss KC RuneLite has already observed, Slayer state, bank item IDs/names/quantities when bank checks are on,
and the local install token only as the Authorization bearer on claim/sync requests.

Boss KC is intentionally sparse: RuneLite only knows a count after it has seen that boss in the
adventure log or after a new kill. Missing bosses stay unknown and are never
reported as zero.

Never sent: RuneScape password, inventory, equipment, GE offers, chat,
friends list, clicks, key presses, screenshots, local files, or RuneLite
config folders, IP address, or machine fingerprint.

The server stores `sha256(token) → RSN` first-wins. The raw token stays
local except for HTTPS claim and sync requests where it is sent as
`Authorization: Bearer <token>` to `/api/sync/claim` and `/api/sync`.
Claim and sync requests both carry the token as `Authorization: Bearer <token>`.

## Web app merge contract

Scapestack Sync is an account-progress helper with bank items included by default.
After sync, the website can load the verified `/next?rsn=...&source=plugin-sync&bank=none`
state without making the RuneLite chat message show a long URL.

- `source=plugin-sync` tells Scapestack to load RuneLite progress
  for skill, quest, diary, collection-log, bank items and Slayer coverage.
- `bank=none` prevents stale browser bank context from being silently reused
  after a plugin sync; when bank checks are on, `/next` can still use
  the fresh RuneLite bank items for quest item checks.
- Gear-aware prices and manual Bank Tags still use browser Bank Memory or Bank
  Tags; that browser-only bank context is never sent to the plugin.
- `/next`, `/slayer`, `/dps`, `/goals` and player profiles use Bank, RSN and
  RuneLite quietly so the plan avoids finished stuff and bad gear assumptions.

This repo is the publish-ready mirror of the canonical source in
[laurensbs/scapestack/plugin](https://github.com/laurensbs/scapestack/tree/main/plugin).
Bug reports, PRs, and roadmap discussion happen in the main repo.

## Install via Plugin Hub

In RuneLite: Configuration → Plugin Hub → search "Scapestack Sync."

## Build locally

```sh
./gradlew build
./gradlew test
./gradlew runClient
```
