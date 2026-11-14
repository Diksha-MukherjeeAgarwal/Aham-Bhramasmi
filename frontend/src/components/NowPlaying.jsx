import { useEffect, useRef } from 'react';
import { engine } from '../engineInstance.js';
import { useAccessibility } from '../AccessibilityContext.jsx';

export default function NowPlaying({ note, isPlaying }) {
  const { accessibilityMode } = useAccessibility();
  const panelRef = useRef(null);

  useEffect(() => {
    if (!accessibilityMode) {
      document.documentElement.style.removeProperty('--now-h');
      return undefined;
    }
    const panel = panelRef.current;
    if (!panel) return undefined;

    const update = () => {
      document.documentElement.style.setProperty('--now-h', `${panel.offsetHeight}px`);
    };
    update();

    let observer;
    if (typeof ResizeObserver === 'function') {
      observer = new ResizeObserver(update);
      observer.observe(panel);
    } else {
      window.addEventListener('resize', update);
    }

    return () => {
      if (observer) observer.disconnect();
      else window.removeEventListener('resize', update);
      document.documentElement.style.removeProperty('--now-h');
    };
  }, [accessibilityMode, note]);

  const sentence = note ? engine.describe(note) : 'No region selected yet. Select one from the list to hear it alone.';

  return (
    <section ref={panelRef} className="now-playing" aria-labelledby="now-title">
      <div className="now-top">
        <h2 id="now-title" className="now-label">Now playing</h2>
        <span className="live-flag" aria-hidden="true">
          <span className={`live-dot${isPlaying ? ' is-on' : ''}`} />
          {isPlaying ? 'Playing' : 'Ready'}
        </span>
      </div>
      <p className="now-sentence">{sentence}</p>
    </section>
  );
}
