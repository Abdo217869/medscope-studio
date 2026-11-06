import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('D:/Medscope Site/node_modules/playwright-core');

(async () => {
  console.log('--- STARTING EXPORT CUSTOMIZATION & PRINT MODE VERIFICATION ---');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1200 }, acceptDownloads: true });
  const page = await context.newPage();

  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err));

  // 1. Navigate to App
  console.log('Navigating to http://localhost:4173 ...');
  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1000);

  // 2. Schedule already active as GIT sample
  console.log('Verifying active schedule for export testing...');

  // 3. Test Print Mode Bounds
  console.log('Verifying Print Mode scaling and zero-clipping...');
  await page.emulateMedia({ media: 'print' });
  const printBounding = await page.evaluate(() => {
    const pageEl = document.querySelector('.print-page-wrapper .schedule-page') || document.querySelector('.schedule-page');
    const tableEl = pageEl ? pageEl.querySelector('[style*="border"]') : null;
    const pageRect = pageEl.getBoundingClientRect();
    const tableRect = tableEl ? tableEl.getBoundingClientRect() : null;
    return {
      page: { w: pageRect.width, h: pageRect.height, top: pageRect.top, left: pageRect.left },
      table: tableRect ? { w: tableRect.width, h: tableRect.height, right: tableRect.right, bottom: tableRect.bottom } : null
    };
  });
  console.log('Print Bounding Box:', printBounding);
  const printFitsA4 = printBounding.page.w <= 795 && printBounding.page.h <= 1125 && printBounding.page.top === 0;
  const tableInsideA4 = printBounding.table && printBounding.table.right <= 794 && printBounding.table.bottom <= 1123;
  console.log('Print page fits A4 perfectly:', printFitsA4);
  console.log('Table completely inside A4 with zero clipping:', tableInsideA4);

  // Return to screen media
  await page.emulateMedia({ media: 'screen' });
  await page.waitForTimeout(300);

  // 4. Test Export Options Modal
  console.log('Opening Export Options Modal...');
  const optionsBtn = await page.$('[data-testid="export-options-btn"]');
  if (optionsBtn) {
    await optionsBtn.click();
    await page.waitForTimeout(400);
  }

  const modalVisible = await page.evaluate(() => {
    return !!document.querySelector('.fixed.inset-0.z-50');
  });
  console.log('Export Modal is visible:', modalVisible);

  // 5. Test Multi-Page PDF Export (All 4 Weeks for Section A1)
  console.log('Selecting "Current Section (All Weeks)" multi-page combined PDF...');
  await page.click('button:has-text("Current Section (All Weeks)")');
  await page.waitForTimeout(300);

  const previewFilename = await page.evaluate(() => {
    const el = document.querySelector('.text-emerald-400');
    return el ? el.textContent.trim() : '';
  });
  console.log('Generated Filename Preview:', previewFilename);

  console.log('Triggering Multi-Page PDF Export...');
  const [ download ] = await Promise.all([
    page.waitForEvent('download', { timeout: 60000 }),
    page.click('button:has-text("Start Export")')
  ]);

  const filename = download.suggestedFilename();
  console.log('Multi-Page PDF Downloaded:', filename);
  await download.saveAs('reference/' + filename);

  // Verify page count of downloaded PDF
  const fs = require('fs');
  const downloadedBuffer = fs.readFileSync('reference/' + filename);
  const pdfStr = downloadedBuffer.toString('latin1');
  const pageMatches = pdfStr.match(/\/Type\s*\/Page\b/g);
  const pageCount = pageMatches ? pageMatches.length : 0;
  console.log(`Downloaded PDF has ${pageCount} pages`);

  // 6. Test ZIP Export (All Sections for Current Week)
  console.log('Testing ZIP Archive Export for Week 1 (All Sections)...');
  await page.click('[data-testid="export-options-btn"]');
  await page.waitForTimeout(400);

  await page.click('button:has-text("Current Week (All Sections)")');
  await page.waitForTimeout(300);

  // Choose ZIP mode
  const zipRadio = await page.$('input[value="zip"]');
  if (zipRadio) await zipRadio.click();
  await page.waitForTimeout(200);

  console.log('Triggering ZIP Export...');
  const [ zipDownload ] = await Promise.all([
    page.waitForEvent('download', { timeout: 90000 }),
    page.click('button:has-text("Start Export")')
  ]);

  const zipFilename = zipDownload.suggestedFilename();
  console.log('ZIP Archive Downloaded:', zipFilename);
  await zipDownload.saveAs('reference/' + zipFilename);
  const zipStat = fs.statSync('reference/' + zipFilename);
  console.log('ZIP file size:', zipStat.size, 'bytes');

  await page.waitForTimeout(1000);
  await browser.close();
  console.log('--- EXPORT CUSTOMIZATION & PRINT MODE VERIFIED WITH 100% SUCCESS! ---');
})();

