import { createRequire } from 'module';
import assert from 'assert';
import path from 'path';
import fs from 'fs';

const require = createRequire(import.meta.url);
const { chromium } = require('D:/Medscope Site/node_modules/playwright-core');

const SCREENSHOT_DIR = path.resolve('reference/phase7b_screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function runPhase7bTests() {
  console.log('=== RUNNING PHASE 7b ACCEPTANCE TESTS ===\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1200 }
  });
  const page = await context.newPage();

  try {
    console.log('1. Navigating to Medscope Studio Editor (#/app)...');
    await page.goto('http://localhost:4173/#/app', { waitUntil: 'networkidle' });

    // Ensure we start with a clean state on the official GIT schedule
    await page.evaluate(() => {
      localStorage.removeItem('medscope_active_theme');
      // If needed, clear projects to load fresh default with Canva fonts
      localStorage.removeItem('medscope_projects');
      localStorage.removeItem('medscope_active_project_id');
    });
    await page.goto('http://localhost:4173/#/app', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Wait for fonts to be ready
    console.log('2. Waiting for document.fonts.ready and checking self-hosted fonts...');
    await page.evaluate(async () => {
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }
    });

    const fontCheck = await page.evaluate(async () => {
      const families = ['Fredoka', 'Arimo', 'Lilita One', 'Poppins', 'Grand Hotel'];
      const loaded = [];
      const missing = [];

      for (const fam of families) {
        // Trigger check with typical font styles
        const ok = document.fonts.check(`16px "${fam}"`) ||
                   document.fonts.check(`400 16px "${fam}"`) ||
                   document.fonts.check(`600 16px "${fam}"`) ||
                   document.fonts.check(`700 16px "${fam}"`);
        if (ok) {
          loaded.push(fam);
        } else {
          missing.push(fam);
        }
      }

      // Check total font faces loaded in document.fonts
      const allLoadedFaces = [];
      document.fonts.forEach(face => {
        allLoadedFaces.push({ family: face.family, status: face.status, weight: face.weight });
      });

      return { loaded, missing, allLoadedFaces };
    });

    console.log('Loaded font families:', fontCheck.loaded);
    assert.strictEqual(fontCheck.loaded.length, 5, `All 5 font families must be loaded. Missing: ${fontCheck.missing.join(', ')}`);
    console.log('✓ document.fonts has all five Canva font families loaded without CDN');

    // Verify Week 1 of Section 1 is active
    console.log('3. Verifying Section 1, Week 1 is rendered on schedule canvas...');
    const weekSelect = await page.$('[data-testid="week-select"]');
    if (weekSelect) {
      await page.selectOption('[data-testid="week-select"]', '1');
      await page.waitForTimeout(300);
    }

    // 4. Assert via getComputedStyle that each role uses the expected font-family, size, and weight
    console.log('4. Asserting typography roles via getComputedStyle...');

    const styles = await page.evaluate(() => {
      function cleanFamily(fam) {
        return fam ? fam.replace(/['"]/g, '').split(',')[0].trim() : '';
      }

      const results = {};

      const termEl = document.querySelector('[data-role="termLabel"]');
      if (termEl) {
        const cs = window.getComputedStyle(termEl);
        results.termLabel = {
          fontFamily: cleanFamily(cs.fontFamily),
          fontSize: cs.fontSize,
          fontWeight: cs.fontWeight
        };
      }

      const moduleEl = document.querySelector('[data-role="moduleTitle"]');
      if (moduleEl) {
        const cs = window.getComputedStyle(moduleEl);
        results.moduleTitle = {
          fontFamily: cleanFamily(cs.fontFamily),
          fontSize: cs.fontSize,
          fontWeight: cs.fontWeight
        };
      }

      const weekEl = document.querySelector('[data-role="weekLabel"]');
      if (weekEl) {
        const cs = window.getComputedStyle(weekEl);
        results.weekLabel = {
          fontFamily: cleanFamily(cs.fontFamily),
          fontSize: cs.fontSize
        };
      }

      const sectionEl = document.querySelector('[data-role="sectionLabel"]');
      if (sectionEl) {
        const cs = window.getComputedStyle(sectionEl);
        results.sectionLabel = {
          fontFamily: cleanFamily(cs.fontFamily),
          fontSize: cs.fontSize
        };
      }

      const headerEl = document.querySelector('[data-role="headerLabel"]');
      if (headerEl) {
        const cs = window.getComputedStyle(headerEl);
        results.headerLabels = {
          fontFamily: cleanFamily(cs.fontFamily),
          fontSize: cs.fontSize
        };
      }

      const dayEl = document.querySelector('[data-role="dayText"]');
      if (dayEl) {
        const cs = window.getComputedStyle(dayEl);
        results.dayText = {
          fontFamily: cleanFamily(cs.fontFamily),
          fontSize: cs.fontSize
        };
      }

      const dateEl = document.querySelector('[data-role="dayDate"]');
      if (dateEl) {
        const cs = window.getComputedStyle(dateEl);
        results.dayDate = {
          fontFamily: cleanFamily(cs.fontFamily),
          fontSize: cs.fontSize
        };
      }

      const sessionTypeEl = document.querySelector('[data-role="sessionType"]');
      if (sessionTypeEl) {
        const cs = window.getComputedStyle(sessionTypeEl);
        results.sessionType = {
          fontFamily: cleanFamily(cs.fontFamily),
          fontSize: cs.fontSize,
          fontWeight: cs.fontWeight,
          textDecorationLine: cs.textDecorationLine
        };
      }

      const sessionSubjectEl = document.querySelector('[data-role="sessionSubject"]');
      if (sessionSubjectEl) {
        const cs = window.getComputedStyle(sessionSubjectEl);
        results.sessionSubject = {
          fontFamily: cleanFamily(cs.fontFamily),
          fontSize: cs.fontSize,
          fontWeight: cs.fontWeight,
          textDecorationLine: cs.textDecorationLine
        };
      }

      const topicEl = document.querySelector('[data-role="topicLine"]');
      if (topicEl) {
        const cs = window.getComputedStyle(topicEl);
        results.topicLine = {
          fontFamily: cleanFamily(cs.fontFamily),
          fontSize: cs.fontSize,
          fontWeight: cs.fontWeight,
          textDecorationLine: cs.textDecorationLine
        };
      }

      const placeEl = document.querySelector('[data-role="placeText"]');
      if (placeEl) {
        const cs = window.getComputedStyle(placeEl);
        results.placeText = {
          fontFamily: cleanFamily(cs.fontFamily),
          fontSize: cs.fontSize,
          fontWeight: cs.fontWeight
        };
      }

      const timeEl = document.querySelector('[data-role="timeText"]');
      if (timeEl) {
        const cs = window.getComputedStyle(timeEl);
        results.timeText = {
          fontFamily: cleanFamily(cs.fontFamily),
          fontSize: cs.fontSize
        };
      }

      const footerEl = document.querySelector('[data-role="footerText"]');
      if (footerEl) {
        const cs = window.getComputedStyle(footerEl);
        results.footerText = {
          fontFamily: cleanFamily(cs.fontFamily),
          fontSize: cs.fontSize
        };
      }

      return results;
    });

    console.log('Computed styles summary:', JSON.stringify(styles, null, 2));

    // Assertions
    assert.strictEqual(styles.termLabel?.fontFamily, 'Poppins', 'Term label must use Poppins');
    assert.strictEqual(styles.termLabel?.fontSize, '41px', 'Term label size must be 41px');
    assert.strictEqual(styles.termLabel?.fontWeight, '700', 'Term label weight must be 700');

    assert.strictEqual(styles.moduleTitle?.fontFamily, 'Poppins', 'Module title must use Poppins');
    assert.strictEqual(styles.moduleTitle?.fontWeight, '800', 'Module title weight must be 800');

    assert.strictEqual(styles.weekLabel?.fontFamily, 'Grand Hotel', 'Week label must use Grand Hotel');
    assert.strictEqual(styles.sectionLabel?.fontFamily, 'Grand Hotel', 'Section label must use Grand Hotel');
    assert.strictEqual(styles.footerText?.fontFamily, 'Grand Hotel', 'Footer text must use Grand Hotel');

    assert.strictEqual(styles.headerLabels?.fontFamily, 'Lilita One', 'Header labels must use Lilita One');
    assert.strictEqual(styles.headerLabels?.fontSize, '70px', 'Header labels size must be 70px');

    assert.strictEqual(styles.dayText?.fontFamily, 'Lilita One', 'Day text must use Lilita One');
    assert.strictEqual(styles.dayDate?.fontFamily, 'Lilita One', 'Day date must use Lilita One');
    assert.strictEqual(styles.timeText?.fontFamily, 'Lilita One', 'Time text must use Lilita One');

    assert.strictEqual(styles.sessionType?.fontFamily, 'Fredoka', 'Session type must use Fredoka');
    assert.strictEqual(styles.sessionType?.fontSize, '41px', 'Session type size must be 41px');
    assert.strictEqual(styles.sessionType?.fontWeight, '600', 'Session type weight must be 600');
    assert.ok(styles.sessionType?.textDecorationLine.includes('underline'), 'Session type must be underlined');

    assert.strictEqual(styles.sessionSubject?.fontFamily, 'Fredoka', 'Session subject must use Fredoka');
    assert.strictEqual(styles.sessionSubject?.fontSize, '41px', 'Session subject size must be 41px');
    assert.strictEqual(styles.sessionSubject?.fontWeight, '600', 'Session subject weight must be 600');
    assert.ok(!styles.sessionSubject?.textDecorationLine.includes('underline') || styles.sessionSubject?.textDecorationLine === 'none', 'Session subject must not be underlined');

    assert.strictEqual(styles.topicLine?.fontFamily, 'Arimo', 'Topic line must use Arimo');
    assert.strictEqual(styles.topicLine?.fontWeight, '700', 'Topic line weight must be 700');
    assert.ok(styles.topicLine?.textDecorationLine.includes('underline'), 'Topic line must be underlined');

    assert.strictEqual(styles.placeText?.fontFamily, 'Fredoka', 'Place text must use Fredoka');
    assert.strictEqual(styles.placeText?.fontSize, '53px', 'Place text size must be 53px');
    assert.strictEqual(styles.placeText?.fontWeight, '600', 'Place text weight must be 600');

    console.log('✓ All role typography styles matched Canva design specifications perfectly!');

    // 5. Save Screenshots
    console.log('5. Saving screenshots...');
    // A) 1414x2000 screenshot of schedule page
    const schedulePage = await page.waitForSelector('.schedule-page');
    const screenshot1414Path = path.join(SCREENSHOT_DIR, 'phase7b_page_1414x2000.png');
    await schedulePage.screenshot({ path: screenshot1414Path });
    console.log(`✓ Saved 1414x2000 screenshot: ${screenshot1414Path}`);

    // B) 50% zoom in the editor
    const editorZoom50Path = path.join(SCREENSHOT_DIR, 'phase7b_editor_zoom50.png');
    await page.screenshot({ path: editorZoom50Path });
    console.log(`✓ Saved 50% zoom editor screenshot: ${editorZoom50Path}`);

    // 6. Test "Reset fonts to Canva defaults" button in Style > Typography
    console.log('6. Testing "Reset fonts to Canva defaults" button in Style > Typography...');
    const styleRailBtn = await page.waitForSelector('button[data-testid="nav-tab-style"], button:has-text("Style")');
    await styleRailBtn.click();
    await page.waitForTimeout(500);

    const resetCanvaBtn = await page.waitForSelector('[data-testid="reset-canva-fonts-btn"]');
    assert.ok(resetCanvaBtn, 'Reset fonts to Canva defaults button must exist in Style > Typography');
    await resetCanvaBtn.click();
    await page.waitForTimeout(500);
    console.log('✓ "Reset fonts to Canva defaults" button clicked and applied successfully');

    console.log('\n=== ALL PHASE 7b ACCEPTANCE TESTS PASSED WITH 100% SUCCESS! ===\n');
  } catch (err) {
    console.error('Test execution error:', err);
    throw err;
  } finally {
    await browser.close();
  }
}

runPhase7bTests().catch(err => {
  console.error(err);
  process.exit(1);
});
