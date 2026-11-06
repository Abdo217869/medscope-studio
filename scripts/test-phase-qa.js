import assert from 'node:assert';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('D:/Medscope Site/node_modules/playwright-core');

import {
  cleanSubjectName,
  normalizeIncomingSubjects,
  coerceNumericSectionIds
} from '../src/utils/importUtils.js';
import { validateScheduleJson } from '../src/utils/schemaValidator.js';
import { validate, timeToMinutes, isValidTimeFormat } from '../src/utils/validatorEngine.js';
import { buildFilename, createPdfFromImages } from '../src/utils/exportPdf.js';
import { isValidDate, buildWeekSchedule } from '../src/utils/dataUtils.js';
import {
  getProjects,
  getActiveProjectId,
  STORAGE_KEY_PROJECTS,
  STORAGE_KEY_CORRUPTED_BACKUP
} from '../src/utils/projectsManager.js';

const BASE_URL = 'http://localhost:4173';

async function runQaTests() {
  console.log('=== RUNNING TARGETED QA & CODE REVIEW TEST SWEEP ===\n');
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`✓ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`✗ FAIL: ${name}\n  Error: ${err.message}`);
      failed++;
    }
  }

  // =========================================================================
  // 1. SUBJECTS WITH SEVERAL BRACKETS
  // =========================================================================
  console.log('\n--- Test Group 1: Subjects with several brackets ---');

  test('Multi-bracket: "(Anatomy) Mandible (part 1)"', () => {
    const proj = {
      module: { title: 'Test', term: '1st Term', weekdays: ['Sun'] },
      sections: [{ id: '1', letter: 'A', number: 1, practicalGroup: 1, label: 'Section 1' }],
      weeks: [{
        n: 1,
        sessions: [{
          date: '2026-11-08',
          type: 'prac',
          number: 1,
          subject: '(Anatomy) Mandible (part 1)',
          topics: [],
          scope: { sections: ['1'] },
          start: '08:00',
          end: '09:30'
        }]
      }]
    };
    const { normalizedProject, fixedCount } = normalizeIncomingSubjects(proj);
    assert.strictEqual(fixedCount, 1, 'Should fix 1 subject');
    const s = normalizedProject.weeks[0].sessions[0];
    assert.strictEqual(s.subject, 'Anatomy', 'Subject must be Anatomy');
    assert.strictEqual(s.topics[0], 'Mandible (part 1)', 'Topic must retain other bracket');
  });

  test('Multi-bracket: "Mandible (Head & Neck) [Part 1] (Anatomy)"', () => {
    const proj = {
      module: { title: 'Test', term: '1st Term', weekdays: ['Sun'] },
      sections: [{ id: '1', letter: 'A', number: 1, practicalGroup: 1, label: 'Section 1' }],
      weeks: [{
        n: 1,
        sessions: [{
          date: '2026-11-08',
          type: 'prac',
          number: 1,
          subject: 'Mandible (Head & Neck) [Part 1] (Anatomy)',
          topics: [],
          scope: { sections: ['1'] },
          start: '08:00',
          end: '09:30'
        }]
      }]
    };
    const { normalizedProject, fixedCount } = normalizeIncomingSubjects(proj);
    assert.strictEqual(fixedCount, 1, 'Should fix 1 subject');
    const s = normalizedProject.weeks[0].sessions[0];
    assert.strictEqual(s.subject, 'Anatomy');
    assert.strictEqual(s.topics[0], 'Mandible (Head & Neck) [Part 1]');
  });

  test('Multi-bracket with counter and punctuation: "Mandible ((Histology 3))."', () => {
    const proj = {
      module: { title: 'Test', term: '1st Term', weekdays: ['Sun'] },
      sections: [{ id: '1', letter: 'A', number: 1, practicalGroup: 1, label: 'Section 1' }],
      weeks: [{
        n: 1,
        sessions: [{
          date: '2026-11-08',
          type: 'prac',
          number: 1,
          subject: 'Mandible ((Histology 3)).',
          topics: [],
          scope: { sections: ['1'] },
          start: '08:00',
          end: '09:30'
        }]
      }]
    };
    const { normalizedProject, fixedCount } = normalizeIncomingSubjects(proj);
    assert.strictEqual(fixedCount, 1, 'Should fix 1 subject');
    const s = normalizedProject.weeks[0].sessions[0];
    assert.strictEqual(s.subject, 'Histology');
    assert.strictEqual(s.topics[0], 'Mandible');
  });

  // =========================================================================
  // 2. NUMERIC SECTION IDS CONVERSION ON IMPORT
  // =========================================================================
  console.log('\n--- Test Group 2: Numeric section IDs conversion on import ---');

  test('Numeric section IDs coerced to string in schema validator & import utils', () => {
    const importPayload = {
      module: { title: 'GIT', term: '1st Term', weekdays: ['Sun', 'Mon'] },
      sections: [
        { id: 1, letter: 'A', number: 1, practicalGroup: 1, label: 'Section 1' },
        { id: 2, letter: 'A', number: 2, practicalGroup: 2, label: 'Section 2' }
      ],
      subjects: [{ name: 'Anatomy', color: '#a01040' }],
      sessionTypes: [{ key: 'tut', label: 'Tut' }],
      weeks: [{
        n: 1,
        sessions: [{
          date: '2026-11-08',
          type: 'tut',
          number: 1,
          subject: 'Anatomy',
          topics: ['Introduction'],
          scope: { sections: [1, 2] },
          start: '08:00',
          end: '09:30',
          place: 'Hall 1',
          status: 'normal'
        }]
      }]
    };

    const res = validateScheduleJson(importPayload);
    assert.strictEqual(res.valid, true, 'Schema validation should accept coerced numeric IDs without error');
    assert.strictEqual(importPayload.sections[0].id, '1', 'Section id 1 should be converted to string "1"');
    assert.strictEqual(importPayload.sections[1].id, '2', 'Section id 2 should be converted to string "2"');
  });

  // =========================================================================
  // 3. INVALID OR INVERTED TIMES
  // =========================================================================
  console.log('\n--- Test Group 3: Invalid or inverted times ---');

  test('timeToMinutes strictly validates hours (0-23) and minutes (0-59)', () => {
    assert.strictEqual(timeToMinutes('08:30'), 510);
    assert.strictEqual(timeToMinutes('00:00'), 0);
    assert.strictEqual(timeToMinutes('23:59'), 1439);
    assert.ok(isNaN(timeToMinutes('25:00')), 'Hour > 23 must return NaN');
    assert.ok(isNaN(timeToMinutes('08:60')), 'Minute > 59 must return NaN');
    assert.ok(isNaN(timeToMinutes('-01:00')), 'Negative hour must return NaN');
    assert.ok(isNaN(timeToMinutes('abc')), 'Non-numeric string must return NaN');
    assert.ok(isNaN(timeToMinutes('')), 'Empty string must return NaN');
  });

  test('Validator detects invalid time formats and inverted intervals (end <= start)', () => {
    const invalidTimeProject = {
      module: { title: 'Test', term: '1st Term', weekdays: ['Sun'] },
      sections: [{ id: '1', letter: 'A', number: 1, practicalGroup: 1, label: 'Section 1' }],
      subjects: [{ name: 'Anatomy', color: '#a01040' }],
      sessionTypes: [{ key: 'tut', label: 'Tut' }],
      weeks: [{
        n: 1,
        sessions: [
          {
            date: '2026-11-08',
            type: 'tut',
            number: 1,
            subject: 'Anatomy',
            start: '10:00',
            end: '09:00', // Inverted
            place: 'Hall 1',
            scope: { sections: ['1'] }
          },
          {
            date: '2026-11-08',
            type: 'tut',
            number: 2,
            subject: 'Anatomy',
            start: '25:00', // Invalid hour
            end: '26:00',
            place: 'Hall 1',
            scope: { sections: ['1'] }
          }
        ]
      }]
    };

    const issues = validate(invalidTimeProject);
    const hasInverted = issues.some(i => i.message.includes('must be after start time'));
    const hasInvalidFormat = issues.some(i => i.message.includes('invalid'));
    assert.ok(hasInverted, 'Must flag inverted time interval');
    assert.ok(hasInvalidFormat, 'Must flag invalid time format');
  });

  // =========================================================================
  // 4. EMPTY FILE NAMES & EXPORT ERROR RESILIENCE
  // =========================================================================
  console.log('\n--- Test Group 4: Empty file names & export resilience ---');

  test('buildFilename falls back to timetable_export when stripped characters produce empty string', () => {
    const emptyFilename = buildFilename('???', { module: '???' }, 'pdf');
    assert.ok(emptyFilename.startsWith('timetable_export'), `Expected timetable_export fallback, got "${emptyFilename}"`);

    const illegalOnly = buildFilename(':*?"<>|/\\', {}, 'pdf');
    assert.ok(illegalOnly.startsWith('timetable_export'), `Expected timetable_export fallback, got "${illegalOnly}"`);
  });

  test('createPdfFromImages throws clear error when images array is empty or contains non-image data', () => {
    assert.throws(() => {
      createPdfFromImages([]);
    }, /No images provided|No valid image/);

    assert.throws(() => {
      createPdfFromImages(['not-a-data-url']);
    }, /No valid image/);
  });

  // =========================================================================
  // 5. INVALID DATES (NEVER DROP SILENTLY & VALIDATOR CHECKS)
  // =========================================================================
  console.log('\n--- Test Group 5: Invalid dates ---');

  test('isValidDate strictly checks calendar dates', () => {
    assert.strictEqual(isValidDate('2026-11-08'), true);
    assert.strictEqual(isValidDate('2026-02-28'), true);
    assert.strictEqual(isValidDate('2026-02-29'), false, '2026 is not a leap year');
    assert.strictEqual(isValidDate('2026-02-31'), false, 'Feb 31 does not exist');
    assert.strictEqual(isValidDate('not-a-date'), false);
    assert.strictEqual(isValidDate(''), false);
    assert.strictEqual(isValidDate(null), false);
  });

  test('Validator reports "date not valid" for malformed or non-existent dates', () => {
    const invalidDateProject = {
      module: { title: 'Test', term: '1st Term', weekdays: ['Sun'] },
      sections: [{ id: '1', letter: 'A', number: 1, practicalGroup: 1, label: 'Section 1' }],
      subjects: [{ name: 'Anatomy', color: '#a01040' }],
      sessionTypes: [{ key: 'tut', label: 'Tut' }],
      weeks: [{
        n: 1,
        sessions: [
          {
            date: '2026-02-31', // Invalid
            type: 'tut',
            number: 1,
            subject: 'Anatomy',
            start: '08:00',
            end: '09:30',
            place: 'Hall 1',
            scope: { sections: ['1'] }
          }
        ]
      }]
    };
    const issues = validate(invalidDateProject);
    const dateIssue = issues.find(i => i.rule === 'ERR_INVALID_DATE' || i.message.includes('date not valid'));
    assert.ok(dateIssue, 'Validator must emit "date not valid" for bad date');
  });

  test('buildWeekSchedule does NOT drop sessions with invalid date; keeps them in rows', () => {
    const moduleInfo = { title: 'Test', weekdays: ['Sun', 'Mon'] };
    const section = { id: '1', letter: 'A', number: 1, practicalGroup: 1 };
    const weekData = {
      n: 1,
      sessions: [
        {
          date: '2026-11-08',
          type: 'tut',
          number: 1,
          subject: 'Anatomy',
          scope: { sections: ['1'] }
        },
        {
          date: 'invalid-date-string',
          type: 'prac',
          number: 2,
          subject: 'Histology',
          scope: { sections: ['1'] }
        }
      ]
    };

    const scheduleRows = buildWeekSchedule(moduleInfo, section, weekData);
    const allSessionsInSchedule = scheduleRows.flatMap(r => r.sessions || []);
    assert.strictEqual(allSessionsInSchedule.length, 2, 'Both sessions must be kept, none silently dropped');
  });

  // =========================================================================
  // 6. E2E BROWSER TESTS WITH PLAYWRIGHT
  // =========================================================================
  console.log('\n--- Test Group 6: Browser E2E Tests ---');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    // E2E 1: Corrupted localStorage recovery & backup
    console.log('Running E2E: Corrupted localStorage recovery...');
    await page.goto(BASE_URL + '/#/');
    await page.evaluate(() => {
      localStorage.setItem('medscope_projects_library', '{{corrupted_json_syntax}}!!');
      window.location.hash = '#/app'; // Try navigating to app with corrupted data
    });
    await page.reload({ waitUntil: 'networkidle' });

    // Verify it did not crash to a blank page and fell back to home screen #/
    const currentHash = await page.evaluate(() => window.location.hash);
    const hasHero = await page.locator('text=Every module,').isVisible();
    const backupExists = await page.evaluate(() => !!localStorage.getItem('medscope_corrupted_backup'));
    assert.ok(hasHero, 'Home hero must be visible (no blank page crash)');
    assert.strictEqual(currentHash, '#/', 'Must fall back to Home screen #/');
    assert.ok(backupExists, 'Must keep a backup copy in medscope_corrupted_backup');
    console.log('✓ PASS: Corrupted localStorage recovered to Home with backup intact');
    passed++;

    // E2E 2: Editor visible "Needs fixing" row for invalid dates
    console.log('Running E2E: Editor "Needs fixing" display for invalid dates...');
    await page.evaluate(() => {
      const brokenSched = {
        module: { title: 'Date Test GIT', term: '1st Term', weekdays: ['Sun', 'Mon'] },
        sections: [{ id: '1', letter: 'A', number: 1, practicalGroup: 1, label: 'Section 1' }],
        subjects: [{ name: 'Anatomy', color: '#a01040' }],
        sessionTypes: [{ key: 'tut', label: 'Tut' }],
        weeks: [{
          n: 1,
          sessions: [{
            date: 'invalid-date',
            type: 'tut',
            number: 1,
            subject: 'Anatomy',
            topics: ['Bad Date Topic'],
            scope: { sections: ['1'] },
            start: '08:00',
            end: '09:30',
            place: 'Hall 1',
            status: 'normal'
          }]
        }]
      };
      const proj = {
        id: 'proj_invalid_date',
        name: 'Invalid Date Proj',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        schedule: brokenSched,
        theme: null
      };
      localStorage.setItem('medscope_projects_library', JSON.stringify([proj]));
      localStorage.setItem('medscope_active_project_id', 'proj_invalid_date');
      localStorage.setItem('medscope_schedule_data', JSON.stringify(brokenSched));
      window.location.hash = '#/app';
    });
    await page.reload({ waitUntil: 'networkidle' });

    // If on Home view, click "Open" on the Invalid Date Proj card
    const cardOpenBtn = page.locator('button:has-text("Open")').first();
    if (await cardOpenBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await cardOpenBtn.click();
      await page.waitForTimeout(500);
    }

    // Open Editor step (data panel in left rail)
    const editorStepBtn = page.locator('[data-testid="rail-data-btn"]');
    await editorStepBtn.waitFor({ timeout: 4000 });
    await editorStepBtn.click();
    await page.waitForTimeout(300);

    const needsFixingRow = page.locator('[data-testid="needs-fixing-row"]');
    await needsFixingRow.waitFor({ timeout: 4000 });
    assert.ok(await needsFixingRow.isVisible(), 'Editor must display visible "Needs fixing" row');
    console.log('✓ PASS: Visible "Needs fixing" row displayed in editor for invalid date');
    passed++;

    // E2E 3: Export checklist shows "date not valid"
    console.log('Running E2E: Export check list displays "date not valid"...');
    const exportBtn = page.locator('button:has-text("Export")').first();
    await exportBtn.click();
    const exportModal = page.locator('[data-testid="export-audit-issues"]');
    await exportModal.waitFor({ timeout: 4000 });
    const auditText = await exportModal.innerText();
    assert.ok(auditText.toLowerCase().includes('date not valid'), `Export checklist must say "date not valid", got: ${auditText}`);
    console.log('✓ PASS: Export check list displays "date not valid"');
    passed++;

  } finally {
    await browser.close();
  }

  console.log(`\n========================================`);
  console.log(`QA TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runQaTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
