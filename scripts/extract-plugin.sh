#!/usr/bin/env bash
# Mirror plugin/ into a standalone repo for RuneLite Plugin Hub submission.
#
# Usage:
#   ./scripts/extract-plugin.sh <target-dir> [--clean]
#
# Examples:
#   ./scripts/extract-plugin.sh ~/code/scapestack-runelite-plugin
#   ./scripts/extract-plugin.sh ~/code/scapestack-runelite-plugin --clean
#
# Why a copy and not a submodule: the Plugin Hub clones a single ref of
# a single repo. A submodule layout would force them to clone the whole
# monorepo just to build the plugin. A flat dedicated repo keeps the
# review-surface tiny.
#
# Idempotent: re-running over an existing target updates files in place
# (good for incremental releases). Pass --clean to wipe the target first
# when the file layout has changed significantly.

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <target-dir> [--clean]" >&2
  exit 1
fi

TARGET="$1"
CLEAN="${2:-}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLUGIN_DIR="$ROOT/plugin"

if [[ ! -d "$PLUGIN_DIR" ]]; then
  echo "Plugin dir not found at $PLUGIN_DIR" >&2
  exit 2
fi

mkdir -p "$TARGET"

if [[ "$CLEAN" == "--clean" ]]; then
  echo "Clean mode: wiping $TARGET contents (keeping .git if present)"
  find "$TARGET" -mindepth 1 -maxdepth 1 ! -name '.git' -exec rm -rf {} +
fi

# rsync preserves timestamps + mode bits (de gradle wrapper heeft +x nodig).
# Excludes:
#  - build/ + .gradle/: gradle outputs
#  - .idea/ + *.iml:    IDE metadata
#  - README.md:         standalone repo heeft een eigen consumer-facing
#                       README; monorepo's plugin-dev-docs zijn voor ons
#  - LICENSE:           BSD-2 file leeft alleen in het standalone repo
# De wrapper (gradlew/.bat + gradle/wrapper/) gaat WEL mee — Plugin Hub
# CI gebruikt 'm om te bouwen zonder system-gradle te installeren.
rsync -a \
  --exclude 'build/' \
  --exclude '.gradle/' \
  --exclude '.idea/' \
  --exclude '*.iml' \
  --exclude 'README.md' \
  --exclude 'LICENSE' \
  "$PLUGIN_DIR/" "$TARGET/"

# Seed a top-level README that links back to the monorepo. Only write
# when missing so manual edits in the standalone repo aren't clobbered.
if [[ ! -f "$TARGET/README.md.published" ]]; then
  cat > "$TARGET/README.md.published" <<'EOF'
# Scapestack Sync (RuneLite plugin)

Syncs your OSRS quest, diary, and collection-log state to
[scapestack.org](https://www.scapestack.org) so its Path-to-Max
recommender works from real data instead of hiscores heuristics.

This repo is the publish-ready mirror of the canonical source in
[laurensbs/scapestack/plugin](https://github.com/laurensbs/scapestack/tree/main/plugin).
Bug reports, PRs, and roadmap discussion happen in the main repo.

## Install via Plugin Hub

In RuneLite: Configuration → Plugin Hub → search "Scapestack Sync."

## Build locally

```sh
gradle wrapper
./gradlew build
./gradlew test
./gradlew runClient
```
EOF
  echo "Wrote $TARGET/README.md.published"
  echo "  (rename to README.md once you've reviewed it.)"
fi

# Copy the monorepo LICENSE if present and the target doesn't have one.
if [[ -f "$ROOT/LICENSE" && ! -f "$TARGET/LICENSE" ]]; then
  cp "$ROOT/LICENSE" "$TARGET/LICENSE"
  echo "Copied LICENSE from monorepo"
fi

echo
echo "✓ Plugin mirrored to $TARGET"
echo "  Next steps:"
echo "    cd $TARGET"
echo "    git init        # if first time"
echo "    git add -A && git commit -m 'Release vX.Y.Z'"
echo "    git tag vX.Y.Z && git push --tags"
