import { chromium } from 'playwright';
import path from 'node:path';
const out = path.resolve('docs/art-direction-2026-11-09/atmosphere-soft');
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await page.goto('http://localhost:5181/?islandSeed=684#/atlas/wonderland-terrain', { waitUntil: 'domcontentloaded' });
await page.locator('.exhibit-cameras').waitFor({ timeout: 90000 });
await page.waitForTimeout(3200);
const coords = async () => page.evaluate(() => {
  const p = window.guixuProbe;
  const positions = [];
  p?.scene.traverse((o) => { if (o.geometry?.attributes?.position?.count === 4 && o.material?.uniforms?.uSeed) {
    const v = o.getWorldPosition(new p.camera.position.constructor()).project(p.camera);
    positions.push([v.x, v.y]);
  } });
  return positions;
});
const before = await coords();
await page.mouse.move(700, 480);
await page.mouse.down();
await page.mouse.move(930, 460, { steps: 25 });
await page.mouse.up();
await page.waitForTimeout(900);
await page.screenshot({ path: path.join(out, 'orbit-684-wide.png') });
console.log(JSON.stringify({ before, after: await coords() }));
await browser.close();
