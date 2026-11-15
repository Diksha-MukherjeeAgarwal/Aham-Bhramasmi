import { NavLink } from 'react-router-dom';

const LINKS = [
  { to: '/', label: 'Listen', end: true },
  { to: '/how-it-works', label: 'How it works' },
  { to: '/docs', label: 'Docs' },
  { to: '/accessibility', label: 'Accessibility' },
  { to: '/about', label: 'About' },
];

export default function Nav() {
  return (
    <nav className="site-nav" aria-label="Primary">
      {LINKS.map((link) => (
        <NavLink key={link.to} to={link.to} end={link.end} className="nav-link">
          {link.label}
        </NavLink>
      ))}
    </nav>
  );
}
