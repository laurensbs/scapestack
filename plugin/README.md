# Scapestack Sync — RuneLite plugin

Reads your quest list, diary completions, collection log, and Slayer state
out of the running OSRS client. After you opt in to sync, it uploads snapshots
to www.scapestack.org/api/sync. The next time you visit `/next`, the
Path-to-Max progress can label quest, diary, collection-log and Slayer
coverage from a verified RuneLite payload instead of relying only on
skill/QP heuristics.

## What it captures

| Signal | Source | Status |
| --- | --- | --- |
| Quests completed | `Quest.getState(client)` per quest enum | ✅ |
| Diary tier completion | VarPlayer/Varbit table (48 entries) | ✅ |
| Collection log items | Widget tree walk (group 621), accumulated across session | ✅ |
| Slayer task, streak, points and blocks | RuneLite Slayer plugin config + client state | ✅ |

The CL accumulator fills as the player browses tabs in the in-game
Collection Log; the player has to actually open it at least once per
session. Diary state and quest state are read instantly on login.

## What it never captures

Scapestack Sync is progress sync, not account access. It never reads or sends:

- RuneScape password, email, authenticator, or account login
- bank tabs, inventory, equipment, Grand Exchange offers, or wealth
- chat messages, friends list, private messages, or clan chat
- Mouse clicks, key presses, menu entries, or gameplay inputs
- Screenshots, local files, RuneLite config folders, or plugin lists

Opted-in sync payloads are limited to RSN, plugin version, quest states,
diary states, loaded collection-log item IDs, Slayer state, and the local
install token used for claim authorization.

## Sync opt-in

The plugin does not POST data by default. After installing, open RuneLite
Configuration → Scapestack Sync and enable:

- `Auto-sync on login` to send account snapshots when you log in. If you are
  already logged in, enabling it sends the first snapshot immediately.
- `Sync on quest complete` if you also want an immediate refresh after quests.

`Show chat feedback` stays enabled by default so players can see when a sync
starts, succeeds, fails, or needs a fresh claim. A successful sync includes
the verified `/next?rsn=...&source=plugin-sync&bank=none` link for that account,
using your configured Sync endpoint's origin for local/self-hosted testing.
The `bank=none` marker is deliberate: RuneLite sync does not send bank,
inventory, equipment or wealth, so `/next` only uses plugin-safe account
state unless you separately paste a bank into the web app.
If you log in before opting in, the plugin shows a one-time chat hint instead
of sending data.

## Web app merge contract

Scapestack Sync is an account-progress verifier, not a bank uploader. A
successful sync chat message opens:

```text
/next?rsn=...&source=plugin-sync&bank=none
```

- `source=plugin-sync` tells Scapestack to load the verified RuneLite payload
  for quest, diary, collection-log and Slayer coverage labels.
- `bank=none` prevents stale browser bank context from being silently reused
  after a plugin-only sync.
- Gear-aware advice still requires the player to paste Bank Memory or Bank
  Tags into the web app separately.
- `/next`, `/slayer`, `/dps`, `/goals` and player profiles show Bank, RSN and
  RuneLite sync as separate readiness signals, so players can see which
  evidence is exact, inferred or missing.

## Auth

Each install generates a UUID on first run (stored via `ConfigManager`
under `scapestackSync.installToken`). The first opted-in sync sends that token
over HTTPS as `Authorization: Bearer <token>` to `/api/sync/claim`, which
stores `sha256(token) → RSN` first-wins. Claim and sync requests both carry
the token as `Authorization: Bearer <token>`. Server rejects syncs whose hash
doesn't match the bound claim — so a malicious peer can't overwrite your row
by guessing your RSN.

Threat model + caveats live in [src/lib/sync-auth.ts](../src/lib/sync-auth.ts).

## Local dev setup

Requirements:
- JDK 11 or newer
- The RuneLite repo cloned somewhere nearby (for `runClient`)

```sh
cd plugin
gradle wrapper      # one-time, creates ./gradlew
./gradlew build     # compiles the plugin
./gradlew test      # runs JUnit suite
./gradlew runClient # launches RuneLite with this plugin side-loaded
```

In the dev client, the plugin appears under Configuration → Plugins as
"Scapestack Sync." Toggle it on, enable `Auto-sync on login`, and log in to
any world. Watch the plugin log (Help → Open log folder) for "Synced to
Scapestack: N quests..." messages.

## Pointing at a local backend

The default endpoint is `https://www.scapestack.org/api/sync`, but the plugin
only POSTs after the player enables sync. For local dev, change the Sync
endpoint in plugin settings to
`http://localhost:4173/api/sync` (the Next.js dev port). The claim URL
is derived automatically (`/api/sync/claim`).

You'll also need to start the website locally:
```sh
cd ..        # back to the Next.js root
npm run dev  # starts on localhost:4173
```

And set `DATABASE_URL` in `.env.local` pointing at a Neon project
(create one free at neon.tech), then run `npm run db:init` to create
the schema (both `player_sync` and `player_claim` tables).

## Publishing to the Plugin Hub

See [PUBLISHING.md](PUBLISHING.md) for the full process.

TL;DR: the plugin must live in its own GitHub repo before Jagex/RuneLite
will review it. Run `scripts/extract-plugin.sh` from the monorepo root
to materialise that repo from the current `plugin/` tree.
