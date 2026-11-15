const { chromium } = require('playwright');
const fs = require('fs');

const BASE = 'http://localhost:4173/';
const OUT = 'D:/codes/nasa space challege/Aham-Bhramasmi/blind-demo-output';
fs.mkdirSync(OUT, { recursive: true });

// This script injects visual overlays for:
// 1. Key press display
// 2. Screen reader announcements (live region monitoring)
// 3. Audio playing indicator
// Then records video. For AUDIO, use OBS/ShareX/Win+G to record system sound.

const INJECTED_SCRIPT = `
// ============================================
// VISUAL OVERLAY FOR BLIND DEMO
// ============================================

// Create overlay container
const overlay = document.createElement('div');
overlay.id = 'blind-demo-overlay';
overlay.style.cssText = \`
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  pointer-events: none;
  z-index: 99999;
  font-family: 'Segoe UI', system-ui, sans-serif;
  color: #fff;
\`;
document.body.appendChild(overlay);

// --- KEY PRESS DISPLAY ---
const keyDisplay = document.createElement('div');
keyDisplay.id = 'key-display';
keyDisplay.style.cssText = \`
  position: fixed;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0,0,0,0.9);
  border: 3px solid #ffd400;
  border-radius: 12px;
  padding: 16px 32px;
  font-size: 28px;
  font-weight: 700;
  color: #ffd400;
  text-align: center;
  min-width: 200px;
  box-shadow: 0 0 30px rgba(255,212,0,0.4);
  opacity: 0;
  transition: opacity 150ms ease;
  pointer-events: none;
\`;
overlay.appendChild(keyDisplay);

function showKey(key) {
  const map = {
    ' ': 'SPACE',
    'ArrowLeft': '← LEFT',
    'ArrowRight': '→ RIGHT',
    'Escape': 'ESC',
    '?': '? (SHORTCUTS)'
  };
  keyDisplay.textContent = map[key] || key.toUpperCase();
  keyDisplay.style.opacity = '1';
  keyDisplay.style.animation = 'none';
  keyDisplay.offsetHeight; // force reflow
  keyDisplay.style.animation = 'pulse 0.3s ease';
  setTimeout(() => { keyDisplay.style.opacity = '0'; }, 1500);
}

// Add pulse animation
const style = document.createElement('style');
style.textContent = \`
  @keyframes pulse { 0% { transform: translateX(-50%) scale(1); } 50% { transform: translateX(-50%) scale(1.05); } 100% { transform: translateX(-50%) scale(1); } }
  @keyframes flash { 0% { background: rgba(255,212,0,0.3); } 100% { background: rgba(0,0,0,0.9); } }
  @keyframes speak { 0% { border-color: #00ff88; box-shadow: 0 0 20px #00ff88; } 100% { border-color: #ffd400; box-shadow: 0 0 30px rgba(255,212,0,0.4); } }
\`;
document.head.appendChild(style);

// --- SCREEN READER ANNOUNCEMENT DISPLAY ---
const srDisplay = document.createElement('div');
srDisplay.id = 'sr-display';
srDisplay.style.cssText = \`
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0,0,0,0.95);
  border: 3px solid #00ff88;
  border-radius: 12px;
  padding: 14px 28px;
  font-size: 16px;
  line-height: 1.5;
  color: #00ff88;
  text-align: center;
  max-width: 800px;
  min-width: 300px;
  box-shadow: 0 0 30px rgba(0,255,136,0.3);
  opacity: 0;
  transition: opacity 200ms ease;
  pointer-events: none;
  white-space: pre-wrap;
\`;
overlay.appendChild(srDisplay);

let srTimeout = null;
function showSR(text) {
  srDisplay.textContent = '🔊 SCREEN READER: ' + text;
  srDisplay.style.opacity = '1';
  srDisplay.style.animation = 'speak 0.4s ease';
  clearTimeout(srTimeout);
  srTimeout = setTimeout(() => { srDisplay.style.opacity = '0'; }, 4000);
}

// Monitor the live region
const liveRegion = document.querySelector('[aria-live="polite"]');
if (liveRegion) {
  const observer = new MutationObserver(() => {
    const text = liveRegion.textContent.trim();
    if (text) showSR(text);
  });
  observer.observe(liveRegion, { childList: true, characterData: true, subtree: true });
  console.log('✅ Live region monitoring active');
}

// --- AUDIO PLAYING INDICATOR ---
const audioIndicator = document.createElement('div');
audioIndicator.id = 'audio-indicator';
audioIndicator.style.cssText = \`
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: rgba(0,0,0,0.8);
  border: 4px solid #ffd400;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  opacity: 0.6;
  transition: all 150ms ease;
  pointer-events: none;
  box-shadow: 0 0 20px rgba(255,212,0,0.3);
\`;
audioIndicator.innerHTML = '🔇';
overlay.appendChild(audioIndicator);

function setAudioPlaying(playing) {
  if (playing) {
    audioIndicator.innerHTML = '🔊';
    audioIndicator.style.borderColor = '#00ff88';
    audioIndicator.style.boxShadow = '0 0 30px rgba(0,255,136,0.6)';
    audioIndicator.style.transform = 'scale(1.2)';
    audioIndicator.style.opacity = '1';
  } else {
    audioIndicator.innerHTML = '🔇';
    audioIndicator.style.borderColor = '#ffd400';
    audioIndicator.style.boxShadow = '0 0 20px rgba(255,212,0,0.3)';
    audioIndicator.style.transform = 'scale(1)';
    audioIndicator.style.opacity = '0.6';
  }
}

// Monitor NowPlaying panel for audio state
const nowPlayingObserver = new MutationObserver(() => {
  const nowPlaying = document.querySelector('.now-playing');
  if (nowPlaying) {
    const liveDot = nowPlaying.querySelector('.live-dot');
    if (liveDot) {
      setAudioPlaying(liveDot.classList.contains('is-on'));
    }
  }
});
const np = document.querySelector('.now-playing');
if (np) nowPlayingObserver.observe(np, { childList: true, subtree: true, attributes: true });

// Also monitor engine play state via global
const checkEnginePlaying = setInterval(() => {
  if (window.engine && typeof window.engine.getState === 'function') {
    const state = window.engine.getState();
    if (state.isPlaying !== undefined) {
      setAudioPlaying(state.isPlaying);
    }
  }
}, 200);

// --- MODE INDICATOR ---
const modeIndicator = document.createElement('div');
modeIndicator.id = 'mode-indicator';
modeIndicator.style.cssText = \`
  position: fixed;
  top: 20px;
  right: 20px;
  background: rgba(0,0,0,0.9);
  border: 2px solid #ffd400;
  border-radius: 8px;
  padding: 10px 16px;
  font-size: 14px;
  color: #ffd400;
  pointer-events: none;
  box-shadow: 0 0 15px rgba(255,212,0,0.2);
\`;
modeIndicator.textContent = 'MODE: NORMAL';
overlay.appendChild(modeIndicator);

function updateMode() {
  const a11y = document.body.classList.contains('a11y-on');
  modeIndicator.textContent = a11y ? 'MODE: ACCESSIBILITY (A11Y)' : 'MODE: NORMAL';
  modeIndicator.style.borderColor = a11y ? '#00ff88' : '#ffd400';
  modeIndicator.style.color = a11y ? '#00ff88' : '#ffd400';
}
const modeObs = new MutationObserver(updateMode);
modeObs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
updateMode();

console.log('✅ Blind demo overlay injected successfully');
`;

