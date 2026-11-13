import assert from 'node:assert';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('D:/Medscope Site/node_modules/playwright-core');

import { buildWeekSchedule, isValidDate, generateDateRange } from '../src/utils/dataUtils.js';
import { validateScheduleJson } from '../src/utils/schemaValidator.js';
import { validate } from '../src/utils/validatorEngine.js';
import { mergeSessionsProject, mergeProjects } from '../src/utils/importUtils.js';

const BASE_URL = 'http://localhost:4173';

function makeSection11Json({ withDays = true, startDate = '2026-11-10', includeOutOfRange = false, includeWeek2 = false } = {}) {
  const week1 = {
    n: 1,
    ...(withDays ? { days: ['2026-11-10', '2026-11-11', '2026-11-12'] } : {}),
    sessions: [
      {
        date: '2026-11-12',
        type: 'prac',
        number: 1,
        subject: 'Anatomy',
        topics: ['Oral Cavity & Pharynx'],
        scope: { sections: ['11'] },
        start: '08:00',
        end: '09:30',
        place: 'Morgue 1',
        status: 'normal',
        note: ''
      }
    ]
  };

  if (includeOutOfRange) {
    week1.sessions.push({
      date: '2026-11-14',
      type: 'tut',
      number: 2,
      subject: 'Histology',
      topics: ['Extra Makeup Tutorial'],
      scope: { sections: ['11'] },
      start: '10:00',
      end: '11:30',
      place: 'Hall 4',
      status: 'normal',
      note: ''
    });
  }

  const weeks = [week1];

  if (includeWeek2) {
    weeks.push({
      n: 2,
      sessions: [
        {
          date: '2026-11-15',
          type: 'tut',
          number: 3,
          subject: 'Physiology',
          topics: ['Swallowing & Esophagus'],
          scope: { sections: ['11'] },
          start: '08:00',
          end: '09:30',
          place: 'Hall 2',
          status: 'normal',
          note: ''
        }
      ]
    });
  }

  return {
    module: {
      title: 'Gastrointestinal Tract',
      term: '1st Term',
      ...(startDate ? { startDate } : {}),
      weekdays: ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu']
    },
    sections: [
      { id: '11', letter: 'D', number: 11, practicalGroup: 11, label: 'Group (D) Section 11' }
    ],
    subjects: [
      { name: 'Anatomy', color: '#a01040' },
      { name: 'Histology', color: '#f0b0d0' },
      { name: 'Physiology', color: '#90f0e0' }
    ],
    sessionTypes: [
      { key: 'tut', label: 'Tut.' },
      { key: 'prac', label: 'Practical.' },
      { key: 'lec', label: 'Lec.' }
    ],
    weeks
  };
}

