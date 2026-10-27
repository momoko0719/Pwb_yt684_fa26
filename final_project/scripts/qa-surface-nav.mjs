/**
 * QA: surface / nav / cover stream (Wonderland).
 * Run: node scripts/qa-surface-nav.mjs   (vite on :5180)
 * → scripts/out/qa-sn-*.png
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
await page.waitForTimeout(18000);

async function shot(name) {
  await page.screenshot({ path: path.join(out, name), type: 'png' });
  console.log('wrote', name);
}

async function clickText(labels) {
  for (const label of labels) {
    const btn = page.getByRole('button', { name: label });
    if (await btn.count()) {
      await btn.first().click({ force: true, timeout: 5000 });
      await page.waitForTimeout(2500);
      return label;
    }
  }
  return null;
}

await shot('qa-sn-overview.png');
await clickText(['Its water', '其水畔']);
await shot('qa-sn-water.png');
await clickText(['Look at it', '看向它']);
await shot('qa-sn-look.png');

// Pan camera toward a far look (simulate browse away from creature) via evaluate if available
const stats = await page.evaluate(() => document.querySelector('.scale-legend')?.innerText ?? '');
console.log('---STATS---\n' + stats.slice(0, 900));
await browser.close();
