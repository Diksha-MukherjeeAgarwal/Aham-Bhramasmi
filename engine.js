/*!
 * Night Lights — sonification engine
 * Single file, vanilla JS, no dependencies, no build step.
 *
 * Include once, anywhere on the page:
 *   <script src="engine.js" defer></script>
 *
 * It mounts its own UI, tries to fetch ./data.json, and falls back to the
 * built-in demo when the fetch fails (for example over file://).
 * Public API: window.SonificationEngine
 */
(() => {
  'use strict';

  /* ------------------------------------------------------------------ *
   * Every tunable constant lives here.
   * ------------------------------------------------------------------ */
  const CONFIG = Object.freeze({
    dataUrl: 'data.json',
    useDemoFallback: true,

    // D minor pentatonic, two octaves from D4 to D6. Semitones above D4.
    pitch: Object.freeze({
      rootMidi: 62,
      offsets: Object.freeze([0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24]),
      downOctave: -12,
    }),

    panWidth: 0.9,

    piece: Object.freeze({
      spacing: 0.8,
      maxSeconds: 30,
      leadIn: 0.12,
      endPadding: 0.25,
    }),

    up: Object.freeze({
      wave: 'triangle',
      duration: 0.8,
      attack: 0.01,
      peak: 0.55,
      sustain: 0.55,
      decay: 0.35,
    }),

    down: Object.freeze({
      wave: 'sine',
      duration: 1.2,
      attack: 0.15,
      peak: 0.55,
      sustain: 0.5,
      decay: 0.45,
    }),

    legend: Object.freeze({
      wave: 'triangle',
      duration: 0.9,
      attack: 0.04,
      peak: 0.4,
      gap: 1.2,
      release: 0.12,
    }),

    audio: Object.freeze({
      masterGain: 0.3,
      compressor: Object.freeze({
        threshold: -18,
        knee: 20,
        ratio: 4,
        attack: 0.006,
        release: 0.25,
      }),
      stopFade: 0.04,
      startPadding: 0.06,
      tail: 0.06,
    }),

    magnitudeLabels: Object.freeze([
      { max: 0.34, label: 'small change' },
      { max: 0.67, label: 'medium change' },
      { max: 1, label: 'large change' },
    ]),

    ui: Object.freeze({
      mapCellLimit: 4096,
      panDecimals: 2,
    }),
  });

  /* Embedded demo so the page is useful even when data.json is absent. */
  const FALLBACK_DATA = Object.freeze({
    dataset: 'nightlights_2012_2023',
    source: 'NASA EIC visualization',
    grid: { rows: 16, cols: 16 },
    regions: [
      { row: 5, col: 11, score: 5.173828125, signed_change: 4.751953125, direction: 'increase' },
      { row: 5, col: 13, score: 5.0263671875, signed_change: 4.8466796875, direction: 'increase' },
      { row: 4, col: 9, score: 4.6767578125, signed_change: 3.748046875, direction: 'increase' },
      { row: 4, col: 13, score: 4.20556640625, signed_change: 3.89208984375, direction: 'increase' },
      { row: 3, col: 8, score: 3.70947265625, signed_change: -1.08349609375, direction: 'decrease' },
      { row: 10, col: 7, score: 3.5595703125, signed_change: 0.44140625, direction: 'stable' },
      { row: 6, col: 11, score: 3.5341796875, signed_change: 3.431640625, direction: 'increase' },
      { row: 5, col: 12, score: 3.26953125, signed_change: 2.7451171875, direction: 'increase' },
    ],
  });

  /* ------------------------------------------------------------------ *
   * Scoped styles
   * ------------------------------------------------------------------ */
  const CSS = String.raw`
:root {
  --se-bg: #05080e;
  --se-panel: rgba(12, 20, 32, 0.74);
  --se-panel-solid: #0b1320;
  --se-line: rgba(151, 183, 220, 0.15);
  --se-line-strong: rgba(151, 183, 220, 0.32);
  --se-text: #edf2f8;
  --se-muted: #91a5bb;
  --se-dim: #7f93a9;
  --se-amber: #ffb454;
  --se-amber-bright: #ffd18c;
  --se-cyan: #58d7cf;
  --se-focus: #a7e8ff;
  --se-sans: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  --se-serif: "Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif;
  --se-mono: ui-monospace, SFMono-Regular, "Cascadia Mono", "Segoe UI Mono", Consolas, monospace;
}
body.se-mounted {
  margin: 0;
  background: var(--se-bg);
}
#se-app {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  background:
    radial-gradient(1100px 680px at 82% -12%, rgba(255, 180, 84, 0.09), transparent 62%),
    radial-gradient(900px 640px at 2% 14%, rgba(88, 215, 207, 0.06), transparent 62%),
    var(--se-bg);
  color: var(--se-text);
  font-family: var(--se-sans);
  -webkit-font-smoothing: antialiased;
}
#se-app *, #se-app *::before, #se-app *::after { box-sizing: border-box; }
#se-app .se-stars {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0.5;
  background-image:
    radial-gradient(1px 1px at 12% 18%, rgba(255,255,255,0.55), transparent 55%),
    radial-gradient(1px 1px at 32% 8%, rgba(255,255,255,0.35), transparent 55%),
    radial-gradient(1.5px 1.5px at 68% 14%, rgba(255,255,255,0.4), transparent 55%),
    radial-gradient(1px 1px at 84% 32%, rgba(255,255,255,0.3), transparent 55%),
    radial-gradient(1px 1px at 48% 26%, rgba(255,255,255,0.28), transparent 55%),
    radial-gradient(1.5px 1.5px at 92% 6%, rgba(255,255,255,0.3), transparent 55%),
    radial-gradient(1px 1px at 6% 44%, rgba(255,255,255,0.22), transparent 55%),
    radial-gradient(1px 1px at 55% 4%, rgba(255,255,255,0.26), transparent 55%);
}
#se-app .se-stars::after {
  content: "";
  position: absolute;
  inset: 0;
  background-image: repeating-linear-gradient(90deg, rgba(154, 187, 224, 0.045) 0 1px, transparent 1px 96px);
  mask-image: linear-gradient(180deg, #000, transparent 76%);
}
.se-shell {
  position: relative;
  z-index: 1;
  max-width: 1240px;
  margin: 0 auto;
  padding: 26px 36px 34px;
}
.se-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding-bottom: 22px;
  border-bottom: 1px solid var(--se-line);
}
.se-brand { display: flex; align-items: center; gap: 13px; min-width: 0; }
.se-mark {
  width: 42px;
  height: 42px;
  flex: none;
  display: grid;
  place-items: center;
  border: 1px solid var(--se-line-strong);
  border-radius: 10px;
  background: linear-gradient(155deg, rgba(255,180,84,0.14), rgba(255,255,255,0.01));
}
.se-mark svg { width: 22px; height: 22px; display: block; }
.se-brand-text { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.se-kicker, .se-eyebrow, .se-label, .se-source-label {
  font-family: var(--se-mono);
  font-size: 10px;
  line-height: 1.3;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
.se-kicker { color: var(--se-amber); }
.se-wordmark {
  font-family: var(--se-serif);
  font-size: 20px;
  letter-spacing: 0.01em;
  color: var(--se-text);
}
.se-source { display: flex; align-items: center; gap: 18px; min-width: 0; }
.se-source-copy { display: flex; flex-direction: column; gap: 3px; min-width: 0; text-align: right; }
.se-source-label { color: var(--se-dim); }
.se-source-name {
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: var(--se-text);
}
.se-source-note {
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  color: var(--se-muted);
}
.se-source-note[data-tone="warn"] { color: var(--se-amber); }
.se-source-note[data-tone="error"] { color: #ff8f85; }
.se-hero { max-width: 920px; padding: 58px 0 38px; }
.se-eyebrow { display: flex; align-items: center; gap: 10px; margin: 0 0 18px; color: var(--se-muted); }
.se-eyebrow::before {
  content: "";
  width: 26px;
  height: 1px;
  background: var(--se-amber);
  box-shadow: 0 0 10px rgba(255,180,84,0.55);
}
.se-hero h1 {
  margin: 0 0 20px;
  font-family: var(--se-serif);
  font-weight: 400;
  font-size: clamp(44px, 6.4vw, 82px);
  line-height: 0.99;
  letter-spacing: -0.035em;
}
.se-hero h1 em { color: var(--se-amber-bright); font-style: italic; }
.se-lede {
  max-width: 64ch;
  margin: 0;
  font-size: clamp(14px, 1.4vw, 17px);
  line-height: 1.68;
  color: var(--se-muted);
}
.se-lede strong { color: var(--se-text); font-weight: 500; }
.se-console {
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  gap: 24px;
  padding: 17px 18px;
  border: 1px solid var(--se-line);
  border-radius: 16px;
  background: linear-gradient(180deg, rgba(18, 28, 43, 0.9), rgba(9, 15, 24, 0.9));
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.38), inset 0 1px 0 rgba(255, 255, 255, 0.035);
}
.se-transport { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.se-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  height: 44px;
  padding: 0 15px;
  border: 1px solid var(--se-line-strong);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.03);
  color: var(--se-text);
  font: 600 13px/1 var(--se-sans);
  letter-spacing: 0.01em;
  white-space: nowrap;
  cursor: pointer;
  transition: background 150ms ease, border-color 150ms ease, color 150ms ease, transform 100ms ease;
}
.se-btn:hover { background: rgba(255, 255, 255, 0.07); border-color: rgba(167, 232, 255, 0.43); }
.se-btn:active { transform: translateY(1px); }
.se-btn svg { width: 16px; height: 16px; flex: none; }
.se-btn kbd, .se-shortcuts kbd {
  display: inline-grid;
  place-items: center;
  min-width: 21px;
  height: 20px;
  padding: 0 5px;
  border: 1px solid rgba(151, 183, 220, 0.28);
  border-radius: 5px;
  background: rgba(0, 0, 0, 0.2);
  color: var(--se-muted);
  font-family: var(--se-mono);
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0;
}
.se-btn kbd { margin-left: 3px; }
.se-btn--primary {
  padding: 0 19px;
  border-color: var(--se-amber);
  background: var(--se-amber);
  color: #1b1205;
  font-weight: 700;
  box-shadow: 0 8px 30px rgba(255, 180, 84, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.42);
}
.se-btn--primary:hover { background: var(--se-amber-bright); border-color: var(--se-amber-bright); }
.se-btn--primary kbd { border-color: rgba(27, 18, 5, 0.3); background: rgba(27, 18, 5, 0.1); color: #46320f; }
.se-btn--ghost { height: 37px; padding: 0 12px; font-size: 12px; background: transparent; }
.se-step {
  display: flex;
  border: 1px solid var(--se-line-strong);
  border-radius: 10px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.03);
}
.se-step .se-btn { border: 0; border-radius: 0; background: transparent; height: 42px; padding: 0 12px; }
.se-step .se-btn + .se-btn { border-left: 1px solid var(--se-line); }
.se-step .se-btn:hover { background: rgba(255, 255, 255, 0.07); }
.se-step .se-btn span { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
.se-now {
  flex: 1 1 310px;
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 260px;
  padding: 2px 6px 2px 22px;
  border-left: 1px solid var(--se-line);
}
.se-eq { display: flex; align-items: flex-end; gap: 3px; height: 22px; flex: none; }
.se-eq i { width: 3px; height: 5px; border-radius: 2px; background: var(--se-line-strong); }
.se-console.is-playing .se-eq i {
  background: var(--se-amber);
  animation: se-eq 900ms ease-in-out infinite;
}
.se-console.is-playing .se-eq i:nth-child(2) { animation-delay: -620ms; }
.se-console.is-playing .se-eq i:nth-child(3) { animation-delay: -310ms; }
.se-console.is-playing .se-eq i:nth-child(4) { animation-delay: -760ms; }
.se-console.is-playing .se-eq i:nth-child(5) { animation-delay: -470ms; }
.se-now-copy { min-width: 0; }
.se-now .se-label { display: block; margin-bottom: 3px; color: var(--se-dim); }
#se-live { margin: 0; font-size: 13px; line-height: 1.45; color: #d3deea; }
.se-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.65fr) minmax(300px, 0.9fr);
  gap: 20px;
  margin-top: 20px;
  align-items: start;
}
.se-card {
  border: 1px solid var(--se-line);
  border-radius: 16px;
  background: var(--se-panel);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
}
.se-regions-card { overflow: hidden; }
.se-regions-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 26px;
  padding: 24px 24px 18px;
  border-bottom: 1px solid var(--se-line);
}
.se-regions-head > div { min-width: 0; }
.se-regions-head .se-skip { overflow-wrap: anywhere; }
.se-regions-head h2, .se-card h2 {
  margin: 0;
  font-family: var(--se-serif);
  font-weight: 400;
  font-size: 25px;
  letter-spacing: -0.015em;
}
.se-title-row { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }
.se-pill {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 8px;
  border: 1px solid rgba(255, 180, 84, 0.3);
  border-radius: 999px;
  background: rgba(255, 180, 84, 0.08);
  color: var(--se-amber-bright);
  font-family: var(--se-mono);
  font-size: 10px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.se-regions-head p { margin: 7px 0 0; color: var(--se-muted); font-size: 12px; line-height: 1.55; }
.se-regions-head .se-skip { margin-top: 5px; color: var(--se-dim); font-family: var(--se-mono); font-size: 10.5px; }
.se-map-figure { flex: none; margin: 0; width: 156px; }
#se-map {
  display: grid;
  gap: 2px;
  width: 156px;
  height: 156px;
  padding: 7px;
  border: 1px solid var(--se-line);
  border-radius: 9px;
  background: rgba(2, 7, 13, 0.66);
}
.se-cell { border-radius: 1px; background: rgba(148, 178, 212, 0.075); }
.se-cell.is-lit { background: var(--cell); opacity: calc(0.3 + var(--mag) * 0.7); }
.se-cell.is-up { --cell: var(--se-amber); }
.se-cell.is-down { --cell: var(--se-cyan); }
.se-cell.is-active { outline: 1.5px solid #fff; outline-offset: 1px; opacity: 1; box-shadow: 0 0 9px var(--cell); }
.se-map-figure figcaption {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-top: 7px;
  color: var(--se-dim);
  font-family: var(--se-mono);
  font-size: 9px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.se-list-wrap { padding: 8px; }
.se-list { display: flex; flex-direction: column; gap: 4px; margin: 0; padding: 0; list-style: none; max-height: 438px; overflow-y: auto; scrollbar-color: rgba(151,183,220,0.3) transparent; }
.se-list::-webkit-scrollbar { width: 8px; }
.se-list::-webkit-scrollbar-thumb { background: rgba(151,183,220,0.24); border-radius: 99px; }
.se-region {
  width: 100%;
  display: grid;
  grid-template-columns: 28px minmax(0, 1.4fr) minmax(96px, 0.95fr) auto;
  align-items: center;
  gap: 14px;
  padding: 11px 13px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.014);
  color: var(--se-text);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background 140ms ease, border-color 140ms ease, transform 140ms ease;
}
.se-list li + li .se-region { border-top-color: rgba(151, 183, 220, 0.08); }
.se-region:hover { background: rgba(255, 255, 255, 0.045); border-color: var(--se-line-strong); }
.se-region:active { transform: scale(0.997); }
.se-region.is-active {
  border-color: rgba(255, 180, 84, 0.5);
  background: linear-gradient(90deg, rgba(255, 180, 84, 0.11), rgba(255, 180, 84, 0.025));
  box-shadow: inset 2px 0 0 var(--se-amber);
}
.se-region[data-direction="down"].is-active {
  border-color: rgba(88, 215, 207, 0.5);
  background: linear-gradient(90deg, rgba(88, 215, 207, 0.1), rgba(88, 215, 207, 0.02));
  box-shadow: inset 2px 0 0 var(--se-cyan);
}
.se-region-num { font-family: var(--se-mono); font-size: 11px; color: var(--se-dim); }
.se-region.is-active .se-region-num { color: var(--se-amber-bright); }
.se-region[data-direction="down"].is-active .se-region-num { color: var(--se-cyan); }
.se-region-main { min-width: 0; }
.se-region-id { display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px 10px; }
.se-dir { display: inline-flex; align-items: center; gap: 5px; font-size: 13px; font-weight: 600; }
.se-dir-mark { font-size: 9px; }
.se-region[data-direction="up"] .se-dir { color: var(--se-amber); }
.se-region[data-direction="down"] .se-dir { color: var(--se-cyan); }
.se-region-cell { font-family: var(--se-mono); font-size: 10px; color: var(--se-dim); letter-spacing: 0.02em; }
.se-region-mag { display: flex; align-items: center; gap: 8px; }
.se-bar { flex: 1; height: 4px; border-radius: 99px; background: rgba(151, 183, 220, 0.12); overflow: hidden; }
.se-bar span { display: block; height: 100%; border-radius: inherit; background: var(--se-amber); opacity: 0.8; }
.se-region[data-direction="down"] .se-bar span { background: var(--se-cyan); }
.se-mag-num { width: 34px; text-align: right; font-family: var(--se-mono); font-size: 10px; color: var(--se-muted); }
.se-region-note { display: flex; align-items: center; gap: 9px; justify-self: end; }
.se-pitch {
  min-width: 36px;
  padding: 3px 6px;
  border: 1px solid rgba(255, 180, 84, 0.26);
  border-radius: 5px;
  color: var(--se-amber-bright);
  font-family: var(--se-mono);
  font-size: 11px;
  text-align: center;
}
.se-region[data-direction="down"] .se-pitch { border-color: rgba(88, 215, 207, 0.28); color: var(--se-cyan); }
.se-pan { width: 50px; color: var(--se-muted); font-family: var(--se-mono); font-size: 9.5px; text-align: right; }
.se-empty { margin: 22px 16px 26px; color: var(--se-muted); font-size: 13px; text-align: center; }
.se-side { display: flex; flex-direction: column; gap: 20px; }
.se-side .se-card { padding: 22px; }
.se-guide h2, .se-check h2 { margin-bottom: 4px; }
.se-guide-intro { margin: 0 0 18px; color: var(--se-muted); font-size: 12px; line-height: 1.6; }
.se-rows { display: flex; flex-direction: column; }
.se-row { display: grid; grid-template-columns: 76px 1fr; gap: 12px; padding: 10px 0; border-top: 1px solid rgba(151, 183, 220, 0.1); }
.se-row:first-child { border-top: 0; padding-top: 0; }
.se-row dt { display: flex; align-items: center; gap: 6px; margin: 0; color: var(--se-dim); font-family: var(--se-mono); font-size: 9.5px; letter-spacing: 0.08em; text-transform: uppercase; }
.se-row dd { margin: 0; color: #c8d5e4; font-size: 12px; line-height: 1.55; }
.se-row dd strong { color: var(--se-text); font-weight: 600; }
.se-row .se-mark-up, .se-row .se-mark-down { font-size: 9px; }
.se-mark-up { color: var(--se-amber); }
.se-mark-down { color: var(--se-cyan); }
.se-guide-note {
  margin: 14px 0 0;
  padding: 10px 12px;
  border: 1px dashed rgba(151, 183, 220, 0.2);
  border-radius: 8px;
  color: var(--se-muted);
  font-size: 11.5px;
  line-height: 1.55;
}
.se-guide-note kbd { border: 1px solid var(--se-line-strong); border-radius: 4px; padding: 0 4px; font-family: var(--se-mono); font-size: 10px; }
.se-check { display: flex; flex-direction: column; min-width: 0; }
.se-check-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.se-chip { color: var(--se-dim); font-family: var(--se-mono); font-size: 9.5px; }
.se-check-intro { margin: 6px 0 14px; color: var(--se-muted); font-size: 11.5px; line-height: 1.55; }
.se-table-wrap { overflow: auto; max-height: 294px; margin: 0 -6px; padding: 0 6px; scrollbar-color: rgba(151,183,220,0.3) transparent; }
.se-table { width: 100%; border-collapse: collapse; font-family: var(--se-mono); font-size: 10px; white-space: nowrap; }
.se-table th {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 6px 5px;
  border-bottom: 1px solid var(--se-line-strong);
  background: var(--se-panel-solid);
  color: var(--se-dim);
  font-weight: 500;
  text-align: left;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
.se-table td { padding: 7px 5px; border-bottom: 1px solid rgba(151, 183, 220, 0.075); color: #c8d5e4; }
.se-table tr:last-child td { border-bottom: 0; }
.se-table .se-td-num { color: var(--se-dim); }
.se-table .se-td-up { color: var(--se-amber); }
.se-table .se-table th:nth-child(5), .se-table td:nth-child(5) { text-align: right; }
.se-table .se-td-pitch { color: var(--se-amber-bright); text-align: right; }
.se-table tr[data-direction="down"] .se-td-pitch { color: var(--se-cyan); }
.se-check-foot { margin: 12px 0 0; color: var(--se-dim); font-family: var(--se-mono); font-size: 9px; line-height: 1.6; }
.se-footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 12px 26px;
  margin-top: 22px;
  padding-top: 18px;
  border-top: 1px solid var(--se-line);
  color: var(--se-dim);
  font-size: 10.5px;
  line-height: 1.5;
}
.se-footer p { margin: 0; }
.se-shortcuts { display: flex; flex-wrap: wrap; align-items: center; gap: 5px 14px; }
.se-shortcuts span { display: inline-flex; align-items: center; gap: 4px; }
.se-shortcuts kbd { height: 17px; min-width: 18px; font-size: 9px; }
.se-visually-hidden {
  position: absolute !important;
  width: 1px; height: 1px;
  margin: -1px; padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}
#se-app :focus-visible { outline: 2px solid var(--se-focus); outline-offset: 3px; }
#se-app button:focus-visible { outline-offset: 2px; }
@keyframes se-eq {
  0%, 100% { height: 5px; opacity: 0.55; }
  50% { height: 21px; opacity: 1; }
}
@media (max-width: 960px) {
  .se-shell { padding: 22px 24px 30px; }
  .se-layout { grid-template-columns: 1fr; }
  .se-side { display: grid; grid-template-columns: 1fr 1fr; align-items: start; }
  .se-now { border-left: 0; padding-left: 4px; }
  .se-console { flex-wrap: wrap; }
  .se-now { flex-basis: 100%; border-top: 1px solid var(--se-line); padding-top: 13px; }
  .se-transport { flex: 1 1 auto; gap: 6px; }
  .se-btn { padding: 0 12px; }
  .se-btn--primary { padding: 0 16px; }
  .se-step .se-btn { padding: 0 10px; }
}
@media (max-width: 700px) {
  .se-shell { padding: 18px 16px 26px; }
  .se-topbar { align-items: flex-start; flex-direction: column; gap: 14px; }
  .se-source { width: 100%; justify-content: space-between; }
  .se-source-copy { text-align: left; }
  .se-source-name, .se-source-note { max-width: 46vw; }
  .se-hero { padding: 42px 0 28px; }
  .se-hero h1 { font-size: clamp(38px, 12vw, 58px); }
  .se-console { padding: 13px; }
  .se-transport { width: 100%; }
  .se-btn--primary { flex: 1 1 auto; }
  .se-step { flex: 1 1 auto; }
  .se-step .se-btn { flex: 1; }
  .se-now { min-width: 0; }
  .se-side { grid-template-columns: 1fr; }
  .se-regions-head { padding: 18px 18px 14px; gap: 16px; }
  .se-map-figure { width: 112px; }
  #se-map { width: 112px; height: 112px; padding: 5px; gap: 1.5px; }
  .se-region { grid-template-columns: 22px minmax(0, 1fr) auto; gap: 9px; padding: 10px; }
  .se-region-mag { grid-column: 2 / 3; grid-row: 2; }
  .se-region-note { grid-column: 3 / 4; grid-row: 1 / 3; flex-direction: column; gap: 4px; }
  .se-map-figure figcaption { font-size: 8px; }
  .se-regions-head h2, .se-card h2 { font-size: 22px; }
  .se-footer { font-size: 10px; }
}
@media (prefers-reduced-motion: reduce) {
  #se-app *, #se-app *::before, #se-app *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
    scroll-behavior: auto !important;
  }
}
`;

  /* ------------------------------------------------------------------ *
   * Markup
   * ------------------------------------------------------------------ */
  const HTML = `
<div id="se-app">
  <div class="se-stars" aria-hidden="true"></div>
  <div class="se-shell">
    <header class="se-topbar">
      <div class="se-brand">
        <div class="se-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <rect x="2" y="2" width="5" height="5" rx="1" opacity=".95"/>
            <rect x="9.5" y="2" width="5" height="5" rx="1" opacity=".25"/>
            <rect x="17" y="2" width="5" height="5" rx="1" opacity=".55"/>
            <rect x="2" y="9.5" width="5" height="5" rx="1" opacity=".3"/>
            <rect x="9.5" y="9.5" width="5" height="5" rx="1" opacity=".85"/>
            <rect x="17" y="9.5" width="5" height="5" rx="1" opacity=".25"/>
            <rect x="2" y="17" width="5" height="5" rx="1" opacity=".18"/>
            <rect x="9.5" y="17" width="5" height="5" rx="1" opacity=".55"/>
            <rect x="17" y="17" width="5" height="5" rx="1" opacity=".9"/>
          </svg>
        </div>
        <div class="se-brand-text">
          <span class="se-kicker">NASA Space Apps · Sonification</span>
          <span class="se-wordmark">Night Lights Engine</span>
        </div>
      </div>
      <div class="se-source">
        <div class="se-source-copy">
          <span class="se-source-label">Data source</span>
          <span class="se-source-name" id="se-source-name">Fetching data.json…</span>
          <span class="se-source-note" id="se-source-note">Satellite night lights · 2012 → 2023</span>
        </div>
        <button type="button" class="se-btn se-btn--ghost" id="se-load">
          <svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12.5h12M8 2.5v8M5 7.5 8 10.5l3-3"/></svg>
          Load JSON
        </button>
        <input type="file" id="se-file" accept=".json,application/json" hidden>
      </div>
    </header>

    <main>
    <section class="se-hero" aria-labelledby="se-title">
      <p class="se-eyebrow">Satellite night lights · 2012 → 2023</p>
      <h1 id="se-title">Night lights,<br><em>scored for stereo.</em></h1>
      <p class="se-lede">A deterministic sonification of changed regions from a satellite night-lights map. <strong>Brighter change becomes higher pitch</strong>; a region’s place on the grid becomes its place in the stereo field. The biggest changes play first.</p>
    </section>

    <section class="se-console" id="se-console" aria-label="Playback controls">
      <div class="se-transport" role="group" aria-label="Transport">
        <button type="button" class="se-btn se-btn--primary" id="se-play" title="Play the whole piece (Space)">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11l9-5.5z" fill="currentColor"/></svg>
          Play piece <kbd aria-hidden="true">Space</kbd>
        </button>
        <div class="se-step" role="group" aria-label="Step through regions">
          <button type="button" class="se-btn" id="se-prev" aria-label="Previous region" title="Previous region (Left arrow)">
            <svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3.5 5.5 8l4.5 4.5"/></svg>
            Previous <kbd aria-hidden="true">←</kbd>
          </button>
          <button type="button" class="se-btn" id="se-next" aria-label="Next region" title="Next region (Right arrow)">
            Next <kbd aria-hidden="true">→</kbd>
            <svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3.5 10.5 8 6 12.5"/></svg>
          </button>
        </div>
        <button type="button" class="se-btn" id="se-legend" title="Play the pitch legend (L)">
          <svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 8h2l1.5-3.5 2 7L9 4l1.7 5.5h3.8"/></svg>
          Legend <kbd aria-hidden="true">L</kbd>
        </button>
        <button type="button" class="se-btn" id="se-stop" title="Stop all sound (S)">
          <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="4" y="4" width="8" height="8" rx="1" fill="currentColor"/></svg>
          Stop <kbd aria-hidden="true">S</kbd>
        </button>
      </div>
      <div class="se-now">
        <div class="se-eq" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
        <div class="se-now-copy">
          <span class="se-label">Now</span>
          <p id="se-live" role="status" aria-live="polite" aria-atomic="true">Ready. Press Space to play the whole piece.</p>
        </div>
      </div>
    </section>

    <div class="se-layout">
      <section class="se-card se-regions-card" aria-labelledby="se-regions-title">
        <header class="se-regions-head">
          <div>
            <div class="se-title-row">
              <h2 id="se-regions-title">Changed regions</h2>
              <span class="se-pill" id="se-count">0 notes</span>
            </div>
            <p>Sorted by magnitude, largest first. Select a row to hear that note alone.</p>
            <p class="se-skip" id="se-skip">Loading data…</p>
          </div>
          <figure class="se-map-figure" id="se-map-figure" hidden>
            <div id="se-map" aria-hidden="true"></div>
            <figcaption><span id="se-map-label">16 × 16</span><span>W → E</span></figcaption>
          </figure>
        </header>
        <div class="se-list-wrap">
          <ol class="se-list" id="se-list" aria-label="Playable regions"></ol>
          <p class="se-empty" id="se-empty">No playable regions yet.</p>
        </div>
      </section>

      <aside class="se-side" aria-label="Reference and verification">
        <section class="se-card se-guide" aria-labelledby="se-guide-title">
          <h2 id="se-guide-title">How to listen</h2>
          <p class="se-guide-intro">Brighter change, higher note. Western cells lean left; eastern cells lean right.</p>
          <dl class="se-rows">
            <div class="se-row"><dt>Pitch</dt><dd><strong>Magnitude</strong> → D minor pentatonic, two octaves, D4–D6.</dd></div>
            <div class="se-row"><dt>Increase</dt><dd><span class="se-mark-up" aria-hidden="true">▲</span> Bright triangle · fast attack · <strong>0.8 s</strong></dd></div>
            <div class="se-row"><dt>Decrease</dt><dd><span class="se-mark-down" aria-hidden="true">▼</span> Dark sine · octave down · slow attack · <strong>1.2 s</strong></dd></div>
            <div class="se-row"><dt>Pan</dt><dd><strong>West → east</strong> becomes left → right in stereo.</dd></div>
          </dl>
          <p class="se-guide-note">Press <kbd>L</kbd> for the legend: a steady middle reference, then a low and a high example.</p>
        </section>

        <section class="se-card se-check" aria-labelledby="se-check-title">
          <div class="se-check-head">
            <h2 id="se-check-title">Self-check</h2>
            <span class="se-chip">adaptData()</span>
          </div>
          <p class="se-check-intro">Every computed note, verifiable without listening.</p>
          <div class="se-table-wrap">
            <table class="se-table">
              <caption class="se-visually-hidden">Computed notes: order, cell, direction, magnitude, pitch and pan</caption>
              <thead><tr><th scope="col">#</th><th scope="col">Cell</th><th scope="col">Dir</th><th scope="col">Mag</th><th scope="col">Pitch</th><th scope="col">Pan</th></tr></thead>
              <tbody id="se-check-body"></tbody>
            </table>
          </div>
          <p class="se-check-foot" id="se-check-foot">Waiting for data.</p>
        </section>
      </aside>
    </div>
    </main>

    <footer class="se-footer">
      <p>Audio starts on your first interaction. Same data, same notes, every time.</p>
      <div class="se-shortcuts" aria-label="Keyboard shortcuts">
        <span><kbd>Space</kbd> play piece</span>
        <span><kbd>←</kbd><kbd>→</kbd> step</span>
        <span><kbd>L</kbd> legend</span>
        <span><kbd>S</kbd> stop</span>
      </div>
    </footer>
  </div>
</div>`;
  /* ------------------------------------------------------------------ *
   * Small helpers
   * ------------------------------------------------------------------ */
  const NOTE_NAMES = Object.freeze(['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']);

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function round(value, decimals = 0) {
    const factor = 10 ** decimals;
    const result = Math.round((value + Number.EPSILON) * factor) / factor;
    return Object.is(result, -0) ? 0 : result;
  }

  function midiToName(midi) {
    const value = Math.round(midi);
    return NOTE_NAMES[((value % 12) + 12) % 12] + (Math.floor(value / 12) - 1);
  }

  function midiToFrequency(midi) {
    return 440 * 2 ** ((midi - 69) / 12);
  }

  function labelForMagnitude(magnitude) {
    const match = CONFIG.magnitudeLabels.find((item) => magnitude <= item.max);
    return match ? match.label : CONFIG.magnitudeLabels[CONFIG.magnitudeLabels.length - 1].label;
  }

  function panText(pan) {
    if (Math.abs(pan) < 0.01) return 'center';
    return Math.round(Math.abs(pan) * 100) + '% ' + (pan < 0 ? 'L' : 'R');
  }

  function panSpeech(pan) {
    if (Math.abs(pan) < 0.01) return 'centered';
    return Math.round(Math.abs(pan) * 100) + ' percent ' + (pan < 0 ? 'left' : 'right');
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  const state = {
    ctx: null,
    compressor: null,
    master: null,
    notes: [],
    meta: null,
    source: '',
    activeIndex: -1,
    mode: 'idle',
    timers: new Set(),
    voices: new Set(),
    token: 0,
    loadToken: 0,
    dom: {},
    regionButtons: [],
    mapIndex: new Map(),
  };

  /* ------------------------------------------------------------------ *
   * adaptData — the only place that knows the JSON shape.
   * Returns an array of notes. Non-enumerable `notes.meta` carries the
   * grid/dataset details used by the UI; replace adaptData freely.
   * ------------------------------------------------------------------ */
  function adaptData(json) {
    if (!json || typeof json !== 'object' || Array.isArray(json)) {
      throw new Error('Data must be a JSON object.');
    }
    if (!Array.isArray(json.regions)) {
      throw new Error('Data needs a "regions" array.');
    }

    const toNumber = (value, fallback = 0) => {
      const number = Number(value);
      return Number.isFinite(number) ? number : fallback;
    };

    const regions = json.regions.filter((region) => region && typeof region === 'object');
    const maxCol = regions.reduce((max, region) => Math.max(max, toNumber(region.col)), 0);
    const maxRow = regions.reduce((max, region) => Math.max(max, toNumber(region.row)), 0);
    const cols = Math.max(1, Math.floor(toNumber(json.grid && json.grid.cols, maxCol + 1)));
    const rows = Math.max(1, Math.floor(toNumber(json.grid && json.grid.rows, maxRow + 1)));

    // Denominator is the largest absolute change anywhere in the file.
    let maxAbs = 0;
    for (const region of regions) {
      maxAbs = Math.max(maxAbs, Math.abs(toNumber(region.signed_change)));
    }

    const pool = CONFIG.pitch.offsets.map((offset) => {
      const midi = CONFIG.pitch.rootMidi + offset;
      return { midi, name: midiToName(midi) };
    });

    const notes = [];
    let stableSkipped = 0;

    regions.forEach((region, sourceIndex) => {
      const rawDirection = String(region.direction == null ? '' : region.direction).trim().toLowerCase();
      if (rawDirection === 'stable') {
        stableSkipped += 1;
        return;
      }

      const signedChange = toNumber(region.signed_change);
      const magnitude = maxAbs > 0 ? clamp(Math.abs(signedChange) / maxAbs, 0, 1) : 0;
      const direction = rawDirection === 'decrease' || (rawDirection !== 'increase' && signedChange < 0)
        ? 'down'
        : 'up';

      const row = toNumber(region.row);
      const col = toNumber(region.col);
      const x = clamp((col + 0.5) / cols, 0, 1);
      const pan = round(clamp((x * 2 - 1) * CONFIG.panWidth, -1, 1), CONFIG.ui.panDecimals);

      const pitchIndex = Math.round(magnitude * (pool.length - 1));
      const midi = pool[pitchIndex].midi + (direction === 'down' ? CONFIG.pitch.downOctave : 0);

      notes.push({
        sourceIndex,
        row,
        col,
        x: round(x, 4),
        pan,
        signedChange,
        magnitude,
        direction,
        pitchIndex,
        midi,
        pitchName: midiToName(midi),
        frequency: round(midiToFrequency(midi), 3),
        changeLabel: labelForMagnitude(magnitude),
      });
    });

    // Largest first; source order breaks ties, so output is deterministic.
    notes.sort((a, b) => b.magnitude - a.magnitude || a.sourceIndex - b.sourceIndex);
    const result = notes.map((note, index) => Object.assign(note, { regionNumber: index + 1 }));

    Object.defineProperty(result, 'meta', {
      enumerable: false,
      value: Object.freeze({
        dataset: typeof json.dataset === 'string' ? json.dataset : '',
        rows,
        cols,
        totalRegions: json.regions.length,
        playableRegions: result.length,
        stableSkipped,
        maxAbsChange: maxAbs,
      }),
    });

    return result;
  }

  /* ------------------------------------------------------------------ *
   * Audio graph and scheduling
   * ------------------------------------------------------------------ */
  async function ensureAudio() {
    if (!state.ctx) {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) throw new Error('This browser does not support the Web Audio API.');

      const ctx = new AudioCtor();
      const compressor = ctx.createDynamicsCompressor();
      const settings = CONFIG.audio.compressor;
      compressor.threshold.value = settings.threshold;
      compressor.knee.value = settings.knee;
      compressor.ratio.value = settings.ratio;
      compressor.attack.value = settings.attack;
      compressor.release.value = settings.release;

      const master = ctx.createGain();
      master.gain.value = CONFIG.audio.masterGain;
      compressor.connect(master);
      master.connect(ctx.destination);

      state.ctx = ctx;
      state.compressor = compressor;
      state.master = master;
    }

    if (state.ctx.state !== 'running') {
      await state.ctx.resume();
    }
    if (state.ctx.state !== 'running') {
      throw new Error('Audio is blocked. Try clicking Play again.');
    }
    return state.ctx;
  }

  function trackVoice(osc, gain, panner) {
    const voice = { osc, gain, panner };
    state.voices.add(voice);
    osc.addEventListener('ended', () => {
      state.voices.delete(voice);
      try { osc.disconnect(); } catch (_) { /* already disconnected */ }
      try { gain.disconnect(); } catch (_) { /* already disconnected */ }
      try { panner.disconnect(); } catch (_) { /* already disconnected */ }
    }, { once: true });
  }

  function scheduleNote(note, when) {
    const ctx = state.ctx;
    const spec = note.direction === 'down' ? CONFIG.down : CONFIG.up;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const panner = ctx.createStereoPanner();

    osc.type = spec.wave;
    osc.frequency.setValueAtTime(note.frequency, when);
    panner.pan.setValueAtTime(note.pan, when);

    const peak = spec.peak;
    const sustain = Math.max(0.0002, peak * spec.sustain);
    const sustainAt = when + spec.attack + Math.max(0.02, (spec.duration - spec.attack) * spec.decay);

    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(peak, when + spec.attack);
    gain.gain.exponentialRampToValueAtTime(sustain, sustainAt);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + spec.duration);

    osc.connect(gain);
    gain.connect(panner);
    panner.connect(state.compressor);
    trackVoice(osc, gain, panner);

    osc.start(when);
    osc.stop(when + spec.duration + CONFIG.audio.tail);
  }

  function scheduleReferenceTone(frequency, when) {
    const ctx = state.ctx;
    const spec = CONFIG.legend;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = spec.wave;
    osc.frequency.setValueAtTime(frequency, when);

    // Flat plateau: a steady reference, not a decaying note.
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(spec.peak, when + spec.attack);
    gain.gain.setValueAtTime(spec.peak, when + spec.duration - spec.release);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + spec.duration);

    osc.connect(gain);
    gain.connect(state.compressor);

    const voice = { osc, gain, panner: null };
    state.voices.add(voice);
    osc.addEventListener('ended', () => {
      state.voices.delete(voice);
      try { osc.disconnect(); } catch (_) { /* noop */ }
      try { gain.disconnect(); } catch (_) { /* noop */ }
    }, { once: true });

    osc.start(when);
    osc.stop(when + spec.duration + CONFIG.audio.tail);
  }

  function scheduleAt(when, callback) {
    const delay = Math.max(0, (when - state.ctx.currentTime) * 1000);
    const id = setTimeout(() => {
      state.timers.delete(id);
      callback();
    }, delay);
    state.timers.add(id);
    return id;
  }

  function clearSchedule() {
    for (const id of state.timers) clearTimeout(id);
    state.timers.clear();
  }

  function silenceVoices() {
    if (!state.ctx) {
      state.voices.clear();
      return;
    }
    const now = state.ctx.currentTime;
    for (const voice of Array.from(state.voices)) {
      try {
        voice.gain.gain.cancelScheduledValues(now);
        voice.gain.gain.setTargetAtTime(0.0001, now, CONFIG.audio.stopFade / 3);
      } catch (_) { /* noop */ }
      try {
        voice.osc.stop(now + CONFIG.audio.stopFade + 0.02);
      } catch (_) { /* already stopped */ }
    }
    state.voices.clear();
  }

  function stopAll(options) {
    const opts = options || {};
    state.token += 1;
    state.mode = 'idle';
    clearSchedule();
    silenceVoices();
    setActive(-1, { scroll: false });
    setPlayingUI(false);
    if (!opts.silent) setLive('Stopped.');
  }
  /* ------------------------------------------------------------------ *
   * UI: mount, render, announce
   * ------------------------------------------------------------------ */
  function cacheDom() {
    const byId = (id) => document.getElementById(id);
    state.dom = {
      app: byId('se-app'),
      console: byId('se-console'),
      live: byId('se-live'),
      sourceName: byId('se-source-name'),
      sourceNote: byId('se-source-note'),
      load: byId('se-load'),
      file: byId('se-file'),
      play: byId('se-play'),
      prev: byId('se-prev'),
      next: byId('se-next'),
      legend: byId('se-legend'),
      stop: byId('se-stop'),
      list: byId('se-list'),
      empty: byId('se-empty'),
      count: byId('se-count'),
      skip: byId('se-skip'),
      map: byId('se-map'),
      mapFigure: byId('se-map-figure'),
      mapLabel: byId('se-map-label'),
      checkBody: byId('se-check-body'),
      checkFoot: byId('se-check-foot'),
    };
  }

  function setLive(text) {
    if (state.dom.live) state.dom.live.textContent = text;
  }

  function setPlayingUI(playing) {
    if (state.dom.console) state.dom.console.classList.toggle('is-playing', playing);
  }

  function setActive(index, options) {
    const opts = options || {};
    state.activeIndex = index;

    state.regionButtons.forEach((button, buttonIndex) => {
      const active = buttonIndex === index;
      button.classList.toggle('is-active', active);
      if (active) button.setAttribute('aria-current', 'true');
      else button.removeAttribute('aria-current');
    });

    for (const cell of state.mapIndex.values()) {
      cell.classList.remove('is-active');
    }
    if (index >= 0 && state.mapIndex.has(index)) {
      state.mapIndex.get(index).classList.add('is-active');
    }

    if (index >= 0 && opts.scroll !== false) {
      const button = state.regionButtons[index];
      if (button) button.scrollIntoView({ block: 'nearest' });
    }
  }

  function regionSpeech(note, index, total) {
    const direction = note.direction === 'up' ? 'increase' : 'decrease';
    return 'Region ' + (index + 1) + ' of ' + total + ': row ' + note.row + ', column ' + note.col +
      ', ' + direction + ', ' + note.changeLabel + '. Pitch ' + note.pitchName + ', ' + panSpeech(note.pan) + '.';
  }

  function renderList() {
    const list = state.dom.list;
    list.textContent = '';
    state.regionButtons = [];

    state.notes.forEach((note, index) => {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'se-region';
      button.dataset.direction = note.direction;
      button.setAttribute('aria-label', regionSpeech(note, index, state.notes.length) + ' Activate to play this note.');

      const number = el('span', 'se-region-num', String(index + 1).padStart(2, '0'));

      const main = el('span', 'se-region-main');
      const idRow = el('span', 'se-region-id');
      const direction = el('span', 'se-dir');
      direction.append(
        el('span', 'se-dir-mark', note.direction === 'up' ? '▲' : '▼'),
        document.createTextNode(' ' + (note.direction === 'up' ? 'increase' : 'decrease')),
      );
      idRow.append(direction, el('span', 'se-region-cell', 'row ' + note.row + ' · col ' + note.col));
      main.append(idRow);

      const magnitude = el('span', 'se-region-mag');
      const bar = el('span', 'se-bar');
      const fill = el('span');
      fill.style.width = Math.max(3, note.magnitude * 100) + '%';
      bar.append(fill);
      magnitude.append(bar, el('span', 'se-mag-num', Math.round(note.magnitude * 100) + '%'));

      const readout = el('span', 'se-region-note');
      readout.append(
        el('span', 'se-pitch', note.pitchName),
        el('span', 'se-pan', panText(note.pan)),
      );

      button.append(number, main, magnitude, readout);
      button.addEventListener('click', () => { void playRegion(index); });
      item.append(button);
      list.append(item);
      state.regionButtons.push(button);
    });
  }

  function renderMap() {
    const meta = state.meta;
    const map = state.dom.map;
    const figure = state.dom.mapFigure;
    map.textContent = '';
    state.mapIndex.clear();

    if (!meta || !state.notes.length || meta.rows * meta.cols > CONFIG.ui.mapCellLimit) {
      figure.hidden = true;
      return;
    }

    figure.hidden = false;
    state.dom.mapLabel.textContent = meta.cols + ' × ' + meta.rows;
    map.style.gridTemplateColumns = 'repeat(' + meta.cols + ', minmax(0, 1fr))';
    map.style.gridTemplateRows = 'repeat(' + meta.rows + ', minmax(0, 1fr))';

    const lit = new Map();
    for (const note of state.notes) {
      const key = note.row + ':' + note.col;
      if (!lit.has(key)) lit.set(key, []);
      lit.get(key).push(note);
    }

    for (let row = 0; row < meta.rows; row += 1) {
      for (let col = 0; col < meta.cols; col += 1) {
        const cell = el('span', 'se-cell');
        const notesHere = lit.get(row + ':' + col);
        if (notesHere && notesHere.length) {
          const strongest = notesHere.reduce((best, note) => (note.magnitude > best.magnitude ? note : best));
          cell.classList.add('is-lit', strongest.direction === 'up' ? 'is-up' : 'is-down');
          cell.style.setProperty('--mag', strongest.magnitude.toFixed(3));
          for (const note of notesHere) {
            state.mapIndex.set(note.regionNumber - 1, cell);
          }
        }
        map.append(cell);
      }
    }
  }

  function renderCheck() {
    const body = state.dom.checkBody;
    body.textContent = '';

    state.notes.forEach((note, index) => {
      const row = document.createElement('tr');
      row.dataset.direction = note.direction;
      const cells = [
        [String(index + 1).padStart(2, '0'), 'se-td-num'],
        [note.row + ',' + note.col, ''],
        [(note.direction === 'up' ? '▲ up' : '▼ down'), note.direction === 'up' ? 'se-td-up' : ''],
        [Math.round(note.magnitude * 100) + '%', ''],
        [note.pitchName, 'se-td-pitch'],
        [note.pan.toFixed(2), ''],
      ];
      for (const [text, className] of cells) {
        row.append(el('td', className || undefined, text));
      }
      body.append(row);
    });

    const meta = state.meta;
    const total = meta ? meta.totalRegions : state.notes.length;
    const skipped = Math.max(0, total - state.notes.length);
    const low = midiToName(CONFIG.pitch.rootMidi);
    const high = midiToName(CONFIG.pitch.rootMidi + CONFIG.pitch.offsets[CONFIG.pitch.offsets.length - 1]);

    state.dom.checkFoot.textContent = state.notes.length
      ? state.notes.length + ' of ' + total + ' regions · ' + skipped + ' skipped · ' + low + '–' + high + ' · pan ±' + CONFIG.panWidth.toFixed(2)
      : 'No playable notes.';
  }

  function renderSummary() {
    const notes = state.notes;
    const meta = state.meta;
    state.dom.count.textContent = notes.length + (notes.length === 1 ? ' note' : ' notes');
    state.dom.empty.hidden = notes.length > 0;

    if (notes.length === 0) {
      state.dom.empty.textContent = meta && meta.totalRegions > 0
        ? 'No playable regions — every region is stable.'
        : 'No playable regions. Load a JSON file with a regions array.';
    }

    if (meta) {
      const parts = [];
      const skipped = Math.max(0, meta.totalRegions - meta.playableRegions);
      if (meta.stableSkipped > 0 && meta.stableSkipped === skipped) {
        parts.push(meta.stableSkipped + (meta.stableSkipped === 1 ? ' stable region skipped' : ' stable regions skipped'));
      } else if (skipped > 0) {
        parts.push(skipped + (skipped === 1 ? ' region skipped' : ' regions skipped'));
      }
      parts.push(meta.cols + ' × ' + meta.rows + ' grid');
      state.dom.skip.textContent = parts.join(' · ');
    } else {
      state.dom.skip.textContent = '';
    }
  }

  function updateSource(source) {
    const meta = state.meta;
    state.dom.sourceName.textContent = meta && meta.dataset ? meta.dataset : source.label;
    const parts = [source.label];
    if (meta) parts.push(meta.cols + ' × ' + meta.rows + ' grid');
    if (source.fallback) parts.push('data.json unavailable');
    state.dom.sourceNote.textContent = parts.join(' · ');
    state.dom.sourceNote.dataset.tone = source.fallback ? 'warn' : '';
    state.dom.sourceNote.title = source.reason
      ? 'data.json could not be loaded: ' + (source.reason.message || source.reason)
      : '';
  }

  function renderAll() {
    renderList();
    renderMap();
    renderCheck();
    renderSummary();
    setActive(-1, { scroll: false });
  }

  function logNotes(notes) {
    if (!notes.length) {
      console.info('[Night Lights] No playable notes.');
      return;
    }
    console.groupCollapsed('[Night Lights] ' + notes.length + ' notes · ' + state.source);
    console.table(notes.map((note) => ({
      region: note.regionNumber,
      row: note.row,
      col: note.col,
      direction: note.direction,
      magnitude: Number(note.magnitude.toFixed(4)),
      pitch: note.pitchName,
      pan: note.pan,
    })));
    console.groupEnd();
  }

  function setLoadError(message) {
    state.dom.sourceNote.textContent = message;
    state.dom.sourceNote.dataset.tone = 'error';
    state.dom.sourceNote.title = message;
    setLive(message);
  }

  function applyData(json, options) {
    const opts = options || {};
    let notes;

    try {
      notes = adaptData(json);
    } catch (error) {
      setLoadError((opts.label ? opts.label + ': ' : '') + error.message);
      return false;
    }

    stopAll({ silent: true });
    state.notes = notes;
    state.meta = notes.meta || null;
    state.source = opts.label || 'JSON';
    renderAll();
    updateSource({ label: state.source, fallback: opts.fallback, reason: opts.reason });
    logNotes(notes);

    const count = notes.length;
    if (count > 0) {
      const intro = opts.fallback
        ? 'data.json could not be loaded, so the built-in demo is loaded. '
        : 'Loaded ' + count + (count === 1 ? ' changed region' : ' changed regions') + ' from ' + state.source + '. ';
      setLive(intro + 'Press Space to play the full piece, or use the arrow keys to step through regions.');
    } else if (state.meta && state.meta.totalRegions > 0) {
      setLive('Loaded ' + state.source + '. No playable regions — every region is stable.');
    } else {
      setLive('Loaded ' + state.source + '. The file contains no regions.');
    }

    return true;
  }

  async function loadFromUrl() {
    const token = ++state.loadToken;
    state.dom.sourceNote.dataset.tone = '';
    state.dom.sourceNote.textContent = 'Fetching ' + CONFIG.dataUrl + '…';

    try {
      const response = await fetch(CONFIG.dataUrl, { cache: 'no-store' });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const json = await response.json();
      if (token !== state.loadToken) return;
      applyData(json, { label: CONFIG.dataUrl });
    } catch (error) {
      if (token !== state.loadToken) return;
      if (CONFIG.useDemoFallback) {
        applyData(FALLBACK_DATA, { label: 'Built-in demo', fallback: true, reason: error });
      } else {
        setLoadError('Could not load ' + CONFIG.dataUrl + ': ' + error.message);
      }
    }
  }

  async function loadFile(file) {
    const token = ++state.loadToken;
    try {
      const text = await file.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch (_) {
        throw new Error('That file is not valid JSON.');
      }
      if (token !== state.loadToken) return;
      applyData(json, { label: file.name });
    } catch (error) {
      if (token !== state.loadToken) return;
      setLoadError('Could not load ' + file.name + ': ' + error.message);
    }
  }
  /* ------------------------------------------------------------------ *
   * Transport
   * ------------------------------------------------------------------ */
  function maxPieceNotes() {
    const longest = Math.max(CONFIG.up.duration, CONFIG.down.duration);
    return Math.max(1, Math.floor((CONFIG.piece.maxSeconds - longest) / CONFIG.piece.spacing) + 1);
  }

  async function playPiece() {
    if (!state.notes.length) {
      setLive('No regions loaded yet. Choose a JSON file to begin.');
      return;
    }

    try {
      await ensureAudio();
    } catch (error) {
      setLive(error.message);
      return;
    }

    stopAll({ silent: true });
    const token = ++state.token;
    state.mode = 'piece';
    setPlayingUI(true);

    const notes = state.notes;
    const limit = maxPieceNotes();
    const count = Math.min(notes.length, limit);
    const start = state.ctx.currentTime + CONFIG.piece.leadIn;

    for (let index = 0; index < count; index += 1) {
      const note = notes[index];
      const when = start + index * CONFIG.piece.spacing;
      scheduleNote(note, when);
      scheduleAt(when, () => {
        if (token !== state.token) return;
        setActive(index);
        setLive(regionSpeech(note, index, notes.length));
        setPlayingUI(true);
      });
    }

    const lastNote = notes[count - 1];
    const lastDuration = lastNote.direction === 'down' ? CONFIG.down.duration : CONFIG.up.duration;
    const endAt = start + (count - 1) * CONFIG.piece.spacing + lastDuration + CONFIG.piece.endPadding;

    scheduleAt(endAt, () => {
      if (token !== state.token) return;
      state.mode = 'idle';
      setPlayingUI(false);
      const omitted = notes.length - count;
      setLive(
        'Piece complete. ' + count + (count === 1 ? ' region played' : ' regions played') +
        (omitted > 0 ? '; ' + omitted + ' omitted by the 30 second limit' : '') + '.',
      );
    });

    setLive('Playing ' + count + (count === 1 ? ' region' : ' regions') + ', largest first.');
  }

  function nextRegionIndex(direction) {
    const count = state.notes.length;
    if (!count) return -1;
    if (state.activeIndex < 0) return direction > 0 ? 0 : count - 1;
    return (state.activeIndex + direction + count) % count;
  }

  async function playRegion(index) {
    if (!state.notes.length) {
      setLive('No regions loaded yet. Choose a JSON file to begin.');
      return;
    }

    const safeIndex = ((index % state.notes.length) + state.notes.length) % state.notes.length;

    try {
      await ensureAudio();
    } catch (error) {
      setLive(error.message);
      return;
    }

    stopAll({ silent: true });
    const token = ++state.token;
    state.mode = 'single';
    const note = state.notes[safeIndex];
    const when = state.ctx.currentTime + CONFIG.audio.startPadding;
    scheduleNote(note, when);
    setActive(safeIndex);
    setPlayingUI(true);
    setLive(regionSpeech(note, safeIndex, state.notes.length));

    const duration = note.direction === 'down' ? CONFIG.down.duration : CONFIG.up.duration;
    scheduleAt(when + duration + CONFIG.piece.endPadding, () => {
      if (token !== state.token) return;
      state.mode = 'idle';
      setPlayingUI(false);
    });
  }

  function stepRegion(direction) {
    const index = nextRegionIndex(direction);
    if (index >= 0) void playRegion(index);
  }

  async function playLegend() {
    try {
      await ensureAudio();
    } catch (error) {
      setLive(error.message);
      return;
    }

    stopAll({ silent: true });
    const token = ++state.token;
    state.mode = 'legend';
    setPlayingUI(true);

    const pool = CONFIG.pitch.offsets.map((offset) => {
      const midi = CONFIG.pitch.rootMidi + offset;
      return { midi, name: midiToName(midi), frequency: midiToFrequency(midi) };
    });
    const low = pool[0];
    const middle = pool[Math.floor((pool.length - 1) / 2)];
    const high = pool[pool.length - 1];

    const start = state.ctx.currentTime + CONFIG.audio.startPadding;
    const times = [
      start,
      start + CONFIG.legend.gap,
      start + CONFIG.legend.gap * 2,
    ];
    scheduleReferenceTone(middle.frequency, times[0]);
    scheduleReferenceTone(low.frequency, times[1]);
    scheduleReferenceTone(high.frequency, times[2]);

    const lines = [
      'Legend. Reference for no change: middle pitch ' + middle.name + ', steady tone.',
      'Legend. Low example: ' + low.name + '.',
      'Legend. High example: ' + high.name + '.',
    ];
    times.forEach((when, index) => {
      scheduleAt(when, () => {
        if (token !== state.token) return;
        setLive(lines[index]);
      });
    });

    scheduleAt(times[2] + CONFIG.legend.duration + CONFIG.piece.endPadding, () => {
      if (token !== state.token) return;
      state.mode = 'idle';
      setPlayingUI(false);
      setLive('Legend complete. Low is a small change; high is a large change.');
    });
  }

  /* ------------------------------------------------------------------ *
   * Input
   * ------------------------------------------------------------------ */
  function onKeyDown(event) {
    if (event.defaultPrevented || event.repeat) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    const target = event.target;
    if (target && (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable
    )) return;

    const focused = document.activeElement;
    const onButton = focused && typeof focused.closest === 'function'
      ? focused.closest('button, a, summary, [role="button"]')
      : null;

    if (event.code === 'Space') {
      // Let the focused control activate natively.
      if (onButton) return;
      event.preventDefault();
      void playPiece();
      return;
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      stepRegion(-1);
      return;
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      stepRegion(1);
      return;
    }

    const key = event.key.toLowerCase();
    if (key === 'l') {
      event.preventDefault();
      void playLegend();
      return;
    }
    if (key === 's') {
      event.preventDefault();
      stopAll();
    }
  }

  function bindEvents() {
    const dom = state.dom;
    dom.play.addEventListener('click', () => { void playPiece(); });
    dom.prev.addEventListener('click', () => { stepRegion(-1); });
    dom.next.addEventListener('click', () => { stepRegion(1); });
    dom.legend.addEventListener('click', () => { void playLegend(); });
    dom.stop.addEventListener('click', () => { stopAll(); });
    dom.load.addEventListener('click', () => { dom.file.click(); });
    dom.file.addEventListener('change', () => {
      const file = dom.file.files && dom.file.files[0];
      dom.file.value = '';
      if (file) void loadFile(file);
    });
    document.addEventListener('keydown', onKeyDown);
  }

  /* ------------------------------------------------------------------ *
   * Boot
   * ------------------------------------------------------------------ */
  function init() {
    if (document.getElementById('se-app')) return;
    if (!document.documentElement.lang) document.documentElement.lang = 'en';
    if (!document.title) document.title = 'Night Lights — Sonification';

    const style = document.createElement('style');
    style.id = 'se-nightlights-styles';
    style.textContent = CSS;
    document.head.append(style);

    const holder = document.createElement('div');
    holder.innerHTML = HTML;
    document.body.append(holder.firstElementChild);
    document.body.classList.add('se-mounted');

    cacheDom();
    bindEvents();
    setLive('Ready. Press Space to play the whole piece.');
    void loadFromUrl();
  }

  function whenReady(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
    } else {
      callback();
    }
  }

  if (!window.__nightLightsEngineLoaded) {
    window.__nightLightsEngineLoaded = true;
    whenReady(init);
    window.SonificationEngine = Object.freeze({
      CONFIG,
      adaptData,
      notes: () => state.notes.slice(),
      play: () => playPiece(),
      stop: () => stopAll(),
      next: () => stepRegion(1),
      previous: () => stepRegion(-1),
      legend: () => playLegend(),
      load: (json) => {
        state.loadToken += 1;
        return applyData(json, { label: 'API' });
      },
    });
  }
})();




