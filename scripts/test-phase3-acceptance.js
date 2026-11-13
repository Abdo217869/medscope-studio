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

  // 3. Verify initial state in Export Modal has 0 errors ("Everything looks fine")
  console.log('3. Checking initial export preflight audit...');
  await page.click('[data-testid="export-options-btn"]');
  await page.waitForSelector('[data-testid="export-audit-clean"]', { timeout: 5000 });
  const initialCleanText = await page.locator('[data-testid="export-audit-clean"]').innerText();
  console.log('Initial Export Audit:', initialCleanText);
  assert.ok(initialCleanText.includes('fine') || initialCleanText.includes('Everything'), 'Initial state should have everything clean');
  await page.click('button:has-text("Cancel")');
  await page.waitForTimeout(300);

  // 4. Open Session Editor
  console.log('4. Opening Session Editor...');
  await page.click('button:has-text("Editor")');
  await page.waitForTimeout(400);

  // 5. Inject Error 1: Time Overlap
  console.log('4. Injecting Error 1: Time Overlap on Tuesday sessions...');
  await page.waitForSelector('#session-card-0', { timeout: 5000 });
  const card0 = page.locator('#session-card-0');
  await card0.click();
  const endInput0 = card0.locator('input[aria-label="End Time"]');
  await endInput0.waitFor({ state: 'visible', timeout: 5000 });
  await endInput0.fill('10:30');
  await endInput0.evaluate(e => e.blur());
  await page.waitForTimeout(400);

  // 6. Inject Error 2: Duplicate Session Number
  console.log('5. Injecting Error 2: Duplicate Session Number...');
  const card3 = page.locator('#session-card-3');
  await card3.click();
  const numInput3 = card3.locator('input[type="number"]');
  await numInput3.waitFor({ state: 'visible', timeout: 5000 });
  await numInput3.fill('1');
  await numInput3.evaluate(e => e.blur());
  await page.waitForTimeout(400);
  await page.waitForTimeout(500);

  // 5. Open Export Modal to verify plain-language checks for errors
  console.log('5. Opening Export Modal to verify plain-language audit...');
  await page.click('[data-testid="export-options-btn"]');
  await page.waitForSelector('[data-testid="export-audit-issues"]', { timeout: 5000 });

  const auditIssuesText = await page.locator('[data-testid="export-audit-issues"]').innerText();
  console.log('Export Audit text:\n', auditIssuesText);
  assert.ok(
    auditIssuesText.includes('to check') || auditIssuesText.includes('thing'),
    'Export modal must show plain-language check for project with errors'
  );
  assert.ok(
    auditIssuesText.toLowerCase().includes('overlap') ||
    auditIssuesText.toLowerCase().includes('duplicate') ||
    auditIssuesText.includes('Tuesday') ||
    auditIssuesText.includes('Sec 11') ||
    auditIssuesText.includes('Section 11'),
    'Export audit must describe injected errors in plain language'
  );
  console.log('✓ Export modal successfully displays plain-language check for project with errors');

  // Test "Fix" button (Jump to session in editor)
  const gotoBtn = page.locator('[data-testid="goto-session-btn"]').first();
  if (await gotoBtn.isVisible()) {
    console.log('Testing "Fix" button to jump to session in Editor...');
    await gotoBtn.click();
    await page.waitForTimeout(500);
  } else {
    await page.click('button:has-text("Cancel")');
    await page.waitForTimeout(300);
  }

  // 6. Fix both injected errors in Session Editor
  console.log('6. Fixing both injected errors in Session Editor...');
  await card0.click();
  await page.waitForTimeout(200);
  const endInputFixed = card0.locator('input[aria-label="End Time"]');
  await endInputFixed.waitFor({ state: 'visible', timeout: 5000 });
  await endInputFixed.fill('09:30');
  await endInputFixed.evaluate(e => e.blur());
  await page.waitForTimeout(300);

  await card3.click();
  await page.waitForTimeout(200);
  const numInputFixed = card3.locator('input[type="number"]');
  await numInputFixed.waitFor({ state: 'visible', timeout: 5000 });
  await numInputFixed.fill('2');
  await numInputFixed.evaluate(e => e.blur());
  await page.waitForTimeout(300);
  await page.waitForTimeout(500);

  // 7. Open Export Modal again: verify audit is clean ("Everything looks fine")
  console.log('7. Verifying Export Audit is clean after fixes...');
  await page.click('[data-testid="export-options-btn"]');
  await page.waitForSelector('[data-testid="export-audit-clean"]', { timeout: 5000 });

  const cleanAuditText = await page.locator('[data-testid="export-audit-clean"]').innerText();
  console.log('Export Audit text after fixes:', cleanAuditText);
  assert.ok(cleanAuditText.includes('fine') || cleanAuditText.includes('Everything'), 'All errors must be resolved in export check');

  const isExportAllowed = await page.evaluate(() => {
    const btn = document.querySelector('[data-testid="start-export-btn"]');
    return btn ? !btn.disabled : false;
  });
  console.log('Is Start Export button enabled?', isExportAllowed);
  assert.strictEqual(isExportAllowed, true, 'Start Export button must be enabled when 0 errors exist');

  await page.click('button:has-text("Cancel")');
  await page.waitForTimeout(300);

  await browser.close();
  console.log('--- PHASE 3 ACCEPTANCE TEST COMPLETED WITH 100% SUCCESS! ---');
})();

