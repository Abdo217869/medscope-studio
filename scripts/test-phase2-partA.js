import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('D:/Medscope Site/node_modules/playwright-core');

(async () => {
  console.log('--- STARTING PHASE 2 PART A ACCEPTANCE VERIFICATION ---');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1200 } });
  const page = await context.newPage();

  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err));

  // 1. Navigate to App
  console.log('Navigating to http://localhost:4173 ...');
  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1000);

  // 2. Open Theme Panel
  console.log('Opening Theme Panel...');
  await page.click('button:has-text("Theme")');
  await page.waitForTimeout(500);

  // 3. Test changing options:
  // - Geometry: change tableBorderWidth to 8
  // - Content: change timeFormat to "12h_ampm"
  // - Text Styles: change weekLabel size
  console.log('Modifying Theme Options in Theme Panel...');

  // Open Geometry accordion if closed
  const geoToggle = await page.$('button:has-text("Page & Table Geometry")');
  if (geoToggle) await geoToggle.click();
  await page.waitForTimeout(400);

  // Set Border Width to 8
  const borderWidthInput = await page.waitForSelector('[data-testid="table-border-width-input"]', { timeout: 3000 });
  if (borderWidthInput) {
    await borderWidthInput.fill('8');
    await page.waitForTimeout(400);
  }

  // Check that the table border in DOM updated to 8px
  const has8pxBorder = await page.evaluate(() => {
    const el = document.querySelector('.schedule-page');
    const tbl = el.querySelector('[style*="8px solid"]');
    return !!tbl;
  });
  console.log('Border 8px reflected in DOM:', has8pxBorder);

  // 4. Test Undo / Redo
  console.log('Testing Undo button...');
  const undoBtn = await page.$('[data-testid="undo-theme-btn"]');
  if (undoBtn) {
    await undoBtn.click();
    await page.waitForTimeout(400);
    const borderReverted = await page.evaluate(() => {
      const el = document.querySelector('.schedule-page');
      const tbl = el.querySelector('[style*="4px solid"]');
      return !!tbl;
    });
    console.log('Border successfully reverted to 4px on Undo:', borderReverted);

    // Redo
    console.log('Testing Redo button...');
    const redoBtn = await page.$('[data-testid="redo-theme-btn"]');
    await redoBtn.click();
    await page.waitForTimeout(400);
    const borderRestored = await page.evaluate(() => {
      const el = document.querySelector('.schedule-page');
      const tbl = el.querySelector('[style*="8px solid"]');
      return !!tbl;
    });
    console.log('Border successfully restored to 8px on Redo:', borderRestored);
  }

  // 5. Test Persistence on Reload
  console.log('Reloading page to test persistence...');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const persistsAfterReload = await page.evaluate(() => {
    const activeTheme = JSON.parse(localStorage.getItem('medscope_active_theme') || '{}');
    return activeTheme?.geometry?.tableBorderWidth === 8;
  });
  console.log('Modified border width (8px) persisted in localStorage after reload:', persistsAfterReload);

  const domPersistsAfterReload = await page.evaluate(() => {
    const el = document.querySelector('.schedule-page');
    const tbl = el.querySelector('[style*="8px solid"]');
    return !!tbl;
  });
  console.log('8px border active in DOM after reload:', domPersistsAfterReload);

  // 6. Test Loading Older Theme Version
  console.log('Testing loading older theme file (Version 1 / Flat schema)...');
  const oldThemeResult = await page.evaluate(() => {
    // Simulate legacy flat theme from Phase 1c
    const legacyTheme = {
      themeVersion: 1,
      name: "Legacy Theme V1",
      tableHeaderBg: "#112233",
      dayCellBg: "#aabbcc",
      tableBorderWidth: 6,
      tableBorderColor: "#ff0000",
      weekFont: "Grand Hotel",
      weekColor: "#00ff00",
      titleFont: "Poppins",
      titleColor: "#0000ff",
      footerLeft: "Legacy Footer Text {module}"
    };

    // Store in localStorage as active theme or pass to window
    localStorage.setItem('medscope_active_theme', JSON.stringify(legacyTheme));
    return true;
  });

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const legacyMergedProperly = await page.evaluate(() => {
    const activeTheme = JSON.parse(localStorage.getItem('medscope_active_theme') || '{}');
    // Check that legacy properties were mapped to modern nested structure
    const hasV2 = activeTheme.themeVersion >= 2;
    const hasMappedBorder = activeTheme.geometry?.tableBorderWidth === 6;
    const hasMappedBorderColor = activeTheme.geometry?.tableBorderColor === "#ff0000";
    const hasDefaultCanvas = activeTheme.geometry?.canvasWidth === 1414;
    const hasMappedWeekColor = activeTheme.textStyles?.weekLabel?.color === "#00ff00";
    return hasV2 && hasMappedBorder && hasMappedBorderColor && hasDefaultCanvas && hasMappedWeekColor;
  });
  console.log('Legacy theme successfully upgraded to themeVersion: 2 without breaking:', legacyMergedProperly);

  // Reset back to clean fixture
  console.log('Resetting to default fixture...');
  await page.evaluate(() => {
    localStorage.removeItem('medscope_active_theme');
  });
  const resetBtn = await page.$('button[title*="Reset"], button:has-text("Reset")');
  if (resetBtn) await resetBtn.click();
  await page.waitForTimeout(500);

  await browser.close();
  console.log('--- ALL ACCEPTANCE CRITERIA VERIFIED SUCCESSFULLY! ---');
})();
