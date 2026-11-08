#!/usr/bin/env bash
# Upload public/content/tests/*/media/* to a Cloudflare R2 bucket, keeping the tests/<id>/media/<file> layout.
# Usage: scripts/upload_media.sh <bucket> [test-id ...]
set -euo pipefail

bucket="${1:?usage: scripts/upload_media.sh <bucket> [test-id ...]}"
shift
cd "$(dirname "$0")/../public/content"

if [ "$#" -gt 0 ]; then
  dirs=()
  for id in "$@"; do
    [[ "$id" =~ ^[a-z0-9-]+$ ]] || { echo "invalid test id: $id" >&2; exit 1; }
    dirs+=("tests/$id/media")
  done
else
  dirs=(tests/*/media)
fi

find "${dirs[@]}" -type f -print0 |
  xargs -0 -P 8 -I{} npx --no-install wrangler r2 object put "$bucket/{}" --file "{}" --remote \
    --cache-control "public, max-age=31536000, immutable"
