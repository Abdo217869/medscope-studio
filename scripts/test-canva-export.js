import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import JSZip from 'jszip';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { chromium } = require('D:/Medscope Site/node_modules/playwright-core');

import { buildCanvaPptx } from '../src/utils/exportCanvaPptx.js';
import { buildFilename } from '../src/utils/exportPdf.js';
import { DEFAULT_THEME } from '../src/constants.js';

const BASE_URL = 'http://localhost:4173';
const CANVA_TEST_DIR = path.resolve('reference/canva-test');

async function nodeAssetLoader(url) {
  if (!url) return null;
  if (url.startsWith('data:')) return url;
  const rel = url.replace(/^\.\//, '');
  const fullPath = path.resolve('public', rel);
  if (!fs.existsSync(fullPath)) {
    console.warn('Asset not found:', fullPath);
    return null;
  }
  const ext = path.extname(fullPath).slice(1).toLowerCase() || 'png';
  const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;
  const b64 = fs.readFileSync(fullPath).toString('base64');
  return `data:${mime};base64,${b64}`;
}

function checkServerRunning() {
  return new Promise((resolve) => {
    const req = http.get(BASE_URL, () => resolve(true));
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function ensurePreviewServer() {
  if (await checkServerRunning()) return null;
  const proc = spawn('npm.cmd', ['run', 'preview', '--', '--port', '4173'], {
    shell: true,
    stdio: 'ignore'
  });
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 500));
    if (await checkServerRunning()) return proc;
  }
  throw new Error('Preview server failed to start');
}

async function run() {
  console.log('=== TEST SUITE: CANVA EDITABLE PPTX PROTOTYPE ===\n');

  // 1. Load GIT sample & generate reference/canva-test/ sample for Section 1 Week 1
  const gitSchedule = JSON.parse(fs.readFileSync('src/samples/GIT_all_sections.json', 'utf8'));
  const sec1 = gitSchedule.sections.find(s => String(s.id) === '1');
  const week1 = gitSchedule.weeks.find(w => w.n === 1);
  assert.ok(sec1 && week1, 'GIT Section 1 and Week 1 must exist');

  if (!fs.existsSync(CANVA_TEST_DIR)) {
    fs.mkdirSync(CANVA_TEST_DIR, { recursive: true });
  }

  const ctx = {
    module: gitSchedule.module.title,
    term: gitSchedule.module.term,
    group: sec1.letter || 'A',
    section: sec1.id,
    week: String(week1.n)
  };
  const baseFilename = buildFilename('{module}_Group_{group}_Section_{section}_Week_{week}', ctx, 'pptx');
  const canvaFilename = baseFilename.replace(/\.pptx$/i, '_CANVA.pptx');
  const outPath = path.join(CANVA_TEST_DIR, canvaFilename);

  const pptx = await buildCanvaPptx({
    moduleInfo: gitSchedule.module,
    section: sec1,
    week: week1,
    theme: DEFAULT_THEME,
    subjects: gitSchedule.subjects,
    sessionTypes: gitSchedule.sessionTypes,
    pageNumber: 1,
    showOffDays: true,
    assetLoader: nodeAssetLoader
  });

  const pptxBuffer = await pptx.write({ outputType: 'nodebuffer' });
  fs.writeFileSync(outPath, pptxBuffer);
  console.log(`✓ Generated sample PPTX: ${outPath} (${(pptxBuffer.length / 1024).toFixed(1)} KB)`);

  // 2. Self-check PPTX internals by unzipping and inspecting XML & media
  const zip = await JSZip.loadAsync(pptxBuffer);
  const presXml = await zip.file('ppt/presentation.xml').async('string');
  const slideXml = await zip.file('ppt/slides/slide1.xml').async('string');
  const mediaFiles = Object.keys(zip.files).filter(k => k.startsWith('ppt/media/'));

  // Slide ratio check (1414/96 * 914400 = 13468350, 2000/96 * 914400 = 19050000)
  assert.ok(presXml.includes('cx="13468350"') && presXml.includes('cy="19050000"'), 'Slide dimensions must match 1414x2000 ratio');

  // Exact font names check
  for (const fontName of ['Fredoka', 'Arimo', 'Lilita One', 'Poppins', 'Grand Hotel']) {
    assert.ok(slideXml.includes(fontName), `Font "${fontName}" must be present in slide1.xml`);
  }

  // Underline check
  assert.ok(slideXml.includes('u="sng"'), 'Single underline (u="sng") must be present on session type / topic lines');

  // Media layers check (bg, qr, logo)
  assert.ok(mediaFiles.length >= 3, `Expected >= 3 embedded media files (bg, qr, logo), got ${mediaFiles.length}`);

  // Real editable text check
  assert.ok(slideXml.includes('Gastrointestinal Tract'), 'Module title must be editable text');
  assert.ok(slideXml.includes('Week 1'), 'Week label must be editable text');
  assert.ok(slideXml.includes('Group (A) Section 1'), 'Section label must be editable text');
  console.log(`✓ Self-check passed: 1414x2000 ratio, 5 fonts, underlines, ${mediaFiles.length} picture layers, editable text nodes`);

  // 3. E2E Browser test in ExportModal
  const serverProc = await ensurePreviewServer();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const page = await context.newPage();

  try {
    await page.goto(`${BASE_URL}/#/app`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid="schedule-page-canvas"]');

    await page.click('[data-testid="export-options-btn"]');
    await page.waitForSelector('[data-testid="export-format-canva"]');
    await page.click('[data-testid="export-format-canva"]');
    await page.waitForSelector('[data-testid="canva-experimental-note"]');

    const noteText = await page.textContent('[data-testid="canva-experimental-note"]');
    assert.ok(noteText.includes('Experimental. Upload to Canva > Create a design > Import file. Small differences from the preview are possible.'));

    const dlPromise = page.waitForEvent('download', { timeout: 15000 });
    await page.click('[data-testid="start-export-btn"]');
    const dl = await dlPromise;
    const dlName = dl.suggestedFilename();
    assert.ok(dlName.endsWith('_CANVA.pptx'), `Expected _CANVA.pptx download, got ${dlName}`);

    const dlBuf = fs.readFileSync(await dl.path());
    assert.strictEqual(dlBuf[0], 0x50); // 'P'
    assert.strictEqual(dlBuf[1], 0x4b); // 'K'
    console.log(`✓ Browser UI downloaded valid PPTX: ${dlName}`);
  } finally {
    await browser.close();
    if (serverProc) serverProc.kill();
  }

  console.log('\n=== ALL CANVA PROTOTYPE TESTS PASSED ===');
}

run().catch((err) => {
  console.error('❌ CANVA TEST FAILURE:', err);
  process.exit(1);
});
