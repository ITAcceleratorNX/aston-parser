#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NODE_BIN="$(command -v node)"
PLIST_SRC="$ROOT/scripts/com.adwave.parser.plist.example"
TARGET="$HOME/Library/LaunchAgents/com.adwave.parser.plist"

sed \
  -e "s|/ABSOLUTE/PATH/TO/adwave-parser|$ROOT|g" \
  -e "s|/usr/local/bin/node|$NODE_BIN|g" \
  "$PLIST_SRC" > "$TARGET"
launchctl unload "$TARGET" 2>/dev/null || true
launchctl load "$TARGET"
echo "Installed $TARGET"
echo "Runs sync every 6 hours. Check $ROOT/logs and $ROOT/data/journal.jsonl"
