// HashRouter owns window.location.hash, so a plain href="#section" would be
// read as a route. These links keep their in-page href for semantics, but move
// focus and scroll without changing the hash.
export function jumpToSection(event, id) {
  if (event) event.preventDefault();
  const target = document.getElementById(id);
  if (!target) return;
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');

  // The sticky header must not cover the heading. The header is static in
  // accessibility mode and on small screens, so only offset when it is sticky.
  const header = document.querySelector('.site-header');
  const sticky = header && getComputedStyle(header).position === 'sticky';
  const offset = (sticky ? header.getBoundingClientRect().height : 0) + 16;
  const section = target.closest('.page-section') || target;
  const top = section.getBoundingClientRect().top + window.scrollY - offset;

  window.scrollTo({ top: Math.max(0, top), behavior: 'auto' });
  target.focus({ preventScroll: true });
}
