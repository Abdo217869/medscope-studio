import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('D:/Medscope Site/node_modules/playwright-core');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1414, height: 2000 } });
  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);

  await page.emulateMedia({ media: 'print' });
  const bounding = await page.evaluate(() => {
    const el = document.querySelector('.schedule-page');
    const rect = el.getBoundingClientRect();
    const table = el.querySelector('[style*="border"]');
    const tableRect = table ? table.getBoundingClientRect() : null;
    return {
      window: { w: window.innerWidth, h: window.innerHeight },
      page: { w: rect.width, h: rect.height, top: rect.top, left: rect.left, bottom: rect.bottom, right: rect.right },
      table: tableRect ? { w: tableRect.width, h: tableRect.height, top: tableRect.top, left: tableRect.left, bottom: tableRect.bottom, right: tableRect.right } : null
    };
  });
  console.log('Bounding in print media:', JSON.stringify(bounding, null, 2));

  // Also check page count in PDF
  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 }
  });

  // Count pages by searching for /Type /Page in PDF buffer
  const str = pdfBuffer.toString('latin1');
  const pageMatches = str.match(/\/Type\s*\/Page\b/g);
  console.log('Number of pages in generated PDF:', pageMatches ? pageMatches.length : 0);

  await browser.close();
})();

