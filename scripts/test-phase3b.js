import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const assert = require('assert');
const { chromium } = require('D:/Medscope Site/node_modules/playwright-core');

import { validate, getCanonicalPlace } from '../src/utils/validatorEngine.js';
import { validateScheduleJson } from '../src/utils/schemaValidator.js';
import { calculateMergeSummary, mergeProjects } from '../src/utils/importUtils.js';
import { compareSessions } from '../src/utils/timeUtils.js';
import { buildWeekSchedule } from '../src/utils/dataUtils.js';
import { DEFAULT_SCHEDULE } from '../src/constants.js';

console.log('====================================================');
console.log('   STARTING PHASE 3b DATA MODEL & IMPORT TEST SUITE  ');
console.log('====================================================');

// Helper to clone objects
function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// ---------------------------------------------------------------------------
// TEST 1: Recorded Sessions Data Model & Behavior
// ---------------------------------------------------------------------------
console.log('\n[1] Testing Recorded Sessions Data Model & Behavior...');
{
  const recProj = clone(DEFAULT_SCHEDULE);
  // Add a recorded session on 2026-09-12 with empty start, end, and place
  recProj.weeks[0].sessions.push({
    date: "2026-09-12",
    type: "lec",
    number: 99,
    subject: "Histology",
    topics: ["Recorded Special"],
    scope: { sections: [recProj.sections[0].id] },
    start: "",
    end: "",
    place: "",
    status: "recorded",
    note: ""
  });

  // A. Validator: Must NOT report missing start/end or place for recorded session
  const issues = validate(recProj);
  const recIssues = issues.filter(i =>
    (i.location.sessionIndex === recProj.weeks[0].sessions.length - 1) &&
    (i.rule === 'ERR_MISSING_REQUIRED_OR_INVALID_TIME' || i.rule === 'ERR_TIME_OVERLAP')
  );
  assert.strictEqual(recIssues.length, 0, 'Recorded sessions with empty time/place must have 0 errors');

  // B. Sorting: Recorded sessions must sort LAST in their day
  const normalSession = { date: "2026-09-12", start: "08:00", end: "09:30", status: "normal" };
  const recSession = { date: "2026-09-12", start: "", end: "", status: "recorded" };
  const sortedSessions = [recSession, normalSession].sort(compareSessions);
  assert.strictEqual(sortedSessions[0], normalSession, 'Normal session must precede recorded session');
  assert.strictEqual(sortedSessions[1], recSession, 'Recorded session must sort last');

  // C. DataUtils dayRows: Renders "Recorded" in placeGroups
  const dayRows = buildWeekSchedule(recProj.module, recProj.sections[0], recProj.weeks[0]);
  const satRow = dayRows.find(r => r.weekdayShort === 'Sat');
  const recordedPlaceGroup = satRow.placeGroups.find(g => g.place === 'Recorded' || g.status === 'recorded');
  assert.ok(recordedPlaceGroup, 'Place group must include Recorded status');
  console.log('✓ Recorded sessions cleanly handled (exempt from time checks, sort last, render Recorded)');
}

// ---------------------------------------------------------------------------
// TEST 2: Leave Sessions Clean Data Model
// ---------------------------------------------------------------------------
console.log('\n[2] Testing Leave Sessions Clean Data Model...');
{
  const leaveProj = clone(DEFAULT_SCHEDULE);
  // Clean leave session: needs only date, note, scope
  leaveProj.weeks[0].sessions.push({
    date: "2026-09-14",
    status: "leave",
    note: "National Holiday",
    scope: { all: true }
  });

  const issues = validate(leaveProj);
  const leaveErrors = issues.filter(i =>
    (i.location.sessionIndex === leaveProj.weeks[0].sessions.length - 1) &&
    i.severity === 'error'
  );
  assert.strictEqual(leaveErrors.length, 0, 'Clean leave session must produce 0 validation errors');

  // Build day rows
  const dayRows = buildWeekSchedule(leaveProj.module, leaveProj.sections[0], leaveProj.weeks[0]);
  const monRow = dayRows.find(r => r.weekdayShort === 'Mon');
  assert.strictEqual(monRow.isLeave, true, 'Row should be marked isLeave = true');
  assert.strictEqual(monRow.leaveNote, 'National Holiday', 'Row should have correct leaveNote');
  console.log('✓ Leave sessions cleanly handled (needs only date, note, scope)');
}

