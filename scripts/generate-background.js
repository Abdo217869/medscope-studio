import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('D:/Medscope Site/node_modules/playwright-core');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 1700 } });

  await page.setContent(`
    <!DOCTYPE html>
    <html>
    <head><style>body { margin: 0; background: #000; overflow: hidden; }</style></head>
    <body>
      <canvas id="cv" width="1200" height="1700"></canvas>
      <script>
        const cv = document.getElementById('cv');
        const ctx = cv.getContext('2d');
        const W = cv.width;
        const H = cv.height;

        // 1. Deep Midnight Blue Base
        const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
        bgGrad.addColorStop(0, '#04091a');
        bgGrad.addColorStop(0.3, '#07132e');
        bgGrad.addColorStop(0.6, '#061129');
        bgGrad.addColorStop(1, '#030816');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, W, H);

        // 2. Nebula Glows (soft organic radial gradients)
        function drawNebula(x, y, r, colorStart, colorEnd) {
          const g = ctx.createRadialGradient(x, y, 0, x, y, r);
          g.addColorStop(0, colorStart);
          g.addColorStop(0.5, colorEnd);
          g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }

        // Center-right cyan nebula
        drawNebula(W * 0.85, H * 0.45, 550, 'rgba(14, 165, 233, 0.22)', 'rgba(2, 132, 199, 0.08)');
        // Center-left blue nebula
        drawNebula(W * 0.15, H * 0.55, 600, 'rgba(56, 189, 248, 0.18)', 'rgba(14, 116, 144, 0.06)');
        // Center subtle bright core
        drawNebula(W * 0.5, H * 0.4, 450, 'rgba(96, 165, 250, 0.15)', 'rgba(30, 58, 138, 0.05)');
        // Bottom subtle nebula
        drawNebula(W * 0.4, H * 0.85, 500, 'rgba(37, 99, 235, 0.12)', 'rgba(15, 23, 42, 0)');
        // Top subtle violet glow
        drawNebula(W * 0.6, H * 0.12, 400, 'rgba(99, 102, 241, 0.12)', 'rgba(30, 27, 75, 0)');

        // 3. Realistic Stars (clusters + background starfield)
        // Pseudo-random with seed
        let seed = 42;
        function rnd() {
          seed = (seed * 9301 + 49297) % 233280;
          return seed / 233280;
        }

        const starCount = 650;
        for (let i = 0; i < starCount; i++) {
          const x = rnd() * W;
          const y = rnd() * H;
          const size = rnd() * 1.6 + 0.3;
          const alpha = rnd() * 0.75 + 0.25;

          const isBlueWhite = rnd() > 0.3;
          const isGold = !isBlueWhite && rnd() > 0.6;
          const color = isGold
            ? 'rgba(254, 240, 138, ' + alpha + ')'
            : (isBlueWhite ? 'rgba(224, 242, 254, ' + alpha + ')' : 'rgba(255, 255, 255, ' + alpha + ')');

          ctx.beginPath();
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();

          // Occasional star halo/glow
          if (size > 1.4 && rnd() > 0.6) {
            ctx.beginPath();
            ctx.arc(x, y, size * 3, 0, Math.PI * 2);
            ctx.fillStyle = isGold ? 'rgba(250, 204, 21, 0.12)' : 'rgba(56, 189, 248, 0.15)';
            ctx.fill();
          }

          // Occasional 4-point cross diffraction spike
          if (size > 1.6 && rnd() > 0.75) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.lineWidth = 0.5;
            const spikeLen = size * 4;
            ctx.beginPath();
            ctx.moveTo(x - spikeLen, y);
            ctx.lineTo(x + spikeLen, y);
            ctx.moveTo(x, y - spikeLen);
            ctx.lineTo(x, y + spikeLen);
            ctx.stroke();
          }
        }
      </script>
    </body>
    </html>
  `);

  await page.waitForTimeout(500);
  const canvasElement = await page.$('#cv');
  const buffer = await canvasElement.screenshot({ type: 'png' });
  fs.writeFileSync('public/assets/cosmic-stars-clean.png', buffer);
  console.log('Generated clean cosmic background: public/assets/cosmic-stars-clean.png');
  await browser.close();
})();

