import assert from 'node:assert';
import fs from 'node:fs';
import http from 'node:http';
import { spawn } from 'node:child_process';
import JSZip from 'jszip';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { chromium } = require('D:/Medscope Site/node_modules/playwright-core');

import {
  parsePageRange,
  estimateFileSize,
  buildProjectFilename,
  buildFilename
} from '../src/utils/exportPdf.js';
import { HELP_EN } from '../src/content/help.en.js';
import { HELP_AR } from '../src/content/help.ar.js';

const BASE_URL = 'http://localhost:4173';

// -----------------------------------------------------------------------------
// Helper: Binary header inspection for PNG, JPEG, PDF
// -----------------------------------------------------------------------------
function getPngDimensions(buf) {
  assert.strictEqual(buf[0], 0x89, 'PNG magic byte 0 must be 0x89');
  assert.strictEqual(buf[1], 0x50, 'PNG magic byte 1 must be 0x50 (P)');
  assert.strictEqual(buf[2], 0x4e, 'PNG magic byte 2 must be 0x4E (N)');
  assert.strictEqual(buf[3], 0x47, 'PNG magic byte 3 must be 0x47 (G)');
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return { width, height };
}

function getJpegDimensions(buf) {
  assert.strictEqual(buf[0], 0xff, 'JPEG magic byte 0 must be 0xFF');
  assert.strictEqual(buf[1], 0xd8, 'JPEG magic byte 1 must be 0xD8');
  assert.strictEqual(buf[2], 0xff, 'JPEG magic byte 2 must be 0xFF');
  let offset = 2;
  while (offset < buf.length - 8) {
    if (buf[offset] !== 0xff) {
      offset++;
      continue;
    }
    const marker = buf[offset + 1];
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      const height = buf.readUInt16BE(offset + 5);
      const width = buf.readUInt16BE(offset + 7);
      return { width, height };
    }
    const len = buf.readUInt16BE(offset + 2);
    offset += 2 + len;
  }
  throw new Error('SOF marker not found in JPEG');
}

function verifyPdfMagic(buf) {
  assert.strictEqual(buf.toString('utf8', 0, 5), '%PDF-', 'PDF must begin with %PDF- header');
}

