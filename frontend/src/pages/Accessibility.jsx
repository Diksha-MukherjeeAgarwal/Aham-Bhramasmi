import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import { FEEDBACK_FORM_URL } from '../site.js';

const feedbackReady = /^https?:\/\//.test(FEEDBACK_FORM_URL);

const MODE_CHANGES = [
  ['Colour', 'Black background, white text, one yellow accent. Meaning is never carried by colour alone.'],
  ['Type', '20 px base text, 1.7 line height, and a 70 ch maximum line length.'],
  ['Layout', 'One column. Buttons are at least 56 px tall with 12 px gaps between targets.'],
  ['Focus', 'A 4 px yellow focus ring with a 4 px offset.'],
  ['Motion', 'No animation or transitions. The 3D view is off by default.'],
  ['Shortcuts', 'A persistent shortcut sheet stays above the main content.'],
  ['Now playing', 'A fixed panel at the bottom names the current region; the page reserves space for it.'],
  ['3D', '“Show 3D view” remains available. If WebGL fails, the 2012 and 2023 frames take over.'],
];

export default function Accessibility() {
  return (
    <div className="page">
      <PageHeader
        title="Accessibility"
        lede="The site is keyboard-first and works without the 3D view. Accessibility mode makes the visual layer plainer and larger; it does not change the data or the sound mapping."
      />

      <div className="page-body prose">
        <section className="page-section" aria-labelledby="mode">
          <h2 id="mode">Accessibility mode</h2>
          <p>
            Turn it on with the <strong>Accessibility mode</strong> button in the header or the{' '}
            <kbd>A</kbd> key. The choice is saved in this browser only.
          </p>
          <p>
            On a first visit, the mode also starts on when the operating system or browser
            reports one of the supported preferences below. The check runs before the first paint,
            so the graphics and the 3D view are not shown by default.
          </p>
          <ul>
            <li>
              <code>forced-colors: active</code> — the forced colour palette, such as Windows
              High Contrast.
            </li>
            <li>
              <code>prefers-contrast: more</code> — the system asks for more contrast.
            </li>
            <li>
              <code>inverted-colors: inverted</code> — the system inverts colours.
            </li>
            <li>
              <code>prefers-reduced-transparency: reduce</code> — the system asks for less
              transparency.
            </li>
            <li>
              <code>prefers-reduced-motion: reduce</code> — the system asks for less motion.
            </li>
          </ul>
          <p>
            A saved choice wins and stays in effect on later visits. Without one, the page follows
            these preferences if they change while it is open. Browsers do not expose whether a
            screen reader is running, so these media queries are the only automatic signal; the
            header button and the <kbd>A</kbd> key always work.
          </p>
          <div className="table-wrap">
            <table>
              <caption>What changes when accessibility mode is on.</caption>
              <thead>
                <tr>
                  <th scope="col">Area</th>
                  <th scope="col">Behaviour</th>
                </tr>
              </thead>
              <tbody>
                {MODE_CHANGES.map(([area, detail]) => (
                  <tr key={area}>
                    <th scope="row">{area}</th>
                    <td>{detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            The mode is a preference, not a claim that the normal theme is unusable. Normal mode
            also supports the keyboard, reduced motion, color-scheme preference, and a visible focus
            ring.
          </p>
        </section>

        <section className="page-section" aria-labelledby="keyboard">
          <h2 id="keyboard">Keyboard</h2>
          <p>
            The skip link is the first focusable item. It jumps to the main content. The central
            key handler ignores keystrokes while you are typing in a field or a slider.
          </p>
          <div className="table-wrap">
            <table>
              <caption>Shortcuts work from any page. Space does not start the piece when a button has focus.</caption>
              <thead>
                <tr>
                  <th scope="col">Key</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                <tr><th scope="row"><kbd>Tab</kbd> / <kbd>Shift</kbd> + <kbd>Tab</kbd></th><td>Move through links, buttons, and the volume slider.</td></tr>
                <tr><th scope="row"><kbd>Enter</kbd></th><td>Activate a link or button.</td></tr>
                <tr><th scope="row"><kbd>Space</kbd></th><td>Play the piece. On a focused button, press the button instead.</td></tr>
                <tr><th scope="row"><kbd>←</kbd> / <kbd>→</kbd></th><td>Previous or next region.</td></tr>
                <tr><th scope="row"><kbd>L</kbd></th><td>Play the legend.</td></tr>
                <tr><th scope="row"><kbd>E</kbd></th><td>Speak the explanation.</td></tr>
                <tr><th scope="row"><kbd>S</kbd></th><td>Stop audio and speech.</td></tr>
                <tr><th scope="row"><kbd>A</kbd></th><td>Toggle accessibility mode.</td></tr>
                <tr><th scope="row"><kbd>?</kbd></th><td>Open the shortcuts dialog.</td></tr>
                <tr><th scope="row"><kbd>Esc</kbd></th><td>Close the shortcuts dialog.</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="page-section" aria-labelledby="screen-readers">
          <h2 id="screen-readers">Screen readers</h2>
          <p>
            Each route sets the document title, moves focus to the page's <code>h1</code>, and
            announces the page name once in a polite live region. The skip link comes before the
            header in the DOM.
          </p>
          <ul>
            <li>
              Playback changes are announced as short summaries: what started, what completed, and
              what stopped. The now-playing sentence updates visually on every note but is not
              announced per note, to avoid a wall of speech over the music.
            </li>
            <li>
              Every region button has a full-sentence accessible name: region number, row and
              column, increase or decrease, change size, pitch, and stereo position.
            </li>
            <li>
              Data and file errors appear in a visible <code>role="alert"</code> box on Listen.
              They are not repeated in the global polite region.
            </li>
            <li>
              The shortcuts dialog is a native modal <code>dialog</code> with a close button and
              Escape support. Focus stays inside it until it closes.
            </li>
            <li>
              Explain uses the browser's speech synthesis. If speech synthesis is unavailable, the
              explanation text is placed in the live region instead.
            </li>
          </ul>
          <p>
            The 3D canvas has <code>role="img"</code> and a fixed label saying that the list below
            holds every region. It is decorative: nothing in the canvas is the only source of
            information.
          </p>
        </section>

        <section className="page-section" aria-labelledby="motion">
          <h2 id="motion">Motion and 3D</h2>
          <ul>
            <li>The 3D view never rotates on its own. Tilt up, Tilt down, and Reset are buttons.</li>
            <li><code>prefers-reduced-motion</code> removes transitions and animations in every mode. Accessibility mode removes them regardless of the system setting.</li>
            <li>The scene renders on demand, pauses while the tab is hidden, caps the pixel ratio at 2, and disposes geometry, materials, and textures when it unmounts.</li>
            <li>If WebGL is unavailable, the browser blocks it, or the context is lost, the page switches to the 2012 and 2023 image frames.</li>
            <li>Accessibility mode starts on the image frames. You can still choose “Show 3D view” if you want it.</li>
          </ul>
        </section>

        <section className="page-section" aria-labelledby="contrast">
          <h2 id="contrast">Contrast, text, and zoom</h2>
          <p>
            Accessibility mode uses black <code>#000000</code>, white <code>#ffffff</code>, and one
            yellow accent <code>#ffd400</code>. White on black is 21:1; the yellow on black is about
            16:1. The accent is used for links, the primary button, focus, and the active region.
          </p>
          <p>
            In normal mode, increases are amber and decreases are cyan. The direction is also
            written as a word and shown with an arrow, so colour is never the only cue.
          </p>
          <p>
            The layout reflows to one column at 320 CSS pixels. Buttons wrap instead of shrinking
            below the target size. Wide tables scroll inside their own wrapper instead of forcing
            the page sideways.
          </p>
          <p>
            At 200% and 400% zoom, text containers have no fixed height, and the page can scroll
            vertically. The 3D view keeps a 16:9 box; if it is in the way, switch to the image
            frames or turn accessibility mode on.
          </p>
          <p>
            Target: WCAG 2.2 AA. The site has not been through a formal third-party audit, so this
            is a design target, not a certification.
          </p>
        </section>

        <section className="page-section" aria-labelledby="limits">
          <h2 id="limits">Known limits</h2>
          <ul>
            <li>Audio needs Web Audio support and a user gesture. Some locked-down browsers block both.</li>
            <li>Screen-reader speech and the sonification can overlap. Use Stop, lower the volume, or finish the spoken explanation first.</li>
            <li>Explain depends on the browser's installed voices. The text fallback is always available in the live region.</li>
            <li>If <code>localStorage</code> is blocked, the accessibility preference lasts for the session only.</li>
            <li>The 3D view is a visual summary, not a complete spatial description. The region list is the accessible source.</li>
            <li>The default data is a small sample derived from a NASA visualization, not a scientific measurement of emissions.</li>
            <li>WAV export needs <code>OfflineAudioContext</code>. If it is missing, the page reports the error.</li>
          </ul>
        </section>

        <section className="page-section" aria-labelledby="feedback">
          <h2 id="feedback">Feedback</h2>
          <p>
            If a barrier blocks you, please report it. Include the page, the browser, the assistive
            technology you used, and what happened.
          </p>
          {feedbackReady ? (
            <p>
              <a href={FEEDBACK_FORM_URL} target="_blank" rel="noreferrer">
                Open the feedback form
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </p>
          ) : (
            <p>
              Feedback form: <span className="placeholder">FEEDBACK_FORM_URL</span>
            </p>
          )}
          <p>
            You can also read the <Link to="/docs">Docs</Link> for keyboard and data details, or
            the <Link to="/how-it-works">How it works</Link> page for the sound mapping.
          </p>
        </section>
      </div>
    </div>
  );
}
