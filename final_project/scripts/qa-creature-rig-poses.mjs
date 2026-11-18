import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const out = path.resolve(process.argv[2] ?? 'docs/art-direction-2026-11-09/creature-rig-stage1');
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const report = [];
for (const state of (process.argv[3] ? [process.argv[3]] : ['rest', 'walk', 'drink'])) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://localhost:${process.env.QA_PORT ?? '5181'}/?islandSeed=684#/atlas/wonderland-terrain`);
  await page.locator('.exhibit-cameras').waitFor({ timeout: 90000 });
  await page.getByRole('button', { name: 'Settings' }).click();
  const section = page.locator('.exhibit-creature-now').locator('..');
  await section.locator('input[type=checkbox]').first().uncheck();
  const pose = await page.evaluate((target) => {
    const d = window.guixuDwelling;
    let steps = 0;
    const ready = () => d.pose.activity === target && (target === 'rest' ? d.pose.lying > 0.99 : target === 'drink' ? d.pose.drinking > 0.99 : d.pose.lying < 0.01 && d.pose.drinking < 0.01);
    while (!ready() && steps < 20000) { d.step(0.25); steps++; }
    return { activity: d.pose.activity, steps, neck: d.pose.neck, lying: d.pose.lying, drinking: d.pose.drinking, muzzle: d.pose.muzzle, feet: d.pose.feet };
  }, state);
  await page.getByRole('button', { name: 'Close' }).first().click();
  if (process.argv[4] === 'skeleton') {
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'Meet the creature' }).click();
    await page.getByRole('button', { name: 'Show live skeleton on island' }).click();
  } else await page.getByRole('button', { name: 'Creature' }).first().click();
  await page.waitForTimeout(2700);
  if (process.argv[4] !== 'nozoom' && process.argv[4] !== 'sideflat') {
    await page.mouse.move(760, 460);
    await page.mouse.wheel(0, -530);
    await page.waitForTimeout(500);
  }
  await page.screenshot({ path: path.join(out, `${state}.png`) });
  if (state === 'drink') await page.screenshot({ path: path.join(out, 'drink-detail.png'), clip: { x: 560, y: 390, width: 430, height: 355 } });
  if (process.argv[4] === 'sideflat') {
    await page.mouse.move(705, 465);
    await page.mouse.down();
    await page.mouse.move(945, 465, { steps: 14 });
    await page.mouse.up();
    await page.waitForTimeout(350);
    await page.screenshot({ path: path.join(out, `${state}-side.png`) });
  } else if (process.argv[4] !== 'nozoom') {
    await page.mouse.move(705, 465);
    await page.mouse.down();
    await page.mouse.move(940, 235, { steps: 14 });
    await page.mouse.up();
    await page.waitForTimeout(350);
    await page.screenshot({ path: path.join(out, `${state}-side.png`) });
  }
  report.push({ state, pose, errors });
  await page.close();
}
fs.writeFileSync(path.join(out, 'poses.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.map(({ state, pose, errors }) => ({ state, activity: pose.activity, steps: pose.steps, neck: pose.neck, errors }))));
await browser.close();
