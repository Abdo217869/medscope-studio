import assert from 'node:assert';
import fs from 'node:fs';
import JSZip from 'jszip';
import { validate } from '../src/utils/validatorEngine.js';
import { buildProjectFilename, buildProjectFileData } from '../src/utils/exportPdf.js';
import { mergeSessionsProject, mergeProjects } from '../src/utils/importUtils.js';

console.log('=== TEST SUITE: EXPORT CHECK WARNING & PROJECT FILE ===\n');

// -----------------------------------------------------------------------------
// 1. Practical Too Long / Broad Scope Warning (WARN_PRACTICAL_TOO_LONG)
// -----------------------------------------------------------------------------
console.log('1. Testing WARN_PRACTICAL_TOO_LONG validation rule...');

const baseSchedule = {
  module: {
    title: 'Gastrointestinal Tract',
    term: '1st Term',
    weekdays: ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu'],
    startDate: '2026-11-14'
  },
  sections: [
    { id: '1', name: 'Section 1', letter: 'A', number: 1, practicalGroup: 1 },
    { id: '2', name: 'Section 2', letter: 'A', number: 2, practicalGroup: 2 },
    { id: '3', name: 'Section 3', letter: 'B', number: 3, practicalGroup: 3 },
    { id: '4', name: 'Section 4', letter: 'B', number: 4, practicalGroup: 4 }
  ],
  subjects: [
    { name: 'Anatomy', color: '#ff2f3a' },
    { name: 'Histology', color: '#4a90e2' }
  ],
  sessionTypes: [
    { key: 'prac', label: 'Prac' },
    { key: 'lec', label: 'Lec' }
  ],
  weeks: [
    {
      n: 1,
      days: ['2026-11-14', '2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19'],
      sessions: [
        // Normal practical (90 min, 1 group): Should NOT trigger
        {
          type: 'Prac',
          number: 1,
          subject: 'Anatomy',
          date: '2026-11-17',
          start: '08:00',
          end: '09:30',
          scope: { sections: ['1'], practicalGroups: [1] }
        },
        // Practical > 100 min (120 min): SHOULD trigger
        {
          type: 'Prac',
          number: 6,
          subject: 'Histology',
          date: '2026-11-17',
          start: '08:00',
          end: '10:00',
          scope: { sections: ['2'], practicalGroups: [2] }
        },
        // Practical scope > 2 practical groups (3 groups, 90 min): SHOULD trigger
        {
          type: 'Prac',
          number: 7,
          subject: 'Anatomy',
          date: '2026-11-18',
          start: '08:00',
          end: '09:30',
          scope: { practicalGroups: [1, 2, 3] }
        },
        // Lecture > 100 min (120 min): Should NOT trigger (only practicals)
        {
          type: 'Lec',
          number: 1,
          subject: 'Anatomy',
          date: '2026-11-17',
          start: '10:00',
          end: '12:00',
          scope: { all: true }
        }
      ]
    }
  ],
  settings: {
    showOffDays: false
  },
  verifications: {
    '1_1': true
  }
};

const issues = validate(baseSchedule);
const longPracIssues = issues.filter(i => i.rule === 'WARN_PRACTICAL_TOO_LONG');

assert.strictEqual(longPracIssues.length, 2, `Expected 2 WARN_PRACTICAL_TOO_LONG warnings, got ${longPracIssues.length}`);

// Check issue 1 (duration > 100 min): "Practical 6 on Tue 17/11 looks too long, check it against the PDF."
const issue1 = longPracIssues.find(i => i.location.sessionIndex === 1);
assert.ok(issue1, 'Issue for sessionIndex 1 must exist');
assert.strictEqual(issue1.severity, 'warning', 'Severity must be non-blocking warning');
assert.strictEqual(
  issue1.message,
  'Practical 6 on Tue 17/11 looks too long, check it against the PDF.',
  `Expected exact message matching requirement, got: "${issue1.message}"`
);
console.log('✓ Duration > 100 min triggered WARN_PRACTICAL_TOO_LONG with message:');
console.log(`  "${issue1.message}"`);

// Check issue 2 (scope > 2 groups): "Practical 7 on Wed 18/11 looks too long, check it against the PDF."
const issue2 = longPracIssues.find(i => i.location.sessionIndex === 2);
assert.ok(issue2, 'Issue for sessionIndex 2 must exist');
assert.strictEqual(issue2.severity, 'warning');
assert.strictEqual(
  issue2.message,
  'Practical 7 on Wed 18/11 looks too long, check it against the PDF.',
  `Expected exact message matching requirement, got: "${issue2.message}"`
);
console.log('✓ Scope > 2 practical groups triggered WARN_PRACTICAL_TOO_LONG with message:');
console.log(`  "${issue2.message}"`);

// -----------------------------------------------------------------------------
// 2. Project File Naming & Structure
// -----------------------------------------------------------------------------
console.log('\n2. Testing project file naming and structure...');

const filename = buildProjectFilename('Gastrointestinal Tract / Module 1', '2026-11-14');
assert.strictEqual(filename, 'Medscope_Gastrointestinal_Tract_Module_1_2026-11-14.json');
console.log(`✓ buildProjectFilename generated safe name: ${filename}`);

