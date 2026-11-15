const KEY = 'earth-jukebox-accessibility';

// Keeps a manual choice effective for this session even when localStorage is
// blocked, so a media-query change cannot undo the toggle.
let sessionChoice = null;

/*
 * Browser support for OS accessibility settings is limited to media queries.
 * There is deliberately no web API for "a screen reader is running" or "the
 * user is blind", so these preferences are the supported, privacy-preserving
 * proxy. Keep this list in sync with the pre-paint script in index.html.
 */
export const OS_ACCESSIBILITY_QUERIES = [
  {
    id: 'forced-colors',
    label: 'forced colors or high contrast',
    query: '(forced-colors: active)',
  },
  {
    id: 'contrast',
    label: 'more contrast',
    query: '(prefers-contrast: more)',
  },
  {
    id: 'inverted-colors',
    label: 'inverted colors',
    query: '(inverted-colors: inverted)',
  },
  {
    id: 'reduced-transparency',
    label: 'reduced transparency',
    query: '(prefers-reduced-transparency: reduce)',
  },
  {
    id: 'reduced-motion',
    label: 'reduced motion',
    query: '(prefers-reduced-motion: reduce)',
  },
];

function savedPreference() {
  if (sessionChoice === 'on' || sessionChoice === 'off') return sessionChoice;
  try {
    const stored = window.localStorage.getItem(KEY);
    if (stored === 'on' || stored === 'off') return stored;
  } catch (_) {
    // Storage can be unavailable in private or restricted contexts.
  }
  return null;
}

export function detectOsAccessibility() {
  const signals = [];
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return { active: false, signals };
  }
  for (const signal of OS_ACCESSIBILITY_QUERIES) {
    try {
      if (window.matchMedia(signal.query).matches) signals.push(signal);
    } catch (_) {
      // An unsupported media feature simply does not match.
    }
  }
  return { active: signals.length > 0, signals };
}

/*
 * A saved choice always wins. Without one, any supported OS accessibility
 * preference turns accessibility mode on before the first React render.
 */
export function readAccessibilityState() {
  const saved = savedPreference();
  const detection = detectOsAccessibility();
  if (saved === 'on') {
    return { on: true, source: 'saved', signals: detection.signals };
  }
  if (saved === 'off') {
    return { on: false, source: 'saved', signals: detection.signals };
  }
  return {
    on: detection.active,
    source: detection.active ? 'os' : 'default',
    signals: detection.signals,
  };
}

export function saveAccessibilityPreference(on) {
  sessionChoice = on ? 'on' : 'off';
  try {
    window.localStorage.setItem(KEY, sessionChoice);
  } catch (_) {
    // The preference simply will not survive a reload, but the session keeps it.
  }
}

/*
 * Follow OS preference changes while no explicit choice is saved. Once the
 * user presses the header button or A, the saved choice overrides the system
 * so the manual toggle is never fought by a media-query change.
 */
export function watchAccessibilityPreference(onChange) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {};
  }

  const lists = OS_ACCESSIBILITY_QUERIES
    .map((signal) => {
      try {
        return window.matchMedia(signal.query);
      } catch (_) {
        return null;
      }
    })
    .filter(Boolean);

  function update() {
    if (savedPreference() !== null) return;
    const detection = detectOsAccessibility();
    onChange({ on: detection.active, signals: detection.signals });
  }

  lists.forEach((list) => {
    if (typeof list.addEventListener === 'function') {
      list.addEventListener('change', update);
    } else if (typeof list.addListener === 'function') {
      list.addListener(update);
    }
  });

  return () => {
    lists.forEach((list) => {
      if (typeof list.removeEventListener === 'function') {
        list.removeEventListener('change', update);
      } else if (typeof list.removeListener === 'function') {
        list.removeListener(update);
      }
    });
  };
}
