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
  console.log('=== RUNNING PHASE 9 ACCEPTANCE TESTS ===\n');

  // 1. UNIT TESTS: Subject Cleaning & Color Normalization
  console.log('1. Testing Subject Names Cleaning...');
  assert.strictEqual(cleanSubjectName('Anatomy 1'), 'Anatomy');
  assert.strictEqual(cleanSubjectName('Histology 9'), 'Histology');
  assert.strictEqual(cleanSubjectName('Biochemistry 2'), 'Biochemistry');
  assert.strictEqual(cleanSubjectName('RADIOLOGY'), 'RADIOLOGY');
  assert.strictEqual(cleanSubjectName('Anatomy'), 'Anatomy');
  console.log('✓ Trailing counters stripped correctly from subject names');

  console.log('2. Testing Color Matching & Neutral Colors...');
  const sampleProject = {
    module: { title: 'Test Module', term: '1st Term', weekdays: ['Sun', 'Mon'] },
    sections: [{ id: '1', letter: 'A', number: 1, practicalGroup: 1, label: 'Group (A) Section 1' }],
    subjects: [
      { name: 'RADIOLOGY', color: '#111111' },
      { name: 'Unknown Subject 1', color: '#222222' }
    ],
    weeks: [
      {
        n: 1,
        sessions: [
          {
            date: '2026-11-08',
            type: 'tut',
            number: 7,
            subject: 'Anatomy 1',
            start: '08:00',
            end: '09:30',
            place: 'Hall 1',
            scope: { sections: ['1'] }
          },
          {
            date: '2026-11-09',
            type: 'prac',
            number: 2,
            subject: 'Histology 9',
            start: '09:30',
            end: '11:00',
            place: 'Lab 1',
            scope: { sections: ['1'] }
          }
        ]
      }
    ]
  };

  const { normalizedProject, cleanedCount } = normalizeIncomingSubjects(sampleProject);
  assert.strictEqual(cleanedCount, 3, 'Should clean 2 sessions + 1 subject definition');
  assert.strictEqual(normalizedProject.weeks[0].sessions[0].subject, 'Anatomy');
  assert.strictEqual(normalizedProject.weeks[0].sessions[1].subject, 'Histology');

  const radiologySub = normalizedProject.subjects.find(s => s.name.toLowerCase() === 'radiology');
  assert.ok(radiologySub, 'Radiology subject must exist');
  assert.strictEqual(radiologySub.color, '#d0c0f0', 'RADIOLOGY must receive standard Radiology color #d0c0f0');

  const unknownSub = normalizedProject.subjects.find(s => s.name.toLowerCase() === 'unknown subject');
  assert.ok(unknownSub, 'Unknown subject must exist with cleaned name');
  assert.strictEqual(unknownSub.color, '#d9d9d9', 'Unknown subject must receive neutral color #d9d9d9');

  console.log('✓ Subjects normalized: trailing counters stripped, colors matched, unknown set to neutral');

  // 3. BROWSER E2E TESTS
  console.log('3. Launching Browser for End-to-End Tests...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    // 3.1: Open base URL with saved projects -> Lands on Home (#/)
    console.log('3.1: Testing base URL landing on Home (#/)...');
    await page.goto(`${BASE_URL}/`);
    await page.waitForTimeout(1000);

    const hash = await page.evaluate(() => window.location.hash);
    assert.strictEqual(hash, '#/', 'Base URL must set URL hash to #/');

    const hero = await page.$('[data-testid="empty-state-hero"]');
    assert.ok(hero, 'Home hero must be visible on initial load');

    // Verify "Your Projects" list exists on Home
    const yourProjectsList = await page.$('[data-testid="your-projects-list"]');
    assert.ok(yourProjectsList, 'Your Projects list must be displayed on Home');

    // Verify prompt buttons exist
    const copyP1 = await page.$('[data-testid="copy-prompt-1-btn"]');
    const copyP2 = await page.$('[data-testid="copy-prompt-2-btn"]');
    assert.ok(copyP1 && copyP2, 'Prompt 1 and 2 copy buttons must be visible on Home');
    console.log('✓ Base URL lands on Home (#/) with hero, prompts, and Your Projects list');

    // 3.2: Click "Open" on a project card -> Navigates to Editor (#/app)
    console.log('3.2: Testing "Open" button navigates to Editor (#/app)...');
    const openBtn = await page.$('[data-testid^="open-project-"]');
    assert.ok(openBtn, 'Project card Open button must exist');
    await openBtn.click();
    await page.waitForTimeout(800);

    const editorHash = await page.evaluate(() => window.location.hash);
    assert.strictEqual(editorHash, '#/app', 'Opening a project must change URL hash to #/app');

    const heroAfterOpen = await page.$('[data-testid="empty-state-hero"]');
    assert.strictEqual(heroAfterOpen, null, 'Home screen must be hidden in editor view');

    const canvas = await page.$('[data-testid="schedule-page-canvas"], .schedule-page');
    assert.ok(canvas, 'Schedule canvas must be visible in editor view');
    console.log('✓ "Open" button successfully opens Editor (#/app)');

    // 3.3: Browser Back from Editor returns to Home (#/)
    console.log('3.3: Testing Browser Back returns to Home (#/)...');
    await page.goBack();
    await page.waitForTimeout(800);

    const backHash = await page.evaluate(() => window.location.hash);
    assert.strictEqual(backHash, '#/', 'Browser Back must return URL hash to #/');

    const heroAfterBack = await page.$('[data-testid="empty-state-hero"]');
    assert.ok(heroAfterBack, 'Home screen must be visible after browser Back');
    console.log('✓ Browser Back returns to Home screen (#/)');

    // 3.4: Brand Logo and CommandBar Home action return to Home (#/)
    console.log('3.4: Testing Brand Logo click returns to Home...');
    // Re-open editor
    const openBtn2 = await page.$('[data-testid^="open-project-"]');
    await openBtn2.click();
    await page.waitForTimeout(800);

    const brandBtn = await page.$('[data-testid="brand-home-btn"]');
    assert.ok(brandBtn, 'Brand Logo Home button must exist in header');
    await brandBtn.click();
    await page.waitForTimeout(800);

    const brandHash = await page.evaluate(() => window.location.hash);
    assert.strictEqual(brandHash, '#/', 'Brand logo click must set URL hash to #/');
    const heroAfterBrand = await page.$('[data-testid="empty-state-hero"]');
    assert.ok(heroAfterBrand, 'Home screen must be visible after Brand logo click');
    console.log('✓ Brand Logo returns to Home (#/)');

    // 3.5: Importing a JSON with "Anatomy 1" shows "Tut.7 > Anatomy"
    console.log('3.5: Testing Import JSON with "Anatomy 1" -> shows "Tut.7 > Anatomy"...');
    // Open import modal from Home
    const importBtn = await page.$('[data-testid="empty-import-btn"]');
    await importBtn.click();
    await page.waitForTimeout(500);

    const testImportJson = {
      module: { title: 'Gastrointestinal Tract', term: '1st Term', weekdays: ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu'] },
      sections: [
        { id: '1', letter: 'A', number: 1, practicalGroup: 1, label: 'Group (A) Section 1' }
      ],
      subjects: [
        { name: 'Anatomy 1', color: '#123456' }
      ],
      sessionTypes: [
        { key: 'tut', label: 'Tut.' },
        { key: 'prac', label: 'Practical.' },
        { key: 'lec', label: 'Lec.' }
      ],
      weeks: [
        {
          n: 1,
          sessions: [
            {
              date: '2026-11-07',
              type: 'tut',
              number: 7,
              subject: 'Anatomy 1',
              topics: ['Digestive Tract Overview'],
              start: '08:00',
              end: '09:30',
              place: 'Hall 4',
              scope: { sections: ['1'] },
              status: 'normal',
              note: ''
            }
          ]
        }
      ]
    };

    const textarea = await page.$('[data-testid="import-json-textarea"]');
    assert.ok(textarea, 'Import textarea must exist');
    await textarea.fill(JSON.stringify(testImportJson, null, 2));
    await page.waitForTimeout(600);

    // Verify summary shows "cleaned subject names"
    const cleanedSummary = await page.$('[data-testid="cleaned-subjects-line"], [data-testid="cleaned-subjects-merge-sessions"]');
    assert.ok(cleanedSummary, 'Cleaned subjects summary line must be visible');
    const cleanedText = await cleanedSummary.innerText();
    assert.match(cleanedText, /\d+\s+subject names?\s+cleaned/i, 'Summary must state subject names cleaned');
    console.log(`✓ Import summary preview displays: "${cleanedText}"`);

    // Apply import (auto-switches to editor #/app)
    page.once('dialog', async d => await d.accept());
    const applyBtn = await page.$('[data-testid="apply-import-btn"]');
    await applyBtn.click();
    await page.waitForTimeout(1000);

    const postImportHash = await page.evaluate(() => window.location.hash);
    assert.strictEqual(postImportHash, '#/app', 'Importing must automatically navigate to editor #/app');

    // Verify session rendered on canvas has "Tut.7 > Anatomy"
    const sessionTitle = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="schedule-page-canvas"], .schedule-page');
      return el ? el.innerText : '';
    });
    assert.ok(sessionTitle.includes('Tut.7') && sessionTitle.includes('Anatomy'), 'Title line must render Tut.7 and Anatomy');
    assert.ok(!sessionTitle.includes('Anatomy 1'), 'Title line must NOT render trailing counter Anatomy 1');
    console.log('✓ Rendered session shows "Tut.7 > Anatomy" with trailing counter stripped!');

    console.log('\n=== ALL PHASE 9 ACCEPTANCE TESTS PASSED SUCCESSFULLY! ===');
  } finally {
    await browser.close();
  }
}

runTests().catch(err => {
  console.error('\n❌ PHASE 9 TEST FAILED:', err);
  process.exit(1);
});
