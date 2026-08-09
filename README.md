# rebyld.

A personal performance dashboard for a 12-week recomposition and 5K-focused training block. The app combines nutrition timing, a 7-day training split, hydration tracking, and recovery guidance in a single-page browser experience.

This project is currently a client-side PWA with no backend or account layer. All learned state is stored locally in the browser, and the app can be installed as a standalone app in Chromium-based browsers.

---

## Current status

The shipped application already includes the following working behaviors:

- Dual nutrition systems: Plan A (Chrono) and Plan B (AM Run Cook)
- Day-by-day plan switching across training and rest schedules
- Seven-day workout split with bodyweight / dumbbell filtering
- Standard and Marathon Burn intensity modes
- Exercise completion tracking with per-day progress badges
- Exercise detail modal with posture, tempo, breathing,mistakes, and link-outs
- Drag-and-drop section ordering and visibility toggles in the settings modal
- Custom target inputs for weight, calories, protein, and water
- Hydration logging and sleep/recovery UI
- Service worker registration for an offline shell

This README reflects the current implementation, not a conceptual roadmap.

---

## Core features

- Nutrition planner with day-specific macro blocks and timing windows
- 7-day workout interface for Monday through Sunday
- Equipment filter: All or Bodyweight Only
- Intensity filter: Standard or Marathon Burn
- Exercise modal with extension data such as cues, mistakes, benefits, and demo links
- Session-scoped completion state for exercise rows and workout tabs
- Persistent dashboard layout and section visibility options
- Custom user metrics that update key UI targets after changes
- Water logging and hydration fill visualization
- Recovery/sleep block with sleep arc behavior
- Installable PWA shell for offline access

---

## Project structure

```text
rebyld/
├── index.html              Main app shell and all section content
├── style.css               Visual system, layouts, cards, modal, tabs
├── app.js                  App logic, storage, filters, tracking, modal behavior
├── sw.js                   Service worker for offline shell caching
├── manifest.webmanifest    PWA install metadata and app details
├── icons/                  App icons (192 / 512)
├── README.md               Project documentation
└── .gitignore              Optional repo hygiene file
```

> There are no additional project documentation files in the current repository. This README is the source of truth for the application’s behavior and setup.

---

## Browser storage model

The app uses browser storage to persist user-specific state. Legacy keys are still migrated automatically from the older `das_*` naming scheme.

| Data | Storage | Persistence |
|---|---|---|
| Layout order and section visibility | `localStorage` | Yes |
| Nutrition plan selection and Plan B day mode | `localStorage` | Yes |
| Equipment mode, intensity mode, user targets | `localStorage` | Yes |
| Workout completion and water logging | `sessionStorage` | Reset on reload |

Key examples:

- `rebyld_layout_sequence_v2`
- `rebyld_hide_v2_<section_id>`
- `rebyld_nutrition_plan`
- `rebyld_plan_b_day`
- `rebyld_equip_mode`
- `rebyld_intensity_level`
- `rebyld_user_targets`
- `rebyld_completed_exercises`
- `rebyld_custom_water_v2`

---

## Running locally

Serve over HTTP so the service worker and install flow work correctly:

```bash
python3 -m http.server 8080
# or
npx serve .
```

Then open:

```text
http://localhost:8080
```

---

## Install as a desktop/mobile app

In Chromium-based browsers:

1. Open the app from a local server
2. Use the browser’s install action or Chrome menu → Install page as app
3. The app launches like a standalone app after the first load

The service worker registers on load and caches the app shell for offline-first use.

---

## Browser requirements

- Recent Chrome / Edge / Firefox / Safari versions
- Modern CSS and HTML features such as `dialog`, CSS transitions, and JS modules-like browser APIs
- HTTP serving is required for the PWA install and caching flow

---

## App behavior notes

### Nutrition

The app exposes two nutrition modes:

- Plan A — Chrono: training-day and rest-day timelines
- Plan B — AM Run Cook: Mon–Fri, Saturday, and Sunday variants

Each plan has its own structured timeline, and the active selection is persisted in browser storage.

### Workouts

The workout section is organized as a 7-day tabbed split with exercise tables and filter buttons. Each day can be marked complete by completing exercise rows, and the corresponding tab shows a completion badge when progress is recorded.

### Exercise modal

Each exercise row or warm-up item can open a demo overlay that includes:

- exercise title and equipment tag
- target muscle list
- cues and mistakes
- breathing / posture / tempo guidance
- 5K and abs benefit notes
- YouTube and Pinterest links

### Hydration and recovery

- Water logging includes preset slots plus custom additions
- The app updates hydration percentage against a user-defined goal
- Recovery and sleep sections are displayed in the main dashboard layout

---

## References

- Form demos: [@officialdemic/shorts](https://www.youtube.com/@officialdemic/shorts)
- Visual inspiration board: [demicofficial/youcan](https://in.pinterest.com/demicofficial/youcan/)

---

## Notes for maintainers

- The app is intentionally front-end only and uses browser storage for persistence.
- It is suitable for small personal-use dashboards and quick iteration without a backend.
- If new features are added, they should preserve the current storage compatibility and migration patterns already in place.
