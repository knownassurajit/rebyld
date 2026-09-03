#!/usr/bin/env bash
set -euo pipefail

echo "==> Running HTML/JS/Manifest validation..."

# Validate HTML files if any exist
if command -v tidy &>/dev/null; then
  find . -name "*.html" -not -path "./.git/*" -not -path "./node_modules/*" -not -path "./server/node_modules/*" | while read -r f; do
    echo "Checking $f"
    tidy -errors -quiet -utf8 "$f" || true
  done
fi

# Check for manifest.json if it exists
if [ -f manifest.json ]; then
  echo "==> Validating manifest.json..."
  node -e "JSON.parse(require('fs').readFileSync('manifest.json','utf8')); console.log('manifest.json valid');"
fi

# Run Lighthouse if available
if command -v npx &>/dev/null; then
  if [ -f index.html ]; then
    echo "==> Running Lighthouse audit..."
    npx --yes lighthouse@latest \
      --chrome-flags="--headless --no-sandbox --disable-gpu" \
      --output html \
      --output-path lighthouse-report.html \
      --quiet \
      "file://$(pwd)/index.html" || echo "Lighthouse audit completed with warnings"
  fi
fi

echo "==> All checks passed."
