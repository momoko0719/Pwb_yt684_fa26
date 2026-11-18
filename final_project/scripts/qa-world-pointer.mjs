import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
await page.goto('http://localhost:5181/?islandSeed=684#/atlas/wonderland-terrain');
await page.locator('.exhibit-cameras').waitFor({ timeout: 60000 });
await page.getByRole('button', { name: 'Creature' }).click();
await page.waitForTimeout(3000);
await page.screenshot({ path: 'docs/current-pass-life.png' });
if (process.argv.includes('--screenshot-only')) { await browser.close(); process.exit(0); }
const box = await page.locator('.wonderland-canvas').boundingBox();
let creature = null;
for (let y = box.y + 300; y < box.y + 620 && !creature; y += 10) {
  for (let x = box.x + 500; x < box.x + 1000 && !creature; x += 10) {
    await page.mouse.move(x, y);
    const kind = await page.evaluate(() => document.body.dataset.worldPointer ?? null);
    if (kind === 'creature' && !creature) creature = { x, y };
    if (creature) {
      await page.screenshot({ path: 'docs/equilinox-pass-2026-11-14/creature-hover.png' });
      console.log('hover', await page.locator('.world-pointer-hint').innerText());
      await page.mouse.click(x, y);
    }
  }
}
console.log(JSON.stringify({ creature, errors }));
if (creature) {
  await page.waitForTimeout(300);
  console.log('creatureCard', await page.locator('.resource-atlas').count(), await page.locator('.resource-atlas-bar').count() ? await page.locator('.resource-atlas-bar').innerText() : null);
}
await browser.close();
