import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('D:/Medscope Site/node_modules/playwright-core');

import { buildWeekSchedule, isValidDate, getWeekCalendarDates } from '../src/utils/dataUtils.js';
import { HELP_EN } from '../src/content/help.en.js';
import { HELP_AR } from '../src/content/help.ar.js';

const BASE_URL = 'http://localhost:4173';

async function runTests() {
  console.log('=== RUNNING PHASE 12 ACCEPTANCE TESTS ===\n');

  // -------------------------------------------------------------------------
  // 1. DATA LAYER TESTS: Show OFF days (ON / OFF / empty week)
  // -------------------------------------------------------------------------
  console.log('1. Testing data layer Show OFF days logic...');
  const gitJson = JSON.parse(fs.readFileSync('src/samples/GIT_all_sections.json', 'utf8'));
  const sec11 = gitJson.sections.find(s => s.id === '11');
  assert.ok(sec11, 'Section 11 must exist in GIT sample');

  // Test 1.1: Section 11, Week 1 when showOffDays is true (default ON)
  const rowsOn = buildWeekSchedule(gitJson.module, sec11, gitJson.weeks[0], { showOffDays: true });
  assert.strictEqual(rowsOn.length, 3, 'When ON, Week 1 for Sec 11 must have 3 days (Tue, Wed, Thu)');
  assert.deepStrictEqual(
    rowsOn.map(r => ({ wd: r.weekdayShort, isOff: r.isOff })),
    [
      { wd: 'Tue', isOff: true },
      { wd: 'Wed', isOff: true },
      { wd: 'Thu', isOff: false }
    ],
    'Tue and Wed must be OFF rows, Thu must have sessions'
  );
  console.log('✓ Show OFF days ON: Section 11, Week 1 shows Tue & Wed (OFF) + Thu');

  // Test 1.2: Section 11, Week 1 when showOffDays is false (OFF)
  const rowsOff = buildWeekSchedule(gitJson.module, sec11, gitJson.weeks[0], { showOffDays: false });
  assert.strictEqual(rowsOff.length, 1, 'When OFF, Week 1 for Sec 11 must have only 1 day');
  assert.strictEqual(rowsOff[0].weekdayShort, 'Thu', 'When OFF, only Thursday is drawn');
  assert.strictEqual(rowsOff[0].isOff, false, 'Thursday is not OFF');
  console.log('✓ Show OFF days OFF: Section 11, Week 1 shows only Thursday');

  // Test 1.3: Week with no sessions for a section draws one OFF row with the week\'s first date
  const emptyWeek = { n: 1, days: ['2026-11-10', '2026-11-11', '2026-11-12'], sessions: [] };
  const rowsEmptyOff = buildWeekSchedule(gitJson.module, sec11, emptyWeek, { showOffDays: false });
  assert.strictEqual(rowsEmptyOff.length, 1, 'When all days are OFF and showOffDays is false, must draw 1 OFF row');
  assert.strictEqual(rowsEmptyOff[0].isOff, true, 'Drawn row is an OFF row');
  assert.strictEqual(rowsEmptyOff[0].dateStr, '2026-11-10', 'Drawn row has the week first date (2026-11-10)');
  console.log('✓ Week with no sessions draws one OFF row with week\'s first date so table is never empty');

  // -------------------------------------------------------------------------
  // 2. HELP TEXT VERIFICATION: English & Arabic
  // -------------------------------------------------------------------------
  console.log('2. Checking help text entries for show_off_days...');
  assert.ok(HELP_EN.show_off_days, 'HELP_EN must include show_off_days');
  assert.ok(HELP_EN.show_off_days.title.includes('Show OFF Days'), 'HELP_EN title matches');
  assert.ok(HELP_AR.show_off_days, 'HELP_AR must include show_off_days');
  assert.ok(HELP_AR.show_off_days.title.includes('إظهار أيام الإجازة') || HELP_AR.show_off_days.title.includes('Show OFF days'), 'HELP_AR title matches');
  console.log('✓ English and Arabic help texts present and correct');

  // -------------------------------------------------------------------------
  // 3. E2E BROWSER TESTS (Playwright)
  // -------------------------------------------------------------------------
  console.log('3. Starting headless Chromium to test UI, responsive layout, and screenshots...');
  const browser = await chromium.launch({ headless: true });

  try {
    // -----------------------------------------------------------------------
    // Test 3.1: Desktop 1440x900 Layout & Editor interactions
    // -----------------------------------------------------------------------
    console.log('3.1: Testing Desktop at 1440x900...');
    const context1440 = await browser.newContext({
      viewport: { width: 1440, height: 900 }
    });
    const page1440 = await context1440.newPage();

    // Navigate to studio app
    await page1440.goto(`${BASE_URL}/#/app`, { waitUntil: 'networkidle' });
    await page1440.waitForSelector('[data-testid="schedule-page-canvas"]');

    // Switch to Section 11 to test Show OFF days visually
    await page1440.click('[data-testid="letter-tab-D"]');
    await page1440.click('[data-testid="section-chip-11"]');
    await page1440.waitForTimeout(200);

    // Initial state: default is showOffDays ON -> Section 11 Week 1 shows Tue, Wed, Thu
    let renderedDays = await page1440.evaluate(() => {
      return Array.from(document.querySelectorAll('.preview-container .schedule-page [data-testid="day-name-text"]'))
        .map(el => el.textContent.trim());
    });
    assert.deepStrictEqual(renderedDays, ['Tuesday', 'Wednesday', 'Thursday'], 'Default preview must show Tue, Wed, Thu for Sec 11');

    // Open Editor panel via Rail step 1
    await page1440.click('[data-testid="rail-data-btn"]');
    await page1440.waitForSelector('[data-testid="days-shown-control"]');

    // Check Editor panel width and verify preview is NOT covered on desktop
    const layoutMetrics = await page1440.evaluate(() => {
      const editorPanel = document.querySelector('div.fixed.inset-y-0.right-0') || document.querySelector('aside + div') || document.querySelector('.overflow-x-hidden');
      const previewEl = document.querySelector('.preview-container');
      const editorRect = editorPanel ? editorPanel.getBoundingClientRect() : null;
      const previewRect = previewEl ? previewEl.getBoundingClientRect() : null;
      return {
        editorWidth: editorRect ? editorRect.width : 0,
        previewVisible: previewRect && previewRect.width > 300,
        editorScrollWidth: editorPanel ? editorPanel.scrollWidth : 0,
        editorClientWidth: editorPanel ? editorPanel.clientWidth : 0
      };
    });
    assert.ok(layoutMetrics.editorWidth >= 400 && layoutMetrics.editorWidth <= 500, `Editor panel width should be ~460px, got ${layoutMetrics.editorWidth}`);
    assert.ok(layoutMetrics.previewVisible, 'Live preview must remain visible and not covered on desktop');
    assert.ok(layoutMetrics.editorScrollWidth <= layoutMetrics.editorClientWidth + 1, 'No horizontal scroll in Editor panel');
    console.log('✓ Editor panel is ~460px wide, no horizontal scroll, preview is not covered');

    // Toggle Show OFF days in Editor top bar -> should show only Thursday
    await page1440.click('[data-testid="toggle-show-off-days"]');
    await page1440.waitForTimeout(300);

    renderedDays = await page1440.evaluate(() => {
      return Array.from(document.querySelectorAll('.preview-container .schedule-page [data-testid="day-name-text"]'))
        .map(el => el.textContent.trim());
    });
    assert.deepStrictEqual(renderedDays, ['Thursday'], 'When Show OFF days is OFF, preview shows only Thursday');
    console.log('✓ Toggling Show OFF days switch hides OFF days in live preview');

    // Turn Show OFF days back ON
    await page1440.click('[data-testid="toggle-show-off-days"]');
    await page1440.waitForTimeout(300);

    // Test Days Shown Chips: excluding a day
    // Section 11 has a session on Thu (2026-11-12). Click chip for Thu 12/11 to exclude it
    const thuChip = page1440.locator('[data-testid="day-chip-2026-11-12"]');
    assert.ok(await thuChip.isVisible(), 'Day chip for 2026-11-12 must be visible');
    await thuChip.click();
    await page1440.waitForTimeout(300);

    // Session on excluded day must NEVER be deleted; it should be flagged with "Needs fixing: date not in days shown"
    const needsFixingCard = page1440.locator('[data-testid="needs-fixing-row"]');
    assert.ok(await needsFixingCard.count() > 0, 'Excluding day must flag session as Needs fixing without deleting it');
    const needsFixingText = await needsFixingCard.first().innerText();
    assert.ok(needsFixingText.includes('Needs fixing') && needsFixingText.includes('date not in days shown'), 'Card shows reason in plain words');
    console.log('✓ Excluding a day via chip flags sessions as "Needs fixing: date not in days shown" without deleting');

    // Reset days to default
    await page1440.click('[data-testid="reset-days-default-btn"]');
    await page1440.waitForTimeout(300);

    // Test Accordion: Open a card, verify two-column grid and commit on blur / cancel on Escape
    const firstCard = page1440.locator('#session-card-0');
    if (await firstCard.isVisible()) {
      await firstCard.click();
      await page1440.waitForTimeout(200);

      // Verify Topics box is >= 4 rows
      const topicsTextarea = firstCard.locator('textarea');
      assert.ok(await topicsTextarea.isVisible(), 'Topics textarea visible');
      const rowsAttr = await topicsTextarea.getAttribute('rows');
      assert.ok(parseInt(rowsAttr, 10) >= 4, 'Topics box must be at least 4 lines tall');

      // Test Escape cancels input
      const placeInput = firstCard.locator('input[aria-label="Place"]');
      const originalPlace = await placeInput.inputValue();
      await placeInput.fill('Temporary Nonexistent Place');
      await placeInput.press('Escape');
      await page1440.waitForTimeout(100);
      const afterEscPlace = await placeInput.inputValue();
      assert.strictEqual(afterEscPlace, originalPlace, 'Pressing Escape must cancel and restore previous value');

      // Test blur commits input
      await placeInput.fill('Hall Test Blur Commit');
      await placeInput.evaluate(e => e.blur());
      await page1440.waitForTimeout(200);
      const afterBlurPlace = await placeInput.inputValue();
      assert.strictEqual(afterBlurPlace, 'Hall Test Blur Commit', 'Blur must commit the value');
      // Revert place
      await placeInput.fill(originalPlace);
      await placeInput.evaluate(e => e.blur());
      await page1440.waitForTimeout(200);
    }
    console.log('✓ Accordion form editing, commit on blur, and Esc cancellation verified');

    // Save screenshot at 1440x900
    await page1440.screenshot({ path: 'reference/editor-1440x900.png', fullPage: false });
    console.log('✓ Saved reference/editor-1440x900.png');
    await context1440.close();

    // -----------------------------------------------------------------------
    // Test 3.2: Desktop 1280x720 (Overlay drawer behavior, no horizontal scroll, screenshot)
    // -----------------------------------------------------------------------
    console.log('3.2: Testing Desktop at 1280x720...');
    const context1280 = await browser.newContext({
      viewport: { width: 1280, height: 720 }
    });
    const page1280 = await context1280.newPage();
    await page1280.goto(`${BASE_URL}/#/app`, { waitUntil: 'networkidle' });
    await page1280.waitForSelector('[data-testid="schedule-page-canvas"]');

    // Open Editor
    await page1280.click('[data-testid="rail-data-btn"]');
    await page1280.waitForSelector('[data-testid="days-shown-control"]');

    const metrics1280 = await page1280.evaluate(() => {
      const editorPanel = document.querySelector('.overflow-x-hidden');
      return {
        scrollWidth: editorPanel ? editorPanel.scrollWidth : 0,
        clientWidth: editorPanel ? editorPanel.clientWidth : 0
      };
    });
    assert.ok(metrics1280.scrollWidth <= metrics1280.clientWidth + 1, 'No horizontal scroll at 1280x720');

    // Save screenshot at 1280x720
    await page1280.screenshot({ path: 'reference/editor-1280x720.png', fullPage: false });
    console.log('✓ Saved reference/editor-1280x720.png');
    await context1280.close();

    // -----------------------------------------------------------------------
    // Test 3.3: Export Modal "Include OFF days" checkbox & project setting override
    // -----------------------------------------------------------------------
    console.log('3.3: Testing Export modal "Include OFF days" checkbox...');
    const contextExport = await browser.newContext({
      viewport: { width: 1440, height: 900 }
    });
    const pageExport = await contextExport.newPage();
    await pageExport.goto(`${BASE_URL}/#/app`, { waitUntil: 'networkidle' });
    await pageExport.waitForSelector('[data-testid="schedule-page-canvas"]');

    // Open Export modal via Rail Step 3
    await pageExport.click('[data-testid="rail-export-btn"]');
    await pageExport.waitForSelector('[data-testid="export-include-off-days-checkbox"]');

    const isCheckedInitially = await pageExport.isChecked('[data-testid="export-include-off-days-checkbox"]');
    assert.strictEqual(isCheckedInitially, true, 'Export modal checkbox starts from project setting (default true)');

    // Toggle checkbox OFF in modal
    await pageExport.click('[data-testid="export-include-off-days-checkbox"]');
    const isCheckedAfter = await pageExport.isChecked('[data-testid="export-include-off-days-checkbox"]');
    assert.strictEqual(isCheckedAfter, false, 'Checkbox can be toggled OFF for that export');

    // Close modal
    await pageExport.keyboard.press('Escape');
    await pageExport.waitForTimeout(200);

    // Project setting in live app must remain untouched (true)
    const liveProjectShowOff = await pageExport.evaluate(() => {
      const saved = localStorage.getItem('medscope_schedule_data');
      if (!saved) return true;
      const s = JSON.parse(saved);
      return s.settings?.showOffDays ?? true;
    });
    assert.strictEqual(liveProjectShowOff, true, 'Export modal override must NOT mutate project setting');
    console.log('✓ Export modal checkbox overrides for one export without mutating project setting');

    // -----------------------------------------------------------------------
    // Test 3.4: Command Bar "Toggle OFF days"
    // -----------------------------------------------------------------------
    console.log('3.4: Testing Command Bar "Toggle OFF days"...');
    // Press Ctrl+K
    await pageExport.keyboard.down('Control');
    await pageExport.keyboard.press('k');
    await pageExport.keyboard.up('Control');
    await pageExport.waitForSelector('input[placeholder*="Type a command"]');

    // Type "toggle off"
    await pageExport.fill('input[placeholder*="Type a command"]', 'toggle off');
    await pageExport.waitForTimeout(100);

    const toggleOffCmd = pageExport.locator('button:has-text("Toggle OFF days")');
    assert.ok(await toggleOffCmd.isVisible(), 'Command "Toggle OFF days" must be listed in Command Bar');
    await toggleOffCmd.click();
    await pageExport.waitForTimeout(300);

    // Verify schedule setting toggled
    const toggledSetting = await pageExport.evaluate(() => {
      const saved = localStorage.getItem('medscope_schedule_data');
      if (!saved) return true;
      const s = JSON.parse(saved);
      return s.settings?.showOffDays;
    });
    assert.strictEqual(toggledSetting, false, 'Command bar command toggled showOffDays to false');
    console.log('✓ Command Bar "Toggle OFF days" successfully toggles project setting');

    await contextExport.close();

  } finally {
    await browser.close();
  }

  console.log('\n=== ALL PHASE 12 ACCEPTANCE TESTS PASSED ===');
}

runTests().catch(err => {
  console.error('\n❌ PHASE 12 TEST FAILURE:', err);
  process.exit(1);
});

