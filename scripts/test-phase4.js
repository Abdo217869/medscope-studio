import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { chromium } = require('D:/Medscope Site/node_modules/playwright-core');

const SCREENSHOT_DIR = path.resolve('reference/phase4_screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

(async () => {
  console.log('====================================================');
  console.log('   STARTING PHASE 4 COMPREHENSIVE VERIFICATION     ');
  console.log('====================================================');

  const browser = await chromium.launch({ headless: true });

  // -------------------------------------------------------------------------
  // 1. DESKTOP VIEWPORT (1440x900)
  // -------------------------------------------------------------------------
  console.log('\n[1] Verifying Desktop (1440px) Layout & Capturing Screens...');
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    acceptDownloads: true
  });
  const page = await desktopContext.newPage();

  page.on('dialog', async d => {
    console.log('Dialog:', d.message());
    await d.accept();
  });

  await page.goto('http://localhost:4173/#/app', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800);

  // Assertion: Ensure Compare UI is completely removed
  const compareElementsCount = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const compareBtns = btns.filter(b => b.textContent.trim().toLowerCase().includes('compare'));
    const selects = document.querySelectorAll('select[data-testid*="compare"]');
    const overlay = document.querySelector('.compare-overlay, [data-testid="compare-overlay"]');
    return compareBtns.length + selects.length + (overlay ? 1 : 0);
  });
  console.log('Compare UI elements found in DOM:', compareElementsCount);
  assert.strictEqual(compareElementsCount, 0, 'Compare feature must be completely removed from UI');

  // Screen 1: Desktop Live Preview
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'desktop_1440_preview.png') });
  console.log('✓ Captured desktop_1440_preview.png');

  // Screen 2: Desktop Step 1 Data (Session Editor)
  console.log('Opening Step 1 (Editor)...');
  await page.click('button[data-testid="rail-data-btn"]');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'desktop_1440_editor.png') });
  console.log('✓ Captured desktop_1440_editor.png');

  // Screen 3: Desktop Step 2 Review (Validator Panel if present)
  console.log('Checking Validator Panel via header badge...');
  const validatorBtn = await page.$('button[data-testid="validator-btn"]');
  if (validatorBtn) {
    await validatorBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'desktop_1440_validator.png') });
    console.log('✓ Captured desktop_1440_validator.png');
    await validatorBtn.click();
  }

  // Screen 4: Desktop Step 3 Style (Theme Panel)
  console.log('Opening Step 3 (Style / Theme)...');
  await page.click('button[data-testid="rail-style-btn"]');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'desktop_1440_theme.png') });
  console.log('✓ Captured desktop_1440_theme.png');

  // Close Theme Panel
  await page.click('button[data-testid="rail-style-btn"]');
  await page.waitForTimeout(300);

  // Screen 5: Desktop Step 4 Export Modal
  console.log('Opening Step 4 (Export Modal)...');
  await page.click('button[data-testid="export-options-btn"]');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'desktop_1440_export.png') });
  console.log('✓ Captured desktop_1440_export.png');
  await page.click('button:has-text("Cancel")');
  await page.waitForTimeout(300);

  // Screen 6: Desktop Import Modal
  console.log('Opening Import Modal...');
  await page.click('button[data-testid="import-nav-btn"]');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'desktop_1440_import.png') });
  console.log('✓ Captured desktop_1440_import.png');
  await page.click('button:has-text("Cancel")');
  await page.waitForTimeout(300);

  // Screen 7: Desktop Help Drawer (EN and AR RTL)
  console.log('Testing Bilingual Help Drawer...');
  await page.click('button[aria-label="Help"]');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'desktop_1440_help_en.png') });
  console.log('✓ Captured desktop_1440_help_en.png');

  // Toggle to Arabic (العربية)
  await page.click('button:has-text("العربية")');
  await page.waitForTimeout(400);
  const isRtl = await page.evaluate(() => {
    const list = document.querySelector('[dir="rtl"]');
    return !!list;
  });
  console.log('Arabic RTL direction active:', isRtl);
  assert.strictEqual(isRtl, true, 'Arabic help must have dir="rtl"');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'desktop_1440_help_ar.png') });
  console.log('✓ Captured desktop_1440_help_ar.png');

  // Test Launching Interactive Tour from Help
  console.log('Launching Interactive Tour from Help...');
  await page.click('button:has-text("بدء الجولة التفاعلية"), button:has-text("Take First-Run Interactive Tour")');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'desktop_1440_tour.png') });
  console.log('✓ Captured desktop_1440_tour.png');
  // Skip tour
  await page.click('button:has-text("Skip tour")');
  await page.waitForTimeout(400);

  // Screen 8: Desktop Empty State (simulate 0 sessions)
  console.log('Simulating Empty State (0 sessions)...');
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('medscope_schedule_data') || '{}');
    const emptyProj = {
      ...saved,
      weeks: [{ n: 1, sessions: [] }]
    };
    localStorage.setItem('medscope_schedule_data', JSON.stringify(emptyProj));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'desktop_1440_empty_state.png') });
  console.log('✓ Captured desktop_1440_empty_state.png');

  // Restore sample fixture
  console.log('Restoring sample fixture from empty state...');
  await page.click('button[data-testid="empty-load-sample-btn"], button:has-text("Load")');
  await page.waitForTimeout(600);
  await desktopContext.close();

  // -------------------------------------------------------------------------
  // 2. TABLET VIEWPORT (768x1024)
  // -------------------------------------------------------------------------
  console.log('\n[2] Verifying Tablet (768px) Layout & Capturing Screens...');
  const tabletContext = await browser.newContext({
    viewport: { width: 768, height: 1024 }
  });
  const tabletPage = await tabletContext.newPage();
  await tabletPage.goto('http://localhost:4173/#/app', { waitUntil: 'networkidle' });
  await tabletPage.evaluate(() => document.fonts.ready);
  await tabletPage.waitForTimeout(800);

  // Screen 9: Tablet Preview
  await tabletPage.screenshot({ path: path.join(SCREENSHOT_DIR, 'tablet_768_preview.png') });
  console.log('✓ Captured tablet_768_preview.png');

  // Screen 10: Tablet Step 1 Editor (drawer)
  await tabletPage.click('button[data-testid="rail-data-btn"]');
  await tabletPage.waitForTimeout(500);
  await tabletPage.screenshot({ path: path.join(SCREENSHOT_DIR, 'tablet_768_editor.png') });
  console.log('✓ Captured tablet_768_editor.png');

  // Screen 11: Tablet Validator
  const tabletValBtn = await tabletPage.$('button[data-testid="validator-btn"]');
  if (tabletValBtn) {
    await tabletValBtn.click();
    await tabletPage.waitForTimeout(500);
    await tabletPage.screenshot({ path: path.join(SCREENSHOT_DIR, 'tablet_768_validator.png') });
    console.log('✓ Captured tablet_768_validator.png');
    const tabletCloseBtn = await tabletPage.$('button[data-testid="validator-close-btn"]');
    if (tabletCloseBtn) await tabletCloseBtn.click();
    else await tabletValBtn.click();
  }

  // Screen 12: Tablet Step 3 Theme
  await tabletPage.click('button[data-testid="rail-style-btn"]');
  await tabletPage.waitForTimeout(500);
  await tabletPage.screenshot({ path: path.join(SCREENSHOT_DIR, 'tablet_768_theme.png') });
  console.log('✓ Captured tablet_768_theme.png');
  await tabletPage.click('button[data-testid="rail-style-btn"]');
  await tabletPage.waitForTimeout(300);

  // Screen 13: Tablet Step 4 Export Modal
  await tabletPage.click('button[data-testid="export-options-btn"]');
  await tabletPage.waitForTimeout(500);
  await tabletPage.screenshot({ path: path.join(SCREENSHOT_DIR, 'tablet_768_export.png') });
  console.log('✓ Captured tablet_768_export.png');
  await tabletPage.click('button:has-text("Cancel")');
  await tabletPage.waitForTimeout(300);

  // Screen 14: Tablet Import Modal
  await tabletPage.click('button[data-testid="import-nav-btn"]');
  await tabletPage.waitForTimeout(500);
  await tabletPage.screenshot({ path: path.join(SCREENSHOT_DIR, 'tablet_768_import.png') });
  console.log('✓ Captured tablet_768_import.png');
  await tabletPage.click('button:has-text("Cancel")');
  await tabletContext.close();

  // -------------------------------------------------------------------------
  // 3. PHONE VIEWPORT (390x844 - iPhone 14 / Standard Mobile)
  // -------------------------------------------------------------------------
  console.log('\n[3] Verifying Phone (390px) Layout & Capturing Screens...');
  const phoneContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true
  });
  const phonePage = await phoneContext.newPage();
  await phonePage.goto('http://localhost:4173/#/app', { waitUntil: 'networkidle' });
  await phonePage.evaluate(() => document.fonts.ready);
  await phonePage.waitForTimeout(800);

  // Screen 15: Phone Preview (with bottom nav & sticky sub-bar)
  await phonePage.screenshot({ path: path.join(SCREENSHOT_DIR, 'phone_390_preview.png') });
  console.log('✓ Captured phone_390_preview.png');

  // Screen 16: Phone Data Tab (Mobile Session Cards with tap to expand)
  console.log('Switching to Mobile Data Tab...');
  await phonePage.click('button[data-testid="mobile-tab-data"]');
  await phonePage.waitForTimeout(500);
  // Tap first card to expand
  const firstCard = await phonePage.$('.medscope-card');
  if (firstCard) await firstCard.click();
  await phonePage.waitForTimeout(300);
  await phonePage.screenshot({ path: path.join(SCREENSHOT_DIR, 'phone_390_editor_cards.png') });
  console.log('✓ Captured phone_390_editor_cards.png');

  // Screen 17: Phone Validator Panel (via header badge if present)
  console.log('Checking Mobile Validator...');
  const phoneValBtn = await phonePage.$('button[data-testid="validator-btn"]');
  if (phoneValBtn) {
    await phoneValBtn.click();
    await phonePage.waitForTimeout(500);
    await phonePage.screenshot({ path: path.join(SCREENSHOT_DIR, 'phone_390_validator.png') });
    console.log('✓ Captured phone_390_validator.png');
    const closeBtn = await phonePage.$('button[data-testid="validator-close-btn"]');
    if (closeBtn) await closeBtn.click();
    else await phoneValBtn.click();
  }

  // Screen 18: Phone Style Tab (Full-screen Theme Sheet)
  console.log('Switching to Mobile Style Tab...');
  await phonePage.click('button[data-testid="mobile-tab-style"]');
  await phonePage.waitForTimeout(500);
  await phonePage.screenshot({ path: path.join(SCREENSHOT_DIR, 'phone_390_theme.png') });
  console.log('✓ Captured phone_390_theme.png');

  // Screen 19: Phone Export Tab (Sheet, resolution capped at 1.5x)
  console.log('Switching to Mobile Export Tab...');
  await phonePage.click('button[data-testid="mobile-tab-export"]');
  await phonePage.waitForTimeout(500);
  await phonePage.screenshot({ path: path.join(SCREENSHOT_DIR, 'phone_390_export.png') });
  console.log('✓ Captured phone_390_export.png');
  await phonePage.click('button:has-text("Cancel")');
  await phonePage.waitForTimeout(300);

  // Screen 20: Phone Import Screen
  console.log('Opening Phone Import Modal...');
  await phonePage.click('button[data-testid="mobile-tab-data"]');
  await phonePage.waitForTimeout(300);
  await phonePage.click('button[data-testid="mobile-import-btn"], button:has-text("Import"):visible');
  await phonePage.waitForTimeout(500);
  await phonePage.screenshot({ path: path.join(SCREENSHOT_DIR, 'phone_390_import.png') });
  console.log('✓ Captured phone_390_import.png');
  await phonePage.click('button:has-text("Cancel"):visible');

  await phoneContext.close();
  await browser.close();

  console.log('\n====================================================');
  console.log('   PHASE 4 VERIFICATION & SCREENSHOTS COMPLETE!     ');
  console.log(`   Screenshots saved in: ${SCREENSHOT_DIR}`);
  console.log('====================================================');
})();
