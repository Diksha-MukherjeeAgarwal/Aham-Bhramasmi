export const EXPLANATION =
  'Earth Jukebox, Change Mode. Press Space to play the whole piece. ' +
  'Press the Left or Right arrow to step through regions. Press L for the legend. ' +
  'Press E to hear this explanation again. Press S to stop. ' +
  'Press A to turn accessibility mode on or off. Press question mark for all keyboard shortcuts. ' +
  'The biggest changes play first. Higher notes mean bigger changes. ' +
  'Decreases are lower and slower.';

export function speakExplanation() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false;
  if (typeof window.SpeechSynthesisUtterance !== 'function') return false;
  try {
    window.speechSynthesis.cancel();
    const utterance = new window.SpeechSynthesisUtterance(EXPLANATION);
    utterance.rate = 1;
    window.speechSynthesis.speak(utterance);
    return true;
  } catch (_) {
    return false;
  }
}

export function stopSpeech() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}
