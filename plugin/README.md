# Scapestack Sync — RuneLite plugin

Reads your quest list, diary completions, and collection log out of the
running OSRS client and uploads them to scapestack.app/api/sync. The
next time you visit `/next`, the Path-to-Max progress uses real data
instead of skill/QP heuristics.

## What it captures

| Signal | Source | Status |
| --- | --- | --- |
| Quests completed | `Quest.getState(client)` per quest enum | ✅ |
| Diary tier completion | VarPlayer/Varbit table (48 entries) | ✅ |
| Collection log items | Widget tree walk (group 621), accumulated across session | ✅ |

The CL accumulator fills as the player browses tabs in the in-game
Collection Log; the player has to actually open it at least once per
session. Diary state and quest state are read instantly on login.

## Auth

Each install generates a UUID on first run (stored via `ConfigManager`
under `scapestackSync.installToken`). The first sync POSTs that token
to `/api/sync/claim`, which binds `sha256(token) → RSN` first-wins.
Subsequent syncs carry `Authorization: Bearer <token>`. Server rejects
syncs whose hash doesn't match the bound claim — so a malicious peer
can't overwrite your row by guessing your RSN.

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
"Scapestack Sync." Toggle it on and log in to any world. Watch the
plugin log (Help → Open log folder) for "Synced to Scapestack: N
quests..." messages.

## Pointing at a local backend

By default the plugin POSTs to `https://scapestack.app/api/sync`. For
local dev, change the Sync endpoint in plugin settings to
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
