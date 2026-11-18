import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const out = path.resolve(process.argv[2] ?? 'docs/ui-qa-2026-11-08/final');
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const report = [];
for (const state of ['resting', 'walking', 'drinking']) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:5181/?islandSeed=684#/atlas/wonderland-terrain', { waitUntil: 'domcontentloaded' });
  await page.locator('.exhibit-cameras').waitFor({ timeout: 60000 });
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.waitForFunction(s => document.querySelector('.exhibit-creature-now')?.textContent?.toLowerCase().includes(s), state, { timeout: 60000 });
  const atClick = await page.locator('.exhibit-creature-now').innerText();
  await page.getByRole('button', { name: 'Close' }).first().click();
  await page.evaluate(() => {
    window.__qa = { frames: [], long: [] };
    let last = performance.now();
    const tick = now => { window.__qa.frames.push(now - last); last = now; requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    new PerformanceObserver(list => { for (const e of list.getEntries()) window.__qa.long.push({ start: e.startTime, duration: e.duration }); }).observe({ entryTypes: ['longtask'] });
  });
  const frames = path.join(out, `life-${state}-verified`);
  fs.mkdirSync(frames, { recursive: true });
  const start = Date.now();
  await page.getByRole('button', { name: 'Creature' }).first().click();
  const frameTimesMs = [];
  for (let i = 0; i < 18; i++) {
    await page.screenshot({ path: path.join(frames, `frame-${String(i).padStart(3, '0')}.png`) });
    frameTimesMs.push(Date.now() - start);
    await page.waitForTimeout(100);
  }
  const qa = await page.evaluate(() => window.__qa);
  const data = { state, atClick, durationMs: Date.now() - start, frameTimesMs, maxFrameMs: Math.max(...qa.frames), longTasks: qa.long };
  report.push(data);
  console.log(JSON.stringify(data));
  await page.close();
}
fs.writeFileSync(path.join(out, 'life-timing.json'), JSON.stringify(report, null, 2));
await browser.close();
