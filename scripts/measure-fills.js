import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('D:/Medscope Site/node_modules/playwright-core');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 2200 } });

  // 1. Measure reference/1.jpg
  const img1Data = fs.readFileSync('reference/1.jpg').toString('base64');

  await page.setContent(`
    <!DOCTYPE html>
    <html>
      <body style="margin:0; background: black;">
        <canvas id="refCanvas" width="1414" height="2000"></canvas>
      </body>
    </html>
  `);

  const refStats = await page.evaluate(async (base64) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.getElementById('refCanvas');
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, 1414, 2000);

        function sampleRegion(x, y, w, h) {
          const imgData = ctx.getImageData(x, y, w, h);
          let r = 0, g = 0, b = 0, count = 0;
          for (let i = 0; i < imgData.data.length; i += 4) {
            r += imgData.data[i];
            g += imgData.data[i + 1];
            b += imgData.data[i + 2];
            count++;
          }
          return {
            r: Math.round(r / count),
            g: Math.round(g / count),
            b: Math.round(b / count),
            count
          };
        }

        function findDarkestPixel(x, y, w, h) {
          const imgData = ctx.getImageData(x, y, w, h);
          let minLum = 999999;
          let best = null;
          for (let i = 0; i < imgData.data.length; i += 4) {
            const r = imgData.data[i];
            const g = imgData.data[i + 1];
            const b = imgData.data[i + 2];
            const lum = r * 0.299 + g * 0.587 + b * 0.114;
            if (lum < minLum) {
              minLum = lum;
              best = { r, g, b, lum: Math.round(lum) };
            }
          }
          return best;
        }

        // Region 1: Sunday OFF row, Topic cell left of "OFF" (x 270-460, y 500-560)
        const region1 = sampleRegion(270, 500, 190, 60);

        // Region 2: Sunday OFF row, Place cell (x 900-1100, y 500-560)
        const region2 = sampleRegion(900, 500, 200, 60);

        // Region 3: Monday OFF row, Topic cell left of "OFF" (x 270-460, y 620-680)
        const region3 = sampleRegion(270, 620, 190, 60);

        // Region 4: Day cell fill - Sunday Day cell left margin (x 55-75, y 500-540) - text-free
        const dayCell = sampleRegion(55, 500, 20, 40);

        // Darkest pixel in Foundation title (x 350-950, y 50-130)
        const titleGlyphDarkest = findDarkestPixel(350, 50, 600, 80);

        resolve({ region1, region2, region3, dayCell, titleGlyphDarkest });
      };
      img.src = 'data:image/jpeg;base64,' + base64;
    });
  }, img1Data);

  // 2. Measure rendered app on localhost:4173
  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);

  // Switch to Foundation preset
  const presetSelect = await page.$('select[data-testid="preset-select"]');
  if (presetSelect) {
    await presetSelect.selectOption({ label: 'Foundation (1st Term)' });
    await page.waitForTimeout(600);
  }

  // Ensure zoom is 1 or take 1414x2000 screenshot of .schedule-page
  const schedulePage = await page.$('.schedule-page');
  const renderBuffer = await schedulePage.screenshot();
  const renderBase64 = renderBuffer.toString('base64');

  await page.setContent(`
    <!DOCTYPE html>
    <html>
      <body style="margin:0; background: black;">
        <canvas id="renderCanvas" width="1414" height="2000"></canvas>
      </body>
    </html>
  `);

  const renderStats = await page.evaluate(async (base64) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.getElementById('renderCanvas');
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, 1414, 2000);

        function sampleRegion(x, y, w, h) {
          const imgData = ctx.getImageData(x, y, w, h);
          let r = 0, g = 0, b = 0, count = 0;
          for (let i = 0; i < imgData.data.length; i += 4) {
            r += imgData.data[i];
            g += imgData.data[i + 1];
            b += imgData.data[i + 2];
            count++;
          }
          return {
            r: Math.round(r / count),
            g: Math.round(g / count),
            b: Math.round(b / count),
            count
          };
        }

        const region1 = sampleRegion(270, 500, 190, 60);
        const region2 = sampleRegion(900, 500, 200, 60);
        const region3 = sampleRegion(270, 620, 190, 60);
        const dayCell = sampleRegion(55, 500, 20, 40);

        resolve({ region1, region2, region3, dayCell });
      };
      img.src = 'data:image/png;base64,' + base64;
    });
  }, renderBase64);

  console.log('=== COMPARISON MEASUREMENTS (1.jpg vs Render) ===');
  console.log('Region 1 (Sunday Topic cell x:270-460, y:500-560):');
  console.log('  1.jpg:  rgb(' + refStats.region1.r + ', ' + refStats.region1.g + ', ' + refStats.region1.b + ')');
  console.log('  Render: rgb(' + renderStats.region1.r + ', ' + renderStats.region1.g + ', ' + renderStats.region1.b + ')');
  console.log('  Delta:  ΔR=' + (renderStats.region1.r - refStats.region1.r) + ' ΔG=' + (renderStats.region1.g - refStats.region1.g) + ' ΔB=' + (renderStats.region1.b - refStats.region1.b));

  console.log('\nRegion 2 (Sunday Place cell x:900-1100, y:500-560):');
  console.log('  1.jpg:  rgb(' + refStats.region2.r + ', ' + refStats.region2.g + ', ' + refStats.region2.b + ')');
  console.log('  Render: rgb(' + renderStats.region2.r + ', ' + renderStats.region2.g + ', ' + renderStats.region2.b + ')');
  console.log('  Delta:  ΔR=' + (renderStats.region2.r - refStats.region2.r) + ' ΔG=' + (renderStats.region2.g - refStats.region2.g) + ' ΔB=' + (renderStats.region2.b - refStats.region2.b));

  console.log('\nRegion 3 (Monday Topic cell x:270-460, y:620-680):');
  console.log('  1.jpg:  rgb(' + refStats.region3.r + ', ' + refStats.region3.g + ', ' + refStats.region3.b + ')');
  console.log('  Render: rgb(' + renderStats.region3.r + ', ' + renderStats.region3.g + ', ' + renderStats.region3.b + ')');
  console.log('  Delta:  ΔR=' + (renderStats.region3.r - refStats.region3.r) + ' ΔG=' + (renderStats.region3.g - refStats.region3.g) + ' ΔB=' + (renderStats.region3.b - refStats.region3.b));

  console.log('\nDay Cell (Sunday x:80-220, y:470-490):');
  console.log('  1.jpg:  rgb(' + refStats.dayCell.r + ', ' + refStats.dayCell.g + ', ' + refStats.dayCell.b + ')');
  console.log('  Render: rgb(' + renderStats.dayCell.r + ', ' + renderStats.dayCell.g + ', ' + renderStats.dayCell.b + ')');
  console.log('  Delta:  ΔR=' + (renderStats.dayCell.r - refStats.dayCell.r) + ' ΔG=' + (renderStats.dayCell.g - refStats.dayCell.g) + ' ΔB=' + (renderStats.dayCell.b - refStats.dayCell.b));

  console.log('\nReference Darkest Title Glyph:');
  console.log('  1.jpg Title Glyph Core: rgb(' + refStats.titleGlyphDarkest.r + ', ' + refStats.titleGlyphDarkest.g + ', ' + refStats.titleGlyphDarkest.b + ')', '#0' + refStats.titleGlyphDarkest.r.toString(16) + refStats.titleGlyphDarkest.g.toString(16) + refStats.titleGlyphDarkest.b.toString(16));

  await browser.close();
})();

