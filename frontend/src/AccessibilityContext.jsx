import { createContext, useContext } from 'react';

export const AccessibilityContext = createContext({
  accessibilityMode: false,
  setAccessibilityMode: () => {},
  selectedRegion: -1,
  setSelectedRegion: () => {},
  // One polite live region for the whole app, owned by App.
  announce: () => {},
});

export function useAccessibility() {
  return useContext(AccessibilityContext);
}
