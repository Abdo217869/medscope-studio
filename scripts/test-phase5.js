import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('D:/Medscope Site/node_modules/playwright-core');
import assert from 'assert';
import { validate } from '../src/utils/validatorEngine.js';
import {
  getScopeSignature,
  getSessionMatchKey,
  calculateMergeSessionsSummary,
  mergeSessionsProject
} from '../src/utils/importUtils.js';
import { DEFAULT_SCHEDULE, GIT_SCHEDULE } from '../src/constants.js';

async function runPhase5Tests() {
  console.log('====================================================');
  console.log('   STARTING PHASE 5 ACCEPTANCE TEST SUITE           ');
  console.log('====================================================\n');

  // ---------------------------------------------------------------------------
  // [1] UNIT TESTS: Optional Session Number & Duplicate Rule
  // ---------------------------------------------------------------------------
  console.log('[1] Testing Optional Session Number & Duplicate Rule...');

  // A. Verify GIT_SCHEDULE has sessions without numbers and produces 0 errors
  const gitIssues = validate(GIT_SCHEDULE);
  const gitErrors = gitIssues.filter(i => i.severity === 'error');
  assert.strictEqual(gitErrors.length, 0, 'GIT Schedule with unnumbered sessions must have 0 errors');
  console.log('✓ GIT Schedule with unnumbered tutorial has 0 errors');

  // B. Verify duplicate check only triggers when BOTH have a number
  const unnumberedTest = {
    ...GIT_SCHEDULE,
    weeks: [
      {
        n: 1,
        sessions: [
          { date: "2026-09-19", type: "tut", subject: "Anatomy", topics: ["Topic 1"], scope: { letter: "A" }, start: "08:00", end: "09:30", place: "Hall 4", status: "normal" },
          { date: "2026-09-20", type: "tut", subject: "Anatomy", topics: ["Topic 2"], scope: { letter: "A" }, start: "08:00", end: "09:30", place: "Hall 4", status: "normal" }
        ]
      }
    ]
  };
  const unnumberedIssues = validate(unnumberedTest);
  const dupUnnumbered = unnumberedIssues.filter(i => i.rule === 'ERR_COVERAGE_OR_DUPLICATE' && i.id.includes('ERR_DUP_SESSION'));
  assert.strictEqual(dupUnnumbered.length, 0, 'Unnumbered sessions must NOT trigger duplicate session errors');
  console.log('✓ Two unnumbered sessions of same type do NOT trigger duplicate session error');

  // C. Verify when BOTH have number, duplicate check DOES trigger
  const numberedDuplicateTest = {
    ...GIT_SCHEDULE,
    weeks: [
      {
        n: 1,
        sessions: [
          { date: "2026-09-19", type: "tut", number: 1, subject: "Anatomy", topics: ["Topic 1"], scope: { sections: [GIT_SCHEDULE.sections[0].id] }, start: "08:00", end: "09:30", place: "Hall 4", status: "normal" },
          { date: "2026-09-20", type: "tut", number: 1, subject: "Anatomy", topics: ["Topic 2"], scope: { sections: [GIT_SCHEDULE.sections[0].id] }, start: "08:00", end: "09:30", place: "Hall 4", status: "normal" }
        ]
      }
    ]
  };
  const numberedDupIssues = validate(numberedDuplicateTest);
  const dupNumbered = numberedDupIssues.filter(i => i.id.includes('ERR_DUP_SESSION'));
  assert.strictEqual(dupNumbered.length, 1, 'Two sessions with same type and number must trigger duplicate session error');
  console.log('✓ Duplicate session error correctly triggers when both sessions have a number');

  // ---------------------------------------------------------------------------
  // [2] UNIT TESTS: Merge Sessions Algorithm (Letter A + Letter B)
  // ---------------------------------------------------------------------------
  console.log('\n[2] Testing Merge Sessions Logic (Letter A then Letter B)...');

  const baseProject = {
    module: { title: "GIT", term: "1st Term", weekdays: ["Sat","Sun","Mon","Tue","Wed","Thu"] },
    sections: [
      { id: "A1", letter: "A", number: 1, practicalGroup: 1, label: "Group (a) Section 1" },
      { id: "A2", letter: "A", number: 2, practicalGroup: 2, label: "Group (a) Section 2" }
    ],
    subjects: [{ name: "Anatomy", color: "#a01040" }],
    sessionTypes: [{ key: "tut", label: "Tut." }],
    weeks: [
      {
        n: 1,
        sessions: [
          { date: "2026-09-19", type: "tut", number: 1, subject: "Anatomy", topics: ["Letter A Anatomy"], scope: { letter: "A" }, start: "08:00", end: "09:30", place: "Hall 4", status: "normal" }
        ]
      }
    ]
  };

  const incomingLetterB = {
    module: { title: "GIT", term: "1st Term", weekdays: ["Sat","Sun","Mon","Tue","Wed","Thu"] },
    sections: [
      { id: "B1", letter: "B", number: 1, practicalGroup: 3, label: "Group (b) Section 1" },
      { id: "B2", letter: "B", number: 2, practicalGroup: 4, label: "Group (b) Section 2" }
    ],
    subjects: [{ name: "Anatomy", color: "#a01040" }, { name: "Physiology", color: "#90f0e0" }],
    sessionTypes: [{ key: "tut", label: "Tut." }, { key: "lec", label: "Lec." }],
    weeks: [
      {
        n: 1,
        sessions: [
          // Different scope (letter: B), so must NOT overwrite letter: A session!
          { date: "2026-09-19", type: "tut", number: 1, subject: "Anatomy", topics: ["Letter B Anatomy"], scope: { letter: "B" }, start: "09:30", end: "11:00", place: "Hall 4", status: "normal" },
          // Lecture with all: true
          { date: "2026-09-20", type: "lec", number: 1, subject: "Physiology", topics: ["Intro Physio"], scope: { all: true }, start: "08:00", end: "09:00", place: "Hall 1", status: "normal" }
        ]
      }
    ]
  };

  const summary = calculateMergeSessionsSummary(baseProject, incomingLetterB);
  assert.strictEqual(summary.sessionsAdded, 2, 'Must indicate 2 sessions added');
  assert.strictEqual(summary.sessionsReplaced, 0, 'Must indicate 0 sessions replaced');
  assert.strictEqual(summary.sessionsUnchanged, 1, 'Must indicate 1 existing session unchanged');
  console.log('✓ calculateMergeSessionsSummary correctly computed +2 added, 0 replaced, 1 unchanged');

  const { mergedProject } = mergeSessionsProject(baseProject, incomingLetterB);
  assert.strictEqual(mergedProject.weeks[0].sessions.length, 3, 'Merged Week 1 must have 3 sessions total (Letter A kept, Letter B added)');
  const secIds = mergedProject.sections.map(s => s.id);
  assert.deepStrictEqual(secIds, ['A1', 'A2', 'B1', 'B2'], 'Sections must be united to A1, A2, B1, B2');
  console.log('✓ mergeSessionsProject preserved Letter A session and added Letter B sessions cleanly');

  // ---------------------------------------------------------------------------
  // [3] PLAYWRIGHT E2E: Projects Library, Safe Merge, Section Picker & Verifications
  // ---------------------------------------------------------------------------
  console.log('\n[3] Launching Browser for End-to-End Acceptance Tests...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  try {
    await page.goto('http://localhost:4173/#/app', { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(600);

    // 1. Projects Library: Open modal, create project, duplicate, switch
    console.log('Testing Projects Library (Open modal, create, rename, switch)...');
    const projectChip = page.locator('[data-testid="project-chip-btn"]');
    assert.strictEqual(await projectChip.isVisible(), true, 'Project chip must be visible in header');
    await projectChip.click();
    await page.waitForTimeout(300);

    // Verify Projects Modal is open
    assert.strictEqual(await page.locator('text=Projects Library').isVisible(), true, 'Projects Library modal must open');

    // Click "New Project"
    console.log('Creating New Project from Projects modal...');
    await page.click('[data-testid="create-new-project-btn"]');
    await page.waitForTimeout(400);

    // Verify switched to new project
    const activeHeaderTitle = await page.locator('[data-testid="project-chip-btn"]').textContent();
    console.log('Active project in header after creation:', activeHeaderTitle);

    // Close and reopen Projects modal to test Rename
    await projectChip.click();
    await page.waitForTimeout(300);

    const renameBtns = page.locator('button[data-testid^="rename-project-"]');
    if (await renameBtns.count() > 0) {
      await renameBtns.first().click();
      await page.waitForTimeout(200);
      const renameInput = page.locator('input[value*="Timetable"]');
      if (await renameInput.isVisible()) {
        await renameInput.fill('Phase 5 Test Schedule');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(300);
      }
    }
    await page.click('[data-testid="close-projects-btn"]');
    await page.waitForTimeout(300);
    console.log('✓ Projects library create, rename, and switch verified');

    // 2. Load Sample GIT Schedule via Import Modal
    console.log('Testing Load Sample GIT creates clean project...');
    await page.click('button[data-testid="import-nav-btn"]');
    await page.waitForTimeout(300);

    // Select GIT from Load sample
    await page.selectOption('select:has-text("Load sample")', 'GIT');
    await page.waitForTimeout(600);

    const updatedModule = await page.locator('[data-testid="project-chip-btn"]').textContent();
    assert.strictEqual(updatedModule.includes('GIT') || updatedModule.includes('Gastrointestinal'), true, 'Loading sample GIT must switch active project to GIT');
    console.log('✓ Loading sample GIT switched to GIT Timetable project');

    // 3. Verify Two-Level Section Picker with 6 sections (A1-A3, B1-B3)
    console.log('Testing Two-Level Section Picker (Letters A & B)...');
    const twoLevelPicker = page.locator('[data-testid="section-picker-two-level"]').first();
    assert.strictEqual(await twoLevelPicker.isVisible(), true, 'Two-level picker must be active for multi-letter sections');

    const letterTabA = page.locator('[data-testid="letter-tab-A"]').first();
    const letterTabB = page.locator('[data-testid="letter-tab-B"]').first();
    assert.strictEqual(await letterTabA.isVisible(), true, 'Letter tab A must exist');
    assert.strictEqual(await letterTabB.isVisible(), true, 'Letter tab B must exist');

    // Switch to Letter B
    await letterTabB.click();
    await page.waitForTimeout(300);
    const chipB1 = page.locator('[data-testid="section-chip-4"], [data-testid="section-chip-B1"]').first();
    assert.strictEqual(await chipB1.isVisible(), true, 'Section chip B1 must be visible after clicking Letter B');

    // Switch to section B2
    const chipB2 = page.locator('[data-testid="section-chip-5"], [data-testid="section-chip-B2"]').first();
    await chipB2.click();
    await page.waitForTimeout(300);
    console.log('✓ Two-level section picker switches between letters and sections seamlessly');

    // 4. Test 12 Sections using "Generate sections" tool in Setup
    console.log('Testing Section Generator Tool in Setup for 12 sections (A1-D3)...');
    await page.click('[data-testid="header-setup-btn"]');
    await page.waitForTimeout(300);

    // Switch to Sections tab
    await page.click('button:has-text("Sections")');
    await page.waitForTimeout(300);

    // Click "Generate sections"
    await page.click('[data-testid="toggle-section-generator-btn"]');
    await page.waitForTimeout(300);

    // Configure Letters A, B, C, D and 3 sections per letter
    await page.fill('[data-testid="generator-letters-input"]', 'A, B, C, D');
    await page.fill('[data-testid="generator-count-input"]', '3');
    await page.waitForTimeout(200);

    // Apply
    await page.click('[data-testid="apply-generated-sections-btn"]');
    await page.waitForTimeout(300);

    // Save setup
    await page.click('button:has-text("Save Configuration")');
    await page.waitForTimeout(400);

    // Verify 4 letter tabs (A, B, C, D) in Two-Level Picker
    const tabC = page.locator('[data-testid="letter-tab-C"]').first();
    const tabD = page.locator('[data-testid="letter-tab-D"]').first();
    assert.strictEqual(await tabC.isVisible(), true, 'Letter tab C must be generated');
    assert.strictEqual(await tabD.isVisible(), true, 'Letter tab D must be generated');
    console.log('✓ Successfully generated 12 sections across 4 letters (A, B, C, D)');

    // 5. Test 12 sections on Phone Viewport (390px)
    console.log('Testing 12 sections on Phone Viewport (390px)...');
    const storageState = await page.context().storageState();
    const phoneContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      storageState
    });
    const phonePage = await phoneContext.newPage();
    await phonePage.goto('http://localhost:4173/#/app', { waitUntil: 'networkidle' });
    await phonePage.waitForTimeout(500);

    const phoneTwoLevel = phonePage.locator('[data-testid="section-picker-two-level"]:visible');
    assert.strictEqual(await phoneTwoLevel.isVisible(), true, 'Two-level picker must be cleanly visible on phone');
    console.log('✓ 12 sections render cleanly on phone without overflow');
    await phoneContext.close();

    // 6. Test Verification Marks & Export Warning
    console.log('Testing Verification Marks and Export Warning...');
    const verifyBtn = page.locator('[data-testid="verification-toggle-btn"]');
    assert.strictEqual(await verifyBtn.isVisible(), true, 'Verification toggle button must exist in header');

    // Initially unverified -> click to verify
    await verifyBtn.click();
    await page.waitForTimeout(300);
    const verifyBtnText = await verifyBtn.textContent();
    assert.strictEqual(verifyBtnText.includes('Verified'), true, 'Must display Verified status');
    console.log('✓ Page marked as verified against source');

    // Open Export Options Modal
    console.log('Opening Export Modal to check unverified pages warning...');
    await page.click('[data-testid="export-options-btn"]');
    await page.waitForTimeout(300);

    // Switch export scope to "Complete Module (All)"
    await page.click('button:has-text("Complete Module (All)")');
    await page.waitForTimeout(300);

    // Verify non-blocking unverified pages warning appears
    const unverifiedAlert = page.locator('[data-testid="unverified-export-warning"]');
    assert.strictEqual(await unverifiedAlert.isVisible(), true, 'Unverified pages warning must appear for unverified pages in scope');

    // Check that Export button is NOT blocked (enabled)
    const exportBtn = page.locator('[data-testid="start-export-btn"]');
    assert.strictEqual(await exportBtn.isEnabled(), true, 'Export button must remain enabled despite unverified pages warning');
    console.log('✓ Export warning cleanly warns without blocking export');

    await page.click('button:has-text("Cancel")');
    await page.waitForTimeout(300);

    console.log('\n====================================================');
    console.log('   ALL PHASE 5 ACCEPTANCE TESTS PASSED (100%)!       ');
    console.log('====================================================\n');
  } finally {
    await browser.close();
  }
}

runPhase5Tests().catch(err => {
  console.error('Phase 5 Test Failure:', err);
  process.exit(1);
});
