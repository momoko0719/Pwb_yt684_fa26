import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const out = path.resolve('docs/ui-qa-2026-11-08/final');
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
for (const seed of [684, 5676, 7, 42]) {
  for (const [label, width, height] of [['wide', 1440, 900], ['narrow', 1040, 800]]) {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.goto(`http://localhost:5181/?islandSeed=${seed}#/atlas/wonderland-terrain`, { waitUntil: 'domcontentloaded' });
    await page.locator('.exhibit-cameras').waitFor({ timeout: 60000 });
    await page.waitForTimeout(1400);
    await page.screenshot({ path: path.join(out, `overview-${seed}-${label}.png`) });
    console.log(seed, label, await page.locator('.exhibit-status').innerText().catch(() => ''));
    await page.close();
  }
}
await browser.close();
