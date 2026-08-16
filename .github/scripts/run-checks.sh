#!/usr/bin/env bash
# Shared CI check script for rebyld.
#
# rebyld has no build system (no bundler, no package.json) so there is
# nothing to "compile" here. Instead this script runs a handful of
# lightweight, container-friendly checks against the static files that
# ship as-is to GitHub Pages:
#
#   1. HTML markup validation (htmlhint)
#   2. manifest.webmanifest JSON validity + app.js/sw.js syntax check
#   3. Lighthouse audit (PWA / best-practices / accessibility) against a
#      locally served copy of the site
#
# It is invoked from both the `test` job (push to develop) and the
# `pr-summary` job (pull_request into main) so the same checks and the
# same summary formatting are used in both places. Results are written
# to:
#   - $GITHUB_STEP_SUMMARY (native Actions job summary)
#   - ./ci-summary.md (read by the pr-summary job and posted as a PR comment)
#
# Exit code is non-zero if any hard-fail check fails, which fails the job.

set -uo pipefail

SUMMARY_FILE="ci-summary.md"
: > "$SUMMARY_FILE"

OVERALL_STATUS=0
LIGHTHOUSE_MIN_SCORE="0.70"

log_section() {
  echo "$1" | tee -a "$SUMMARY_FILE"
}

echo "## rebyld CI checks" | tee -a "$SUMMARY_FILE"
echo "" >> "$SUMMARY_FILE"

# ---------------------------------------------------------------------------
# 0. System deps: chromium for the Lighthouse step (node:20-slim ships
#    neither python3 nor a browser, so this is the one extra install).
# ---------------------------------------------------------------------------
echo "Installing chromium for Lighthouse..."
apt-get update -qq && apt-get install -y -qq chromium > /tmp/apt-install.log 2>&1
if [ $? -ne 0 ]; then
  echo "::warning::Failed to install chromium, Lighthouse step will be skipped"
  cat /tmp/apt-install.log
  CHROMIUM_AVAILABLE=0
else
  CHROMIUM_AVAILABLE=1
fi

# ---------------------------------------------------------------------------
# 1. HTML validation (htmlhint)
#
# html-validate was tried first but its default ruleset flags this
# hand-written app's intentional inline styles and landmark structure as
# 43 errors that are stylistic opinions, not markup bugs. htmlhint's
# default rules (doctype, tag closing/nesting, id uniqueness, attribute
# quoting, etc.) installed cleanly and passed cleanly against index.html,
# so it is the tool actually wired up here.
# ---------------------------------------------------------------------------
log_section "### HTML validation (htmlhint)"
echo '```' >> "$SUMMARY_FILE"
if npx --yes htmlhint index.html 2>&1 | tee -a "$SUMMARY_FILE"; then
  HTMLHINT_STATUS="PASS"
else
  HTMLHINT_STATUS="FAIL"
  OVERALL_STATUS=1
fi
echo '```' >> "$SUMMARY_FILE"
echo "**Result: $HTMLHINT_STATUS**" >> "$SUMMARY_FILE"
echo "" >> "$SUMMARY_FILE"

# ---------------------------------------------------------------------------
# 2. manifest.webmanifest JSON validity + app.js/sw.js syntax
#
# node:20-slim has no python3, so JSON validation is done with node
# instead of the python3 one-liner.
# ---------------------------------------------------------------------------
log_section "### Manifest & script syntax checks"
echo '```' >> "$SUMMARY_FILE"

STATIC_STATUS="PASS"

if node -e "JSON.parse(require('fs').readFileSync('manifest.webmanifest','utf8')); console.log('manifest.webmanifest: valid JSON')" >> "$SUMMARY_FILE" 2>&1; then
  :
else
  STATIC_STATUS="FAIL"
fi

if node --check sw.js >> "$SUMMARY_FILE" 2>&1; then
  echo "sw.js: syntax OK" >> "$SUMMARY_FILE"
else
  STATIC_STATUS="FAIL"
fi

if node --check app.js >> "$SUMMARY_FILE" 2>&1; then
  echo "app.js: syntax OK" >> "$SUMMARY_FILE"
else
  STATIC_STATUS="FAIL"
fi

echo '```' >> "$SUMMARY_FILE"
echo "**Result: $STATIC_STATUS**" >> "$SUMMARY_FILE"
echo "" >> "$SUMMARY_FILE"
[ "$STATIC_STATUS" = "FAIL" ] && OVERALL_STATUS=1

