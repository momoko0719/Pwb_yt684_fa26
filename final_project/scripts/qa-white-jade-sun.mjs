import { chromium } from 'playwright';
import path from 'node:path';
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://localhost:5181/?islandSeed=684#/atlas/wonderland-terrain', { waitUntil: 'domcontentloaded' });
await page.locator('.exhibit-cameras').waitFor({ timeout: 60000 });
await page.getByRole('button', { name: 'Settings' }).click();
for (const time of ['Dawn', 'Noon', 'Dusk', 'Night']) {
  await page.getByRole('button', { name: time, exact: true }).click();
  await page.waitForTimeout(350);
  await page.screenshot({ path: path.resolve(`docs/ui-qa-2026-11-08/final/sun-${time.toLowerCase()}.png`) });
  console.log(time, await page.locator('.exhibit-sun > span').innerText());
}
await browser.close();
