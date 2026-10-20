#!/bin/sh
# Upload sfx/*.mp3 and sfx/manifest.json to the wndrklub-sfx R2 bucket.
# Audio is cached for a year (give a replaced sound a new file name);
# the manifest for five minutes, so edits to it show up quickly.
set -e
cd "$(dirname "$0")/../sfx"
for f in *.mp3; do
  wrangler r2 object put "wndrklub-sfx/$f" --file "$f" --remote \
    --content-type audio/mpeg --cache-control "public, max-age=31536000, immutable"
done
wrangler r2 object put wndrklub-sfx/manifest.json --file manifest.json --remote \
  --content-type application/json --cache-control "public, max-age=300"
