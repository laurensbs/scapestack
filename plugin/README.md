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

When sync succeeds, the RuneLite panel shows the next step under the player's
pinned goal: its sprite, stop point and goal fraction, plus live herb/bird-house
timers. `Something else` cycles through the next two measured options. Opening
the bank also checks one exact local result without contacting Scapestack: if a
normal account is one affordable piece short of Ahrim's, the panel names the
piece, RuneLite price, coins in the bank and completed set. Unknown prices,
iron accounts and banks more than one piece short produce no buying claim. If
both `Sync on login` and bank checks are enabled, bank-open still refreshes the
broader server answer. The panel's `Sync on login` control changes that one
setting only.

`Connect` creates a short-lived Scapestack link and opens it with RuneLite's
browser helper. If that browser open is blocked, `Enter code instead` keeps the
typed-code approval flow available.

RuneLite chat stays compact. The old “is syncing” line fires only for manual
syncs; background login, bank-open, quest and interval refreshes do not regress
to periodic chat noise. The plugin does not show or ask for a sync URL. The public plugin always uses the official
Scapestack endpoint automatically; normal players do not paste or configure a
sync URL. Local development can override it with the hidden
`-Dscapestack.syncUrl=http://127.0.0.1:4173/api/sync` JVM property.

For collection-log accuracy, open the in-game Collection Log once and click the
relevant tabs/categories before syncing. RuneLite cannot read the log passively:
it only exposes collection-log item widgets after the game has rendered them.
After one successful read, Scapestack retains the combined progress on the
server, so you do not have to open it again in every RuneLite session. The panel
says whether the log was not opened this session, opened without item slots, or
loaded correctly.

Quest variables are polled for a bounded number of client ticks after login.
If they are still unavailable, the plugin omits quest progress instead of
sending an empty list. It likewise omits collection-log item IDs until the
widget has exposed real item slots. An explicit empty list is reserved for a
successful read that found nothing.

`Full resync` is the repair action for progress stored incorrectly in an older
snapshot. It replaces the saved quest, diary and collection-log progress only
after all three have been read; otherwise the panel says what must be opened or
retried first.

## Data contract

Sent after opt-in: RSN, plugin version, account type, skill levels and XP, quest and diary completion,
loaded collection-log item IDs, boss KC RuneLite has already observed, Slayer state, Combat Achievement points and highest completed tier,
farming-patch and bird-house timers RuneLite's own Time Tracking plugin has recorded,
bank item IDs/names/quantities when bank checks are on,
and the local install token only as the Authorization bearer on claim/sync requests.
As with every HTTPS request, the Scapestack server can see the connection's IP
address. The plugin does not add the IP address to its JSON snapshot.

Boss KC is intentionally sparse: RuneLite only knows a count after it has seen that boss in the
adventure log or after a new kill. Missing bosses stay unknown and are never
reported as zero.

Farm timers are read, never written. The stock Time Tracking plugin already
stores what it sees per RS profile in the `timetracking` config group — patch
varbit plus the time it was seen, and the same for the four Fossil Island
bird-house spaces. Growth durations come from RuneLite's own patch tables, so
they follow the game. A patch RuneLite has never observed is reported as
unknown, not as an empty patch: the domain says `not-loaded` until the player
has actually stood next to something. Turning the Time Tracking plugin off
turns this off with it.

Never sent: RuneScape password, inventory, equipment, GE offers, chat,
friends list, clicks, key presses, screenshots, local files, or RuneLite
config folders, or a machine fingerprint.

Equipment stays on that list in 0.4.0. The snapshot contract has a slot for
it, and the plugin fills that slot with `unsupported` rather than leaving it
out — so the absence is a stated choice a reader can check, not an omission.

The server stores `sha256(token) → RSN` first-wins. The raw token stays
local except for HTTPS claim and sync requests where it is sent as
`Authorization: Bearer <token>` to `/api/sync/claim` and `/api/sync`.
Claim and sync requests both carry the token as `Authorization: Bearer <token>`.

The optional `panel` member in a successful sync response is additive and
backward-compatible. It contains at most three compact answers, an optional
pinned-goal sprite ID and one bank-affordability sentence. It does not add a
transmitted request field and therefore does not change snapshot contract 4.

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
