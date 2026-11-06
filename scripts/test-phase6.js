import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const assert = require('assert');
const { chromium } = require('D:/Medscope Site/node_modules/playwright-core');

import { DEFAULT_SCHEDULE, GIT_SCHEDULE, DEFAULT_THEME } from '../src/constants.js';
import { validate } from '../src/utils/validatorEngine.js';
import { mergeThemeWithDefaults } from '../src/utils/themeUtils.js';

(async () => {
  console.log('===========================================================');
  console.log('   STARTING PHASE 6 ACCEPTANCE & INTEGRATION TEST SUITE    ');
  console.log('===========================================================');

  // -------------------------------------------------------------------------
  // 1. Data Integrity & Validator Pure Checks
  // -------------------------------------------------------------------------
  console.log('\n[1] Verifying Real GIT Sample Data Integrity...');
  assert.strictEqual(DEFAULT_SCHEDULE.module.title, 'Gastrointestinal Tract', 'Module title must be Gastrointestinal Tract');
  assert.strictEqual(DEFAULT_SCHEDULE.sections.length, 12, 'Must have 12 sections (A1-D3)');
  assert.strictEqual(DEFAULT_SCHEDULE.weeks.length, 7, 'Must have 7 weeks');
  
  const totalSessions = DEFAULT_SCHEDULE.weeks.reduce((acc, w) => acc + (w.sessions ? w.sessions.length : 0), 0);
  console.log(`Total sessions in GIT: ${totalSessions}`);
  assert.strictEqual(totalSessions, 317, 'Must have 317 sessions in GIT sample');

  const issues = validate(DEFAULT_SCHEDULE);
  const errors = issues.filter(i => i.severity === 'error');
  console.log(`Validator issues on GIT: Errors: ${errors.length}, Total issues: ${issues.length}`);
  assert.strictEqual(errors.length, 0, 'Validator must report ZERO errors on GIT sample');
  console.log('✓ Pure validator check passed with 0 errors.');

  // -------------------------------------------------------------------------
  // 2. Theme dayDate Role & Migration
  // -------------------------------------------------------------------------
  console.log('\n[2] Verifying dayDate Theme Role & themeVersion Migration...');
  const mergedDefault = mergeThemeWithDefaults();
  assert.ok(mergedDefault.textStyles.dayDate, 'dayDate role must exist in textStyles');
  assert.strictEqual(mergedDefault.textStyles.dayDate.visible, true, 'dayDate must be visible by default');
  assert.strictEqual(mergedDefault.textStyles.dayDate.fontFamily, 'Lilita One', 'dayDate font must default to Lilita One');

  // Test migration from old theme without dayDate
  const oldTheme = {
    themeVersion: 1,
    tableFont: 'Inter',
    textColor: '#123456'
  };
  const migratedTheme = mergeThemeWithDefaults(oldTheme);
  assert.ok(migratedTheme.textStyles.dayDate, 'Migrated theme must have dayDate');
  assert.strictEqual(migratedTheme.textStyles.dayDate.fontFamily, 'Inter', 'Migrated theme inherits tableFont');
  assert.strictEqual(migratedTheme.textStyles.dayDate.color, '#123456', 'Migrated theme inherits textColor');
  assert.strictEqual(migratedTheme.textStyles.dayDate.visible, true, 'Migrated theme dayDate default visible');
  console.log('✓ Theme dayDate role and migration verified.');

  // -------------------------------------------------------------------------
  // 3. Browser UI & Rendering Acceptance Tests
  // -------------------------------------------------------------------------
  console.log('\n[3] Launching Browser for UI Acceptance...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1200 } });
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') console.log('BROWSER ERROR:', msg.text());
  });

  console.log('Navigating to http://localhost:4173/#/app ...');
  await page.goto('http://localhost:4173/#/app', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1000);

  // Clear any existing localStorage projects to test fresh first launch
  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.goto('http://localhost:4173/#/app', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800);

  // A. Verify Validator Badge in header (removed in Phase 6b)
  console.log('\n[3A] Checking Validator Badge in Header...');
  const valBtnExists = await page.$('[data-testid="validator-btn"]');
  if (!valBtnExists) {
    console.log('✓ Validator badge button removed from header as required by Phase 6b.');
  } else {
    const badgeText = await page.evaluate(() => {
      const btn = document.querySelector('[data-testid="validator-btn"]');
      return btn ? btn.textContent.trim() : '';
    });
    console.log('Validator Badge Text:', badgeText);
    assert.strictEqual(badgeText.includes('✓') || !badgeText.match(/\b[1-9]\d*\b/), true, 'Validator badge must show 0 errors');
  }

  // B. Verify LeftRail has exactly 3 steps: 1 Editor, 2 Style, 3 Export (NO Review step)
  console.log('\n[3B] Checking LeftRail Workflow Steps...');
  const railSteps = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('aside[aria-label="Workflow Navigation Rail"] nav button'));
    return buttons.map(b => b.textContent.trim().replace(/\s+/g, ' '));
  });
  console.log('Rail steps found:', railSteps);
  assert.strictEqual(railSteps.length, 3, 'LeftRail must contain exactly 3 workflow steps');
  assert.ok(railSteps[0].includes('1.') && railSteps[0].includes('Editor'), 'Step 1 must be Editor');
  assert.ok(railSteps[1].includes('2.') && railSteps[1].includes('Style'), 'Step 2 must be Style');
  assert.ok(railSteps[2].includes('3.') && railSteps[2].includes('Export'), 'Step 3 must be Export');
  console.log('✓ LeftRail workflow steps correctly renumbered: 1 Editor, 2 Style, 3 Export.');

  // C. Test Validator Badge Click (removed in Phase 6b)
  console.log('\n[3C] Testing Validator Badge / Preflight Audit...');
  if (valBtnExists) {
    await page.click('button[data-testid="validator-btn"]');
    await page.waitForTimeout(400);

    const validatorPanelVisible = await page.evaluate(() => {
      const panel = document.querySelector('[data-testid="validator-panel"]');
      return panel && panel.offsetHeight > 0;
    });
    assert.strictEqual(validatorPanelVisible, true, 'Validator panel must open when badge is clicked');

    // Verify Close button closes it
    const closeBtn = await page.$('button[data-testid="validator-close-btn"]');
    assert.ok(closeBtn, 'Validator panel must have a close button');
    await closeBtn.click();
    await page.waitForTimeout(400);
  } else {
    console.log('✓ Validator UI moved to Export Modal preflight audit as required by Phase 6b.');
  }

  // D. Check Week 1 Section A1 Day Column Rendering:
  // Must render: Tuesday 10/11, Wednesday 11/11, Thursday 12/11
  console.log('\n[3D] Verifying Week 1 Section A1 Day Column Rendering...');
  // Select Week 1, Section A1
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

  const renderedDayRows = await page.evaluate(() => {
    const livePage = document.querySelector('.preview-container .schedule-page');
    if (!livePage) return [];
    const dayCells = Array.from(livePage.querySelectorAll('div[style*="border-right"]'))
      .filter(cell => cell.querySelector('[data-testid="day-name-text"]'));
    return dayCells.map(cell => {
      const name = cell.querySelector('[data-testid="day-name-text"]')?.textContent?.trim() || '';
      const date = cell.querySelector('[data-testid="day-date-text"]')?.textContent?.trim() || '';
      return { name, date };
    });
  });

  console.log('Rendered Day Rows for Week 1 Section A1:', renderedDayRows);
  assert.strictEqual(renderedDayRows.length, 3, 'Week 1 must render exactly 3 day rows (Tue, Wed, Thu)');
  assert.strictEqual(renderedDayRows[0].name, 'Tuesday', 'Row 1 name must be Tuesday');
  assert.strictEqual(renderedDayRows[0].date, '10/11', 'Row 1 date must be 10/11');
  assert.strictEqual(renderedDayRows[1].name, 'Wednesday', 'Row 2 name must be Wednesday');
  assert.strictEqual(renderedDayRows[1].date, '11/11', 'Row 2 date must be 11/11');
  assert.strictEqual(renderedDayRows[2].name, 'Thursday', 'Row 3 name must be Thursday');
  assert.strictEqual(renderedDayRows[2].date, '12/11', 'Row 3 date must be 12/11');
  console.log('✓ Week 1 section A1 renders: Tuesday 10/11, Wednesday 11/11, Thursday 12/11!');

  // E. Check Import > Load sample offers only "GIT (all 12 sections)"
  console.log('\n[3E] Checking Import Modal Load Sample Options...');
  await page.click('button:has-text("Import")');
  await page.waitForTimeout(400);

  const sampleOptions = await page.evaluate(() => {
    const select = document.querySelector('select.input-field');
    if (!select) return [];
    return Array.from(select.options).map(o => o.text);
  });
  console.log('Sample options in Import Modal:', sampleOptions);
  const sampleChoices = sampleOptions.filter(t => !t.includes('Load sample (creates new project)'));
  assert.strictEqual(sampleChoices.length, 1, 'Import > Load sample must offer only 1 sample');
  assert.strictEqual(sampleChoices[0], 'GIT (all 12 sections)', 'Sample must be "GIT (all 12 sections)"');

  // Close import modal
  await page.click('button[data-testid="import-modal-close-btn"]');
  await page.waitForTimeout(400);
  console.log('✓ Import modal offers only "GIT (all 12 sections)".');

  // F. Check Style panel contains dayDate role and allows editing visibility and size
  console.log('\n[3F] Checking Style Panel dayDate Role Customization...');
  await page.click('button[data-testid="rail-style-btn"]');
  await page.waitForTimeout(500);

  // Check Text Styles role options in Style Panel
  const roleOptions = await page.evaluate(() => {
    // Open textStyles accordion if closed
    const header = Array.from(document.querySelectorAll('span, button, div')).find(el => el.textContent?.trim() === 'Text Styles & Typography');
    if (header) header.click();

    const allSelects = Array.from(document.querySelectorAll('select'));
    for (const s of allSelects) {
      const opts = Array.from(s.options).map(o => o.value);
      if (opts.includes('dayDate')) return opts;
    }
    return [];
  });
  console.log('Found dayDate in style role options:', roleOptions.includes('dayDate'));
  assert.ok(roleOptions.includes('dayDate'), 'Style panel must offer dayDate role in dropdown');

  // Close Style Panel
  await page.click('button[data-testid="rail-style-btn"]');
  await page.waitForTimeout(400);

  // G. Mobile Navigation Check: No Review tab on phone viewport
  console.log('\n[3G] Checking Mobile Phone Viewport Navigation...');
  const phoneContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const phonePage = await phoneContext.newPage();
  await phonePage.goto('http://localhost:4173/#/app', { waitUntil: 'networkidle' });
  await phonePage.waitForTimeout(500);

  const mobileTabs = await phonePage.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('nav[aria-label="Mobile Bottom Navigation"] button'));
    return tabs.map(t => t.textContent.trim());
  });
  console.log('Mobile tabs found:', mobileTabs);
  assert.strictEqual(mobileTabs.some(t => t.trim().toLowerCase() === 'review'), false, 'Mobile nav must NOT contain Review tab');
  assert.ok(mobileTabs.some(t => t.includes('Preview')), 'Mobile nav has Preview tab');
  assert.ok(mobileTabs.some(t => t.includes('Editor') || t.includes('Data')), 'Mobile nav has Editor tab');
  assert.ok(mobileTabs.some(t => t.includes('Style')), 'Mobile nav has Style tab');
  assert.ok(mobileTabs.some(t => t.includes('Export')), 'Mobile nav has Export tab');
  console.log('✓ Mobile bottom navigation has no Review tab.');

  await browser.close();
  console.log('\n===========================================================');
  console.log('   ALL PHASE 6 ACCEPTANCE TESTS PASSED WITH 100% SUCCESS!  ');
  console.log('===========================================================');
})();