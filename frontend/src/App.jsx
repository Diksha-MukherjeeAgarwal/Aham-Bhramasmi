import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AccessibilityContext } from './AccessibilityContext.jsx';
import { engine, loadDefaultData } from './engineInstance.js';
import { EXPLANATION, speakExplanation, stopSpeech } from './explanation.js';
import { jumpToSection } from './jump.js';
import { PAGE_TITLES, SITE_NAME, SITE_SUBTITLE } from './site.js';
import {
  readAccessibilityState,
  saveAccessibilityPreference,
  watchAccessibilityPreference,
} from './storage.js';
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import ShortcutSheet from './components/ShortcutSheet.jsx';
import ShortcutsDialog from './components/ShortcutsDialog.jsx';
import Listen from './pages/Listen.jsx';
import HowItWorks from './pages/HowItWorks.jsx';
import Docs from './pages/Docs.jsx';
import Accessibility from './pages/Accessibility.jsx';
import About from './pages/About.jsx';

function plural(count, word) {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

function RouteEffects({ announce }) {
  const { pathname } = useLocation();

  useEffect(() => {
    const label = PAGE_TITLES[pathname] || 'Listen';
    document.title = `${label} · ${SITE_NAME}: ${SITE_SUBTITLE}`;
    window.scrollTo(0, 0);
    const heading = document.getElementById('page-title');
    if (heading) heading.focus({ preventScroll: true });
    announce(`${label} page.`);
  }, [announce, pathname]);

  return null;
}

export default function App() {
  const [accessibilityMode, setAccessibilityModeState] = useState(
    () => readAccessibilityState().on,
  );
  const [selectedRegion, setSelectedRegion] = useState(-1);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  const announce = useCallback((text) => {
    setAnnouncement(text);
  }, []);

  const setAccessibilityMode = useCallback((next) => {
    setAccessibilityModeState(next);
    saveAccessibilityPreference(next);
    announce(next
      ? 'Accessibility mode on. Black background, white text, one yellow accent, larger text, no animation.'
      : 'Accessibility mode off.');
  }, [announce]);

  // Apply the theme before paint so an auto-detected visitor never sees the
  // graphics-first dark shell. The boot class is set by index.html before CSS
  // and React load; this effect keeps it in sync afterwards.
  useLayoutEffect(() => {
    document.body.classList.toggle('a11y-on', accessibilityMode);
    document.documentElement.classList.toggle('a11y-boot', accessibilityMode);
    return () => {
      document.body.classList.remove('a11y-on');
      document.documentElement.classList.remove('a11y-boot');
    };
  }, [accessibilityMode]);

  // Follow a live OS change only while no explicit choice is saved.
  useEffect(() => watchAccessibilityPreference(({ on }) => {
    setAccessibilityModeState(on);
    announce(on
      ? 'Accessibility mode on. Your system accessibility settings changed.'
      : 'Accessibility mode off. Your system accessibility settings changed.');
  }), [announce]);

  // Engine events are the only source of playback truth. React never schedules audio.
  useEffect(() => {
    const offs = [
      engine.subscribe('loaded', (payload) => {
        setSelectedRegion(payload.notes.length ? 0 : -1);
      }),
      engine.subscribe('regionStart', (index) => {
        setSelectedRegion(index);
      }),
      engine.subscribe('pieceEnd', (payload) => {
        if (!payload) return;
        if (payload.kind === 'piece') {
          const left = payload.left
            ? ` ${payload.left} left out by the 30 second limit.`
            : '';
          announce(`Piece complete: ${plural(payload.played, 'region')} played.${left}`);
        } else if (payload.kind === 'legend') {
          announce('Legend finished. Higher means a bigger change; the low, slow note is a decrease.');
        }
      }),
      engine.subscribe('stopped', () => {
        announce('Stopped.');
      }),
      engine.subscribe('error', (error) => {
        // Load and data errors get a visible alert on the Listen page.
        if (error.kind === 'load' || error.kind === 'data') return;
        announce(error.message || 'Audio error.');
      }),
    ];
    return () => offs.forEach((off) => off());
  }, [announce]);

  useEffect(() => {
    void loadDefaultData();
  }, []);

  useEffect(() => {
    function isTyping(target) {
      if (!target) return false;
      if (target.isContentEditable) return true;
      return /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
    }

    function onKeyDown(event) {
      if (event.defaultPrevented || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      if (isTyping(event.target)) return;

      if (shortcutsOpen) {
        if (event.key === 'Escape') {
          event.preventDefault();
          setShortcutsOpen(false);
        }
        return;
      }

      if (event.code === 'Space') {
        const focused = document.activeElement;
        if (focused && focused.closest('button, a, summary, [role="button"]')) return;
        event.preventDefault();
        const state = engine.getState();
        if (!state.notes.length) {
          void engine.play();
          return;
        }
        const plan = engine.planPiece(state.notes);
        announce(plan.count < state.notes.length
          ? `Playing ${plan.count} of ${plural(state.notes.length, 'region')}, largest first.`
          : `Playing ${plural(plan.count, 'region')}, largest first.`);
        void engine.play();
        return;
      }

      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        const direction = event.key === 'ArrowRight' ? 1 : -1;
        const state = engine.getState();
        if (!state.notes.length) {
          announce('No regions loaded.');
          return;
        }
        const index = direction > 0 ? engine.next() : engine.previous();
        if (Number.isInteger(index) && index >= 0) {
          setSelectedRegion(index);
          announce(engine.describe(state.notes[index]));
        }
        return;
      }

      const key = event.key.toLowerCase();
      if (key === 'l') {
        event.preventDefault();
        announce('Playing the legend: no change, a small increase, a large increase, then a decrease.');
        void engine.legend();
      } else if (key === 'e') {
        event.preventDefault();
        announce(speakExplanation() ? 'Explanation started.' : EXPLANATION);
      } else if (key === 's') {
        event.preventDefault();
        stopSpeech();
        engine.stop();
      } else if (key === 'a') {
        event.preventDefault();
        setAccessibilityMode(!accessibilityMode);
      } else if (event.key === '?') {
        event.preventDefault();
        setShortcutsOpen(true);
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [accessibilityMode, announce, setAccessibilityMode, shortcutsOpen]);

  const contextValue = useMemo(() => ({
    accessibilityMode,
    setAccessibilityMode,
    selectedRegion,
    setSelectedRegion,
    announce,
  }), [accessibilityMode, announce, selectedRegion, setAccessibilityMode]);

  return (
    <AccessibilityContext.Provider value={contextValue}>
      <div className={accessibilityMode ? 'site a11y' : 'site'}>
        <a
          className="skip-link"
          href="#main"
          onClick={(event) => jumpToSection(event, 'main')}
        >
          Skip to main content
        </a>

        <RouteEffects announce={announce} />
        <Header onOpenShortcuts={() => setShortcutsOpen(true)} />
        {accessibilityMode ? <ShortcutSheet /> : null}

        <main id="main" className="site-main" tabIndex={-1}>
          <div className="wrap">
            <Routes>
              <Route path="/" element={<Listen />} />
              <Route path="/how-it-works" element={<HowItWorks />} />
              <Route path="/docs" element={<Docs />} />
              <Route path="/accessibility" element={<Accessibility />} />
              <Route path="/about" element={<About />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </main>

        <Footer />

        <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {announcement}
        </div>

        <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      </div>
    </AccessibilityContext.Provider>
  );
}