async function runTests() {
  console.log('=== RUNNING PHASE 11 ACCEPTANCE TESTS ===\n');

  // -------------------------------------------------------------------------
  // 1. UNIT TESTS: Week "days" Rendering, Missing-days Fallbacks, Schema, Validator, Imports
  // -------------------------------------------------------------------------
  console.log('1. Testing Section 11 with explicit "days" = [Tue, Wed, Thu]...');
  const projWithDays = makeSection11Json({ withDays: true, startDate: undefined });
  const rowsWithDays = buildWeekSchedule(projWithDays.module, projWithDays.sections[0], projWithDays.weeks[0]);
  assert.strictEqual(rowsWithDays.length, 3, 'Week 1 with 3 days must render 3 rows');
  assert.strictEqual(rowsWithDays[0].weekdayShort, 'Tue');
  assert.strictEqual(rowsWithDays[0].dateStr, '2026-11-10');
  assert.strictEqual(rowsWithDays[0].isOff, true, 'Tuesday must be OFF');
  assert.strictEqual(rowsWithDays[1].weekdayShort, 'Wed');
  assert.strictEqual(rowsWithDays[1].dateStr, '2026-11-11');
  assert.strictEqual(rowsWithDays[1].isOff, true, 'Wednesday must be OFF');
  assert.strictEqual(rowsWithDays[2].weekdayShort, 'Thu');
  assert.strictEqual(rowsWithDays[2].dateStr, '2026-11-12');
  assert.strictEqual(rowsWithDays[2].isOff, false, 'Thursday must show sessions');
  assert.strictEqual(rowsWithDays[2].sessions.length, 1);
  console.log('✓ Section 11 with "days" renders Tue OFF, Wed OFF, Thu with sessions');

  console.log('2. Testing explicit "days" order preservation...');
  const customOrderRows = buildWeekSchedule(
    projWithDays.module,
    projWithDays.sections[0],
    { n: 1, days: ['2026-11-12', '2026-11-10'], sessions: projWithDays.weeks[0].sessions }
  );
  assert.deepStrictEqual(customOrderRows.map(r => r.dateStr), ['2026-11-12', '2026-11-10'], 'Exact "days" order must be preserved');
  console.log('✓ Explicit "days" renders exact array order');

  console.log('3. Testing Section 11 without "days" (module.startDate & Week 2 Sat start)...');
  const projNoDaysStart = makeSection11Json({ withDays: false, startDate: '2026-11-10', includeWeek2: true });
  const rowsW1Start = buildWeekSchedule(projNoDaysStart.module, projNoDaysStart.sections[0], projNoDaysStart.weeks[0]);
  assert.deepStrictEqual(rowsW1Start.map(r => r.dateStr), ['2026-11-10', '2026-11-11', '2026-11-12'], 'Week 1 without "days" must start from module.startDate');
  assert.strictEqual(rowsW1Start[0].isOff, true);
  assert.strictEqual(rowsW1Start[1].isOff, true);
  assert.strictEqual(rowsW1Start[2].isOff, false);

  const rowsW2 = buildWeekSchedule(projNoDaysStart.module, projNoDaysStart.sections[0], projNoDaysStart.weeks[1]);
  assert.deepStrictEqual(rowsW2.map(r => r.dateStr), ['2026-11-14', '2026-11-15'], 'Week 2 without "days" must start from first module weekday (Sat 2026-11-14)');
  assert.strictEqual(rowsW2[0].weekdayShort, 'Sat');
  assert.strictEqual(rowsW2[0].isOff, true, 'Sat before Sun session must render as OFF');
  assert.strictEqual(rowsW2[1].weekdayShort, 'Sun');
  assert.strictEqual(rowsW2[1].isOff, false);

  const projNoDaysNoStart = makeSection11Json({ withDays: false, startDate: null });
  const rowsW1Fallback = buildWeekSchedule(projNoDaysNoStart.module, projNoDaysNoStart.sections[0], projNoDaysNoStart.weeks[0]);
  assert.deepStrictEqual(rowsW1Fallback.map(r => r.dateStr), ['2026-11-12'], 'Week 1 without "days" or startDate must start from earliest session date');
  console.log('✓ Missing "days" fallback handles module.startDate (Week 1) and Saturday calendar start (Week 2)');

  console.log('4. Testing out-of-range session date handling (kept + flagged)...');
  const projOut = makeSection11Json({ withDays: true, includeOutOfRange: true });
  const rowsOut = buildWeekSchedule(projOut.module, projOut.sections[0], projOut.weeks[0]);
  const outDates = rowsOut.map(r => r.dateStr);
  assert.ok(outDates.includes('2026-11-14'), 'Out-of-range session date must NOT be dropped');
  const outIssues = validate(projOut);
  const outIssue = outIssues.find(i => i.message.includes('Week 1: date 2026-11-14 is not in the days shown'));
  assert.ok(outIssue, 'Validator must report "Week 1: date 2026-11-14 is not in the days shown"');
  console.log('✓ Out-of-range date kept in render rows and flagged by validator');

  console.log('5. Testing schemaValidator support for optional week.days...');
  assert.strictEqual(validateScheduleJson(projWithDays).valid, true, 'Schema validator accepts valid "days" array');
  const badDaysProj = JSON.parse(JSON.stringify(projWithDays));
  badDaysProj.weeks[0].days = ['2026-11-10', '2026-02-31'];
  const badRes = validateScheduleJson(badDaysProj);
  assert.strictEqual(badRes.valid, false, 'Schema validator rejects invalid date inside "days"');
  assert.ok(badRes.errors.some(e => e.path === 'weeks[0].days[1]'), 'Error path points to invalid element');
  const nonArrDaysProj = JSON.parse(JSON.stringify(projWithDays));
  nonArrDaysProj.weeks[0].days = '2026-11-10';
  assert.strictEqual(validateScheduleJson(nonArrDaysProj).valid, false, 'Schema validator rejects non-array "days"');
  console.log('✓ schemaValidator validates optional week.days cleanly');

  console.log('6. Testing import modes unioning/preserving "days"...');
  const incomingA = makeSection11Json({ withDays: true });
  incomingA.weeks[0].days = ['2026-11-10', '2026-11-11'];
  const incomingB = makeSection11Json({ withDays: true });
  incomingB.weeks[0].days = ['2026-11-11', '2026-11-12'];

  const { mergedProject: msMerged } = mergeSessionsProject(incomingA, incomingB);
  assert.deepStrictEqual(msMerged.weeks[0].days, ['2026-11-10', '2026-11-11', '2026-11-12'], 'merge_sessions unions week.days');

  const { mergedProject: rwMerged } = mergeProjects(incomingA, incomingB);
  assert.deepStrictEqual(rwMerged.weeks[0].days, ['2026-11-10', '2026-11-11', '2026-11-12'], 'Replace weeks mode unions week.days');

  const oldA = makeSection11Json({ withDays: false });
  const oldB = makeSection11Json({ withDays: false });
  const { mergedProject: oldMerged } = mergeSessionsProject(oldA, oldB);
  assert.strictEqual(oldMerged.weeks[0].days, undefined, 'Old projects without "days" are never modified with synthetic "days"');
  console.log('✓ All merge modes union "days" and preserve legacy files');

  assert.deepStrictEqual(generateDateRange('2026-11-09', '2026-11-12'), ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12']);

  // -------------------------------------------------------------------------
  // 2. BROWSER END-TO-END TESTS
  // -------------------------------------------------------------------------
  console.log('\n7. Launching Browser for E2E Tests...');
  const browser = await chromium.launch({ headless: true });

  try {
    // --- E2E A: Section 11 with days, without days, out-of-range + Export check, Editor control ---
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    console.log('7.1: Testing E2E Import Section 11 WITH "days" = Tue, Wed, Thu...');
    await page.goto(`${BASE_URL}/#/`, { waitUntil: 'networkidle' });
    await page.evaluate(() => localStorage.clear());
    await page.goto(`${BASE_URL}/#/`, { waitUntil: 'networkidle' });

    await page.click('[data-testid="empty-import-btn"]');
    await page.waitForSelector('[data-testid="import-json-textarea"]');
    await page.fill('[data-testid="import-json-textarea"]', JSON.stringify(makeSection11Json({ withDays: true, startDate: null }), null, 2));
    await page.click('input[value="replace"]');
    page.once('dialog', d => d.accept());
    await page.click('[data-testid="apply-import-btn"]');
    await page.waitForSelector('.schedule-page');
    await page.waitForTimeout(400);

    const dayRows1 = await page.evaluate(() => {
      const cells = Array.from(document.querySelectorAll('.preview-container .schedule-page [data-testid="day-name-text"]'));
      return cells.map((el) => {
        const parentRow = el.closest('div[style*="border-bottom"]');
        const date = parentRow?.querySelector('[data-testid="day-date-text"]')?.textContent?.trim() || '';
        const text = parentRow?.innerText || '';
        return { name: el.textContent.trim(), date, isOff: text.includes('OFF') };
      });
    });
    assert.strictEqual(dayRows1.length, 3, 'Should render 3 day rows');
    assert.strictEqual(dayRows1[0].name, 'Tuesday');
    assert.strictEqual(dayRows1[0].isOff, true);
    assert.strictEqual(dayRows1[1].name, 'Wednesday');
    assert.strictEqual(dayRows1[1].isOff, true);
    assert.strictEqual(dayRows1[2].name, 'Thursday');
    assert.strictEqual(dayRows1[2].isOff, false);
    console.log('✓ Browser renders Tue OFF, Wed OFF, Thu with sessions');

    console.log('7.2: Testing E2E Import WITHOUT "days" (module.startDate + Week 2 Sat start)...');
    await page.click('button:has-text("Import")');
    await page.waitForSelector('[data-testid="import-json-textarea"]');
    await page.fill('[data-testid="import-json-textarea"]', JSON.stringify(makeSection11Json({ withDays: false, startDate: '2026-11-10', includeWeek2: true }), null, 2));
    await page.click('input[value="replace"]');
    page.once('dialog', d => d.accept());
    await page.click('[data-testid="apply-import-btn"]');
    await page.waitForTimeout(400);

    const w1NoDays = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.preview-container .schedule-page [data-testid="day-name-text"]')).map(el => el.textContent.trim());
    });
    assert.deepStrictEqual(w1NoDays, ['Tuesday', 'Wednesday', 'Thursday'], 'Week 1 without "days" must start at module.startDate');

    await page.selectOption('[data-testid="week-select"]', '2');
    await page.waitForTimeout(300);
    const w2NoDays = await page.evaluate(() => {
      const cells = Array.from(document.querySelectorAll('.preview-container .schedule-page [data-testid="day-name-text"]'));
      return cells.map((el) => {
        const parentRow = el.closest('div[style*="border-bottom"]');
        return { name: el.textContent.trim(), isOff: (parentRow?.innerText || '').includes('OFF') };
      });
    });
    assert.strictEqual(w2NoDays[0].name, 'Saturday');
    assert.strictEqual(w2NoDays[0].isOff, true, 'Week 2 without "days" starts on Saturday OFF');
    assert.strictEqual(w2NoDays[1].name, 'Sunday');
    console.log('✓ Browser Week 1 starts at module.startDate and Week 2 starts at Sat OFF');

    console.log('7.3: Testing out-of-range session date on page AND in Export check...');
    await page.click('button:has-text("Import")');
    await page.waitForSelector('[data-testid="import-json-textarea"]');
    await page.fill('[data-testid="import-json-textarea"]', JSON.stringify(makeSection11Json({ withDays: true, includeOutOfRange: true }), null, 2));
    await page.click('input[value="replace"]');
    page.once('dialog', d => d.accept());
    await page.click('[data-testid="apply-import-btn"]');
    await page.waitForTimeout(400);

    const pageTextWithOut = await page.locator('.preview-container .schedule-page').innerText();
    assert.ok(pageTextWithOut.includes('Extra Makeup Tutorial'), 'Out-of-range session must remain visible on the page');

    await page.click('[data-testid="export-options-btn"]');
    await page.waitForSelector('[data-testid="export-audit-issues"]');
    const auditText = await page.locator('[data-testid="export-audit-issues"]').innerText();
    assert.ok(auditText.includes('Week 1: date 2026-11-14 is not in the days shown'), `Export check must list out-of-range warning, got: ${auditText}`);
    await page.click('button:has-text("Cancel")');
    await page.waitForTimeout(250);
    console.log('✓ Out-of-range session shown on canvas AND flagged in Export check');

    console.log('7.4: Testing Editor "Days shown" control without deleting sessions...');
    await page.click('[data-testid="rail-data-btn"]');
    await page.waitForSelector('[data-testid="days-shown-control"]');
    await page.click('[data-testid="day-chip-2026-11-14"]');
    await page.waitForTimeout(300);

    const editedDays = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.preview-container .schedule-page [data-testid="day-name-text"]')).map(el => el.textContent.trim());
    });
    assert.ok(editedDays.includes('Saturday') && editedDays.includes('Thursday'), `Expected Saturday & Thursday after chip toggle, got ${editedDays}`);
    const pageAfterEdit = await page.locator('.preview-container .schedule-page').innerText();
    assert.ok(pageAfterEdit.includes('Extra Makeup Tutorial') && pageAfterEdit.includes('Oral Cavity'), 'Editing Days shown must NEVER delete sessions');
    console.log('✓ Editor "Days shown" updates week days inclusively without deleting sessions');

    await context.close();

    // --- E2E B: Home page scroll across 1440x900, 1280x720, and 390x844 phone ---
    console.log('7.5: Testing Home page vertical scroll & fixed chrome across 1440x900, 1280x720, and 390px...');
    const seedProjects = Array.from({ length: 4 }, (_, idx) => ({
      id: `proj_scroll_${idx + 1}`,
      name: `Scroll Test Module ${idx + 1}`,
      createdAt: Date.now() - idx * 60000,
      updatedAt: Date.now() - idx * 30000,
      schedule: makeSection11Json({ withDays: true }),
      theme: null
    }));

    for (const vp of [
      { name: 'Desktop 1440x900', width: 1440, height: 900, isMobile: false },
      { name: 'Laptop 1280x720', width: 1280, height: 720, isMobile: false },
      { name: 'Phone 390x844', width: 390, height: 844, isMobile: true }
    ]) {
      const vpCtx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        ...(vp.isMobile ? { isMobile: true, hasTouch: true } : {})
      });
      const vpPage = await vpCtx.newPage();
      await vpPage.goto(`${BASE_URL}/#/`, { waitUntil: 'networkidle' });
      await vpPage.evaluate((projs) => {
        localStorage.setItem('medscope_projects_library', JSON.stringify(projs));
        localStorage.setItem('medscope_active_project_id', projs[0].id);
        window.location.hash = '#/';
      }, seedProjects);
      await vpPage.reload({ waitUntil: 'networkidle' });
      await vpPage.waitForSelector('[data-testid="empty-state-hero"]');
      await vpPage.waitForTimeout(300);

      // Verify Home scroll container styling & stationary chrome
      const beforeScroll = await vpPage.evaluate(() => {
        const hero = document.querySelector('[data-testid="empty-state-hero"]');
        const header = document.querySelector('header');
        const rail = document.querySelector('aside[aria-label="Workflow Navigation Rail"]');
        const aurora = document.querySelector('.aurora-layer');
        const heroCs = getComputedStyle(hero);
        return {
          overflowY: heroCs.overflowY,
          heroRect: hero.getBoundingClientRect().toJSON(),
          scrollHeight: hero.scrollHeight,
          clientHeight: hero.clientHeight,
          headerTop: header ? header.getBoundingClientRect().top : null,
          railLeft: rail ? rail.getBoundingClientRect().left : null,
          auroraTop: aurora ? aurora.getBoundingClientRect().top : null
        };
      });

      assert.ok(beforeScroll.overflowY === 'auto' || beforeScroll.overflowY === 'scroll', `${vp.name}: Home container must have overflow-y: auto (got ${beforeScroll.overflowY})`);
      assert.ok(beforeScroll.scrollHeight > beforeScroll.clientHeight, `${vp.name}: Home container should be scrollable (${beforeScroll.scrollHeight} > ${beforeScroll.clientHeight})`);

      // Scroll to bottom and click last project's Open button
      const lastOpenBtn = vpPage.locator('[data-testid="open-project-proj_scroll_4"]');
      await lastOpenBtn.scrollIntoViewIfNeeded();
      await vpPage.waitForTimeout(200);

      // Also scroll all the way down to make sure footer & bottom padding clear any fixed bar
      await vpPage.evaluate(() => {
        const hero = document.querySelector('[data-testid="empty-state-hero"]');
        hero.scrollTop = hero.scrollHeight;
      });
      await vpPage.waitForTimeout(200);

      const afterScroll = await vpPage.evaluate(() => {
        const hero = document.querySelector('[data-testid="empty-state-hero"]');
        const header = document.querySelector('header');
        const rail = document.querySelector('aside[aria-label="Workflow Navigation Rail"]');
        const aurora = document.querySelector('.aurora-layer');
        const lastBtn = document.querySelector('[data-testid="open-project-proj_scroll_4"]');
        const nav = document.querySelector('nav[aria-label="Mobile Bottom Navigation"]');
        const footer = document.querySelector('[data-testid="empty-state-hero"] footer');
        return {
          scrollTop: hero.scrollTop,
          headerTop: header ? header.getBoundingClientRect().top : null,
          railLeft: rail ? rail.getBoundingClientRect().left : null,
          auroraTop: aurora ? aurora.getBoundingClientRect().top : null,
          btnRect: lastBtn.getBoundingClientRect().toJSON(),
          footerRect: footer.getBoundingClientRect().toJSON(),
          navTop: nav && getComputedStyle(nav).display !== 'none' ? nav.getBoundingClientRect().top : window.innerHeight
        };
      });

      assert.ok(afterScroll.scrollTop > 0, `${vp.name}: Hero must actually scroll down`);
      assert.strictEqual(afterScroll.headerTop, beforeScroll.headerTop, `${vp.name}: Header must stay in place when scrolling`);
      assert.strictEqual(afterScroll.auroraTop, beforeScroll.auroraTop, `${vp.name}: Aurora must stay in place when scrolling`);
      if (!vp.isMobile) {
        assert.strictEqual(afterScroll.railLeft, beforeScroll.railLeft, `${vp.name}: Left rail must stay in place`);
      }
      assert.ok(afterScroll.btnRect.bottom <= afterScroll.navTop + 1, `${vp.name}: Last Open button must be above bottom viewport/nav (${afterScroll.btnRect.bottom} <= ${afterScroll.navTop})`);
      assert.ok(afterScroll.footerRect.bottom <= afterScroll.navTop + 1, `${vp.name}: Footer must be reachable above bottom viewport/nav (${afterScroll.footerRect.bottom} <= ${afterScroll.navTop})`);

      // Scroll back slightly if needed & click Open on the 4th project
      await lastOpenBtn.scrollIntoViewIfNeeded();
      await lastOpenBtn.click();
      await vpPage.waitForSelector('.schedule-page');
      const openedHash = await vpPage.evaluate(() => window.location.hash);
      assert.strictEqual(openedHash, '#/app', `${vp.name}: Clicking Open after scrolling must open editor`);
      console.log(`✓ ${vp.name}: scrolled to "Your Projects", stationary chrome verified, project opened cleanly`);

      await vpCtx.close();
    }

    console.log('\n=== ALL PHASE 11 ACCEPTANCE TESTS PASSED SUCCESSFULLY! ===');
  } finally {
    await browser.close();
  }
}

runTests().catch(err => {
  console.error('\n❌ PHASE 11 TEST FAILED:', err);
  process.exit(1);
});