// -----------------------------------------------------------------------------
// Helper: Ensure preview server is active
// -----------------------------------------------------------------------------
function checkServerRunning() {
  return new Promise((resolve) => {
    const req = http.get(BASE_URL, (res) => {
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function ensurePreviewServer() {
  const isRunning = await checkServerRunning();
  if (isRunning) return null;

  console.log('Starting preview server on port 4173...');
  const proc = spawn('npm.cmd', ['run', 'preview', '--', '--port', '4173'], {
    shell: true,
    stdio: 'ignore'
  });

  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (await checkServerRunning()) {
      console.log('✓ Preview server is ready');
      return proc;
    }
  }
  throw new Error('Failed to start preview server on port 4173');
}

// -----------------------------------------------------------------------------
// MAIN TEST SUITE
// -----------------------------------------------------------------------------
async function runTests() {
  console.log('=== TEST SUITE: PHASE 13 IMAGE EXPORT (JPG & PNG) ===\n');

  // ---------------------------------------------------------------------------
  // 1. UNIT TESTS: parsePageRange (returns 1-based page numbers)
  // ---------------------------------------------------------------------------
  console.log('1. Testing parsePageRange...');
  // 'all' / empty / whitespace
  assert.deepStrictEqual(parsePageRange('all', 5), [1, 2, 3, 4, 5]);
  assert.deepStrictEqual(parsePageRange('', 3), [1, 2, 3]);
  assert.deepStrictEqual(parsePageRange('   ', 4), [1, 2, 3, 4]);

  // Single numbers & ranges
  assert.deepStrictEqual(parsePageRange('1-3', 10), [1, 2, 3]);
  assert.deepStrictEqual(parsePageRange('2,5,7', 10), [2, 5, 7]);
  assert.deepStrictEqual(parsePageRange('1-2, 4', 10), [1, 2, 4]);

  // Deduplication & Sorting
  assert.deepStrictEqual(parsePageRange('1, 1, 2, 2', 5), [1, 2]);
  assert.deepStrictEqual(parsePageRange('4, 2, 1', 5), [1, 2, 4]);

  // Out-of-bounds numbers are excluded safely
  assert.deepStrictEqual(parsePageRange('0, 15', 5), []);
  assert.deepStrictEqual(parsePageRange('1-99', 3), [1, 2, 3]);

  // Invalid non-numeric input falls back safely to empty array
  assert.deepStrictEqual(parsePageRange('invalid', 5), []);
  console.log('✓ parsePageRange handles all ranges, comma lists, deduplication, and bounds');

  // ---------------------------------------------------------------------------
  // 2. UNIT TESTS: estimateFileSize
  // ---------------------------------------------------------------------------
  console.log('\n2. Testing estimateFileSize...');
  const jpgStd = estimateFileSize('jpg', 1.0, 0.92);
  assert.ok(jpgStd.includes('KB') || jpgStd.includes('MB'), 'JPG standard size estimate formatted');
  const jpgHigh = estimateFileSize('jpg', 2.0, 0.92);
  assert.ok(jpgHigh.includes('MB') || jpgHigh.includes('KB'), 'JPG high size estimate formatted');

  const pngStd = estimateFileSize('png', 1.0, 1.0);
  assert.ok(pngStd.includes('MB'), 'PNG standard estimate is formatted in MB');
  const pngHigh = estimateFileSize('png', 2.0, 1.0);
  assert.ok(pngHigh.includes('MB'), 'PNG high estimate is formatted in MB');

  const pdfEst = estimateFileSize('pdf', 1.0, 1.0);
  assert.ok(pdfEst.includes('KB') || pdfEst.includes('MB'), 'PDF size estimate formatted');
  console.log('✓ estimateFileSize returns valid estimates for JPG, PNG, and PDF');

  // ---------------------------------------------------------------------------
  // 3. UNIT TESTS: buildProjectFilename
  // ---------------------------------------------------------------------------
  console.log('\n3. Testing buildProjectFilename for images and archives...');
  assert.strictEqual(
    buildProjectFilename('GIT_Section_1_Week_1.jpg'),
    'GIT_Section_1_Week_1_EDIT-FILE.json'
  );
  assert.strictEqual(
    buildProjectFilename('GIT_Section_1_Week_1.png'),
    'GIT_Section_1_Week_1_EDIT-FILE.json'
  );
  assert.strictEqual(
    buildProjectFilename('GIT_All_Sections.zip'),
    'GIT_All_Sections_EDIT-FILE.json'
  );
  console.log('✓ buildProjectFilename correctly appends _EDIT-FILE.json to image and zip names');

  // ---------------------------------------------------------------------------
  // 4. VERIFY HELP TEXT UPDATES
  // ---------------------------------------------------------------------------
  console.log('\n4. Verifying HelpDrawer and Help topics...');
  const helpDrawerSource = fs.readFileSync('src/components/HelpDrawer.jsx', 'utf8');
  assert.ok(
    helpDrawerSource.includes('JPG') && helpDrawerSource.includes('PNG'),
    'HelpDrawer must mention JPG and PNG'
  );

  assert.ok(HELP_EN.png, 'HELP_EN must include png topic');
  assert.ok(
    HELP_EN.png.desc.includes('JPG') && HELP_EN.png.desc.includes('PNG'),
    'HELP_EN png topic must describe JPG and PNG options'
  );

  assert.ok(HELP_AR.png, 'HELP_AR must include png topic in Arabic');
  assert.ok(
    HELP_AR.png.desc.includes('JPG') || HELP_AR.png.desc.includes('PNG'),
    'HELP_AR png topic must describe JPG and PNG options'
  );
  console.log('✓ English and Arabic help texts properly describe image export options');

  // ---------------------------------------------------------------------------
  // 5. E2E BROWSER TESTS (Playwright)
  // ---------------------------------------------------------------------------
  console.log('\n5. Launching Chromium for E2E Export Tests...');
  const serverProc = await ensurePreviewServer();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    acceptDownloads: true
  });
  const page = await context.newPage();

  try {
    // Navigate to studio app
    await page.goto(`${BASE_URL}/#/app`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid="schedule-page-canvas"]');
    console.log('✓ Studio loaded successfully');

    // Open Export modal
    await page.click('[data-testid="export-options-btn"]');
    await page.waitForSelector('[data-testid="export-format-pdf"]');
    console.log('✓ Export modal opened');

    // Check Format Switch buttons exist
    assert.ok(await page.isVisible('[data-testid="export-format-pdf"]'));
    assert.ok(await page.isVisible('[data-testid="export-format-jpg"]'));
    assert.ok(await page.isVisible('[data-testid="export-format-png"]'));
    console.log('✓ Format switch buttons (PDF | JPG | PNG) are rendered');

    // -------------------------------------------------------------------------
    // 5.1 Format Switch Interactions & Option Visibility
    // -------------------------------------------------------------------------
    // Click JPG format
    await page.click('[data-testid="export-format-jpg"]');
    await page.waitForTimeout(100);
    assert.ok(await page.isVisible('[data-testid="export-jpg-quality-select"]'), 'JPG quality select must be visible');

    // Click PNG format
    await page.click('[data-testid="export-format-png"]');
    await page.waitForTimeout(100);
    assert.strictEqual(await page.isVisible('[data-testid="export-jpg-quality-select"]'), false, 'JPG quality select must be hidden for PNG');
    assert.ok(await page.isVisible('[data-testid="png-quality-note"]'), 'PNG quality note must be visible');
    const pngNoteText = await page.textContent('[data-testid="png-quality-note"]');
    assert.ok(pngNoteText.includes('PNG is sharper but larger. JPG is smaller and fine for sharing.'));
    console.log('✓ Format toggle dynamically displays JPG quality presets and PNG sharpness notes');

    // -------------------------------------------------------------------------
    // 5.2 Page Range Live Count
    // -------------------------------------------------------------------------
    await page.fill('[data-testid="export-page-range-input"]', '1');
    await page.waitForTimeout(100);
    let liveCount = await page.textContent('[data-testid="export-pages-count-live"]');
    assert.ok(liveCount.includes('1 page will be exported'));

    await page.fill('[data-testid="export-page-range-input"]', 'all');
    await page.waitForTimeout(100);
    liveCount = await page.textContent('[data-testid="export-pages-count-live"]');
    assert.ok(liveCount.includes('1 page will be exported')); // Scope is 'current'
    console.log('✓ Page range input live count updates responsively');

    // -------------------------------------------------------------------------
    // 5.3 Test Single Page JPG Export (Magic Bytes + Dimensions 1414x2000)
    // -------------------------------------------------------------------------
    console.log('\n5.3 Testing Single Page JPG Export...');
    await page.click('[data-testid="export-format-jpg"]');
    // Ensure Standard resolution (1414x2000)
    await page.selectOption('[data-testid="export-resolution-select"]', '1.0');
    // Keep saveProjectFile checkbox checked
    const isSaveProjectChecked = await page.isChecked('[data-testid="export-save-project-file-checkbox"]');
    if (!isSaveProjectChecked) {
      await page.click('[data-testid="export-save-project-file-checkbox"]');
    }

    // Capture downloads
    const jpgDownloadPromise = page.waitForEvent('download', { timeout: 15000 });
    await page.click('[data-testid="start-export-btn"]');

    const jpgDownload = await jpgDownloadPromise;
    const jpgFilename = jpgDownload.suggestedFilename();
    assert.ok(jpgFilename.endsWith('.jpg'), `JPG filename must end with .jpg, got ${jpgFilename}`);

    const jpgPath = await jpgDownload.path();
    const jpgBuffer = fs.readFileSync(jpgPath);

    // Verify JPEG magic bytes
    assert.strictEqual(jpgBuffer[0], 0xff, 'JPEG magic byte 0 must be 0xFF');
    assert.strictEqual(jpgBuffer[1], 0xd8, 'JPEG magic byte 1 must be 0xD8');
    assert.strictEqual(jpgBuffer[2], 0xff, 'JPEG magic byte 2 must be 0xFF');

    // Verify dimensions (1414 x 2000)
    const jpgDims = getJpegDimensions(jpgBuffer);
    assert.strictEqual(jpgDims.width, 1414, `Expected JPG width 1414, got ${jpgDims.width}`);
    assert.strictEqual(jpgDims.height, 2000, `Expected JPG height 2000, got ${jpgDims.height}`);
    console.log(`✓ Single page JPG exported successfully: ${jpgFilename} (${jpgDims.width}x${jpgDims.height}) with valid 0xFF 0xD8 0xFF magic bytes`);

    // Wait a brief moment in case the project file was also downloaded
    await page.waitForTimeout(500);

    // -------------------------------------------------------------------------
    // 5.4 Test Single Page PNG Export (Magic Bytes + Dimensions 1414x2000)
    // -------------------------------------------------------------------------
    console.log('\n5.4 Testing Single Page PNG Export...');
    // Reopen export modal if closed
    if (!await page.isVisible('[data-testid="export-format-png"]')) {
      await page.click('[data-testid="export-options-btn"]');
      await page.waitForSelector('[data-testid="export-format-png"]');
    }

    await page.click('[data-testid="export-format-png"]');
    await page.selectOption('[data-testid="export-resolution-select"]', '1.0');

    const pngDownloadPromise = page.waitForEvent('download', { timeout: 15000 });
    await page.click('[data-testid="start-export-btn"]');

    const pngDownload = await pngDownloadPromise;
    const pngFilename = pngDownload.suggestedFilename();
    assert.ok(pngFilename.endsWith('.png'), `PNG filename must end with .png, got ${pngFilename}`);

    const pngPath = await pngDownload.path();
    const pngBuffer = fs.readFileSync(pngPath);

    // Verify PNG magic bytes: \x89PNG
    assert.strictEqual(pngBuffer[0], 0x89);
    assert.strictEqual(pngBuffer[1], 0x50);
    assert.strictEqual(pngBuffer[2], 0x4e);
    assert.strictEqual(pngBuffer[3], 0x47);

    // Verify dimensions (1414 x 2000)
    const pngDims = getPngDimensions(pngBuffer);
    assert.strictEqual(pngDims.width, 1414, `Expected PNG width 1414, got ${pngDims.width}`);
    assert.strictEqual(pngDims.height, 2000, `Expected PNG height 2000, got ${pngDims.height}`);
    console.log(`✓ Single page PNG exported successfully: ${pngFilename} (${pngDims.width}x${pngDims.height}) with valid 0x89 0x50 0x4E 0x47 magic bytes`);

    await page.waitForTimeout(500);

    // -------------------------------------------------------------------------
    // 5.5 Test Page Range as ZIP Export (Count, Naming & _EDIT-FILE.json)
    // -------------------------------------------------------------------------
    console.log('\n5.5 Testing Page Range as ZIP Export...');
    if (!await page.isVisible('[data-testid="export-format-jpg"]')) {
      await page.click('[data-testid="export-options-btn"]');
      await page.waitForSelector('[data-testid="export-format-jpg"]');
    }

    // Switch to section all weeks scope (several pages)
    await page.click('button:has-text("Current Section (All Weeks)")');
    await page.click('[data-testid="export-format-jpg"]');
    // Set page range to 1-2
    await page.fill('[data-testid="export-page-range-input"]', '1-2');
    await page.waitForTimeout(100);

    const rangeCountText = await page.textContent('[data-testid="export-pages-count-live"]');
    assert.ok(rangeCountText.includes('2 pages will be exported'), `Expected 2 pages count, got: ${rangeCountText}`);

    // Ensure ZIP delivery mode is selected
    const zipRadio = page.locator('input[name="imageDeliveryMode"][value="zip"]');
    if (await zipRadio.isVisible()) {
      await zipRadio.check();
    }

    // Trigger ZIP download
    const zipDownloadPromise = page.waitForEvent('download', { timeout: 20000 });
    await page.click('[data-testid="start-export-btn"]');

    const zipDownload = await zipDownloadPromise;
    const zipFilename = zipDownload.suggestedFilename();
    assert.ok(zipFilename.endsWith('.zip'), `ZIP filename must end with .zip, got ${zipFilename}`);

    const zipPath = await zipDownload.path();
    const zipBuffer = fs.readFileSync(zipPath);

    // Unpack ZIP and inspect contents
    const zip = await JSZip.loadAsync(zipBuffer);
    const filesInZip = Object.keys(zip.files).filter((k) => !k.endsWith('/'));

    // Should contain 2 jpg images + 1 _EDIT-FILE.json
    const jpgFiles = filesInZip.filter((k) => k.endsWith('.jpg'));
    const editFiles = filesInZip.filter((k) => k.endsWith('_EDIT-FILE.json'));

    assert.strictEqual(jpgFiles.length, 2, `Expected 2 JPG files in ZIP, found ${jpgFiles.length}`);
    assert.strictEqual(editFiles.length, 1, `Expected 1 _EDIT-FILE.json in ZIP, found ${editFiles.length}`);

    // Verify the project edit file inside the ZIP is valid project JSON
    const editFileContent = await zip.file(editFiles[0]).async('string');
    const parsedProject = JSON.parse(editFileContent);
    assert.ok(parsedProject.module, 'Project file must contain module');
    assert.ok(parsedProject.sections, 'Project file must contain sections');
    assert.ok(parsedProject.weeks, 'Project file must contain weeks');
    console.log(`✓ Range ZIP exported successfully: ${zipFilename} containing ${jpgFiles.length} JPG pages and ${editFiles[0]}`);

    await page.waitForTimeout(500);

    // -------------------------------------------------------------------------
    // 5.6 Confirm PDF Export Still Works
    // -------------------------------------------------------------------------
    console.log('\n5.6 Confirming PDF Export Still Works...');
    if (!await page.isVisible('[data-testid="export-format-pdf"]')) {
      await page.click('[data-testid="export-options-btn"]');
      await page.waitForSelector('[data-testid="export-format-pdf"]');
    }

    await page.click('button:has-text("Current Page Only")');
    await page.click('[data-testid="export-format-pdf"]');
    await page.fill('[data-testid="export-page-range-input"]', 'all');

    const pdfDownloadPromise = page.waitForEvent('download', { timeout: 15000 });
    await page.click('[data-testid="start-export-btn"]');

    const pdfDownload = await pdfDownloadPromise;
    const pdfFilename = pdfDownload.suggestedFilename();
    assert.ok(pdfFilename.endsWith('.pdf'), `PDF filename must end with .pdf, got ${pdfFilename}`);

    const pdfPath = await pdfDownload.path();
    const pdfBuffer = fs.readFileSync(pdfPath);
    verifyPdfMagic(pdfBuffer);
    console.log(`✓ PDF export confirmed working: ${pdfFilename} begins with %PDF- header`);

  } finally {
    await browser.close();
    if (serverProc) {
      serverProc.kill();
    }
  }

  console.log('\n=== ALL PHASE 13 ACCEPTANCE TESTS PASSED SUCCESSFULLY! ===');
}

runTests().catch((err) => {
  console.error('\n❌ PHASE 13 TEST FAILURE:', err);
  process.exit(1);
});
