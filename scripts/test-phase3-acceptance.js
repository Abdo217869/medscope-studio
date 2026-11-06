import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const assert = require('assert');
const { chromium } = require('D:/Medscope Site/node_modules/playwright-core');

(async () => {
  console.log('--- STARTING PHASE 3 ACCEPTANCE TEST ---');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1200 } });
  const page = await context.newPage();

  page.on('dialog', async dialog => {
    console.log('DIALOG DETECTED:', dialog.message());
    await dialog.accept();
  });

  console.log('1. Navigating to http://localhost:4173/ ...');
  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);

  // 2. Import GIT fixture
  console.log('2. Importing GIT fixture...');
  await page.click('button:has-text("Import")');
  await page.waitForTimeout(300);
  await page.click('button:has-text("GIT (all 12 sections)")');
  await page.waitForTimeout(300);
  await page.click('button:has-text("Apply Import")');
  await page.waitForTimeout(600);

  // 3. Verify Validator badge shows 0 errors initially
  const initialBadgeText = await page.evaluate(() => {
    const btn = document.querySelector('[data-testid="validator-btn"]');
    return btn ? btn.textContent.trim() : '';
  });
  console.log('Initial Validator Badge:', initialBadgeText);
  assert.strictEqual(initialBadgeText.includes('✓') || !initialBadgeText.match(/\b[1-9]\d*\b/), true, 'Initial state should have 0 errors');

  // 4. Open Session Editor
  console.log('3. Opening Session Editor...');
  await page.click('button:has-text("Editor")');
  await page.waitForTimeout(400);

  // 5. Inject Error 1: Time Overlap
  console.log('4. Injecting Error 1: Time Overlap on Tuesday sessions...');
  await page.evaluate(() => {
    // Change row 1 end time to 10:30 to overlap with row 4 (09:30 - 11:00) for section A1
    const endInputs = document.querySelectorAll('tbody tr input[placeholder="09:30"]');
    if (endInputs.length >= 1) {
      endInputs[0].value = '10:30';
      endInputs[0].dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  await page.waitForTimeout(400);

  // 6. Inject Error 2: Duplicate Session Number
  console.log('5. Injecting Error 2: Duplicate Session Number...');
  await page.evaluate(() => {
    // Change session number of row 4 to 1 (duplicates prac 1 for Section A1)
    const numInputs = document.querySelectorAll('tbody tr input[type="number"]');
    if (numInputs.length >= 4) {
      numInputs[3].value = '1';
      numInputs[3].dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  await page.waitForTimeout(500);

  // 7. Verify Validator Badge reflects errors
  const errorBadgeText = await page.evaluate(() => {
    return document.querySelector('[data-testid="validator-btn"]').textContent.trim();
  });
  console.log('Validator Badge after error injection:', errorBadgeText);
  const errorCountMatch = errorBadgeText.match(/(\d+)/);
  const errorCount = errorCountMatch ? parseInt(errorCountMatch[1], 10) : 0;
  console.log('Detected error count on badge:', errorCount);
  assert.strictEqual(errorCount >= 2, true, 'Badge must reflect at least 2 errors');

  // 8. Open Validator Panel
  console.log('6. Opening Validator Panel...');
  await page.click('[data-testid="validator-btn"]');
  await page.waitForTimeout(400);

  const errorCardsCount = await page.evaluate(() => {
    return document.querySelectorAll('[data-testid="validator-error-card"]').length;
  });
  console.log('Validator error cards visible in panel:', errorCardsCount);
  assert.strictEqual(errorCardsCount >= 2, true, 'At least 2 error cards must be displayed in panel');

  // 9. Test "Jump to Editor"
  console.log('7. Testing "Jump to Editor" on first error card...');
  await page.click('[data-testid="validator-error-card"] button:has-text("Jump to Editor")');
  await page.waitForTimeout(500);

  const isRowHighlighted = await page.evaluate(() => {
    const highlighted = document.querySelector('tr[class*="ring-amber-400"]');
    return !!highlighted;
  });
  console.log('Row successfully highlighted in Session Editor:', isRowHighlighted);
  assert.strictEqual(isRowHighlighted, true, 'Target row must be highlighted after Jump to Editor');

  // 10. Check Export Gating: Export must be BLOCKED
  console.log('8. Opening Export Modal to check gating...');
  await page.click('button:has-text("Options")');
  await page.waitForTimeout(400);

  const isExportBlockedAlertVisible = await page.evaluate(() => {
    return !!document.querySelector('[data-testid="export-validation-alert"]');
  });
  console.log('Export Blocked alert is visible:', isExportBlockedAlertVisible);
  assert.strictEqual(isExportBlockedAlertVisible, true, 'Export blocked alert must be visible');

  const isStartExportDisabled = await page.evaluate(() => {
    const btn = document.querySelector('[data-testid="start-export-btn"]');
    return btn ? btn.disabled : false;
  });
  console.log('Start Export button is disabled:', isStartExportDisabled);
  assert.strictEqual(isStartExportDisabled, true, 'Start Export button must be disabled when errors exist');

  // Test "Export anyway" checkbox override
  console.log('9. Testing "Export anyway" override checkbox...');
  await page.click('[data-testid="export-anyway-checkbox"]');
  await page.waitForTimeout(300);

  const isStartExportNowEnabled = await page.evaluate(() => {
    const btn = document.querySelector('[data-testid="start-export-btn"]');
    return btn ? !btn.disabled : false;
  });
  console.log('Start Export button is enabled after ticking "Export anyway":', isStartExportNowEnabled);
  assert.strictEqual(isStartExportNowEnabled, true, 'Export anyway must unblock Start Export button');

  // Close Export Modal
  await page.click('button:has-text("Cancel")');
  await page.waitForTimeout(300);

  // 11. Fix the two errors in Session Editor
  console.log('10. Fixing both injected errors in Session Editor...');
  await page.evaluate(() => {
    // Restore time
    const endInputs = document.querySelectorAll('tbody tr input[placeholder="09:30"]');
    if (endInputs.length >= 1) {
      endInputs[0].value = '09:30';
      endInputs[0].dispatchEvent(new Event('input', { bubbles: true }));
    }
    // Restore number
    const numInputs = document.querySelectorAll('tbody tr input[type="number"]');
    if (numInputs.length >= 4) {
      numInputs[3].value = '2';
      numInputs[3].dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  await page.waitForTimeout(500);

  // 12. Verify errors are cleared on badge
  const fixedBadgeText = await page.evaluate(() => {
    return document.querySelector('[data-testid="validator-btn"]').textContent.trim();
  });
  console.log('Validator badge text after fixes:', fixedBadgeText);
  const fixedErrorsCount = fixedBadgeText.match(/\b[1-9]\d*\b/);
  console.log('Errors remaining after fixes:', fixedErrorsCount ? fixedErrorsCount[0] : 0);
  assert.strictEqual(fixedErrorsCount === null, true, 'All errors must be resolved');

  // 13. Open Export Modal again: verify export is ALLOWED
  console.log('11. Verifying Export is now unblocked...');
  await page.click('button:has-text("Options")');
  await page.waitForTimeout(400);

  const isBlockedNow = await page.evaluate(() => {
    return !!document.querySelector('[data-testid="export-validation-alert"]');
  });
  console.log('Is export blocked alert present?', isBlockedNow);
  assert.strictEqual(isBlockedNow, false, 'Export blocked alert should not be present');

  const isExportAllowed = await page.evaluate(() => {
    const btn = document.querySelector('[data-testid="start-export-btn"]');
    return btn ? !btn.disabled : false;
  });
  console.log('Is Start Export button enabled?', isExportAllowed);
  assert.strictEqual(isExportAllowed, true, 'Start Export button must be enabled when 0 errors exist');

  await page.click('button:has-text("Cancel")');
  await page.waitForTimeout(300);

  // 14. Reset to default fixture
  console.log('12. Resetting fixture...');
  const closeV = page.locator('[data-testid="validator-close-btn"]');
  if (await closeV.isVisible()) {
    await closeV.click();
    await page.waitForTimeout(300);
  }
  await page.click('button[data-testid="header-more-btn"], button[title="More actions"]');
  await page.waitForTimeout(300);
  await page.click('button:has-text("Reset Fixture")');
  await page.waitForTimeout(400);

  await browser.close();
  console.log('--- PHASE 3 ACCEPTANCE TEST COMPLETED WITH 100% SUCCESS! ---');
})();