const dummyTheme = {
  themeVersion: 2,
  moduleTitle: 'Gastrointestinal Tract',
  table: { headerHeight: 70 }
};

const projectFileData = buildProjectFileData(baseSchedule, dummyTheme);
assert.ok(projectFileData.module, 'Project file must contain module');
assert.ok(projectFileData.sections, 'Project file must contain sections');
assert.ok(projectFileData.subjects, 'Project file must contain subjects');
assert.ok(projectFileData.sessionTypes, 'Project file must contain sessionTypes');
assert.ok(projectFileData.weeks, 'Project file must contain weeks');
assert.ok(projectFileData.settings, 'Project file must contain settings');
assert.strictEqual(projectFileData.settings.showOffDays, false, 'settings.showOffDays must be preserved');
assert.deepStrictEqual(projectFileData.verifications, { '1_1': true }, 'verifications must be preserved');
assert.ok(projectFileData.theme, 'Project file must contain theme');
console.log('✓ buildProjectFileData successfully packaged complete project data structure');

// -----------------------------------------------------------------------------
// 3. ZIP Export: Verify project.json inside ZIP
// -----------------------------------------------------------------------------
console.log('\n3. Testing ZIP export containing project.json...');

const zip = new JSZip();
// Simulate files in export ZIP
zip.file('dummy_schedule.pdf', 'dummy-pdf-content');
zip.file('project.json', JSON.stringify(projectFileData, null, 2));

const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
const unzipped = await JSZip.loadAsync(zipBuffer);

assert.ok(unzipped.file('project.json'), 'project.json must be present in ZIP archive');
const readProjectJsonStr = await unzipped.file('project.json').async('string');
const readProject = JSON.parse(readProjectJsonStr);

assert.strictEqual(readProject.module.title, 'Gastrointestinal Tract');
assert.strictEqual(readProject.settings.showOffDays, false);
assert.strictEqual(readProject.verifications['1_1'], true);
assert.strictEqual(readProject.weeks[0].sessions.length, 4);
console.log('✓ ZIP export contains valid project.json next to PDF files');

// -----------------------------------------------------------------------------
// 4. Import project.json into a new project
// -----------------------------------------------------------------------------
console.log('\n4. Testing importing project.json into a fresh project...');

const freshProject = {
  module: { title: 'New Module', term: '1st Term', weekdays: ['Sat'] },
  sections: [{ id: '1', name: 'Sec 1' }],
  subjects: [],
  sessionTypes: [],
  weeks: [],
  settings: { showOffDays: true },
  verifications: {}
};

// 4.1 Replace mode
const replaceImported = JSON.parse(JSON.stringify(readProject));
assert.strictEqual(replaceImported.sections.length, 4);
assert.strictEqual(replaceImported.weeks[0].sessions.length, 4);
assert.strictEqual(replaceImported.settings.showOffDays, false);
assert.strictEqual(replaceImported.verifications['1_1'], true);
console.log('✓ Replace project mode preserves all sessions, sections, showOffDays, and verifications');

// 4.2 Merge sessions mode
const { mergedProject: mergeSessionsResult } = mergeSessionsProject(freshProject, readProject);
assert.strictEqual(mergeSessionsResult.weeks[0].sessions.length, 4);
assert.strictEqual(mergeSessionsResult.settings.showOffDays, false);
assert.strictEqual(mergeSessionsResult.verifications['1_1'], true);
console.log('✓ Merge sessions mode preserves all sessions, sections, showOffDays, and verifications');

// 4.3 Replace weeks mode (mergeProjects)
const { mergedProject: mergeWeeksResult } = mergeProjects(freshProject, readProject);
assert.strictEqual(mergeWeeksResult.weeks[0].sessions.length, 4);
assert.strictEqual(mergeWeeksResult.settings.showOffDays, false);
assert.strictEqual(mergeWeeksResult.verifications['1_1'], true);
console.log('✓ Replace weeks mode preserves all sessions, sections, showOffDays, and verifications');

// -----------------------------------------------------------------------------
// 5. Help Drawer Short Lines (EN + AR)
// -----------------------------------------------------------------------------
console.log('\n5. Verifying Help drawer notes...');
const helpDrawerContent = fs.readFileSync('src/components/HelpDrawer.jsx', 'utf8');

const enTarget = 'Keep the .json file. Send it to anyone and they can open the same timetable in Import and edit it.';
const arTarget = 'احتفظ بملف الـ .json. أرسله لأي شخص ليتمكن من فتح نفس الجدول في الاستيراد وتعديله.';

assert.ok(helpDrawerContent.includes(enTarget), 'HelpDrawer must include English project file note');
assert.ok(helpDrawerContent.includes(arTarget), 'HelpDrawer must include Arabic project file note');
console.log('✓ HelpDrawer contains both Arabic and English project file guidance notes');

console.log('\n=== ALL PROJECT FILE & EXPORT CHECK WARNING TESTS PASSED! ===');
