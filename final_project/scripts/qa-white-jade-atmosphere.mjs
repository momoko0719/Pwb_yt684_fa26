import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const stage = process.argv[2] ?? 'after';
const quick = process.argv.includes('--quick');
const quickSeed = Number(process.argv.find((arg) => arg.startsWith('--seed='))?.split('=')[1] ?? 684);
const out = path.resolve(`docs/art-direction-2026-11-09/atmosphere-${stage}`);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const results = [];
for (const seed of quick ? [quickSeed] : [684, 5676, 7, 42]) {
  for (const [size, width, height] of quick ? [['wide', 1440, 900]] : [['wide', 1440, 900], ['narrow', 1040, 800]]) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    await page.goto(`http://localhost:5181/?islandSeed=${seed}#/atlas/wonderland-terrain`, { waitUntil: 'domcontentloaded' });
    await page.locator('.exhibit-cameras').waitFor({ timeout: 90000 });
    await page.waitForTimeout(3200);
    await page.screenshot({ path: path.join(out, `overview-${seed}-${size}.png`) });
    if (quick) console.log('sprites', await page.evaluate(() => {
      const probe = window.guixuProbe;
      const found = [];
      probe?.scene.traverse((object) => { if (object.isSprite) { const p = object.position.clone().project(probe.camera); found.push({ world: object.position.toArray(), screen: [p.x, p.y, p.z], opacity: object.material.opacity }); } });
      return found;
    }));
    if (quick) console.log('cloud volumes', await page.evaluate(() => {
      const probe = window.guixuProbe;
      const found = [];
      probe?.scene.traverse((object) => { if (object.material?.uniforms?.uOpacity) { const p = object.position.clone().project(probe.camera); found.push({ world: object.position.toArray(), screen: [p.x, p.y, p.z], scale: object.scale.toArray(), triangles: object.geometry.drawRange.count / 3 }); } });
      return found;
    }));
    const frameMs = await page.evaluate(async () => {
      const times = [];
      let previous = 0;
      await new Promise((resolve) => {
        const sample = (now) => {
          if (previous) times.push(now - previous);
          previous = now;
          if (times.length >= 90) resolve(); else requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      });
      times.sort((a, b) => a - b);
      return { median: times[45], p95: times[85] };
    });
    results.push({ seed, size, frameMs, errors });
    console.log(seed, size, frameMs, errors.length ? errors : 'ok');
    if (!quick && seed === 684 && size === 'wide') {
      await page.getByRole('button', { name: 'Settings' }).click();
      for (const time of ['Dawn', 'Noon', 'Dusk', 'Night']) {
        await page.getByRole('button', { name: time, exact: true }).click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: path.join(out, `sun-${time.toLowerCase()}.png`) });
      }
    }
    await page.close();
  }
}
fs.writeFileSync(path.join(out, 'measurements.json'), JSON.stringify(results, null, 2));
await browser.close();