// ---------------------------------------------------------------------------
// TEST 3: New Validator Rules (WARN_PRAC_BROAD_SCOPE & WARN_WEEK_NUMBER_GAP)
// ---------------------------------------------------------------------------
console.log('\n[3] Testing New Validator Rules...');
{
  // 3a. WARN_PRAC_BROAD_SCOPE
  const pPrac = clone(DEFAULT_SCHEDULE);
  pPrac.weeks[0].sessions.push({
    date: "2026-09-12", type: "prac", number: 88, subject: "Anatomy",
    topics: ["prac broad"], scope: { letter: "A" },
    start: "11:00", end: "12:30", place: "Lab 1", status: "normal"
  });
  const pracIssues = validate(pPrac).filter(i => i.rule === 'WARN_PRAC_BROAD_SCOPE');
  assert.strictEqual(pracIssues.length, 1, 'Broad prac scope warning must fire for letter scope when letter has >1 sections');
  assert.strictEqual(pracIssues[0].severity, 'warning', 'Must be a warning (not error)');

  // 3b. WARN_WEEK_NUMBER_GAP
  const pGap = clone(DEFAULT_SCHEDULE);
  pGap.weeks = [
    { n: 2, sessions: [] },
    { n: 4, sessions: [] }
  ];
  const gapIssues = validate(pGap).filter(i => i.rule === 'WARN_WEEK_NUMBER_GAP');
  assert.strictEqual(gapIssues.length, 1, 'Week number gap warning must fire when week 3 is missing between 2 and 4');
  assert.strictEqual(gapIssues[0].location.week, 3, 'Missing week must be identified as 3');
  console.log('✓ Both WARN_PRAC_BROAD_SCOPE and WARN_WEEK_NUMBER_GAP work as specified');
}

// ---------------------------------------------------------------------------
// TEST 4: Structural vs Data-Quality Validation on Import
// ---------------------------------------------------------------------------
console.log('\n[4] Testing Structural vs Data-Quality Schema Validation...');
{
  // A. Structural error: Missing required top-level key "weeks"
  const badStructure1 = { module: { title: "T", term: "1", weekdays: ["Sat"] }, sections: [], subjects: [], sessionTypes: [] };
  const res1 = validateScheduleJson(badStructure1);
  assert.strictEqual(res1.valid, false, 'Missing top-level key must fail structural validation');
  assert.ok(res1.errors.some(e => e.path === 'weeks'), 'Must flag missing weeks');

  // B. Structural error: Wrong type (weeks is not an array)
  const badStructure2 = { ...badStructure1, weeks: "not-an-array" };
  const res2 = validateScheduleJson(badStructure2);
  assert.strictEqual(res2.valid, false, 'Non-array weeks must fail structural validation');

  // C. Structural error: Week without number n
  const badStructure3 = { ...badStructure1, weeks: [{ sessions: [] }] };
  const res3 = validateScheduleJson(badStructure3);
  assert.strictEqual(res3.valid, false, 'Week missing n must fail structural validation');

  // D. Data-Quality issue (empty scope, overlaps, missing place on normal session):
  // MUST pass structural schema validation so user can import and see issues in Validator Panel!
  const dataQualityProject = clone(DEFAULT_SCHEDULE);
  dataQualityProject.weeks[0].sessions.push({
    date: "2026-09-12",
    type: "tut",
    number: 999,
    subject: "Unknown Subject",
    scope: {}, // Empty scope (data quality problem)
    start: "08:00",
    end: "09:30",
    place: "" // Missing place (data quality problem)
  });

  const resDQ = validateScheduleJson(dataQualityProject);
  assert.strictEqual(resDQ.valid, true, 'Data-quality problems must NOT block structural schema validation');

  // But the Validator Engine MUST flag them!
  const dqValidatorIssues = validate(dataQualityProject);
  assert.ok(dqValidatorIssues.some(i => i.rule === 'ERR_INVALID_SCOPE'), 'Validator panel must flag empty scope');
  assert.ok(dqValidatorIssues.some(i => i.rule === 'WARN_UNKNOWN_SUBJECT'), 'Validator panel must flag unknown subject');
  console.log('✓ Structural schema validation blocks only structural errors; data-quality issues pass to Validator panel');
}

