#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$ROOT_DIR/webapps/hangouts"
PUBLIC_DIR="$ROOT_DIR/public/hangouts"

if [ ! -d "$APP_DIR/node_modules" ]; then
  (cd "$APP_DIR" && npm ci)
fi

(cd "$APP_DIR" && npm run build)

mkdir -p "$PUBLIC_DIR"
rsync -a --delete "$APP_DIR/dist/" "$PUBLIC_DIR/"

echo "Hangouts deployed to: $PUBLIC_DIR"
