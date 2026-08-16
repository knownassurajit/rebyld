# CI/CD for rebyld

This directory holds the automation added to standardize rebyld with the rest of
knownassurajit's repos. It is intentionally small, because the app itself is
intentionally small.

## No build system, by design

rebyld is a hand-written, vanilla HTML/CSS/JS static PWA: `index.html`, `style.css`,
`app.js`, `sw.js`, `manifest.webmanifest`, `icons/`. There is no `package.json`, no
bundler, no transpiler, and no framework. That's a deliberate choice, not a gap — so
this pipeline does not try to introduce a build step. Everything below runs directly
against the files as they're committed, and the deploy step ships the repo root
as-is.

The `node:20-slim` container image used by the `test` and `pr-summary` jobs exists
purely to run `npx`-based CLI tools (htmlhint, Lighthouse) — not because the app
needs Node to run.

## Branch model

- **`main`** — production/final branch. Only receives merges via reviewed PRs from
  `develop`. Every push to `main` triggers the `deploy` job, which publishes the
  repo to GitHub Pages.
- **`develop`** — integration branch. Feature branches merge into `develop`, and
  pushes to `develop` run the full `test` job. PRs from `develop` into `main` go
  through the `pr-summary` job (checks + a comment on the PR).

This mirrors the develop/main model used across the other repos being brought under
the same CI/CD standard, even though rebyld previously had no automation and only a
single `main` branch.

## What the `test` / `pr-summary` jobs check, and why

Both jobs run the same script, `.github/scripts/run-checks.sh`, inside the
`node:20-slim` container. `pr-summary` additionally posts the results as a comment
on the pull request (via `actions/github-script@v7`), and both jobs write to the
native GitHub Actions job summary (`$GITHUB_STEP_SUMMARY`).

1. **HTML validation — `htmlhint`.**
   `html-validate` was tried first, since it was the first option in the plan. Its
   default ruleset flags this app's intentional inline `style="..."` attributes
   (used extensively for dynamically-computed styling) and its landmark structure
   as 43 "errors" — all style opinions, not actual markup bugs, which would make
   the gate fail permanently on unrelated code. `htmlhint` installed just as
   cleanly via `npx`, and its default rules (doctype present, tags properly
   closed/nested, unique ids, quoted attributes, etc.) actually reflect markup
   correctness. It passes cleanly against `index.html` today, so it's the one
   wired into CI.

2. **Manifest & script sanity checks.**
   - `manifest.webmanifest` is parsed as JSON via `node -e "JSON.parse(...)"`.
     (The original plan suggested a `python3` one-liner, but `node:20-slim` does
     not ship `python3` — verified empirically — so this uses Node instead, which
     is already present in the container.)
   - `sw.js` and `app.js` are syntax-checked with `node --check`.

3. **Lighthouse audit — PWA / best-practices / accessibility.**
   The site is served locally inside the container (`npx serve . -l 8080`, the
   same tool the main `README.md` already documents for local dev) and audited
   with `npx lighthouse@11.7.1 http://localhost:8080 --only-categories=pwa,best-practices,accessibility`.
   Two things worth calling out:
   - `node:20-slim` has no browser, so the job installs `chromium` via `apt-get`
     before running Lighthouse, and passes `--no-sandbox` (required for Chrome
     running as root in a container) via `--chrome-flags`. This was verified to
     work reliably — no separate Lighthouse-specific base image (e.g.
     `femtopixel/google-lighthouse`) was needed.
   - Lighthouse is deliberately pinned to `11.7.1` rather than `@latest`.
     `lighthouse@latest` (currently v13) **removed the "pwa" category entirely**
     — Google deprecated it in Lighthouse v12+. Running `--only-categories=pwa`
     against the latest version silently drops PWA from the report
     (`unrecognized category in 'onlyCategories': pwa`), which defeats the point
     of this check. `11.7.1` is the last release with the classic PWA category
     and was confirmed (by actually running it against this app) to produce a
     real PWA score.
   - Each category must score at least 0.70 (70%) or the job fails. As of the
     PR that introduced this pipeline, the app scores PWA 100%, Best Practices
     100%, Accessibility 80%.

All of the above were run for real inside a local `node:20-slim` container (via
`docker run`) before being wired into the workflow — nothing here is
speculative/unverified.

## Deploy job

On every push to `main`, the `deploy` job (which `needs: test`, so it only runs
after the checks above pass) uploads the repo root — minus `.git` and `.github` —
as a Pages artifact via `actions/upload-pages-artifact@v3` and publishes it with
`actions/deploy-pages@v4`. There is no build step: the static files are shipped
exactly as committed.

**One-time manual setup required:** GitHub Pages must be enabled for this repo
before `deploy` can actually publish anything. In the repo's **Settings → Pages**,
set **Source: GitHub Actions**. This is a one-time, admin-only action in the GitHub
UI (or via an admin-scoped API token) — it cannot be done by an unprivileged
workflow or by the automation that opened this PR. Until it's done, the `deploy`
job will fail at the `actions/deploy-pages@v4` step with an error indicating Pages
isn't configured for the repo.

## Why `test` also runs on push to `main`

The task plan that produced this pipeline described the `test` job as running "on
push to develop and all pull_requests" and the `deploy` job as "`needs: test`, only
push to main." Taken literally, that combination doesn't work: if `test` never runs
on a push-to-`main` event, GitHub Actions treats it as skipped for that event, and a
job that `needs` a skipped job is itself skipped by default — so `deploy` would
never run. To keep `needs: test` meaningful, `test`'s trigger was broadened to also
run on push to `main`, so there is always a same-run `test` job for `deploy` to
depend on.
