import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn, spawnSync, execSync } from 'node:child_process';

const BASE_URL = 'http://localhost:4173';

function checkServerRunning() {
  return new Promise((resolve) => {
    const req = http.get(BASE_URL, (res) => {
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function startPreviewServer() {
  const isRunning = await checkServerRunning();
  if (isRunning) {
    console.log('Preview server already running on http://localhost:4173');
    return null;
  }

  console.log('Starting preview server on port 4173...');
  const proc = spawn('npm.cmd', ['run', 'preview', '--', '--port', '4173'], {
    shell: true,
    stdio: 'ignore'
  });

  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (await checkServerRunning()) {
      console.log('Preview server is ready on http://localhost:4173');
      return proc;
    }
  }
  throw new Error('Failed to start preview server on port 4173');
}

async function main() {
  console.log('Building app for tests...');
  execSync('npm run build', { stdio: 'inherit' });

  const serverProc = await startPreviewServer();

  const testFiles = [
    'test-canva-export.js',
    'test-phase13.js',
    'test-export-project-file.js',
    'test-validator-engine.js',
    'test-phase12.js',
    'test-phase11.js',
    'test-phase10.js',
    'test-phase9.js',
    'test-phase-qa.js',
    'test-phase7b.js',
    'test-phase6b-phase8.js',
    'test-phase6.js',
    'test-phase7.js',
    'test-phase5.js',
    'test-phase4.js',
    'test-phase3b.js',
    'test-phase3-acceptance.js',
    'test-phase3-print.js',
    'test-phase2-partA.js',
    'test-phase2-partB.js',
    'test-fonts-metrics.js',
    'test-export-customization.js',
    'test-print-view.js',
    'test-print.js',
    'test-render.js'
  ];

  const results = [];
  console.log(`\nStarting execution of ${testFiles.length} test suites...\n`);

  for (const file of testFiles) {
    const fullPath = path.join('scripts', file);
    if (!fs.existsSync(fullPath)) {
      results.push({ file, status: 'SKIPPED (File not found)', duration: 0 });
      continue;
    }

    process.stdout.write(`Running ${file}... `);
    const start = Date.now();
    const result = spawnSync('node', [fullPath], {
      encoding: 'utf8',
      env: process.env,
      timeout: 120000
    });
    const duration = ((Date.now() - start) / 1000).toFixed(2);

    if (result.status === 0) {
      process.stdout.write(`PASSED (${duration}s)\n`);
      results.push({ file, status: 'PASSED', duration });
    } else {
      process.stdout.write(`FAILED (${duration}s)\n`);
      console.error(`\n--- ERROR OUTPUT FOR ${file} ---`);
      if (result.stdout) console.error(result.stdout.slice(-1000));
      if (result.stderr) console.error(result.stderr.slice(-1000));
      console.error('--------------------------------\n');
      results.push({ file, status: 'FAILED', duration });
    }
  }

  if (serverProc) {
    serverProc.kill();
  }

  console.log('\n======================================================');
  console.log('                  TEST RESULTS SUMMARY                 ');
  console.log('======================================================\n');
  console.log('| Test Suite | Status | Duration |');
  console.log('| :--- | :---: | :---: |');
  for (const r of results) {
    const icon = r.status === 'PASSED' ? 'PASSED' : r.status;
    console.log(`| \`${r.file}\` | **${icon}** | ${r.duration}s |`);
  }

  const allPassed = results.every((r) => r.status === 'PASSED');
  const passedCount = results.filter((r) => r.status === 'PASSED').length;
  console.log(`\nTotal: ${results.length} | Passed: ${passedCount} | Failed: ${results.length - passedCount}`);

  if (!allPassed) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
