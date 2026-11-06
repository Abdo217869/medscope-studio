import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const fs = require('fs');
const pdfParse = require('pdf-parse');
const { chromium } = require('D:/Medscope Site/node_modules/playwright-core');

(async () => {
  console.log('--- STARTING PHASE 3 STEP 0: PRINT MODE VERIFICATION ---');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1414, height: 2000 } });
  const page = await context.newPage();

  console.log('Navigating to preview server...');
  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);

  // 1. Using active GIT sample (7 weeks)
  console.log('Testing print mode on active GIT sample...');

  // Check how many weeks Foundation has
  const weeksCount = await page.evaluate(() => {
    const wrappers = document.querySelectorAll('.print-all-weeks-container .print-page-wrapper');
    return wrappers.length;
  });
  console.log('Rendered print page wrappers in DOM:', weeksCount);

  // 2. Generate PDF via Playwright page.pdf with preferCSSPageSize: true
  console.log('Generating print PDF with preferCSSPageSize: true...');
  const pdfBuffer = await page.pdf({
    preferCSSPageSize: true,
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 }
  });

  const pdfPath = 'reference/test_print_foundation_all_weeks.pdf';
  fs.writeFileSync(pdfPath, pdfBuffer);
  console.log(`Saved print PDF to ${pdfPath} (${pdfBuffer.length} bytes)`);

  // 3. Inspect PDF with pdf-parse
  console.log('Analyzing PDF pages and text content...');
  const { PDFParse } = pdfParse;
  const parser = new PDFParse({ data: pdfBuffer });
  const doc = await parser.load();
  console.log(`PDF Page Count: ${doc.numPages} (Expected: ${weeksCount})`);
  if (doc.numPages !== weeksCount) {
    throw new Error(`Page count mismatch! Expected ${weeksCount}, got ${doc.numPages}`);
  }

  // 4. Verify text bounding boxes in print media
  console.log('Verifying bounding boxes of all text elements in print media...');
  await page.emulateMedia({ media: 'print' });

  const bboxCheck = await page.evaluate(() => {
    const wrappers = document.querySelectorAll('.print-page-wrapper');
    let totalTextNodes = 0;
    let clippedTextNodes = 0;
    const details = [];

    wrappers.forEach((wrapper, wIdx) => {
      const wrapperRect = wrapper.getBoundingClientRect();
      const textNodes = wrapper.querySelectorAll('div, span, h1');
      textNodes.forEach(node => {
        if (node.children.length === 0 && node.textContent?.trim()) {
          totalTextNodes++;
          const r = node.getBoundingClientRect();
          // Check if lies outside wrapper bounds (with 2px tolerance)
          if (r.left < wrapperRect.left - 2 ||
              r.right > wrapperRect.right + 2 ||
              r.top < wrapperRect.top - 2 ||
              r.bottom > wrapperRect.bottom + 2) {
            clippedTextNodes++;
            details.push({
              weekIdx: wIdx,
              text: node.textContent.trim().slice(0, 30),
              nodeRect: { l: r.left, r: r.right, t: r.top, b: r.bottom },
              wrapperRect: { l: wrapperRect.left, r: wrapperRect.right, t: wrapperRect.top, b: wrapperRect.bottom }
            });
          }
        }
      });
    });

    return { totalTextNodes, clippedTextNodes, details: details.slice(0, 5) };
  });

  console.log(`Evaluated ${bboxCheck.totalTextNodes} text elements across all print pages.`);
  console.log(`Clipped text elements outside A4 page bounds: ${bboxCheck.clippedTextNodes}`);
  if (bboxCheck.clippedTextNodes > 0) {
    console.warn('Sample clipped nodes:', bboxCheck.details);
    throw new Error(`Found ${bboxCheck.clippedTextNodes} clipped text nodes in print pages!`);
  }

  await page.emulateMedia({ media: 'screen' });
  await browser.close();
  console.log('--- PRINT MODE VERIFIED WITH 100% SUCCESS! ---');
})();
