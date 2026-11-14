import { Link } from 'react-router-dom';
import AccessibilityToggle from './AccessibilityToggle.jsx';
import Nav from './Nav.jsx';
import { SITE_NAME, SITE_SUBTITLE } from '../site.js';

export default function Header({ onOpenShortcuts }) {
  return (
    <header className="site-header">
      <div className="wrap header-top">
        <Link className="brand" to="/">
          <span className="brand-mark" aria-hidden="true" />
          <span>
            <span className="brand-name">{SITE_NAME}</span>
            <span className="brand-sub">{SITE_SUBTITLE}</span>
          </span>
        </Link>
        <Nav />
        <div className="header-tools">
          <AccessibilityToggle />
          <button type="button" className="btn btn--small" onClick={onOpenShortcuts}>
            Shortcuts <kbd aria-hidden="true">?</kbd>
          </button>
        </div>
      </div>
    </header>
  );
}
