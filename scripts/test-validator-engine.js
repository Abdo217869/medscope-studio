import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const assert = require('assert');

import { validate, getCanonicalPlace } from '../src/utils/validatorEngine.js';
import { DEFAULT_SCHEDULE } from '../src/constants.js';

console.log('--- STARTING VALIDATOR ENGINE UNIT TESTS ---');

// 1. Test GIT fixture produces ZERO errors
console.log('1. Testing GIT Fixture...');
const gitIssues = validate(DEFAULT_SCHEDULE);
const gitErrors = gitIssues.filter(i => i.severity === 'error');
const gitWarnings = gitIssues.filter(i => i.severity === 'warning');
console.log(`GIT Errors: ${gitErrors.length}, Warnings: ${gitWarnings.length}`);
assert.strictEqual(gitErrors.length, 0, 'GIT Fixture must have 0 errors');

// Helper to create a deep copy of EGU for seeding single isolated problems
function cloneEgu() {
  return JSON.parse(JSON.stringify(DEFAULT_SCHEDULE));
}

// 3. Seeded Fixture: Duplicate session number
console.log('3. Testing Seeded Fixture: Duplicate Session Number...');
const fDup = cloneEgu();
const s0 = fDup.weeks[0].sessions.find(s => s.type && s.number !== undefined);
fDup.weeks[0].sessions.push({
  ...s0,
  topics: ["different topic"],
  start: "11:00", end: "12:30", place: "Hall 4", status: "normal"
});
const issuesDup = validate(fDup).filter(i => i.rule === 'ERR_COVERAGE_OR_DUPLICATE' && i.message.includes('Duplicate session'));
console.log('Duplicate session issues found:', issuesDup.length);
assert.strictEqual(issuesDup.length, 1, 'Duplicate session rule must fire exactly once');

// 4. Seeded Fixture: Time overlap
console.log('4. Testing Seeded Fixture: Time Overlap...');
const fOverlap = cloneEgu();
fOverlap.weeks[0].sessions.push({
  date: "2026-11-10", type: "tut", number: 99, subject: "Anatomy",
  topics: ["overlapping session"], scope: { sections: [fOverlap.sections[0].id] },
  start: "08:30", end: "09:00", place: "Hall 5", status: "normal"
});
const issuesOverlap = validate(fOverlap).filter(i => i.rule === 'ERR_TIME_OVERLAP');
console.log('Time overlap issues found:', issuesOverlap.length);
assert.strictEqual(issuesOverlap.length, 1, 'Time overlap rule must fire exactly once');

// 5. Seeded Fixture: Wrong weekday (e.g. Friday when module weekdays are Sat-Thu)
console.log('5. Testing Seeded Fixture: Wrong Weekday...');
const fWeekday = cloneEgu();
fWeekday.weeks[0].sessions[0].date = "2026-11-13"; // Friday
const issuesWeekday = validate(fWeekday).filter(i => i.rule === 'ERR_DATE_WEEKDAY_OR_CALENDAR');
console.log('Wrong weekday issues found:', issuesWeekday.length);
assert.strictEqual(issuesWeekday.length >= 1, true, 'Wrong weekday rule must fire');

// 6. Seeded Fixture: Empty group number in scope (e.g. practicalGroups: ["Group"])
console.log('6. Testing Seeded Fixture: Empty / Non-numeric Group in Scope...');
const fScope = cloneEgu();
fScope.weeks[0].sessions[0].scope = { practicalGroups: ["Group"] };
const issuesScope = validate(fScope).filter(i => i.rule === 'ERR_INVALID_SCOPE' && i.message.includes('non-numeric'));
console.log('Non-numeric scope issues found:', issuesScope.length);
assert.strictEqual(issuesScope.length, 1, 'Empty/non-numeric scope group rule must fire exactly once');

// 7. Seeded Fixture: One section missing a practical (Coverage check)
console.log('7. Testing Seeded Fixture: One Section Missing a Practical (Coverage)...');
const fCoverage = cloneEgu();
fCoverage.sections = [
  { id: "A1", letter: "A", number: 1, practicalGroup: 1, label: "Group (a) Section 1" },
  { id: "A2", letter: "A", number: 2, practicalGroup: 2, label: "Group (a) Section 2" }
];
// Add a practical targeted exclusively to A1
fCoverage.weeks[0].sessions.push({
  date: "2026-11-10", type: "prac", number: 55, subject: "Anatomy",
  topics: ["special practical"], scope: { sections: ["A1"] },
  start: "11:00", end: "12:30", place: "Lab 1", status: "normal"
});
const issuesCoverage = validate(fCoverage).filter(i => i.rule === 'ERR_COVERAGE_OR_DUPLICATE' && i.message.includes('missing coverage'));
console.log('Missing coverage issues found:', issuesCoverage.length);
assert.strictEqual(issuesCoverage.length >= 1, true, 'Coverage check rule must fire');

// 8. Seeded Fixture: Unknown subject
console.log('8. Testing Seeded Fixture: Unknown Subject...');
const fSubject = cloneEgu();
fSubject.weeks[0].sessions[0].subject = "Quantum Astrobiology";
const issuesSubject = validate(fSubject).filter(i => i.rule === 'WARN_UNKNOWN_SUBJECT');
console.log('Unknown subject warnings found:', issuesSubject.length);
assert.strictEqual(issuesSubject.length, 1, 'Unknown subject rule must fire exactly once');

