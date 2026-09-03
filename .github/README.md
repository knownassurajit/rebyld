# CI/CD (`rebyld/.github`)

```text
.github/
├── dependabot.yml
├── workflows/ci-cd.yml
└── scripts/run-checks.sh
```

## Branching

- `develop` — integration
- `main` — production (GitHub Pages source)

## Jobs

| Job | Trigger | Purpose |
|---|---|---|
| `test` | push to develop/main, PRs into main | HTMLHint, JS syntax, manifest, server dry-run, Lighthouse |
| `dependency-review` | PRs | high-severity advisory gate |
| `pr-summary` | PRs into main | sticky CI comment |
| `deploy` | push to main | GitHub Pages (`actions/deploy-pages`) |

The Pages artifact excludes `.git`, `.github`, `server`, and `node_modules`. Host the Express backend separately and set `window.__REBYLD_BACKEND_URL__`.
