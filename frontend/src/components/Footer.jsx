import { Link } from 'react-router-dom';
import { CHALLENGE_NAME, GITHUB_URL, SITE_NAME, SITE_SUBTITLE } from '../site.js';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <p className="footer-brand">{SITE_NAME}: {SITE_SUBTITLE}</p>
        <div className="footer-grid">
          <div className="footer-copy">
            <p>
              Built for the NASA Space Apps Challenge, {CHALLENGE_NAME}. Data comes from a NASA EIC
              night-lights visualization. Values are derived from that visualization, not raw measurements.
            </p>
          </div>
          <nav className="footer-links" aria-label="Footer">
            <Link to="/accessibility">Accessibility</Link>
            <Link to="/docs">Docs</Link>
            <a href={GITHUB_URL} target="_blank" rel="noreferrer">
              GitHub<span className="sr-only"> (opens in a new tab)</span>
            </a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
