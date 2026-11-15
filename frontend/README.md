# Earth Jukebox: Change Mode — front end

Vite + React 18 site for the Night Lights sonification engine. It turns the biggest
changes between two NASA night-lights frames into a short piece of music, then lets
you inspect every note in text.

This folder contains the production React/Vite site. The dependency-free
standalone sonification engine remains at the repository root.

## Requirements

- Node.js 18 or newer
- npm 9 or newer

No CDN, no web fonts, and no runtime services are required. After a build the
site is fully local: every runtime request is for a file in `public/`.

## Install and run

```bash
cd frontend
npm install
npm run dev
```

Vite prints a local URL, normally <http://localhost:5173/>. Nothing plays
automatically; press **Play piece** or <kbd>Space</kbd>.

## Production build

```bash
cd frontend
npm run build
npm run preview   # serves dist/ locally for a final check
```

The build is written to `frontend/dist/`. Assets use the relative Vite base
`"./"`, and routing uses `HashRouter`, so the same build works at a domain root
or under a project subpath such as `/Aham-Bhramasmi/`.

## Project layout

```text
frontend/
├─ index.html
├─ package.json
├─ vite.config.js
├─ public/
│  ├─ data.json                 default 16 × 16 dataset
│  ├─ favicon.svg
│  └─ assets/
│     ├─ night-2012.png
│     └─ night-2023.png
└─ src/
   ├─ engine.js                 sonification engine (audio unchanged)
   ├─ engineInstance.js         one engine for the app lifetime
   ├─ useEngine.js              the single React subscription hook
   ├─ App.jsx                   routes, keyboard map, announcements
   ├─ components/               header, controls, views, dialog, table
   ├─ pages/                    Listen, How it works, Docs, Accessibility, About
   ├─ references.js             eight DOI reference slots
   ├─ site.js                   site and placeholder constants
   └─ styles.css                normal and accessibility themes
```

## Data

The Listen page loads `public/data.json` on first visit. A file must be a JSON
object with a `regions` array; each playable region needs a finite
`signed_change`. Use **Load JSON** to replace the dataset at runtime. A failed
load leaves the current data in place and shows a visible error.

The engine is created once with `createEngine({ headless: true, volume: 0.3 })`.
React never creates an audio context or schedules notes. It reads snapshots from
`engine.getState()` through `useEngine` and sends user commands back to the
engine.

## Deploy to GitHub Pages

The repository is <https://github.com/Diksha-MukherjeeAgarwal/Aham-Bhramasmi>.
Publish the contents of `frontend/dist`, not the repository root.

### Option A — GitHub Actions (recommended)

Add `.github/workflows/deploy-frontend.yml` at the repository root:

```yaml
name: Deploy front end to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: frontend/package-lock.json
      - name: Install
        working-directory: frontend
        run: npm ci
      - name: Build
        working-directory: frontend
        run: npm run build
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: frontend/dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

Then open **Settings → Pages** and set **Source** to **GitHub Actions**. The site
will be served from `https://diksha-mukherjeeagarwal.github.io/Aham-Bhramasmi/`.

No 404 rewrite is needed. Every route lives after the hash
(`#/how-it-works`, `#/docs`, `#/accessibility`, `#/about`), so the server only
ever requests `index.html`.

### Option B — manual publish

```bash
cd frontend
npm install
npm run build
```

Upload the contents of `frontend/dist` to the branch or Pages target configured
in **Settings → Pages**. Keep `base: "./"` in `vite.config.js`. If you publish
with a tool such as `gh-pages`, publish `frontend/dist` as the site root.

### Verify after deploying

1. The Listen page shows 7 playable regions and 8 regions in the file.
2. All five header links change the page and the document title.
3. Pressing <kbd>Space</kbd> plays; <kbd>S</kbd> stops.
4. **Download audio (WAV)** produces `night-lights-piece.wav`.
5. **Accessibility mode** switches to the black, white, and yellow theme.
6. Refreshing a deep link such as `#/docs` still opens Docs.

## Accessibility notes

- Skip link is the first focusable element.
- Every route sets `document.title`, focuses the `h1`, and announces once.
- All playback state comes from engine events; the now-playing sentence updates
  visually without announcing every note.
- Accessibility mode: black background, white text, one yellow accent, no
  gradients or animation, 20 px base text, 1.7 line height, 70 ch measure,
  single column, 56 px minimum buttons, 4 px focus rings, 12 px target gaps,
  a persistent shortcut sheet, and a fixed now-playing panel.
- The 3D view is off by default in accessibility mode and can be enabled with
  **Show 3D view**. If WebGL is unavailable, the image frames take over.
- On a first visit, an OS accessibility preference starts accessibility mode
  before the first paint and opens the image frames instead of the 3D globe:
  `forced-colors: active`, `prefers-contrast: more`,
  `inverted-colors: inverted`, `prefers-reduced-transparency: reduce`, or
  `prefers-reduced-motion: reduce`.
- A saved choice wins. The header button and the <kbd>A</kbd> key store `on` or
  `off`; an explicit `off` is not overridden by the system. Without a saved
  choice, the page follows live changes to those media queries.
- Browsers do not expose screen-reader use or a blindness setting, so a
  screen-reader user without one of those OS preferences is not detected
  automatically. The manual toggle always works.
- `prefers-reduced-motion` also removes transitions in normal mode.
- Normal mode is dark by default and switches to a light palette when the OS
  requests a light color scheme. Accessibility mode is independent of the OS
  scheme and always uses black, white, and yellow.

## Known placeholders

These values were not supplied and are visibly marked in the app. Replace them
before publishing:

- `FEEDBACK_FORM_URL` in `src/site.js`
- team member names and roles in `src/site.js`
- the eight citation/DOI slots in `src/references.js`
- `SVS_URL`, `NASA_CREDIT_TEXT`, and `LICENSE_PLACEHOLDER` in `src/site.js`

The default data is derived from the NASA Earth Information Center visualization
*Change in Night Lights between 2012 and 2023*. It is a relative score, not raw
radiance.

## Troubleshooting

- **No sound:** press Play once more. Browsers start audio only after a user
  gesture. Check the volume slider and system output.
- **Data error:** confirm the file is strict JSON with a `regions` array and a
  finite `signed_change` on each playable region.
- **3D view missing:** WebGL is unavailable or the context was lost. Use the
  image frames; all data remains in the region list and note table.
- **WAV fails:** the browser may not support `OfflineAudioContext`. Try a current
  Chromium or Firefox build.
- **Deep link opens Listen:** make sure the URL keeps the `#/` prefix, for example
  `#/docs`.
