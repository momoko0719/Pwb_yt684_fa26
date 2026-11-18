import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const out = path.resolve('docs/equilinox-pass-2026-11-14');
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const results = [];
for (const seed of (process.argv[2] ? process.argv[2].split(',').map(Number) : [684, 42])) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text().slice(0, 500)); });
  await page.goto(`http://localhost:5181/?islandSeed=${seed}#/atlas/wonderland-terrain`);
  await page.locator('.exhibit-cameras').waitFor({ timeout: 90000 });
  await page.waitForTimeout(34000);
  await page.screenshot({ path: path.join(out, `seed-${seed}-overview.png`) });
  await page.getByRole('button', { name: 'Water' }).click();
  await page.waitForTimeout(3500);
  await page.screenshot({ path: path.join(out, `seed-${seed}-water.png`) });
  results.push({ seed, errors });
  await page.close();
}
fs.writeFileSync(path.join(out, 'qa.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results));
await browser.close();
