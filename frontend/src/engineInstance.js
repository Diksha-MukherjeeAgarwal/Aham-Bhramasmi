import { createEngine } from './engine.js';

// Created once for the whole app. React never creates or schedules audio.
export const engine = createEngine({ headless: true, volume: 0.3 });

let defaultLoad = null;

export function loadDefaultData() {
  if (!defaultLoad) {
    const url = new URL('data.json', document.baseURI).href;
    defaultLoad = engine.loadJSON(url, 'data.json').then((ok) => {
      if (!ok) defaultLoad = null;
      return ok;
    });
  }
  return defaultLoad;
}
