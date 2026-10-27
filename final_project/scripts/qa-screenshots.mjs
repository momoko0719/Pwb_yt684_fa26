/**
 * Visual QA screenshots for Wonderland (seed 684 default).
 * Run: node scripts/qa-screenshots.mjs  (vite on :5180)
 * PNGs ? scripts/out/qa-*.png
 */
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(__dir, 'out');
const url = 'http://localhost:5180/#/atlas/wonderland-terrain';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(16000);

async function shot(name) {
  const p = path.join(out, name);
  await page.screenshot({ path: p, type: 'png' });
  console.log('wrote', name);
}

async function clickText(labels) {
  for (const label of labels) {
    const btn = page.getByRole('button', { name: label });
    if (await btn.count()) {
      await btn.first().click({ force: true, timeout: 5000 });
      await page.waitForTimeout(2800);
      return label;
    }
  }
  return null;
}

await shot('qa-overview-default.png');
const water = await clickText(['Its water', '???']);
if (water) await shot('qa-cam-Its-water.png');
const look = await clickText(['Look at it', '???']);
if (look) await shot('qa-cam-Look-at-it.png');
const flowers = await clickText(['Look at flowers', '????']);
if (flowers) await shot('qa-look-flowers.png');
const close = await clickText(['Close to the ground', '????']);
if (close) await shot('qa-cam-Close.png');

const stats = await page.evaluate(() => document.querySelector('.stats-panel')?.innerText ?? '');
console.log('---STATS---\n' + stats.slice(0, 800));
await browser.close();
