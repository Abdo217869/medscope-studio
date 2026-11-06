import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('D:/Medscope Site/node_modules/playwright-core');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1414, height: 2000 } });
  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);

  await page.emulateMedia({ media: 'print' });
  await page.screenshot({ path: 'reference/test_print_view.png', fullPage: true });

  console.log('Saved reference/test_print_view.png');
  await browser.close();
})();