// 9. Seeded Fixture: Place casing / non-canonical place
console.log('9. Testing Seeded Fixture: Place Casing / Non-canonical Place...');
const fPlace = cloneEgu();
fPlace.weeks[0].sessions[0].place = "lab 4";
const issuesPlace = validate(fPlace).filter(i => i.rule === 'WARN_NON_CANONICAL_PLACE');
console.log('Non-canonical place warnings found:', issuesPlace.length);
assert.strictEqual(issuesPlace.length, 1, 'Place casing rule must fire exactly once');
assert.strictEqual(issuesPlace[0].autoFix.fixedValue, 'Lab 4', 'Auto-fix should correctly suggest "Lab 4"');

// 10. Seeded Fixture: Two sections in same room at same time
console.log('10. Testing Seeded Fixture: Room Collision...');
const fRoom = cloneEgu();
fRoom.sections.push({ id: "X1", letter: "X", number: 1, practicalGroup: 99, label: "Group (x) Section 1" });
fRoom.weeks[0].sessions.push({
  date: "2026-11-10", type: "tut", number: 1, subject: "Histology",
  topics: ["pelvic"], scope: { letter: "X" },
  start: "08:30", end: "09:00", place: "Morgue 1", status: "normal"
});
const issuesRoom = validate(fRoom).filter(i => i.rule === 'WARN_ROOM_COLLISION');
console.log('Room collision warnings found:', issuesRoom.length);
assert.strictEqual(issuesRoom.length, 1, 'Room collision rule must fire exactly once');

// 11. Seeded Fixture: Week ending mid-week
console.log('11. Testing Seeded Fixture: Week Ending Mid-Week...');
const fMidWeek = cloneEgu();
fMidWeek.weeks[fMidWeek.weeks.length - 1].sessions = [
  fMidWeek.weeks[fMidWeek.weeks.length - 1].sessions[0]
];
const issuesMidWeek = validate(fMidWeek).filter(i => i.rule === 'WARN_EMPTY_OR_MIDWEEK_WEEK' && i.message.includes('mid-week'));
console.log('Mid-week stop warnings found:', issuesMidWeek.length);
assert.strictEqual(issuesMidWeek.length, 1, 'Week ending mid-week rule must fire exactly once');

// 12. Test New Phase 3b Validator Rules:
// 12a. WARN_PRAC_BROAD_SCOPE
console.log('12a. Testing Seeded Fixture: Practical Broad Scope...');
const fPracBroadLetter = cloneEgu();
fPracBroadLetter.weeks[0].sessions.push({
  date: "2026-11-10", type: "prac", number: 99, subject: "Anatomy",
  topics: ["broad practical"], scope: { letter: "A" },
  start: "11:00", end: "12:30", place: "Lab 1", status: "normal"
});
const issuesPracLetter = validate(fPracBroadLetter).filter(i => i.rule === 'WARN_PRAC_BROAD_SCOPE');
console.log('Broad prac scope (letter) warnings found:', issuesPracLetter.length);
assert.strictEqual(issuesPracLetter.length, 1, 'Broad prac scope rule must fire for letter scope');

const fPracBroadAll = cloneEgu();
fPracBroadAll.weeks[0].sessions.push({
  date: "2026-11-10", type: "prac", number: 99, subject: "Anatomy",
  topics: ["broad practical"], scope: { all: true },
  start: "11:00", end: "12:30", place: "Lab 1", status: "normal"
});
const issuesPracAll = validate(fPracBroadAll).filter(i => i.rule === 'WARN_PRAC_BROAD_SCOPE');
console.log('Broad prac scope (all) warnings found:', issuesPracAll.length);
assert.strictEqual(issuesPracAll.length, 1, 'Broad prac scope rule must fire for all scope');

// 12b. WARN_WEEK_NUMBER_GAP
console.log('12b. Testing Seeded Fixture: Week Number Gap...');
const fWeekGap = cloneEgu();
fWeekGap.weeks = [
  { n: 2, sessions: [] },
  { n: 4, sessions: [] }
];
const issuesWeekGap = validate(fWeekGap).filter(i => i.rule === 'WARN_WEEK_NUMBER_GAP');
console.log('Week number gap warnings found:', issuesWeekGap.length);
assert.strictEqual(issuesWeekGap.length, 1, 'Week number gap rule must fire for missing week 3');
assert.strictEqual(issuesWeekGap[0].location.week, 3, 'Location should point to missing week 3');

// 13. Test Ignore Feature: Warnings can be ignored, Errors cannot
console.log('13. Testing Ignore Rules...');
const placeIssueId = issuesPlace[0].id;
const filteredWarnings = validate(fPlace, { ignoredSignatures: new Set([placeIssueId]) });
assert.strictEqual(filteredWarnings.some(i => i.id === placeIssueId), false, 'Ignored warning must be suppressed');

// Try to ignore an error
const errorId = issuesOverlap[0].id;
const filteredErrors = validate(fOverlap, { ignoredSignatures: new Set([errorId]) });
assert.strictEqual(filteredErrors.some(i => i.id === errorId), true, 'Errors must NEVER be ignored');

console.log('--- ALL VALIDATOR ENGINE UNIT TESTS PASSED WITH 100% SUCCESS! ---');