# ---------------------------------------------------------------------------
# 3. Lighthouse audit (PWA / best-practices / accessibility)
#
# lighthouse@latest (v12+) removed the "pwa" category entirely, so
# `--only-categories=pwa` silently drops PWA from the report. Since a PWA
# audit is the whole point of this step, the workflow pins lighthouse to
# 11.7.1 (the last release with the classic PWA category) instead of
# using @latest.
# ---------------------------------------------------------------------------
log_section "### Lighthouse audit (pwa, best-practices, accessibility)"

if [ "$CHROMIUM_AVAILABLE" = "1" ]; then
  npx --yes serve . -l 8080 > /tmp/serve.log 2>&1 &
  SERVE_PID=$!

  READY=0
  for _ in $(seq 1 20); do
    if node -e "require('http').get('http://localhost:8080', res => process.exit(0)).on('error', () => process.exit(1))" 2>/dev/null; then
      READY=1
      break
    fi
    sleep 1
  done

  if [ "$READY" != "1" ]; then
    echo "::warning::Local server on :8080 never became ready, skipping Lighthouse"
    echo "**Result: SKIPPED (server did not start)**" >> "$SUMMARY_FILE"
    OVERALL_STATUS=1
  else
    CHROME_PATH=/usr/bin/chromium npx --yes lighthouse@11.7.1 http://localhost:8080 \
      --output=json --output-path=./lighthouse-report.json \
      --chrome-flags="--headless --no-sandbox --disable-gpu" \
      --only-categories=pwa,best-practices,accessibility \
      --quiet > /tmp/lighthouse.log 2>&1
    LH_EXIT=$?

    if [ $LH_EXIT -ne 0 ] || [ ! -f lighthouse-report.json ]; then
      echo "Lighthouse run failed (exit $LH_EXIT):" >> "$SUMMARY_FILE"
      echo '```' >> "$SUMMARY_FILE"
      tail -40 /tmp/lighthouse.log >> "$SUMMARY_FILE"
      echo '```' >> "$SUMMARY_FILE"
      echo "**Result: FAIL**" >> "$SUMMARY_FILE"
      OVERALL_STATUS=1
    else
      LH_TABLE=$(node -e "
        const fs = require('fs');
        const r = JSON.parse(fs.readFileSync('lighthouse-report.json', 'utf8'));
        const min = $LIGHTHOUSE_MIN_SCORE;
        const rows = [];
        let pass = true;
        for (const key of ['pwa', 'best-practices', 'accessibility']) {
          const cat = r.categories[key];
          if (!cat) {
            rows.push(\`| \${key} | n/a | FAIL (category missing) |\`);
            pass = false;
            continue;
          }
          const score = cat.score === null ? null : cat.score;
          const pct = score === null ? 'n/a' : Math.round(score * 100) + '%';
          const ok = score !== null && score >= min;
          if (!ok) pass = false;
          rows.push(\`| \${cat.title} | \${pct} | \${ok ? 'PASS' : 'FAIL'} |\`);
        }
        console.log('| Category | Score | Result |');
        console.log('|---|---|---|');
        console.log(rows.join('\n'));
        console.log('');
        console.log(pass ? 'OVERALL: PASS' : 'OVERALL: FAIL');
        process.exit(pass ? 0 : 1);
      ")
      LH_STATUS=$?
      echo "$LH_TABLE" >> "$SUMMARY_FILE"
      echo "" >> "$SUMMARY_FILE"
      echo "(threshold: >= ${LIGHTHOUSE_MIN_SCORE} / category)" >> "$SUMMARY_FILE"
      [ $LH_STATUS -ne 0 ] && OVERALL_STATUS=1
    fi
  fi

  kill "$SERVE_PID" >/dev/null 2>&1 || true
else
  echo "**Result: SKIPPED (chromium unavailable)**" >> "$SUMMARY_FILE"
  OVERALL_STATUS=1
fi

echo "" >> "$SUMMARY_FILE"
echo "---" >> "$SUMMARY_FILE"
if [ $OVERALL_STATUS -eq 0 ]; then
  echo "All checks passed." >> "$SUMMARY_FILE"
else
  echo "One or more checks failed. See details above." >> "$SUMMARY_FILE"
fi

# Mirror the summary into the native Actions job summary, if available.
if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  cat "$SUMMARY_FILE" >> "$GITHUB_STEP_SUMMARY"
fi

exit $OVERALL_STATUS
