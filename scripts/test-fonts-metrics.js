import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('D:/Medscope Site/node_modules/playwright-core');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent(`
    <!DOCTYPE html>
    <html>
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Lilita+One&family=Grand+Hotel&family=Poppins:wght@800&family=Fredoka:wght@700&display=swap" rel="stylesheet">
      </head>
      <body>
        <canvas id="c"></canvas>
      </body>
    </html>
  `);
  await page.evaluate(() => document.fonts.ready);

  const widths = await page.evaluate(() => {
    const ctx = document.getElementById('c').getContext('2d');
    function measure(text, font) {
      ctx.font = font;
      return Math.round(ctx.measureText(text).width);
    }
    return {
      wednesday_38: measure('Wednesday', '38px "Lilita One"'),
      wednesday_36: measure('Wednesday', '36px "Lilita One"'),
      wednesday_34: measure('Wednesday', '34px "Lilita One"'),
      wednesday_32: measure('Wednesday', '32px "Lilita One"'),
      saturday_38: measure('Saturday', '38px "Lilita One"'),
      topicLong_28: measure('(Functional organization of human body)', '28px "Lilita One"'),
      topicLong_26: measure('(Functional organization of human body)', '26px "Lilita One"'),
      topicLong_25: measure('(Functional organization of human body)', '25px "Lilita One"'),
      off_62: measure('OFF', '62px "Lilita One"'),
      recorded_48: measure('Recorded', '48px "Lilita One"'),
      hall4_50: measure('Hall 4', '50px "Lilita One"'),
      dayColWidth: 202 - 4 - 24, // 174px
      topicColWidth: 632 - 4 - 24, // 604px
      placeColWidth: 246 - 4 - 24, // 218px
      timeColWidth: 234 - 4 - 24  // 206px
    };
  });

  console.log('Lilita One Text Measurements:', widths);
  await browser.close();
})();

