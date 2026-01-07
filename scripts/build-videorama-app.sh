#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

WEBAPP_DIR="$ROOT_DIR/webapps/videorama"
OUT_DIR="$ROOT_DIR/public/videorama-app"

if [[ ! -d "$WEBAPP_DIR" ]]; then
  echo "Missing webapp directory: $WEBAPP_DIR" >&2
  exit 1
fi

echo "Building Videorama webapp…"
cd "$WEBAPP_DIR"

npm install
npm run build

echo "Copying build output to public/…"
rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"
cp -R dist/* "$OUT_DIR/"

echo "Done. Open: /videorama-app/"

