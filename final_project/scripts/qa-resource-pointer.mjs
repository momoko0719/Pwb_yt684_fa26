import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://localhost:5181/?islandSeed=684#/atlas/wonderland-terrain');
await page.locator('.exhibit-cameras').waitFor({ timeout: 60000 });
const find = async (x0, x1, y0, y1, step) => {
  for (let y = y0; y <= y1; y += step) for (let x = x0; x <= x1; x += step) {
    await page.mouse.move(x, y);
    if (await page.evaluate(() => document.body.dataset.worldPointer === 'resource')) return { x, y };
  }
  return null;
};
await page.getByRole('button', { name: 'Water' }).click();
await page.waitForTimeout(2500);
let point = await find(250, 450, 650, 810, 12);
if (point) await page.mouse.click(point.x, point.y);
await page.waitForTimeout(250);
await page.screenshot({ path: 'docs/current-pass-vegetation-card.png' });
console.log('vegetation', JSON.stringify({ point, card: await page.locator('.resource-detail h3').count() ? await page.locator('.resource-detail h3').innerText() : null }));
if (await page.locator('.resource-atlas-bar').count()) await page.getByRole('button', { name: 'Close' }).first().click();
await page.waitForTimeout(2500);
await page.screenshot({ path: 'docs/current-pass-water.png' });
point = await find(250, 1150, 180, 720, 28);
if (point) await page.mouse.click(point.x, point.y);
console.log('element', JSON.stringify({ point, card: await page.locator('.resource-detail h3').count() ? await page.locator('.resource-detail h3').innerText() : null }));
await browser.close();
