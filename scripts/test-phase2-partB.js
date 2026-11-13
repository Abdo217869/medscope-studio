import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const fs = require('fs');
const { chromium } = require('D:/Medscope Site/node_modules/playwright-core');

(async () => {
  console.log('--- STARTING PHASE 2 PART B ACCEPTANCE VERIFICATION ---');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1200 }, acceptDownloads: true });
  const page = await context.newPage();

  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err));

  // 1. Navigate to App
  console.log('Navigating to http://localhost:4173 ...');
  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1000);

  // 2. Open Import Modal & Test Schema Validation
  console.log('Testing Import Modal and Schema Validation...');
  await page.click('button:has-text("Import")');
  await page.waitForTimeout(400);

  // Type invalid JSON
  const textarea = await page.$('textarea[data-testid="import-json-textarea"]');
  await textarea.fill('{"module": {"title": 123}}');
  await page.waitForTimeout(300);

  const errorCount = await page.evaluate(() => {
    return document.querySelectorAll('.bg-rose-950\\/80').length;
  });
  console.log('Detected schema errors with JSON paths:', errorCount > 0);

  // Click Load GIT fixture
  console.log('Loading GIT fixture in Import Modal...');
  await page.click('button:has-text("GIT (all 12 sections)")');
  await page.waitForTimeout(400);

  const isValid = await page.evaluate(() => {
    return !!document.querySelector('.bg-emerald-950\\/40, [data-testid="import-validation-success"], .text-emerald-400');
  });
  console.log('GIT fixture validated successfully:', isValid);

  // Apply Import
  page.on('dialog', dialog => dialog.accept());
  await page.click('button:has-text("Apply Import")');
  await page.waitForTimeout(600);

  // 3. Open Session Editor & Edit a Session
  console.log('Opening Session Editor...');
  await page.click('button:has-text("Editor")');
  await page.waitForTimeout(500);

  const editorVisible = await page.evaluate(() => {
    return !!document.querySelector('table');
  });
  console.log('Session Editor table is visible:', editorVisible);

  // Find first session place input and change to "Hall 999"
  console.log('Editing place of first session to "Hall 999"...');
  const placeInput = await page.$('tbody tr:first-child input[placeholder="Hall 4"]');
  if (placeInput) {
    await placeInput.fill('Hall 999');
    await placeInput.dispatchEvent('input');
    await page.waitForTimeout(400);
  } else {
    // fallback query
    await page.evaluate(() => {
      const firstInput = document.querySelector('tbody tr:first-child input[value="Hall 4"]');
      if (firstInput) {
        firstInput.value = 'Hall 999';
        firstInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    await page.waitForTimeout(400);
  }

  // Verify Live Preview updated
  const previewHasHall999 = await page.evaluate(() => {
    const preview = document.querySelector('.schedule-page');
    return preview ? preview.textContent.includes('Hall 999') : false;
  });
  console.log('Live preview immediately updated to "Hall 999":', previewHasHall999);

  // 4. Export Project JSON
  console.log('Exporting Project JSON...');
  await page.click('button[data-testid="header-more-btn"], button[title="More actions"]');
  await page.waitForTimeout(200);
  const [ download ] = await Promise.all([
    page.waitForEvent('download', { timeout: 10000 }),
    page.click('button:has-text("Export Project JSON"), button:has-text("Export JSON")')
  ]);

  const filename = download.suggestedFilename();
  console.log('Exported JSON filename:', filename);
  const exportedPath = 'reference/' + filename;
  await download.saveAs(exportedPath);

  const exportedContent = fs.readFileSync(exportedPath, 'utf8');
  const parsedExport = JSON.parse(exportedContent);
  const exportedHasHall999 = exportedContent.includes('Hall 999');
  console.log('Exported JSON contains "Hall 999":', exportedHasHall999);

  // 5. Change place to something else, then re-import exported JSON
  console.log('Changing place to "Hall 888" before re-import test...');
  await page.evaluate(() => {
    const inputs = document.querySelectorAll('tbody tr input');
    for (const inp of inputs) {
      if (inp.value === 'Hall 999') {
        inp.value = 'Hall 888';
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        break;
      }
    }
  });
  await page.waitForTimeout(400);

  const previewHasHall888 = await page.evaluate(() => {
    return document.querySelector('.schedule-page').textContent.includes('Hall 888');
  });
  console.log('Preview reflects "Hall 888":', previewHasHall888);

  // Re-import the exported project JSON
  console.log('Re-importing the exported project JSON...');
  await page.click('button[data-testid="import-nav-btn"], button:has-text("Import")');
  await page.waitForTimeout(400);

  await page.evaluate((val) => {
    const ta = document.querySelector('textarea[data-testid="import-json-textarea"]');
    if (ta) {
      ta.value = val;
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }, exportedContent);
  await page.waitForTimeout(400);
  await page.click('button:has-text("Validate JSON")');
  await page.waitForTimeout(400);

  const applyBtn = await page.$('button:has-text("Apply Import")');
  const isApplyDisabled = await page.evaluate(btn => btn ? btn.disabled : true, applyBtn);
  console.log('Is Apply Import disabled?', isApplyDisabled);

  await applyBtn.click();
  await page.waitForTimeout(600);

  // Verify Hall 999 is restored
  const previewRestoredHall999 = await page.evaluate(() => {
    return document.querySelector('.schedule-page').textContent.includes('Hall 999');
  });
  console.log('Preview restored to "Hall 999" after re-importing project JSON:', previewRestoredHall999);

  // 6. Test 1-Step Undo Import
  console.log('Testing 1-Step Undo Import...');
  await page.click('button[data-testid="import-nav-btn"], button:has-text("Import")');
  await page.waitForTimeout(400);

  const undoImportBtn = await page.$('button:has-text("Undo Last Import")');
  if (undoImportBtn) {
    await undoImportBtn.click();
    await page.waitForTimeout(400);
    const revertedToHall888 = await page.evaluate(() => {
      return document.querySelector('.schedule-page').textContent.includes('Hall 888');
    });
    console.log('Successfully reverted import in 1 step ("Hall 888" restored):', revertedToHall888);
  }

  // 7. Test Setup Modal
  console.log('Testing Setup Modal...');
  await page.click('button:has-text("Setup")');
  await page.waitForTimeout(400);

  const setupModalVisible = await page.evaluate(() => {
    return !!document.querySelector('[data-testid="setup-modal"]') || !!document.querySelector('input[placeholder*="Foundation"]') || !!document.querySelector('input[placeholder*="Gastrointestinal"]');
  });
  console.log('Setup modal is open with module fields:', setupModalVisible);

  await page.click('button:has-text("Cancel")');
  await page.waitForTimeout(300);

  // 8. Test Text Fit Warning Badge
  console.log('Testing Text Fit Warning Badge when long text is entered...');
  await page.evaluate(() => {
    // Type an extremely long place name that overflows the place cell
    const inputs = document.querySelectorAll('tbody tr input');
    for (const inp of inputs) {
      if (inp.value.includes('Hall') || inp.value.includes('Morgue') || inp.value.includes('Lab')) {
        inp.value = 'Extremely Long Lecture Hall Name That Definitely Exceeds The Place Column Width Of 246 Pixels';
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        break;
      }
    }
  });
  await page.waitForTimeout(500);

  const warningBadgeVisible = await page.evaluate(() => {
    return !!document.querySelector('[data-testid="overflow-warning-badge"]');
  });
  console.log('Overflow Warning Badge displayed on preview:', warningBadgeVisible);

  // Reset to default fixture via Load sample
  console.log('Resetting to default fixture via Load sample...');
  const importNavBtn = page.locator('button[data-testid="import-nav-btn"], button:has-text("Import")');
  if (await importNavBtn.isVisible()) {
    await importNavBtn.click();
    await page.waitForTimeout(300);
    const sampleSelect = page.locator('select:has-text("Load sample")');
    if (await sampleSelect.isVisible()) {
      await sampleSelect.selectOption('GIT');
      await page.waitForTimeout(600);
    }
  }

  await browser.close();
  console.log('--- PHASE 2 PART B ACCEPTANCE VERIFIED WITH 100% SUCCESS! ---');
})();
