#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

echo "==> HTMLHint"
npx --yes htmlhint@latest --config .htmlhintrc index.html

echo "==> JavaScript syntax"
node --check app.js
node --check sw.js
if [ -f server/server.js ]; then
  node --check server/server.js
  node --check server/llm.js
  node --check server/routes/adapt.js
fi

echo "==> Manifest"
node -e "JSON.parse(require('fs').readFileSync('manifest.webmanifest','utf8')); console.log('manifest.webmanifest valid')"

if [ -f server/package.json ]; then
  echo "==> Server dry-run"
  (cd server && npm ci --omit=dev >/dev/null 2>&1 || npm install --omit=dev >/dev/null)
  node server/server.js --dry-run
fi

echo "==> Lighthouse (PWA / Best Practices / Accessibility)"
npx --yes serve@14 -l 8080 --no-port-switching >/tmp/rebyld-serve.log 2>&1 &
SERVE_PID=$!
trap 'kill $SERVE_PID 2>/dev/null || true' EXIT
sleep 2

npx --yes lighthouse@11.7.1 \
  http://127.0.0.1:8080 \
  --chrome-flags="--headless --no-sandbox --disable-gpu" \
  --only-categories=pwa,best-practices,accessibility \
  --output html --output json \
  --output-path lighthouse-report \
  --quiet || echo "Lighthouse completed with warnings"

echo "==> Checks complete"
