import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { PNG } = require('pngjs');

// Read public/assets/bg.png
const bgPng = PNG.sync.read(fs.readFileSync('public/assets/bg.png'));

function getBgAvg(x, y, w, h) {
  let r = 0, g = 0, b = 0, count = 0;
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const idx = (bgPng.width * (y + dy) + (x + dx)) << 2;
      r += bgPng.data[idx];
      g += bgPng.data[idx + 1];
      b += bgPng.data[idx + 2];
      count++;
    }
  }
  return { r: r / count, g: g / count, b: b / count };
}

const bgReg1 = getBgAvg(270, 500, 190, 60);
const bgReg2 = getBgAvg(900, 500, 200, 60);
const bgReg3 = getBgAvg(270, 620, 190, 60);

console.log('Background alone:');
console.log('  Region 1 (Topic Sun):', bgReg1);
console.log('  Region 2 (Place Sun):', bgReg2);
console.log('  Region 3 (Topic Mon):', bgReg3);

// Target averages from 1.jpg:
// Reg 1: 119, 142, 175
// Reg 2: 130, 146, 167
// Reg 3: 127, 149, 181

let bestAlpha = 0, bestR = 0, bestG = 0, bestB = 0, minErr = Infinity;

for (let a = 0.55; a <= 0.85; a += 0.01) {
  for (let r = 150; r <= 200; r += 2) {
    for (let g = 160; g <= 210; g += 2) {
      for (let b = 180; b <= 240; b += 2) {
        const pred1 = { r: r * a + bgReg1.r * (1 - a), g: g * a + bgReg1.g * (1 - a), b: b * a + bgReg1.b * (1 - a) };
        const pred2 = { r: r * a + bgReg2.r * (1 - a), g: g * a + bgReg2.g * (1 - a), b: b * a + bgReg2.b * (1 - a) };
        const pred3 = { r: r * a + bgReg3.r * (1 - a), g: g * a + bgReg3.g * (1 - a), b: b * a + bgReg3.b * (1 - a) };

        const err = Math.pow(pred1.r - 119, 2) + Math.pow(pred1.g - 142, 2) + Math.pow(pred1.b - 175, 2)
                  + Math.pow(pred2.r - 130, 2) + Math.pow(pred2.g - 146, 2) + Math.pow(pred2.b - 167, 2)
                  + Math.pow(pred3.r - 127, 2) + Math.pow(pred3.g - 149, 2) + Math.pow(pred3.b - 181, 2);

        if (err < minErr) {
          minErr = err;
          bestAlpha = a;
          bestR = r;
          bestG = g;
          bestB = b;
        }
      }
    }
  }
}

console.log('Optimal overlay: rgba(' + bestR + ', ' + bestG + ', ' + bestB + ', ' + bestAlpha.toFixed(2) + ')');
console.log('Minimum error:', minErr);

const pred1 = { r: Math.round(bestR * bestAlpha + bgReg1.r * (1 - bestAlpha)), g: Math.round(bestG * bestAlpha + bgReg1.g * (1 - bestAlpha)), b: Math.round(bestB * bestAlpha + bgReg1.b * (1 - bestAlpha)) };
const pred2 = { r: Math.round(bestR * bestAlpha + bgReg2.r * (1 - bestAlpha)), g: Math.round(bestG * bestAlpha + bgReg2.g * (1 - bestAlpha)), b: Math.round(bestB * bestAlpha + bgReg2.b * (1 - bestAlpha)) };
const pred3 = { r: Math.round(bestR * bestAlpha + bgReg3.r * (1 - bestAlpha)), g: Math.round(bestG * bestAlpha + bgReg3.g * (1 - bestAlpha)), b: Math.round(bestB * bestAlpha + bgReg3.b * (1 - bestAlpha)) };

console.log('Predicted Reg 1 vs 1.jpg (119, 142, 175):', pred1);
console.log('Predicted Reg 2 vs 1.jpg (130, 146, 167):', pred2);
console.log('Predicted Reg 3 vs 1.jpg (127, 149, 181):', pred3);