// ---------------------------------------------------------------------------
// TEST 5: Merge vs Replace Project Logic
// ---------------------------------------------------------------------------
console.log('\n[5] Testing Merge vs Replace Project Logic...');
{
  const currentProject = clone(DEFAULT_SCHEDULE);
  currentProject.weeks = [currentProject.weeks[0]]; // seed with Week 1 only

  // Create an incoming project with:
  // - Week 1 (updated sessions -> should replace current Week 1)
  // - Week 2 (new week -> should be added)
  // - Section B1 (new section -> should be unioned)
  // - Subject Pathology (new subject -> should be unioned)
  // - SessionType seminar (new type -> should be unioned)
  const incomingProject = {
    module: { title: "EGU", term: "3rd Term", weekdays: ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"] },
    sections: [
      currentProject.sections[0],
      { id: "E1", letter: "E", number: 1, practicalGroup: 13, label: "Group (e) Section 1" }
    ],
    subjects: [
      { name: "Anatomy", color: "#a01040" },
      { name: "Pathology", color: "#ff8800" }
    ],
    sessionTypes: [
      { key: "tut", label: "Tut." },
      { key: "sem", label: "Seminar" }
    ],
    weeks: [
      {
        n: 1,
        sessions: [
          { date: "2026-09-12", type: "tut", number: 1, subject: "Anatomy", topics: ["New Week 1 Content"], scope: { all: true }, start: "08:00", end: "09:30", place: "Hall 1", status: "normal", note: "" }
        ]
      },
      {
        n: 2,
        sessions: [
          { date: "2026-09-19", type: "tut", number: 2, subject: "Pathology", topics: ["Week 2 Intro"], scope: { all: true }, start: "08:00", end: "09:30", place: "Hall 2", status: "normal", note: "" }
        ]
      }
    ]
  };

  // A. Summary calculation
  const summary = calculateMergeSummary(currentProject, incomingProject);
  assert.deepStrictEqual(summary.weeksReplaced, [1], 'Week 1 must be marked for replacement');
  assert.deepStrictEqual(summary.weeksAdded, [2], 'Week 2 must be marked as added');
  assert.strictEqual(summary.sectionsAdded.length, 1, 'Section E1 should be marked as added');
  assert.strictEqual(summary.sectionsAdded[0].id, 'E1', 'Section E1 should be added');
  assert.strictEqual(summary.subjectsAdded.length, 1, 'Pathology subject should be added');
  assert.strictEqual(summary.sessionTypesAdded.length, 1, 'sem sessionType should be added');

  // B. Project Merge
  const { mergedProject } = mergeProjects(currentProject, incomingProject);
  assert.strictEqual(mergedProject.weeks.length, 2, 'Merged project must have exactly 2 weeks');
  assert.strictEqual(mergedProject.weeks[0].n, 1, 'First week must be Week 1');
  assert.strictEqual(mergedProject.weeks[0].sessions[0].topics[0], "New Week 1 Content", 'Week 1 must be replaced with incoming sessions');
  assert.strictEqual(mergedProject.weeks[1].n, 2, 'Second week must be Week 2');

  // Sections union
  const mergedSecIds = mergedProject.sections.map(s => s.id);
  assert.ok(mergedSecIds.includes(currentProject.sections[0].id) && mergedSecIds.includes('E1'), 'All sections must be unioned');
  assert.strictEqual(mergedProject.sections.length, currentProject.sections.length + 1, 'Total sections should increase by 1');

  // Subjects union
  const mergedSubNames = mergedProject.subjects.map(s => s.name);
  assert.ok(mergedSubNames.includes('Pathology'), 'Pathology must be unioned into subjects');
  assert.strictEqual(mergedProject.subjects.length, currentProject.subjects.length + 1, 'Total subjects should increase by 1');

  // SessionTypes union
  const mergedTypeKeys = mergedProject.sessionTypes.map(st => st.key);
  assert.ok(mergedTypeKeys.includes('sem'), 'sem type must be unioned into sessionTypes');
  assert.strictEqual(mergedProject.sessionTypes.length, 4, 'Total types should be 4 (3 existing + 1 new)');

  console.log('✓ calculateMergeSummary and mergeProjects produce exact union and replacement');
}

// ---------------------------------------------------------------------------
// TEST 6: Playwright E2E Test for Import Modal (Replace vs Merge & 1-step undo)
// ---------------------------------------------------------------------------
console.log('\n[6] Running Playwright E2E UI Test for Import Modal...');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  try {
    await page.goto('http://localhost:4173', { waitUntil: 'networkidle' });
    console.log('Page loaded');

    // 1. Open Import Modal
    await page.click('button[data-testid="import-nav-btn"]');
    await page.waitForSelector('text=Import Timetable Project JSON', { timeout: 5000 });
    console.log('Import modal opened successfully');

    // 2. Verify Mode Switch options exist
    const replaceRadio = page.locator('input[value="replace"]');
    const mergeRadio = page.locator('input[value="merge"]');
    assert.strictEqual(await replaceRadio.isVisible(), true, 'Replace project radio button must exist');
    assert.strictEqual(await mergeRadio.isVisible(), true, 'Merge into current project radio button must exist');

    // 3. Paste a merge project JSON (containing Week 8 and new subject)
    const mergeData = {
      module: { title: "Gastrointestinal Tract", term: "1st Term", weekdays: ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu"] },
      sections: [{ id: "A1", letter: "A", number: 1, practicalGroup: 1, label: "Group (a) Section 1" }],
      subjects: [{ name: "Genetics", color: "#8800ff" }],
      sessionTypes: [{ key: "tut", label: "Tut." }],
      weeks: [
        {
          n: 8,
          sessions: [
            { date: "2026-12-26", type: "tut", number: 10, subject: "Genetics", topics: ["Clinical Genetics"], scope: { sections: ["A1"] }, start: "08:00", end: "09:30", place: "Hall 4", status: "normal", note: "" }
          ]
        }
      ]
    };

    const textarea = page.locator('textarea[data-testid="import-json-textarea"]');
    await textarea.fill(JSON.stringify(mergeData, null, 2));

    // 4. Select "Merge into current project"
    await mergeRadio.check();
    await page.waitForTimeout(300);

    // 5. Verify Merge Summary Preview is displayed
    const mergeSummaryText = await page.locator('text=Merge Summary Preview').isVisible();
    assert.strictEqual(mergeSummaryText, true, 'Merge Summary Preview must be displayed in merge mode');
    const addsWeek8 = await page.locator('text=Adds Week 8').isVisible();
    assert.strictEqual(addsWeek8, true, 'Merge preview must indicate Adds Week 8');
    const addsGenetics = await page.locator('text=Adds 1 new subject(s) (Genetics)').isVisible();
    assert.strictEqual(addsGenetics, true, 'Merge preview must indicate Adds Genetics subject');
    console.log('Merge preview correctly displayed');

    // 6. Apply Merge
    const applyBtn = page.locator('button[data-testid="apply-import-btn"]');
    await applyBtn.click();
    await page.waitForTimeout(500);

    // 7. Verify Week 8 now appears in the week selector!
    const weekSelect = page.locator('select[data-testid="week-select"]');
    assert.strictEqual(await weekSelect.isVisible(), true, 'Week selector must be visible when multiple weeks exist');
    const weekOptions = await weekSelect.innerText();
    assert.ok(weekOptions.includes('Week 8'), 'Week 8 must be present in the week dropdown after merge');
    console.log('Week 8 verified in UI after merge');

    // 8. Test 1-Step Undo
    await page.click('button[data-testid="import-nav-btn"]');
    await page.waitForSelector('text=Import Timetable Project JSON');
    const undoBtn = page.locator('button:has-text("↩ Undo Last Import")');
    assert.strictEqual(await undoBtn.isVisible(), true, 'Undo Last Import button must be visible');
    await undoBtn.click();
    await page.waitForTimeout(500);

    // Verify Week 8 is reverted back
    const weekOptionsAfterUndo = await page.locator('select[data-testid="week-select"]').innerText();
    assert.strictEqual(weekOptionsAfterUndo.includes('Week 8'), false, 'Week 8 must no longer be present after undo');
    console.log('Undo Last Import successfully reverted the merge');

    console.log('\n====================================================');
    console.log('   ALL PHASE 3b TESTS PASSED WITH 100% SUCCESS!     ');
    console.log('====================================================');
  } finally {
    await browser.close();
  }
})();
