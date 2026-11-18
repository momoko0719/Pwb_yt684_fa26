import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const out = path.resolve(process.argv[2] ?? 'docs/streamling-pass-2026-11-15');
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const report = [];
for (const seed of [684, 42]) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://localhost:${process.env.QA_PORT ?? '5184'}/?islandSeed=${seed}#/atlas/wonderland-terrain`);
  await page.locator('.exhibit-cameras').waitFor({ timeout: 90000 });
  await page.getByRole('button', { name: 'Water' }).click();
  await page.waitForTimeout(3500);
  await page.screenshot({ path: path.join(out, `water-${seed}.png`) });
  let clickedInWorld = false;
  if (seed === 684) {
    for (const [x, y] of [[180, 580], [548, 845], [175, 590], [550, 830]]) {
      await page.mouse.click(x, y);
      if (await page.locator('.resource-atlas').isVisible()) { clickedInWorld = true; break; }
    }
    if (clickedInWorld) { await page.screenshot({ path: path.join(out, 'fish-world-click-684.png') }); await page.getByRole('button', { name: 'Close' }).first().click(); }
  }
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.locator('.exhibit-panel-actions button').first().click();
  await page.getByRole('button', { name: 'Creatures' }).click();
  await page.getByRole('button', { name: /Jade Streamling/ }).click();
  await page.screenshot({ path: path.join(out, `fish-card-${seed}.png`) });
  await page.getByRole('button', { name: 'Close' }).first().click();
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Meet the creature' }).click();
  await page.screenshot({ path: path.join(out, `needs-${seed}.png`) });
  const data = await page.evaluate(() => {
    const d = window.guixuDwelling;
    if (!d) return null;
    d.reset();
    const events = [];
    let prior = d.pose.activity;
    let minGrass = 1;
    for (let i = 0; i < 6000; i++) {
      d.step(0.25);
      minGrass = Math.min(minGrass, d.grazing?.biomass ?? 1);
      if (d.pose.activity !== prior) {
        events.push({ at: Math.round(d.time), from: prior, to: d.pose.activity, hunger: +d.needs.hunger.toFixed(2), thirst: +d.needs.thirst.toFixed(2), energy: +d.needs.energy.toFixed(2) });
        prior = d.pose.activity;
      }
    }
    return { events: events.slice(0, 22), minGrass, needs: d.needs };
  });
  report.push({ seed, data, clickedInWorld, errors });
  await page.close();
}
fs.writeFileSync(path.join(out, 'qa.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
await browser.close();
