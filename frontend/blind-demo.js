const { chromium } = require('playwright');
const fs = require('fs');

const BASE = 'http://localhost:4173/';
const OUT = 'D:/codes/nasa space challege/Aham-Bhramasmi/blind-demo-output';
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({
    headless: false,  // visible so you can see it
    slowMo: 300,      // slow down for demo clarity
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: OUT, size: { width: 1280, height: 720 } },
  });

  const page = await context.newPage();

  // Listen for console logs (engine messages)
  page.on('console', msg => {
    if (msg.type() === 'log' && msg.text().includes('[Night Lights]')) {
      console.log('🔊 ENGINE:', msg.text());
    }
  });

  console.log('🎬 Starting blind-first demo...');
  console.log('   This simulates a blind user with screen reader using keyboard only');

  await page.goto(BASE + '#/');
  await page.waitForSelector('#page-title', { timeout: 15000 });
  await page.waitForTimeout(1000);

  console.log('✅ Page loaded. Screen reader would announce: "Listen page."');

  // 1. Press A for accessibility mode
  console.log('⌨️  Pressing A (accessibility mode)...');
  await page.keyboard.press('a');
  await page.waitForTimeout(800);

  // Verify focus moved to "How to listen"
  const focusedId = await page.evaluate(() => document.activeElement?.id);
  console.log(`🎯 Focus landed on: ${focusedId} (expected: how-title)`);

  await page.waitForTimeout(500);

  // 2. Press Space to play the piece
  console.log('⌨️  Pressing Space (play piece)...');
  await page.keyboard.press('Space');
  await page.waitForTimeout(4000);  // let it play ~4 seconds

  // 3. Press S to stop
  console.log('⌨️  Pressing S (stop)...');
  await page.keyboard.press('s');
  await page.waitForTimeout(500);

  // 4. Press Right arrow to step through regions
  console.log('⌨️  Pressing → (next region)...');
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(800);

  console.log('⌨️  Pressing → (next region)...');
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(800);

  // 5. Press L for legend
  console.log('⌨️  Pressing L (legend)...');
  await page.keyboard.press('l');
  await page.waitForTimeout(3000);  // legend plays 4 notes

  // 6. Press E for explanation
  console.log('⌨️  Pressing E (explain)...');
  await page.keyboard.press('e');
  await page.waitForTimeout(3000);  // speech synthesis

  // 7. Press S to stop speech
  console.log('⌨️  Pressing S (stop speech)...');
  await page.keyboard.press('s');
  await page.waitForTimeout(500);

  // 8. Press ? for shortcuts dialog
  console.log('⌨️  Pressing ? (shortcuts dialog)...');
  await page.keyboard.press('?');
  await page.waitForTimeout(1000);

  // 9. Press Esc to close dialog
  console.log('⌨️  Pressing Esc (close dialog)...');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // 10. Toggle accessibility off with A
  console.log('⌨️  Pressing A (toggle accessibility off)...');
  await page.keyboard.press('a');
  await page.waitForTimeout(800);

  console.log('✅ Demo complete!');
  await page.waitForTimeout(1000);

  await context.close();
  await browser.close();

  // Find the video file
  const files = fs.readdirSync(OUT);
  const videoFile = files.find(f => f.endsWith('.webm'));
  if (videoFile) {
    console.log(`\n🎥 Video saved: ${OUT}/${videoFile}`);
    console.log('   Note: Playwright records video only, not page audio.');
    console.log('   For audio, use OBS/ShareX to record system audio simultaneously.');
  }
})().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});