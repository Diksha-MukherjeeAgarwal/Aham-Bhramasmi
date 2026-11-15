import { useAccessibility } from '../AccessibilityContext.jsx';

export default function AccessibilityToggle() {
  const { accessibilityMode, setAccessibilityMode } = useAccessibility();

  return (
    <button
      type="button"
      className="btn btn--small toggle"
      aria-pressed={accessibilityMode}
      aria-keyshortcuts="A"
      onClick={() => setAccessibilityMode(!accessibilityMode)}
    >
      Accessibility mode
      <span className="toggle-state" aria-hidden="true">{accessibilityMode ? 'On' : 'Off'}</span>
    </button>
  );
}
