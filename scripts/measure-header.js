import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('D:/Medscope Site/node_modules/playwright-core');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 2200 } });

  const img1Data = fs.readFileSync('reference/1.jpg').toString('base64');

  await page.setContent(`
    <!DOCTYPE html>
    <html>
      <body style="margin:0; background: black;">
        <canvas id="canvas" width="1414" height="2000"></canvas>
      </body>
    </html>
  `);

  const metrics = await page.evaluate(async (base64) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.getElementById('canvas');
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, 1414, 2000);

        // Check vertical profile of center column (x 400 to 900) between y 0 and y 250
        // Find text pixels (lum < 50 for dark navy, or gold for section label)
        const headerData = ctx.getImageData(350, 0, 600, 240);
        let titleTop = -1, titleBottom = -1, sectionTop = -1, sectionBottom = -1;

        // Find navy title pixels: r < 50, g < 50, b < 70
        for (let y = 0; y < 140; y++) {
          let navyCount = 0;
          for (let x = 0; x < 600; x++) {
            const idx = (y * 600 + x) * 4;
            const r = headerData.data[idx];
            const g = headerData.data[idx+1];
            const b = headerData.data[idx+2];
            if (r < 50 && g < 50 && b < 80) navyCount++;
          }
          if (navyCount > 5) {
            if (titleTop === -1) titleTop = y;
            titleBottom = y;
          }
        }

        let minX = 9999, maxX = 0, minY = 9999, maxY = 0;
        // Search section label between y 110 and 235, x 300 to 1100
        const id = ctx.getImageData(300, 110, 800, 125);
        for (let y = 0; y < 125; y++) {
          for (let x = 0; x < 800; x++) {
            const idx = (y * 800 + x) * 4;
            const r = id.data[idx], g = id.data[idx+1], b = id.data[idx+2];
            // Look for non-nebula pixels: nebula is mostly blue (b > r, b > g). Gold is r > b && g > b
            if (r > 130 && g > 100 && r > b + 20) {
              minX = Math.min(minX, x + 300);
              maxX = Math.max(maxX, x + 300);
              minY = Math.min(minY, y + 110);
              maxY = Math.max(maxY, y + 110);
            }
          }
        }

        resolve({ titleTop, titleBottom, minX, maxX, minY, maxY, weekTop, weekBottom, termTop, termBottom });
      };
      img.src = 'data:image/jpeg;base64,' + base64;
    });
  }, img1Data);

  console.log('1.jpg Header Vertical Metrics:');
  console.log('  Title ("Foundation"):   y = ' + metrics.titleTop + ' to ' + metrics.titleBottom + ' (height ' + (metrics.titleBottom - metrics.titleTop) + 'px)');
  console.log('  Section ("Group (a)..."): y = ' + metrics.sectionTop + ' to ' + metrics.sectionBottom + ' (height ' + (metrics.sectionBottom - metrics.sectionTop) + 'px)');
  console.log('  Gap between Section bottom and Table top (y 240): ' + (240 - metrics.sectionBottom) + 'px');
  console.log('  Week ("Week 1"):         y = ' + metrics.weekTop + ' to ' + metrics.weekBottom);
  console.log('  Term ("1st Term"):       y = ' + metrics.termTop + ' to ' + metrics.termBottom);

  await browser.close();
})();
