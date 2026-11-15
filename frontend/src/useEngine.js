import { useEffect, useState } from 'react';
import { engine } from './engineInstance.js';

const EVENTS = ['loaded', 'playState', 'regionStart', 'pieceEnd', 'stopped', 'error'];

export function useEngine() {
  const [snapshot, setSnapshot] = useState(() => engine.getState());

  useEffect(() => {
    const update = () => setSnapshot((previous) => {
      const next = engine.getState();
      // Keep the notes array stable across play/region events so the 3D scene
      // is not rebuilt every time the highlighted region changes.
      const sameNotes = previous.notes.length === next.notes.length
        && previous.notes.every((note, index) => note === next.notes[index]);
      return { ...next, notes: sameNotes ? previous.notes : next.notes };
    });
    const unsubscribe = EVENTS.map((event) => engine.subscribe(event, update));
    return () => unsubscribe.forEach((off) => off());
  }, []);

  return snapshot;
}
