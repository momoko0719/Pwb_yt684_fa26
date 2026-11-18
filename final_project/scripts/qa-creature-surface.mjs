import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const out = path.resolve('docs/art-direction-2026-11-09/creature-surface-stage4');
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
await page.goto('http://localhost:5181/?islandSeed=684#/atlas/wonderland-terrain');
await page.locator('.exhibit-cameras').waitFor({ timeout: 90000 });
await page.getByRole('button', { name: 'Settings' }).click();
await page.getByRole('button', { name: 'Meet the creature' }).click();
const preview = page.locator('.morph-panel .resource-preview-host');
await preview.locator('canvas').waitFor();
await page.waitForTimeout(350);
for (let angle = 0; angle < 4; angle++) {
  await page.screenshot({ path: path.join(out, `atlas-${angle}.png`) });
  await preview.screenshot({ path: path.join(out, `model-${angle}.png`) });
  const box = await preview.boundingBox();
  const x = box.x + box.width * 0.45, y = box.y + box.height * 0.5;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 157, y, { steps: 15 });
  await page.mouse.up();
  await page.waitForTimeout(100);
}
for (const [name, build, stature] of [['light-tall', '0', '1'], ['heavy-low', '1', '0']]) {
  const sliders = page.locator('.morph-controls input[type=range]');
  await sliders.nth(0).evaluate((el, value) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, build);
  await sliders.nth(1).evaluate((el, value) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, stature);
  await page.waitForTimeout(150);
  await preview.screenshot({ path: path.join(out, `${name}.png`) });
}
fs.writeFileSync(path.join(out, 'qa.json'), JSON.stringify({ errors }, null, 2));
console.log(JSON.stringify({ errors }));
await browser.close();
