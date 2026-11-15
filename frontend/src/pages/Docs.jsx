import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import { jumpToSection } from '../jump.js';

const EXAMPLE_JSON = `{
  "dataset": "nightlights_2012_2023",
  "source": "NASA EIC visualization",
  "grid": { "rows": 16, "cols": 16 },
  "regions": [
    {
      "row": 5,
      "col": 11,
      "score": 5.173828125,
      "signed_change": 4.751953125,
      "direction": "increase"
    },
    {
      "row": 3,
      "col": 8,
      "score": 3.70947265625,
      "signed_change": -1.08349609375,
      "direction": "decrease"
    }
  ]
}`;

const API_EXAMPLE = `import { createEngine } from './engine.js';

const engine = createEngine({ headless: true, volume: 0.3 });

engine.subscribe('regionStart', (index, note) => {
  console.log(index, note.number, note.pitchName, note.pan);
});

engine.subscribe('error', (error) => {
  console.error(error.kind, error.message);
});

await engine.loadJSON('./data.json', 'data.json');
await engine.play(); // schedules the piece; events report progress`;

const FIELDS = [
  ['regions', 'Yes', 'An array of candidate regions. If this is missing, the file is rejected with a data error.'],
  ['regions[].signed_change', 'Yes', 'A finite number. Its absolute value sets pitch; its sign decides direction when direction is missing. Entries without a usable number are skipped.'],
  ['regions[].direction', 'No', 'increase, decrease, or stable, case-insensitive. stable is skipped. An unknown or missing label uses the sign; a zero with no label is skipped.'],
  ['regions[].row, regions[].col', 'No', 'Converted with Number(...) || 0. Missing, empty, or non-numeric values become 0; decimal and negative values are kept as-is and can fall outside the grid.'],
  ['regions[].score', 'No', 'Kept in the source file for provenance. The player does not read it.'],
  ['grid.rows, grid.cols', 'No', 'Positive integers. If absent, the grid is inferred from the highest row or column plus one.'],
  ['dataset', 'No', 'A string stored in the engine info as info.dataset. The Listen source line shows it after the file name when present.'],
  ['source', 'No', 'Optional provenance. The sound mapping does not use it.'],
];

const EVENTS = [
  ['loaded', 'payload', 'A successful load: { notes, info, label, problem }. Notes are already sorted, largest first.'],
  ['regionStart', '(index, note)', 'A region became current, either during the piece or for a single-region play.'],
  ['pieceEnd', 'payload', "kind: 'piece' with played, total, and left; kind: 'region' with index; or kind: 'legend'."],
  ['stopped', 'none', 'Stop finished fading the current bus.'],
  ['error', 'error', "An Error with kind: 'load', 'data', 'audio', or 'empty'."],
  ['playState', 'boolean', 'Internal UI event for play/stop state. Subscribers may use it, but the five events above are the stable surface.'],
];

