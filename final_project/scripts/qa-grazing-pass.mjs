import { chromium } from 'playwright';
import fs from 'node:fs';

const out = 'docs/grazing-pass-2026-11-14';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const results = [];
for (const seed of [684, 42, 7, 5676]) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(`http://localhost:${process.env.QA_PORT ?? '5181'}/?islandSeed=${seed}#/atlas/wonderland-terrain`);
  await page.locator('.exhibit-cameras').waitFor({ timeout: 90000 });
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.locator('.exhibit-creature-now').locator('..').locator('input[type=checkbox]').first().uncheck();
  const state = await page.evaluate(() => {
    const d = window.guixuDwelling;
    const initial = d.grazing && { ...d.grazing };
    let reached = false, minBiomass = 1, eatSteps = 0;
    for (let i = 0; i < 3000; i++) {
      d.step(0.25);
      if (d.pose.activity === 'eat') { reached = true; eatSteps++; }
      if (d.grazing) minBiomass = Math.min(minBiomass, d.grazing.biomass);
      if (reached && d.pose.activity === 'rest') break;
    }
    const after = d.grazing?.biomass ?? null;
    d.step(30);
    return { initial, reached, eatSteps, minBiomass, after, recovered: d.grazing?.biomass ?? null, activity: d.pose.activity, time: d.time };
  });
  await page.screenshot({ path: `${out}/grazing-seed-${seed}.png` });
  if (seed === 684) {
    await page.evaluate(() => {
      const d = window.guixuDwelling;
      d.reset();
      for (let i = 0; i < 2500 && (d.pose.activity !== 'eat' || d.grazing.biomass > 0.32); i++) d.step(0.25);
    });
    await page.getByRole('button', { name: 'Close' }).first().click();
    await page.getByRole('button', { name: 'Creature' }).first().click();
    await page.waitForTimeout(2400);
    await page.mouse.move(760, 460);
    await page.mouse.wheel(0, -390);
    await page.waitForTimeout(550);
    await page.screenshot({ path: `${out}/eating-seed-684.png` });
    await page.evaluate(() => { window.guixuDwelling.grazing.biomass = 1; });
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${out}/full-grass-same-camera.png` });
    await page.evaluate(() => { window.guixuDwelling.grazing.biomass = 0.2; });
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${out}/eaten-grass-same-camera.png` });
  }
  results.push({ seed, state, errors });
  await page.close();
}
fs.writeFileSync(`${out}/grazing-results.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results));
await browser.close();
