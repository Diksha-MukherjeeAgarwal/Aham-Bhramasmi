import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import ReferenceList from '../components/ReferenceList.jsx';
import {
  CHALLENGE_NAME,
  FEEDBACK_FORM_URL,
  GITHUB_URL,
  LICENSE_PLACEHOLDER,
  NASA_CREDIT_TEXT,
  SITE_NAME,
  SITE_SUBTITLE,
  SVS_ASSET_TITLE,
  SVS_URL,
  TEAM_MEMBER_PLACEHOLDERS,
} from '../site.js';

const feedbackReady = /^https?:\/\//.test(FEEDBACK_FORM_URL);
const svsReady = /^https?:\/\//.test(SVS_URL);

export default function About() {
  return (
    <div className="page">
      <PageHeader
        title="About"
        lede={`${SITE_NAME}: ${SITE_SUBTITLE} is a small, keyboard-first jukebox for the largest changes in NASA's night-lights comparison.`}
      />

      <div className="page-body prose">
        <section className="page-section" aria-labelledby="project">
          <h2 id="project">The project</h2>
          <p>
            Most sonifications turn one image into sound. This one turns a <em>difference</em> into
            sound. It compares night lights in 2012 and 2023, keeps the regions where the light
            changed, and plays the largest changes first. The result is short enough to listen to
            in one sitting and structured enough to check note by note.
          </p>
          <p>
            The interface is built around listening without sight: real buttons, one central
            keyboard handler, full-sentence region names, a visible now-playing sentence, and a
            complete region list that names every pitch and pan value. The 3D view is optional
            decoration; the list is the source of truth.
          </p>
          <p>
            Built for the NASA Space Apps Challenge, {CHALLENGE_NAME}. The project is an independent
            submission and is not an official NASA product.
          </p>
        </section>

        <section className="page-section" aria-labelledby="why">
          <h2 id="why">Why “Change Mode”?</h2>
          <p>
            A single night-lights frame is beautiful, but the story is in what moved. Change Mode
            makes that story audible: a bigger change is a higher note, an increase is bright and
            short, and a decrease is dark, slow, and an octave lower. The column becomes the stereo
            position, so you can hear east and west as well as up and down.
          </p>
          <p>
            The mapping is deliberately simple. A listener should be able to learn it from the
            legend in under a minute, then use it to explore a file. The <Link to="/how-it-works">How
            it works</Link> page documents every choice, including the parts the music does not
            claim to measure.
          </p>
        </section>

        <section className="page-section" aria-labelledby="built">
          <h2 id="built">How it is built</h2>
          <ul>
            <li>Vite 5 and React 18, with plain JavaScript modules and no CSS framework.</li>
            <li>A vanilla Web Audio engine created once outside React. React reads it through one hook and never schedules audio.</li>
            <li>three.js for the optional 3D view, loaded lazily and disposed when it unmounts.</li>
            <li>HashRouter for five static routes, so the build works on GitHub Pages without a rewrite rule.</li>
            <li>System fonts only. No CDN, no external font request, and no network call after the build except local files.</li>
          </ul>
          <p>
            The sound engine keeps the original mapping and voice design. The React layer adds
            events, a volume control, a headless mode, and a single JSON loader; it does not
            recompute the notes.
          </p>
        </section>

        <section className="page-section" aria-labelledby="team">
          <h2 id="team">Team</h2>
          <ul className="team-list" aria-label="Team members to be added">
          </ul>
        </section>

        <section className="page-section" aria-labelledby="credits">
          <h2 id="credits">Credits</h2>
          <ul className="credit-list">
            <li>
              <strong>Night-lights visualization:</strong> NASA Earth Information Center and the
              NASA Scientific Visualization Studio.
            </li>
            <li>
              <strong>Visualization asset:</strong>{' '}
              {svsReady ? (
                <a href={SVS_URL} target="_blank" rel="noreferrer">
                  {SVS_ASSET_TITLE}
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              ) : (
                <span className="placeholder">{SVS_ASSET_TITLE}</span>
              )}
            </li>
            <li>
              <strong>NASA credit:</strong> <span className="placeholder">{NASA_CREDIT_TEXT}</span>
            </li>
            <li>
              <strong>Challenge:</strong> NASA Space Apps 2026, {CHALLENGE_NAME}.
            </li>
            <li>
              <strong>Source code:</strong>{' '}
              <a href={GITHUB_URL} target="_blank" rel="noreferrer">
                Diksha-MukherjeeAgarwal/Aham-Bhramasmi
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </li>
            <li>
              <strong>License:</strong> <span className="placeholder">{LICENSE_PLACEHOLDER}</span>
            </li>
          </ul>
        </section>

        <section className="page-section" aria-labelledby="references">
          <h2 id="references">References</h2>
          <p>
            The eight DOI references supplied with the challenge brief are listed below. No other
            sources are cited on this site.
          </p>
          <ReferenceList />
        </section>

        <section className="page-section" aria-labelledby="disclaimer">
          <h2 id="disclaimer">Disclaimer</h2>
          <p>
            This is an independent project. NASA does not endorse it. The data values are derived
            from a NASA visualization, not from raw radiance measurements, and relative sizes are
            meaningful only within the loaded file. The sonification is an artistic mapping for
            exploration and accessibility, not a scientific instrument or the sole basis for a
            policy, economic, or environmental conclusion.
          </p>
        </section>

        <section className="page-section" aria-labelledby="contact">
          <h2 id="contact">Contact and feedback</h2>
          <p>
            Questions, corrections, and accessibility reports are welcome. If you are reporting a
            barrier, include the page, browser, assistive technology, and what happened.
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
            For keyboard, data, and build details, see the <Link to="/docs">Docs</Link>. For the
            accessibility features in one place, see <Link to="/accessibility">Accessibility</Link>.
          </p>
        </section>
      </div>
    </div>
  );
}
