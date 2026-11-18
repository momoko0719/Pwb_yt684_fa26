import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const out = path.resolve('docs/art-direction-2026-11-09/creature-variation-2026-11-11');
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const results = [];
for (const seed of [684, 42]) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto(`http://localhost:5181/?islandSeed=${seed}#/atlas/wonderland-terrain`);
  await page.locator('.exhibit-cameras').waitFor({ timeout: 90000 });
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Meet the creature' }).click();
  await page.locator('.morph-panel canvas').waitFor();
  const choices = page.locator('.morph-choice').first();
  await choices.getByRole('button', { name: 'Single' }).click();
  await page.locator('.morph-controls').getByRole('button', { name: '0', exact: true }).click();
  await page.locator('.morph-stage').scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(out, `seed-${seed}-single.png`) });
  const single = await page.evaluate(() => window.guixuMorph.morph.axes);
  await choices.getByRole('button', { name: 'Paired' }).click();
  await page.locator('.morph-controls').getByRole('button', { name: '3', exact: true }).click();
  await page.locator('.morph-stage').scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(out, `seed-${seed}-paired.png`) });
  const paired = await page.evaluate(() => window.guixuMorph.morph.axes);
  results.push({ seed, single, paired, errors });
  await page.close();
}
fs.writeFileSync(path.join(out, 'qa.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results));
await browser.close();
