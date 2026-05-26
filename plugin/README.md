# Scapestack Sync — RuneLite plugin

Reads your quest list, diary completions, and collection log out of the
running OSRS client and uploads them to scapestack.app/api/sync. The
next time you visit `/next`, the Path-to-Max progress uses real data
instead of skill/QP heuristics.

## What it captures

| Signal | Source | Status |
| --- | --- | --- |
| Quests completed | `Quest.getState(client)` per quest enum | ✅ v0 |
| Diary tier completion | Diary widget scrape | 🚧 v0.2 (stub) |
| Collection log items | CL widget scrape | 🚧 v0.2 (stub) |

v0 ships with quest sync working end-to-end. Diary + CL are stubs that
return empty lists — the website's /next page falls back to its
heuristic + collectionlog.net integration for those signals until v0.2
lands. The endpoint accepts the empty arrays gracefully.

## Local dev setup

Requirements:
- JDK 11 or newer
- The RuneLite repo cloned somewhere nearby (for `runClient`)

```sh
cd plugin
gradle wrapper      # one-time, creates ./gradlew
./gradlew build     # compiles the plugin
./gradlew runClient # launches RuneLite with this plugin side-loaded
```

In the dev client, the plugin appears under Configuration → Plugins as
"Scapestack Sync." Toggle it on and log in to any world. Watch the
plugin log (Help → Open log folder) for "Synced to Scapestack: N
quests..." messages.

## Pointing at a local backend

By default the plugin POSTs to `https://scapestack.app/api/sync`. For
local dev, change the Sync endpoint in plugin settings to
`http://localhost:4173/api/sync` (the Next.js dev port).

You'll also need to start the website locally:
```sh
cd ..        # back to the Next.js root
npm run dev  # starts on localhost:4173
```

And set `DATABASE_URL` in `.env.local` pointing at a Neon project
(create one free at neon.tech), then run `npm run db:init` to create
the schema.

## Publishing to the Plugin Hub

Out of scope for v0.1. Steps when we're ready:
1. Move this directory into its own GitHub repo
   (`github.com/laurensbs/scapestack-runelite-plugin`)
2. Submit via the [RuneLite Plugin Hub
   process](https://github.com/runelite/plugin-hub#readme)
3. Wait 2-6 weeks for Jagex review
4. Once approved, it's discoverable in-game under Plugin Hub

## Security note

v0 trusts whichever RSN the client reports. That means a malicious
plugin user could overwrite *another* player's sync row by spoofing
the RSN in the payload. Production-ready auth requires signing each
submission with a per-install token validated against the player's
in-game identity — see the v0.2 spec in `docs/PLUGIN-AUTH.md` (TODO).
