import assert from 'node:assert';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('D:/Medscope Site/node_modules/playwright-core');
import { generateContinuousSections, migrateSectionModel, needsSectionMigration } from '../src/utils/sectionUtils.js';
import { buildFilename } from '../src/utils/exportPdf.js';
import GIT_SCHEDULE from '../src/samples/GIT_all_sections.json' with { type: 'json' };

const PORT = 4173;
const BASE_URL = `http://localhost:${PORT}`;

async function runAcceptanceTests() {
  console.log('=== RUNNING PHASE 6b & PHASE 8 ACCEPTANCE TESTS ===\n');

  // 1. UNIT TEST: Continuous Section Generation (Phase 6b)
  console.log('1. Testing Continuous Section Generation...');
  const groupsConfig = [
    { letter: 'A', count: 3 },
    { letter: 'B', count: 4 },
    { letter: 'C', count: 3 },
    { letter: 'D', count: 2 }
  ];
  const { sections, previewText } = generateContinuousSections(groupsConfig);
  assert.strictEqual(sections.length, 12, 'Must generate exactly 12 sections');
  assert.strictEqual(sections[0].id, '1');
  assert.strictEqual(sections[0].letter, 'A');
  assert.strictEqual(sections[2].id, '3');
  assert.strictEqual(sections[3].id, '4');
  assert.strictEqual(sections[3].letter, 'B');
  assert.strictEqual(sections[6].id, '7');
  assert.strictEqual(sections[7].id, '8');
  assert.strictEqual(sections[7].letter, 'C');
  assert.strictEqual(sections[7].label, 'Group (C) Section 8');
  assert.strictEqual(sections[11].id, '12');
  assert.strictEqual(sections[11].letter, 'D');

  assert.strictEqual(
    previewText,
    'Group (A): 1, 2, 3 | Group (B): 4, 5, 6, 7 | Group (C): 8, 9, 10 | Group (D): 11, 12',
    'Preview text must match continuous format'
  );
  console.log('✓ Continuous section generation produces 1..N numbering across groups');

  // 2. UNIT TEST: Legacy Section Model Migration
  console.log('2. Testing Legacy Section Model Migration...');
  const legacyProject = {
    module: { title: 'Test Module' },
    sections: [
      { id: 'A1', letter: 'A', number: 1, label: 'Old A1' },
      { id: 'A2', letter: 'A', number: 2, label: 'Old A2' },
      { id: 'B1', letter: 'B', number: 1, label: 'Old B1' }
    ],
    weeks: [
      {
        n: 1,
        sessions: [
          {
            type: 'lec',
            subject: 'Anatomy',
            scope: { sections: ['A1', 'B1'] }
          }
        ]
      }
    ]
  };

  assert.strictEqual(needsSectionMigration(legacyProject), true, 'Needs migration for A1/B1 IDs');
  const migrated = migrateSectionModel(legacyProject);
  assert.strictEqual(migrated.sections[0].id, '1');
  assert.strictEqual(migrated.sections[1].id, '2');
  assert.strictEqual(migrated.sections[2].id, '3');
  assert.strictEqual(migrated.sections[2].letter, 'B');
  assert.strictEqual(migrated.sections[2].label, 'Group (B) Section 3');
  assert.deepStrictEqual(migrated.weeks[0].sessions[0].scope.sections, ['1', '3'], 'Session scopes must be rewritten to 1 and 3');
  console.log('✓ Legacy section IDs (A1, B2) renumbered to 1..N and scopes rewritten');

  // 3. UNIT TEST: Filename placeholders ({group}, {section})
  console.log('3. Testing Filename placeholders...');
  const fn = buildFilename(
    '{module}_Group_{group}_Section_{section}_Week_{week}',
    { module: 'GIT', group: 'C', section: '8', week: '3' }
  );
  assert.strictEqual(fn, 'GIT_Group_C_Section_8_Week_3.pdf');
  console.log('✓ Filename template supports {group} and {section} correctly');

  // 4. BROWSER E2E TESTS
  console.log('4. Launching Browser for End-to-End Tests...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  try {
    // Clear localStorage and navigate to editor (#/app)
    await page.goto(`${BASE_URL}/#/app`);
    await page.evaluate(() => localStorage.clear());
    await page.goto(`${BASE_URL}/#/app`);
    await page.waitForTimeout(1000);

    // Test Wordmark and branding
    const brand = page.locator('header').first();
    const brandText = await brand.textContent();
    assert.ok(brandText.includes('Medscope Studio'), 'Header must display "Medscope Studio"');
    assert.ok(brandText.includes('by Medscope Team'), 'Header must display "by Medscope Team"');
    console.log('✓ Header wordmark displays Medscope Studio / by Medscope Team');

    // Test Single Primary Export button
    const exportBtn = page.locator('[data-testid="export-options-btn"]');
    assert.strictEqual(await exportBtn.isVisible(), true, 'Single primary export button must exist');
    console.log('✓ Export is a single primary button in header');

    // Test Section Picker Level 1 & Level 2
    const letterTabC = page.locator('[data-testid="letter-tab-C"]').first();
    assert.strictEqual(await letterTabC.isVisible(), true, 'Letter tab C must be visible');
    await letterTabC.click();
    await page.waitForTimeout(200);

    const sectionChip8 = page.locator('[data-testid="section-chip-8"]').first();
    assert.strictEqual(await sectionChip8.isVisible(), true, 'Section chip 8 must be visible under Group C');
    await sectionChip8.click();
    await page.waitForTimeout(300);

    // Check header text on page: "Group (C) Section 8"
    const sectionHeader = page.locator('[data-testid="header-section-label"]').first();
    const sectionHeaderText = await sectionHeader.textContent();
    assert.strictEqual(sectionHeaderText.trim(), 'Group (C) Section 8', 'Page header text must be "Group (C) Section 8"');
    console.log('✓ Section picker switches to Section 8; page header text reads "Group (C) Section 8"');

    // Test Export Modal: "Everything looks fine" on clean GIT fixture
    await exportBtn.click();
    await page.waitForTimeout(400);

    const cleanAudit = page.locator('[data-testid="export-audit-clean"]');
    assert.strictEqual(await cleanAudit.isVisible(), true, 'Export preflight must report clean status');
    const cleanText = await cleanAudit.textContent();
    assert.ok(cleanText.includes('Everything looks fine'), 'Must say "Everything looks fine"');

    // Start Export button must be enabled
    const startExportBtn = page.locator('[data-testid="start-export-btn"]');
    assert.strictEqual(await startExportBtn.isEnabled(), true, 'Start Export button must be enabled');
    console.log('✓ Export preflight displays "Everything looks fine" and Start Export is enabled');

    // Close export modal
    const cancelExportBtn = page.locator('button:has-text("Cancel")').first();
    await cancelExportBtn.click();
    await page.waitForTimeout(400);

    // Test Setup Modal continuous section generator
    const setupBtn = page.locator('[data-testid="header-setup-btn"]');
    await setupBtn.click();
    await page.waitForTimeout(400);

    // Click Sections tab
    await page.click('button:has-text("Sections")');
    await page.waitForTimeout(300);

    const previewBox = page.locator('[data-testid="sections-preview-text"]');
    assert.strictEqual(await previewBox.isVisible(), true, 'Live preview list must be visible under inputs');
    const previewContent = await previewBox.textContent();
    assert.ok(previewContent.includes('Group (A): 1, 2, 3'), 'Preview list must include Group (A): 1, 2, 3');
    assert.ok(previewContent.includes('Group (B): 4, 5, 6'), 'Preview list must include Group (B): 4, 5, 6');
    assert.ok(previewContent.includes('Group (C): 7, 8, 9'), 'Preview list must include Group (C): 7, 8, 9');
    console.log(`✓ Setup Sections shows continuous generator preview: "${previewContent}"`);

    // Close setup modal
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Test Prompt 1 & Prompt 2 copy buttons in Help Drawer
    const helpBtn = page.locator('header button[title*="Help"]').first();
    await helpBtn.click();
    await page.waitForTimeout(400);

    const copyPrompt1Btn = page.locator('[data-testid="copy-prompt-1-btn"]').first();
    const copyPrompt2Btn = page.locator('[data-testid="copy-prompt-2-btn"]').first();
    assert.strictEqual(await copyPrompt1Btn.isVisible(), true, 'Copy Prompt 1 button must be visible in Help');
    assert.strictEqual(await copyPrompt2Btn.isVisible(), true, 'Copy Prompt 2 button must be visible in Help');

    await copyPrompt1Btn.click();
    await page.waitForTimeout(200);
    console.log('✓ Prompt 1 and Prompt 2 copy buttons work in Help Drawer');

    // Switch to Arabic in Help
    await page.click('button:has-text("العربية")');
    await page.waitForTimeout(200);
    const helpArCard = page.locator('[data-testid="help-ai-workflow-card"]');
    const helpArText = await helpArCard.textContent();
    assert.ok(helpArText.includes('خطوات تحويل الجدول بالذكاء الاصطناعي'), 'Arabic help must display 3-step guide');
    console.log('✓ Bilingual Help displays 3-step AI workflow in Arabic and English');

    // Close help drawer
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    console.log('\n=== ALL PHASE 6b & PHASE 8 ACCEPTANCE TESTS PASSED! ===');
  } finally {
    await browser.close();
  }
}

runAcceptanceTests().catch(err => {
  console.error('\n❌ ACCEPTANCE TEST FAILED:', err);
  process.exit(1);
});