export default function Docs() {
  return (
    <div className="page">
      <PageHeader
        title="Docs"
        lede="Run the site, load your own JSON, or drive the sonification engine from another page. Every number here matches the code in this repository."
      />

      <div className="page-body prose">
        <nav className="toc" aria-label="On this page">
          <a href="#quick-start" onClick={(event) => jumpToSection(event, 'quick-start')}>Quick start</a>
          <a href="#data-format" onClick={(event) => jumpToSection(event, 'data-format')}>Data format</a>
          <a href="#loading" onClick={(event) => jumpToSection(event, 'loading')}>Loading data</a>
          <a href="#engine-api" onClick={(event) => jumpToSection(event, 'engine-api')}>Engine API</a>
          <a href="#audio-file" onClick={(event) => jumpToSection(event, 'audio-file')}>WAV export</a>
          <a href="#run-build" onClick={(event) => jumpToSection(event, 'run-build')}>Run and build</a>
          <a href="#deploy" onClick={(event) => jumpToSection(event, 'deploy')}>Deploy</a>
          <a href="#troubleshooting" onClick={(event) => jumpToSection(event, 'troubleshooting')}>Troubleshooting</a>
        </nav>

        <section className="page-section" aria-labelledby="quick-start">
          <h2 id="quick-start">Quick start</h2>
          <p>
            Open the Listen page. Nothing starts automatically. Press <kbd>Space</kbd> to play the
            piece, or use the buttons. The default dataset loads from <code>public/data.json</code>.
          </p>
          <p>
            On a first visit, the page also asks the browser for OS accessibility preferences. If
            forced colours, more contrast, inverted colours, reduced transparency, or reduced
            motion is active, the site opens in accessibility mode on the image frames instead of
            the 3D globe. A saved choice from the header button or the <kbd>A</kbd> key overrides
            detection.
          </p>
          <p>
            Every keyboard shortcut is listed once, on the{' '}
            <Link to="/accessibility">Accessibility page</Link>, and in the Shortcuts dialog
            (<kbd>?</kbd>).
          </p>
        </section>

        <section className="page-section" aria-labelledby="data-format">
          <h2 id="data-format">Data format</h2>
          <p>
            A data file is one JSON object with a <code>regions</code> array. This is a valid
            two-region file:
          </p>
          <pre><code>{EXAMPLE_JSON}</code></pre>

          <div className="table-wrap">
            <table>
              <caption>Field reference. Only regions and signed_change are required.</caption>
              <thead>
                <tr>
                  <th scope="col">Field</th>
                  <th scope="col">Required</th>
                  <th scope="col">What the engine does</th>
                </tr>
              </thead>
              <tbody>
                {FIELDS.map(([field, required, detail]) => (
                  <tr key={field}>
                    <th scope="row"><code>{field}</code></th>
                    <td>{required}</td>
                    <td>{detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3>Rules the player applies</h3>
          <ul>
            <li>Playable regions are sorted by the absolute value of <code>signed_change</code>, largest first. Ties keep file order.</li>
            <li>Relative size is scaled to the largest playable absolute change, not to the grid or to skipped rows.</li>
            <li>Pitch uses an 11-step D minor pentatonic scale from D4 to D6. Decreases are shifted down one octave.</li>
            <li>Pan uses the column: left columns to the left, right columns to the right, at 90% stereo width.</li>
            <li>The piece schedules one note every 0.8 seconds and stops adding notes at the 30-second cap. The default file fits completely.</li>
            <li>Stable regions, regions without a finite <code>signed_change</code>, and unlabeled zero-change regions are skipped. The Listen source line reports the total skipped.</li>
          </ul>
          <div className="callout">
            <p>
              <strong>No computer vision at runtime.</strong> The browser does not inspect the
              NASA images to derive values. It plays the numbers in the JSON. If you want a new
              dataset, run your analysis first, then load the result here.
            </p>
          </div>
        </section>

        <section className="page-section" aria-labelledby="loading">
          <h2 id="loading">Loading data</h2>
          <p>
            On Listen, choose <strong>Load JSON</strong> and pick a <code>.json</code> file. A
            successful load replaces the current data, stops audio, and selects the first region.
            A failed load leaves the current data in place and shows a visible error.
          </p>
          <p>
            From code, <code>engine.loadJSON(input, label)</code> accepts a URL string, a{' '}
            <code>File</code> or <code>Blob</code>, or parsed JSON. It returns a promise that
            resolves to <code>true</code> on success and <code>false</code> on failure. A failed
            load emits an <code>error</code> event with <code>kind: "load"</code> or{' '}
            <code>kind: "data"</code>.
          </p>
          <pre><code>{`// URL, File/Blob, or parsed object
await engine.loadJSON('./my-data.json', 'my-data.json');
await engine.loadJSON(fileInput.files[0], fileInput.files[0].name);
await engine.loadJSON(parsedObject, 'pasted.json');`}</code></pre>
        </section>

        <section className="page-section" aria-labelledby="engine-api">
          <h2 id="engine-api">Engine API</h2>
          <p>
            The engine is created once in <code>src/engineInstance.js</code> with{' '}
            <code>{'{ headless: true, volume: 0.3 }'}</code>. React reads it through one hook. React
            never schedules audio; it only renders state and sends user commands.
          </p>
          <pre><code>{API_EXAMPLE}</code></pre>

          <h3>Methods</h3>
          <div className="table-wrap">
            <table>
              <caption>Return values are what the current implementation returns, not a promise about future versions.</caption>
              <thead>
                <tr>
                  <th scope="col">Method</th>
                  <th scope="col">Returns</th>
                  <th scope="col">Notes</th>
                </tr>
              </thead>
              <tbody>
                <tr><th scope="row"><code>play()</code></th><td>Promise&lt;void&gt;</td><td>Resolves when the piece has been scheduled, not when it ends. Listen to events for progress.</td></tr>
                <tr><th scope="row"><code>playRegion(index)</code></th><td>Promise&lt;void&gt;</td><td>Plays one region once and selects it. The index wraps.</td></tr>
                <tr><th scope="row"><code>next()</code>, <code>previous()</code></th><td>number</td><td>The selected index, or -1 when there are no regions.</td></tr>
                <tr><th scope="row"><code>stop()</code></th><td>void</td><td>Fades and clears the bus, stops speech only when the UI calls it, and emits stopped.</td></tr>
                <tr><th scope="row"><code>legend()</code></th><td>Promise&lt;void&gt;</td><td>Plays the no-change, small, large, and decrease reference sounds.</td></tr>
                <tr><th scope="row"><code>loadJSON(input, label)</code></th><td>Promise&lt;boolean&gt;</td><td>The one React-facing loader. See Loading data.</td></tr>
                <tr><th scope="row"><code>load(json, label)</code></th><td>boolean</td><td>Applies an already parsed object without the fetch/read step.</td></tr>
                <tr><th scope="row"><code>setVolume(level)</code></th><td>number</td><td>Clamps to 0–1. The change is applied to the live master gain with a short ramp.</td></tr>
                <tr><th scope="row"><code>subscribe(event, fn)</code></th><td>function</td><td>Returns an unsubscribe function. Listener errors are caught and logged.</td></tr>
                <tr><th scope="row"><code>getState()</code></th><td>object</td><td>{'{ notes, info, sourceLabel, index, isPlaying, volume }'}; notes and info are copies.</td></tr>
                <tr><th scope="row"><code>render(kind)</code></th><td>Promise&lt;AudioBuffer&gt;</td><td>Offline render at 44.1 kHz stereo. kind is 'piece' or 'legend'.</td></tr>
                <tr><th scope="row"><code>toWav(buffer)</code></th><td>ArrayBuffer</td><td>16-bit PCM WAV with a standard header.</td></tr>
                <tr><th scope="row"><code>saveWav()</code></th><td>Promise&lt;void&gt;</td><td>Renders and downloads the piece. The Listen button uses render + toWav instead.</td></tr>
                <tr><th scope="row"><code>describe(note)</code></th><td>string</td><td>The full now-playing sentence, including region number, row/column, direction, size, pitch, and pan.</td></tr>
                <tr><th scope="row"><code>panLabel(pan, spoken)</code></th><td>string</td><td>Visual form like 85% L, or spoken form like 85 percent left.</td></tr>
                <tr><th scope="row"><code>speakable(name)</code></th><td>string</td><td>Replaces the sharp symbol with the word "sharp".</td></tr>
                <tr><th scope="row"><code>notes()</code></th><td>array</td><td>A copy of the current notes.</td></tr>
                <tr><th scope="row"><code>planPiece(notes)</code></th><td>object</td><td>{'{ slots, count, seconds }'}; used by the interface to report how many will play.</td></tr>
              </tbody>
            </table>
          </div>

          <h3>Events</h3>
          <div className="table-wrap">
            <table>
              <caption>Events are emitted synchronously from the engine. React subscribes through useEngine.</caption>
              <thead>
                <tr>
                  <th scope="col">Event</th>
                  <th scope="col">Arguments</th>
                  <th scope="col">When</th>
                </tr>
              </thead>
              <tbody>
                {EVENTS.map(([event, args, detail]) => (
                  <tr key={event}>
                    <th scope="row"><code>{event}</code></th>
                    <td>{args}</td>
                    <td>{detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="page-section" aria-labelledby="audio-file">
          <h2 id="audio-file">Downloading audio</h2>
          <p>
            <strong>Download audio (WAV)</strong> renders the whole piece with{' '}
            <code>OfflineAudioContext</code> at 44.1 kHz stereo, encodes 16-bit PCM, and downloads{' '}
            <code>night-lights-piece.wav</code>. It does not play the audio out loud first.
          </p>
          <p>
            Rendering uses the same voices, reverb, compressor, and master gain as live playback,
            so the file should match what you hear. If the browser has no offline audio support,
            the page reports the error instead of downloading an empty file.
          </p>
        </section>

        <section className="page-section" aria-labelledby="run-build">
          <h2 id="run-build">Run and build</h2>
          <p>Use Node.js 18 or newer. The project is a Vite + React 18 app with pinned versions.</p>
          <pre><code>{`cd frontend
npm install
npm run dev      # local development server
npm run build    # production build in dist/
npm run preview  # serve the production build locally`}</code></pre>
          <p>
            The Vite <code>base</code> is <code>"./"</code>, and routing uses{' '}
            <code>HashRouter</code>. That combination keeps assets, <code>data.json</code>, and
            page links working from a project subpath without a server rewrite.
          </p>
          <p>
            After the first build, the site is fully local: no CDN, no external fonts, and no
            runtime calls except the files in <code>public/</code>. The only browser storage is the
            accessibility preference, stored in <code>localStorage</code> inside a try/catch.
          </p>
        </section>

        <section className="page-section" aria-labelledby="deploy">
          <h2 id="deploy">Deploy to GitHub Pages</h2>
          <ol>
            <li>Build from <code>frontend/</code> with <code>npm run build</code>.</li>
            <li>Publish the contents of <code>frontend/dist</code> to the Pages branch or workflow.</li>
            <li>Keep <code>base: "./"</code> in <code>vite.config.js</code> so the build works under <code>/Aham-Bhramasmi/</code>.</li>
            <li>Open the Pages URL. Routes appear after the hash, for example <code>#/how-it-works</code>.</li>
          </ol>
          <p>
            The full command sequence and a workflow sketch are in <code>frontend/README.md</code>.
            Deep links do not need a 404 rewrite because everything after the hash stays in the
            browser.
          </p>
        </section>

        <section className="page-section" aria-labelledby="troubleshooting">
          <h2 id="troubleshooting">Troubleshooting</h2>
          <div className="table-wrap">
            <table>
              <caption>Common failures and the first thing to check.</caption>
              <thead>
                <tr>
                  <th scope="col">Symptom</th>
                  <th scope="col">What to do</th>
                </tr>
              </thead>
              <tbody>
                <tr><th scope="row">No sound</th><td>Press Play once more. Browsers only start audio after a user gesture. Check the volume slider and the system output.</td></tr>
                <tr><th scope="row">"That file is not valid JSON"</th><td>Check for a trailing comma, a comment, or a single quote. Standard JSON only.</td></tr>
                <tr><th scope="row">"Expected a JSON object with a regions array"</th><td>The file parsed, but its shape is wrong. The top level needs a regions array; each region needs a finite signed_change.</td></tr>
                <tr><th scope="row">The 3D view disappears</th><td>WebGL is unavailable or the context was lost. The image frames take over; the region list is still complete.</td></tr>
                <tr><th scope="row">The WAV fails</th><td>The browser may not support OfflineAudioContext. Try a current Chromium or Firefox build.</td></tr>
                <tr><th scope="row">The data error stays visible</th><td>Dismiss it, or load a valid file. A successful load clears it.</td></tr>
                <tr><th scope="row">A screen reader is silent</th><td>Check that the page is focused and the screen reader is watching live regions. Route changes set the title and focus the h1.</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="page-section" aria-labelledby="docs-references">
          <h2 id="docs-references">References</h2>
          <p>
            The project cites only the eight DOI references supplied with the challenge brief. They
            are listed on the <Link to="/about">About page</Link>. The slots live in{' '}
            <code>src/references.js</code>.
          </p>
        </section>
      </div>
    </div>
  );
}
