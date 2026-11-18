import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const out = path.resolve('docs/art-direction-2026-11-09/creature-morph-stage3');
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });

const sheet = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await sheet.goto('http://localhost:5181/?morphSheet=1&islandSeed=684#/atlas/wonderland-terrain', { waitUntil: 'domcontentloaded' });
await sheet.locator('.morph-sheet canvas').waitFor({ timeout: 90000 });
await sheet.waitForTimeout(500);
await sheet.locator('.morph-sheet').screenshot({ path: path.join(out, 'silhouettes-684.png') });
await sheet.close();

async function openCreature(page) {
  await page.goto('http://localhost:5181/?islandSeed=684#/atlas/wonderland-terrain', { waitUntil: 'domcontentloaded' });
  await page.locator('.exhibit-cameras').waitFor({ timeout: 90000 });
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Meet the creature' }).click();
  await page.locator('.morph-panel canvas').waitFor({ timeout: 20000 });
  await page.locator('.morph-panel').evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(300);
}

const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
await openCreature(page);
const drawsBefore = await page.evaluate(() => window.guixuProbe?.gl?.info?.render?.calls ?? null);
const birth = await page.evaluate(() => window.guixuMorph.morph.id);
await page.screenshot({ path: path.join(out, 'atlas-birth-684-wide.png') });
await page.locator('.morph-panel').screenshot({ path: path.join(out, 'atlas-controls-684-wide.png') });

const frames = path.join(out, 'frames');
fs.mkdirSync(frames, { recursive: true });
let frame = 0;
const snap = async () => {
  await page.locator('.morph-panel').screenshot({ path: path.join(frames, `m-${String(frame).padStart(2, '0')}.png`) });
  frame += 1;
};
const setAxes = async (axes) => {
  await page.evaluate((value) => window.guixuMorph.setAxes(value), axes);
  await page.waitForTimeout(80);
  await snap();
};
await snap();
for (const step of [0.05, 0.35, 0.7, 1]) {
  await setAxes({ bulk: step, stature: 0.51, crown: 0.53 });
  await page.waitForTimeout(180);
}
for (const step of [0.05, 0.4, 0.75, 1]) {
  await setAxes({ bulk: 0.51, stature: step, crown: 0.53 });
  await page.waitForTimeout(180);
}
for (const step of [0, 0.35, 0.7, 1]) {
  await setAxes({ bulk: 0.51, stature: 0.51, crown: step });
  await page.waitForTimeout(180);
}
await page.getByRole('button', { name: 'Restore birth form' }).click();
await page.waitForTimeout(200);
await snap();
const afterDragRestore = await page.evaluate(() => window.guixuMorph.morph.id);
await page.getByRole('button', { name: 'Random form' }).click();
await page.waitForTimeout(400);
await snap();
const randomId = await page.evaluate(() => window.guixuMorph.morph.id);
const loading = await page.locator('.exhibit-loading').count();
const drawsAfter = await page.evaluate(() => window.guixuProbe?.gl?.info?.render?.calls ?? null);
await page.screenshot({ path: path.join(out, 'atlas-random-684-wide.png') });
await page.getByRole('button', { name: 'Restore birth form' }).click();
await page.waitForTimeout(300);
await snap();
const restored = await page.evaluate(() => window.guixuMorph.morph.axes);
await page.screenshot({ path: path.join(out, 'atlas-restored-684-wide.png') });

await page.reload({ waitUntil: 'domcontentloaded' });
await page.locator('.exhibit-cameras').waitFor({ timeout: 90000 });
await page.getByRole('button', { name: 'Settings' }).click();
await page.getByRole('button', { name: 'Meet the creature' }).click();
await page.locator('.morph-panel canvas').waitFor();
const again = await page.evaluate(() => window.guixuMorph.morph.id);
await context.close();

const narrow = await browser.newPage({ viewport: { width: 1040, height: 800 }, deviceScaleFactor: 1 });
await openCreature(narrow);
await narrow.screenshot({ path: path.join(out, 'atlas-birth-684-narrow.png') });
await narrow.locator('.morph-panel').screenshot({ path: path.join(out, 'atlas-controls-684-narrow.png') });
await narrow.close();
await browser.close();

console.log(JSON.stringify({ birth, again, same: birth === again, afterDragRestore, randomId, restored, loading, drawsBefore, drawsAfter, errors, frames: frame }, null, 2));
