import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const out = path.resolve(`docs/art-direction-2026-11-09/atmosphere-${process.argv[2] ?? 'final'}`);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await context.newPage();
await page.goto('http://localhost:5181/?islandSeed=684#/atlas/wonderland-terrain', { waitUntil: 'domcontentloaded' });
await page.locator('.exhibit-cameras').waitFor({ timeout: 90000 });
for (let i = 0; i < 16; i++) {
  await page.screenshot({ path: path.join(out, `motion-${String(i).padStart(2, '0')}.png`) });
  await page.waitForTimeout(450);
}
await page.close();
await context.close();
await browser.close();
