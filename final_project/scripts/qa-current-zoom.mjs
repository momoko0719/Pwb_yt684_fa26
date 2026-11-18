import { chromium } from 'playwright';
import fs from 'node:fs';

const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://localhost:5181/?islandSeed=684&navProbe=1#/atlas/wonderland-terrain', { waitUntil: 'domcontentloaded' });
await page.locator('.exhibit-cameras').waitFor({ timeout: 60000 });
await page.waitForTimeout(1500);
if (process.argv.includes('--mountains')) {
  await page.getByRole('button', { name: 'Mountains' }).click();
  await page.waitForTimeout(2500);
}
const canvas = page.locator('canvas').first();
const box = await canvas.boundingBox();
await page.mouse.move(box.x + box.width * 0.53, box.y + box.height * 0.58);
await page.evaluate(() => { window.__navProbe = []; });
await page.evaluate(() => { window.__frames = []; let prev = performance.now(); const tick = t => { window.__frames.push(t - prev); prev = t; if (window.__frames.length < 1200) requestAnimationFrame(tick); }; requestAnimationFrame(tick); performance.clearMeasures('white-jade-cover-build'); });
if (!process.argv.includes('--idle')) for (let i = 0; i < 90; i++) { await page.mouse.wheel(0, -250); await page.waitForTimeout(60); }
await page.waitForTimeout(3500);
const samples = await page.evaluate(() => window.__navProbe);
const timing = await page.evaluate(() => ({ frames: window.__frames, cover: performance.getEntriesByName('white-jade-cover-build', 'measure').map(e => e.duration) }));
fs.writeFileSync('docs/zoom-samples.json', JSON.stringify(samples));
const direction = samples.map((s, i) => i ? s.cam[1] - samples[i - 1].cam[1] : 0);
const frames = timing.frames.filter(x => x > 0).sort((a,b) => a-b);
console.log(JSON.stringify({ count: samples.length, clamped: samples.filter(s => s.camClamped).length, targetClamped: samples.filter(s => s.tgtClamped).length, yReversals: direction.filter((d, i) => i && Math.abs(d) > .02 && Math.sign(d) !== Math.sign(direction[i - 1])).length, minY: Math.min(...samples.map(s=>s.cam[1])), maxY: Math.max(...samples.map(s=>s.cam[1])), frameP95: frames[Math.floor(frames.length*.95)], frameMax: frames.at(-1), coverBuildMax: Math.max(0,...timing.cover), coverBuildCount: timing.cover.length }));
await browser.close();
