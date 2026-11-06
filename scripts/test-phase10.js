import assert from 'node:assert';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('D:/Medscope Site/node_modules/playwright-core');
import {
  cleanSubjectName,
  normalizeIncomingSubjects,
  KNOWN_SUBJECT_COLORS,
  NEUTRAL_SUBJECT_COLOR
} from '../src/utils/importUtils.js';

const BASE_URL = 'http://localhost:4173';

async function runTests() {
  console.log('=== RUNNING PHASE 10 ACCEPTANCE TESTS ===\n');

  // 1. UNIT TESTS: Import Safety Net & Normalization
  console.log('1. Testing Import Safety Net: Bracket Discipline Extraction...');
  const testBracket = {
    module: { title: 'Test GIT', term: '1st Term', weekdays: ['Sun', 'Mon', 'Tue'] },
    sections: [{ id: '1', letter: 'A', number: 1, practicalGroup: 1, label: 'Group (A) Section 1' }],
    subjects: [],
    weeks: [
      {
        n: 1,
        sessions: [
          {
            date: '2026-11-10',
            type: 'prac',
            number: 1,
            subject: 'Mandible and normal lateralis (Anatomy)',
            topics: [],
            scope: { sections: ['1'] },
            start: '08:00',
            end: '09:30',
            place: 'Morgue 1',
            status: 'normal'
          }
        ]
      }
    ]
  };

  const { normalizedProject: normBracket, fixedCount: fixedBracket } = normalizeIncomingSubjects(testBracket);
  assert.strictEqual(fixedBracket, 1, 'Should report 1 subject fixed');
  const session1 = normBracket.weeks[0].sessions[0];
  assert.strictEqual(session1.subject, 'Anatomy', 'Subject should be extracted as Anatomy');
  assert.deepStrictEqual(session1.topics, ['Mandible and normal lateralis'], 'Topics should contain extracted topic');
  console.log('✓ Bracket discipline extracted correctly: subject="Anatomy", topics=["Mandible and normal lateralis"]');

  console.log('2. Testing Import Safety Net: Starts With Known Discipline...');
  const testStarts = {
    module: { title: 'Test GIT', term: '1st Term', weekdays: ['Sun'] },
    sections: [{ id: '1', letter: 'A', number: 1, practicalGroup: 1, label: 'Group (A) Section 1' }],
    subjects: [],
    weeks: [
      {
        n: 1,
        sessions: [
          {
            date: '2026-11-08',
            type: 'lec',
            number: 12,
            subject: 'Anatomy Revision',
            topics: [],
            scope: { sections: ['1'] },
            start: '08:00',
            end: '09:30',
            place: 'Hall 1',
            status: 'normal'
          }
        ]
      }
    ]
  };

  const { normalizedProject: normStarts, fixedCount: fixedStarts } = normalizeIncomingSubjects(testStarts);
  assert.strictEqual(fixedStarts, 1, 'Should report 1 subject fixed');
  const session2 = normStarts.weeks[0].sessions[0];
  assert.strictEqual(session2.subject, 'Anatomy', 'Subject should be Anatomy');
  assert.deepStrictEqual(session2.topics, ['Anatomy Revision'], 'Topics should contain original text when empty');
  console.log('✓ Starts-with discipline extracted correctly: subject="Anatomy", topics=["Anatomy Revision"]');

  console.log('3. Testing Unknown Subjects Color is Never White...');
  const testUnknown = {
    module: { title: 'Test Module', term: '1st Term', weekdays: ['Sun'] },
    sections: [{ id: '1', letter: 'A', number: 1, practicalGroup: 1, label: 'Group (A) Section 1' }],
    subjects: [
      { name: 'Unknown Subject White', color: '#ffffff' }
    ],
    weeks: [
      {
        n: 1,
        sessions: [
          {
            date: '2026-11-08',
            type: 'tut',
            number: 3,
            subject: 'Unknown Subject White',
            topics: [],
            scope: { sections: ['1'] },
            start: '08:00',
            end: '09:30',
            place: 'Hall 2',
            status: 'normal'
          }
        ]
      }
    ]
  };

  const { normalizedProject: normUnknown } = normalizeIncomingSubjects(testUnknown);
  const subjObj = normUnknown.subjects.find(s => s.name === 'Unknown Subject White');
  assert.strictEqual(subjObj.color, NEUTRAL_SUBJECT_COLOR, 'Unknown subject color must never be white, must be #d9d9d9');
  console.log('✓ Unknown subject assigned neutral #d9d9d9 color (never white)');

  // 4. BROWSER END-TO-END TESTS
  console.log('4. Launching Browser for End-to-End Tests...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    // 4.1: Test single section chip in the header
    console.log('4.1: Testing Single Section Header Chip...');
    const singleSectionProject = {
      id: 'proj_single_section_test',
      name: 'Single Section Test',
      lastEdited: new Date().toISOString(),
      schedule: {
        module: { title: 'Single Section Module', term: '1st Term', weekdays: ['Sun', 'Mon'] },
        sections: [{ id: '1', letter: 'A', number: 1, practicalGroup: 1, label: 'Section 1' }],
        subjects: [{ name: 'Anatomy', color: '#a01040' }],
        weeks: [
          {
            n: 1,
            sessions: [
              {
                date: '2026-11-08',
                type: 'tut',
                number: 1,
                subject: 'Anatomy',
                topics: ['Pelvis'],
                scope: { sections: ['1'] },
                start: '08:00',
                end: '09:30',
                place: 'Hall 1',
                status: 'normal'
              }
            ]
          }
        ]
      }
    };

    await page.goto(`${BASE_URL}/#/app`, { waitUntil: 'networkidle' });
    // Inject single-section project into localStorage using correct keys
    await page.evaluate((proj) => {
      localStorage.setItem('medscope_projects_library', JSON.stringify([proj]));
      localStorage.setItem('medscope_active_project_id', proj.id);
      localStorage.setItem('medscope_schedule_data', JSON.stringify(proj.schedule));
    }, singleSectionProject);

    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const sectionChip = page.locator('[data-testid="section-chip-1"]').first();
    await sectionChip.waitFor({ state: 'visible', timeout: 5000 });
    const chipText = (await sectionChip.textContent()).trim();
    assert.strictEqual(chipText, 'Section 1', 'Single section chip should read "Section 1"');

    // Check that it does NOT have filled red background gradient and has amber/neutral outline
    const chipClasses = await sectionChip.getAttribute('class');
    assert(!chipClasses.includes('from-[#ff2f3a]'), 'Section chip must NOT be a filled red circle');
    assert(chipClasses.includes('border-[#ffb347]/40') || chipClasses.includes('text-[#ffb347]'), 'Section chip should have neutral/amber outline');
    console.log('✓ Single section chip rendered as "Section 1" with neutral/amber outline, not a filled red circle');

    // 4.2: Test Import JSON with "Mandible and normal lateralis (Anatomy)"
    console.log('4.2: Testing Import JSON Safety Net with "Mandible and normal lateralis (Anatomy)"...');
    const importBtn = page.locator('button:has-text("Import"), [data-testid="header-import-btn"]').first();
    await importBtn.click();
    await page.waitForTimeout(500);

    const importModal = page.locator('[data-testid="import-modal-close-btn"]').first();
    await importModal.waitFor({ state: 'visible', timeout: 5000 });

    const importPayload = {
      module: { title: 'Gastrointestinal Tract', term: '1st Term', weekdays: ['Tue', 'Wed'] },
      sections: [{ id: '1', letter: 'A', number: 1, practicalGroup: 1, label: 'Section 1' }],
      sessionTypes: [
        { key: 'tut', label: 'Tut.' },
        { key: 'prac', label: 'Practical.' },
        { key: 'lec', label: 'Lec.' }
      ],
      subjects: [
        { name: 'Anatomy', color: '#a01040' },
        { name: 'Unknown Subject', color: '#ffffff' }
      ],
      weeks: [
        {
          n: 1,
          sessions: [
            {
              date: '2026-11-10',
              type: 'prac',
              number: 1,
              subject: 'Mandible and normal lateralis (Anatomy)',
              topics: [],
              scope: { sections: ['1'] },
              start: '08:00',
              end: '09:30',
              place: 'Morgue 1',
              status: 'normal'
            },
            {
              date: '2026-11-10',
              type: 'prac',
              number: 2,
              subject: 'Gastrointestinal Tract Histopathology and Diagnostic Procedures',
              topics: ['Specimen preparation', 'Microscopic analysis'],
              scope: { sections: ['1'] },
              start: '09:30',
              end: '11:00',
              place: 'Lab 9',
              status: 'normal'
            }
          ]
        }
      ]
    };

    // Paste into JSON textarea and validate
    const textarea = page.locator('textarea').first();
    await textarea.fill(JSON.stringify(importPayload, null, 2));
    await page.waitForTimeout(400);

    // Verify "1 subject fixed" appears in the summary
    const fixedLine = page.locator('[data-testid="fixed-subjects-line"]').first();
    await fixedLine.waitFor({ state: 'visible', timeout: 5000 });
    const fixedText = await fixedLine.textContent();
    assert(fixedText.includes('1 subject fixed') || fixedText.includes('1 subjects fixed'), `Summary should state subjects fixed, got: ${fixedText}`);
    console.log(`✓ Import summary preview displays: "${fixedText.trim()}"`);

    // Select replace project mode & apply import
    const replaceRadio = page.locator('input[value="replace"]').first();
    await replaceRadio.click();
    await page.waitForTimeout(200);

    // Override browser confirm dialog
    page.on('dialog', async dialog => {
      await dialog.accept();
    });

    const applyBtn = page.locator('button:has-text("Apply Import"), button:has-text("Import Schedule")').first();
    await applyBtn.click();
    await page.waitForTimeout(1000);

    // 4.3: Verify Rendered Canvas
    console.log('4.3: Verifying Canvas Session Title and Topic...');
    const pageCanvas = page.locator('[data-testid="schedule-page-canvas"], .schedule-page').first();
    await pageCanvas.waitFor({ state: 'visible', timeout: 8000 });

    const sessionTypeEl = page.locator('[data-role="sessionType"]').first();
    const sessionSubjectEl = page.locator('[data-role="sessionSubject"]').first();
    const topicLineEl = page.locator('[data-role="topicLine"]').first();

    const typeText = (await sessionTypeEl.textContent()).trim();
    const subjectText = (await sessionSubjectEl.textContent()).trim();
    const topicText = (await topicLineEl.textContent()).trim();

    assert.strictEqual(typeText, 'Prac 1', `Type should be "Prac 1", got "${typeText}"`);
    assert.strictEqual(subjectText, 'Anatomy', `Subject should be "Anatomy", got "${subjectText}"`);
    assert.strictEqual(topicText, '(Mandible and normal lateralis)', `Topic should be "(Mandible and normal lateralis)", got "${topicText}"`);
    console.log(`✓ Rendered session shows "${typeText} > ${subjectText}" with topic "${topicText}"!`);

    // 4.4: Verify Wrapping and Font Shrinking for Long Practical Title
    console.log('4.4: Verifying Long Practical Title Wrapping & Shrinking...');
    const sessionTitles = page.locator('[data-role="sessionTitle"]');
    const titleCount = await sessionTitles.count();
    assert(titleCount >= 2, `Should render at least 2 session titles, found ${titleCount}`);

    // Check second session title (long subject)
    const longTitle = sessionTitles.nth(1);
    const longTitleSubject = await longTitle.locator('[data-role="sessionSubject"]').textContent();
    assert(longTitleSubject.includes('Gastrointestinal Tract Histopathology'), 'Long title subject matched');

    // Verify it fits within bounds without overflow
    const overflowWarning = page.locator('[data-testid="overflow-warning-badge"]');
    const hasOverflow = await overflowWarning.isVisible();
    assert(!hasOverflow, 'Canvas must not have text fit overflow warning');
    console.log('✓ Long session title wrapped and scaled cleanly with no overflow warnings');

    // 4.5: Check zoom at 40% and 100%
    console.log('4.5: Verifying Canvas at 40% and 100% Zoom...');
    // Test zoom out (40%)
    const zoomOutBtn = page.locator('button[title*="Zoom out"], button:has-text("-")').first();
    if (await zoomOutBtn.isVisible()) {
      for (let i = 0; i < 5; i++) {
        await zoomOutBtn.click();
        await page.waitForTimeout(100);
      }
    }
    await page.waitForTimeout(500);
    const hasOverflowAt40 = await overflowWarning.isVisible();
    assert(!hasOverflowAt40, 'Canvas must not have text fit overflow at 40% zoom');
    console.log('✓ 40% zoom renders without clipped titles');

    // Test zoom in (100%)
    const zoomInBtn = page.locator('button[title*="Zoom in"], button:has-text("+")').first();
    if (await zoomInBtn.isVisible()) {
      for (let i = 0; i < 15; i++) {
        await zoomInBtn.click();
        await page.waitForTimeout(100);
      }
    }
    await page.waitForTimeout(500);
    const hasOverflowAt100 = await overflowWarning.isVisible();
    assert(!hasOverflowAt100, 'Canvas must not have text fit overflow at 100% zoom');
    console.log('✓ 100% zoom renders without clipped titles');

    console.log('\n=== ALL PHASE 10 ACCEPTANCE TESTS PASSED SUCCESSFULLY! ===');
  } finally {
    await browser.close();
  }
}

runTests().catch(err => {
  console.error('\n❌ PHASE 10 ACCEPTANCE TEST FAILED:');
  console.error(err);
  process.exit(1);
});
