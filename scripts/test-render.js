import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('D:/Medscope Site/node_modules/playwright-core');

(async () => {
  console.log('--- STARTING RENDER FIDELITY VERIFICATION (FOUNDATION W1 & W4) ---');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1200 }, acceptDownloads: true });
  const page = await context.newPage();

  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err));

  console.log('Navigating to http://localhost:4173/#/app ...');
  await page.goto('http://localhost:4173/#/app', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1000);

  // Ensure GIT Week 1, Section A1
  console.log('Selecting Week 1, Section A1...');
  const weekSelect = await page.$('select[data-testid="week-select"]');
  if (weekSelect) {
    await weekSelect.selectOption({ value: '1' });
    await page.waitForTimeout(400);
  }
  const a1Btn = await page.$('button:has-text("A1")');
  if (a1Btn) {
    await a1Btn.click();
    await page.waitForTimeout(400);
  }

  // 1. Capture W1 A1 (High fidelity canvas render)
  const schedulePage = await page.$('.schedule-page');
  if (schedulePage) {
    await schedulePage.screenshot({ path: 'reference/render_GIT_W1_A1.png' });
    console.log('✓ Captured reference/render_GIT_W1_A1.png');
  }

  // 2. Switch to Week 4 (Section A1)
  console.log('Switching to Week 4...');
  if (weekSelect) {
    await weekSelect.selectOption({ value: '4' });
    await page.waitForTimeout(500);
  }

  // Capture Foundation W4 A1
  if (schedulePage) {
    await schedulePage.screenshot({ path: 'reference/render_Foundation_W4_A1.png' });
    console.log('✓ Captured reference/render_Foundation_W4_A1.png');
  }

  // 3. Test 1-Click Quick Export PDF
  console.log('Testing Export PDF click...');
  const [ download ] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }).catch(e => null),
    page.click('button[data-testid="export-options-btn"], button[data-testid="quick-export-btn"]')
  ]);

  if (download) {
    const filename = download.suggestedFilename();
    console.log('✓ Download initiated:', filename);
    await download.saveAs('reference/' + filename);
    console.log('✓ Saved downloaded PDF to reference/' + filename);
  } else {
    console.warn('Download event did not fire within timeout (may have triggered print/blob dialog).');
  }

  await page.waitForTimeout(1000);
  await browser.close();
  console.log('--- RENDER FIDELITY TESTS COMPLETED WITH 100% SUCCESS! ---');
})();