// Demo sequence with spoken narration
const DEMO_STEPS = [
  { key: null, wait: 1500, desc: 'Page loads in normal mode' },
  { key: 'a', wait: 1200, desc: 'Press A → Accessibility mode ON' },
  { key: ' ', wait: 5000, desc: 'Press SPACE → Play piece (listen to sonification)' },
  { key: 's', wait: 800, desc: 'Press S → Stop' },
  { key: 'ArrowRight', wait: 1000, desc: 'Press → → Next region' },
  { key: 'ArrowRight', wait: 1000, desc: 'Press → → Next region' },
  { key: 'l', wait: 4000, desc: 'Press L → Play legend (4 reference tones)' },
  { key: 'e', wait: 4000, desc: 'Press E → Speak explanation (browser TTS)' },
  { key: 's', wait: 800, desc: 'Press S → Stop speech' },
  { key: '?', wait: 1500, desc: 'Press ? → Open shortcuts dialog' },
  { key: 'Escape', wait: 800, desc: 'Press ESC → Close dialog' },
  { key: 'a', wait: 1200, desc: 'Press A → Accessibility mode OFF' },
  { key: null, wait: 1000, desc: 'Demo complete' },
];

(async () => {
  const browser = await chromium.launch({
    headless: false,
    slowMo: 100,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: OUT, size: { width: 1440, height: 900 } },
  });

  const page = await context.newPage();

  // Inject overlay on every page load
  await page.addInitScript(INJECTED_SCRIPT);

  console.log('🎬 Starting ENHANCED blind-first demo...');
  console.log('   Visual overlays: Key presses | Screen reader announcements | Audio indicator | Mode badge');
  console.log('   For AUDIO: Record with OBS / ShareX / Win+G (system audio)');

  await page.goto(BASE + '#/');
  await page.waitForSelector('#page-title', { timeout: 15000 });
  await page.waitForTimeout(1000);

  // Run demo steps
  for (const step of DEMO_STEPS) {
    console.log(`▶️  ${step.desc}`);
    if (step.key) {
      await page.keyboard.press(step.key);
    }
    await page.waitForTimeout(step.wait);
  }

  console.log('✅ Demo complete!');
  await page.waitForTimeout(1000);

  await context.close();
  await browser.close();

  const files = fs.readdirSync(OUT);
  const videoFile = files.find(f => f.endsWith('.webm'));
  if (videoFile) {
    console.log(`\n🎥 Video saved: ${OUT}/${videoFile}`);
    console.log('   Overlays included: Key press | Screen reader text | Audio playing indicator | Mode badge');
    console.log('   For sound: Re-record with OBS/ShareX capturing system audio while playing this video,');
    console.log('   or run the demo again with OBS recording the browser window + desktop audio.');
  }
})().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});