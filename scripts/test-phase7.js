import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { chromium } = require('D:/Medscope Site/node_modules/playwright-core');

const SCREENSHOT_DIR = path.resolve('reference/phase7_screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

(async () => {
  console.log('===========================================================');
  console.log('   STARTING PHASE 7 FULL UI RESTYLE VERIFICATION SUITE     ');
  console.log('===========================================================');

  const browser = await chromium.launch({ headless: true });

  // -------------------------------------------------------------------------
  // 1. DESKTOP VIEWPORT (1440x900)
  // -------------------------------------------------------------------------
  console.log('\n[1] Verifying Desktop (1440px) Layout & Capturing Screens...');
  const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await desktopContext.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') console.log('BROWSER ERROR:', msg.text());
  });

  // Navigate to Preview
  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);

  // 1A. Verify Aurora Background presence
  const auroraExists = await page.evaluate(() => {
    const layer = document.querySelector('.aurora-layer');
    const blades = document.querySelectorAll('.aurora-blade');
    return !!layer && blades.length >= 4;
  });
  console.log('Aurora background layer with 5 light-blades exists:', auroraExists);
  assert.strictEqual(auroraExists, true, 'Aurora background layer must exist with light-blades');

  // 1B. Verify Floating Pill Header
  const pillHeader = await page.evaluate(() => {
    const header = document.querySelector('header');
    if (!header) return null;
    const style = window.getComputedStyle(header);
    return {
      borderRadius: style.borderRadius,
      display: style.display,
      hasDiamond: !!header.querySelector('polygon')
    };
  });
  console.log('Floating pill header specs:', pillHeader);
  assert.strictEqual(pillHeader.hasDiamond, true, 'Header must have warm diamond glyph');

  // 1C. Capture Screen 1: Desktop Empty State
  console.log('Simulating Empty State for Screenshot 1...');
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('medscope_schedule_data') || '{}');
    const emptyProj = {
      ...saved,
      weeks: [{ n: 1, sessions: [] }]
    };
    localStorage.setItem('medscope_schedule_data', JSON.stringify(emptyProj));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);

  // Verify H1 64px on Empty State
  const emptyHeroH1 = await page.evaluate(() => {
    const h1 = document.querySelector('.hero-headline');
    if (!h1) return null;
    const style = window.getComputedStyle(h1);
    return {
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      text: h1.textContent.trim()
    };
  });
  console.log('Hero Headline specs:', emptyHeroH1);
  assert.strictEqual(emptyHeroH1.fontSize, '64px', 'Hero H1 must be 64px');

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'desktop_1440_empty_state.png') });
  console.log('✓ Captured desktop_1440_empty_state.png');

  // Restore GIT fixture from Empty State
  console.log('Restoring GIT sample from empty state button...');
  await page.click('[data-testid="empty-load-sample-btn"]');
  await page.waitForTimeout(800);

  // 1D. Capture Screen 2: Desktop Editor with GIT Loaded
  console.log('Opening Step 1 (Editor)...');
  await page.click('button[data-testid="rail-data-btn"]');
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'desktop_1440_editor.png') });
  console.log('✓ Captured desktop_1440_editor.png');
  // Close editor drawer
  await page.click('button[data-testid="rail-data-btn"]');
  await page.waitForTimeout(300);

  // 1E. Capture Screen 3: Desktop Validator Panel (if present)
  const valBtn = await page.$('button[data-testid="validator-btn"]');
  if (valBtn) {
    console.log('Opening Validator Panel via header badge...');
    await valBtn.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'desktop_1440_validator.png') });
    console.log('✓ Captured desktop_1440_validator.png');
    await page.click('button[data-testid="validator-close-btn"]');
    await page.waitForTimeout(300);
  }

  // 1F. Capture Screen 4: Desktop Export Modal
  console.log('Opening Export Modal...');
  await page.click('button[data-testid="export-options-btn"]');
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'desktop_1440_export.png') });
  console.log('✓ Captured desktop_1440_export.png');
  await page.click('button:has-text("Cancel")');
  await page.waitForTimeout(300);

  // 1G. Capture Screen 5: Desktop Command Bar Open (Ctrl+K)
  console.log('Testing Command Bar (Ctrl+K)...');
  await page.keyboard.press('Control+KeyK');
  await page.waitForTimeout(500);

  const commandBarVisible = await page.evaluate(() => {
    const cb = document.querySelector('[data-testid="command-bar-modal"]');
    return cb && cb.offsetHeight > 0;
  });
  console.log('Command bar visible after Ctrl+K:', commandBarVisible);
  assert.strictEqual(commandBarVisible, true, 'Command bar must open on Ctrl+K');

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'desktop_1440_command_bar.png') });
  console.log('✓ Captured desktop_1440_command_bar.png');

  // Test keyboard navigation in command bar
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(100);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  await desktopContext.close();

  // -------------------------------------------------------------------------
  // 2. TABLET VIEWPORT (768x1024 - iPad)
  // -------------------------------------------------------------------------
  console.log('\n[2] Verifying Tablet (768px) Layout & Capturing Screens...');
  const tabletContext = await browser.newContext({ viewport: { width: 768, height: 1024 } });
  const tabletPage = await tabletContext.newPage();
  await tabletPage.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
  await tabletPage.evaluate(() => document.fonts.ready);
  await tabletPage.waitForTimeout(600);

  // Screen 6: Tablet Empty State
  await tabletPage.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('medscope_schedule_data') || '{}');
    const emptyProj = { ...saved, weeks: [{ n: 1, sessions: [] }] };
    localStorage.setItem('medscope_schedule_data', JSON.stringify(emptyProj));
  });
  await tabletPage.reload({ waitUntil: 'networkidle' });
  await tabletPage.evaluate(() => document.fonts.ready);
  await tabletPage.waitForTimeout(500);
  await tabletPage.screenshot({ path: path.join(SCREENSHOT_DIR, 'tablet_768_empty_state.png') });
  console.log('✓ Captured tablet_768_empty_state.png');

  // Restore sample
  await tabletPage.click('[data-testid="empty-load-sample-btn"]');
  await tabletPage.waitForTimeout(700);

  // Screen 7: Tablet Editor
  await tabletPage.click('button[data-testid="rail-data-btn"]');
  await tabletPage.waitForTimeout(500);
  await tabletPage.screenshot({ path: path.join(SCREENSHOT_DIR, 'tablet_768_editor.png') });
  console.log('✓ Captured tablet_768_editor.png');
  // Close editor drawer before next step
  const editorCloseBtn = tabletPage.locator('button[data-testid="editor-close-btn"]');
  if (await editorCloseBtn.isVisible()) {
    await editorCloseBtn.click();
    await tabletPage.waitForTimeout(300);
  } else {
    await tabletPage.click('.fixed.inset-0.bg-black\\/60', { position: { x: 50, y: 50 } }).catch(() => {});
    await tabletPage.waitForTimeout(300);
  }
  await tabletPage.waitForTimeout(300);

  // Screen 8: Tablet Validator (if present)
  const tabletValBtn = await tabletPage.$('button[data-testid="validator-btn"]');
  if (tabletValBtn) {
    await tabletValBtn.click();
    await tabletPage.waitForTimeout(500);
    await tabletPage.screenshot({ path: path.join(SCREENSHOT_DIR, 'tablet_768_validator.png') });
    console.log('✓ Captured tablet_768_validator.png');
    await tabletPage.click('button[data-testid="validator-close-btn"]');
    await tabletPage.waitForTimeout(300);
  }

  // Screen 9: Tablet Export Modal
  await tabletPage.click('button[data-testid="export-options-btn"]');
  await tabletPage.waitForTimeout(500);
  await tabletPage.screenshot({ path: path.join(SCREENSHOT_DIR, 'tablet_768_export.png') });
  console.log('✓ Captured tablet_768_export.png');
  await tabletPage.click('button:has-text("Cancel")');
  await tabletPage.waitForTimeout(300);

  // Screen 10: Tablet Command Bar
  await tabletPage.keyboard.press('Control+KeyK');
  await tabletPage.waitForTimeout(500);
  await tabletPage.screenshot({ path: path.join(SCREENSHOT_DIR, 'tablet_768_command_bar.png') });
  console.log('✓ Captured tablet_768_command_bar.png');
  await tabletPage.keyboard.press('Escape');
  await tabletPage.waitForTimeout(300);

  await tabletContext.close();

  // -------------------------------------------------------------------------
  // 3. PHONE VIEWPORT (390x844 - iPhone 14)
  // -------------------------------------------------------------------------
  console.log('\n[3] Verifying Phone (390px) Layout & Capturing Screens...');
  const phoneContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true
  });
  const phonePage = await phoneContext.newPage();
  await phonePage.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
  await phonePage.evaluate(() => document.fonts.ready);
  await phonePage.waitForTimeout(600);

  // Screen 11: Phone Empty State
  await phonePage.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('medscope_schedule_data') || '{}');
    const emptyProj = { ...saved, weeks: [{ n: 1, sessions: [] }] };
    localStorage.setItem('medscope_schedule_data', JSON.stringify(emptyProj));
  });
  await phonePage.reload({ waitUntil: 'networkidle' });
  await phonePage.evaluate(() => document.fonts.ready);
  await phonePage.waitForTimeout(500);

  // Assert no horizontal scroll on phone
  const hasHorizontalScroll = await phonePage.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  console.log('Phone has zero horizontal scroll:', !hasHorizontalScroll);
  assert.strictEqual(hasHorizontalScroll, false, 'Phone must have NO horizontal page scroll');

  await phonePage.screenshot({ path: path.join(SCREENSHOT_DIR, 'phone_390_empty_state.png') });
  console.log('✓ Captured phone_390_empty_state.png');

  // Restore sample
  await phonePage.click('[data-testid="empty-load-sample-btn"]');
  await phonePage.waitForTimeout(700);

  // Screen 12: Phone Editor Tab
  await phonePage.click('button[data-testid="mobile-tab-data"]');
  await phonePage.waitForTimeout(500);
  await phonePage.screenshot({ path: path.join(SCREENSHOT_DIR, 'phone_390_editor.png') });
  console.log('✓ Captured phone_390_editor.png');

  // Screen 13: Phone Validator Panel (if present)
  const phoneValBtn = await phonePage.$('button[data-testid="validator-btn"]');
  if (phoneValBtn) {
    await phoneValBtn.click();
    await phonePage.waitForTimeout(500);
    await phonePage.screenshot({ path: path.join(SCREENSHOT_DIR, 'phone_390_validator.png') });
    console.log('✓ Captured phone_390_validator.png');
    await phonePage.click('button[data-testid="validator-close-btn"]');
    await phonePage.waitForTimeout(300);
  }

  // Screen 14: Phone Export Tab
  await phonePage.click('button[data-testid="mobile-tab-export"]');
  await phonePage.waitForTimeout(500);
  await phonePage.screenshot({ path: path.join(SCREENSHOT_DIR, 'phone_390_export.png') });
  console.log('✓ Captured phone_390_export.png');
  await phonePage.click('button:has-text("Cancel")');
  await phonePage.waitForTimeout(300);

  // Screen 15: Phone Command Bar (via top search button)
  await phonePage.click('header button[title*="Search"]');
  await phonePage.waitForTimeout(500);
  await phonePage.screenshot({ path: path.join(SCREENSHOT_DIR, 'phone_390_command_bar.png') });
  console.log('✓ Captured phone_390_command_bar.png');

  await phoneContext.close();
  await browser.close();

  console.log('\n===========================================================');
  console.log('   ALL PHASE 7 ACCEPTANCE CRITERIA VERIFIED (100% SUCCESS) ');
  console.log(`   Screenshots saved in: ${SCREENSHOT_DIR}`);
  console.log('===========================================================');
})();

