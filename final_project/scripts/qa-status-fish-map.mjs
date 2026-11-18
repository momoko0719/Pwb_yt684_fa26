import { chromium } from 'playwright';
import fs from 'node:fs';
const out = 'docs/status-fish-map-2026-11-15'; fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const results = [];
for (const seed of [684, 42]) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto(`http://localhost:5184/?islandSeed=${seed}#/atlas/wonderland-terrain`);
  await page.locator('.exhibit-cameras').waitFor({ timeout: 90000 });
  await page.getByRole('button', { name: 'Creature', exact: true }).click();
  await page.locator('.creature-status-dock').waitFor({ timeout: 15000 });
  await page.screenshot({ path: `${out}/status-${seed}.png` });
  await page.locator('.island-navigator-toggle').click();
  await page.locator('.island-navigator-panel').waitFor();
  await page.screenshot({ path: `${out}/map-${seed}.png` });
  const fishButtons = await page.locator('.island-navigator-fish button').count();
  if (fishButtons) { await page.locator('.island-navigator-fish button').first().click(); await page.waitForTimeout(1500); await page.screenshot({ path: `${out}/fish-locate-${seed}.png` }); if (seed === 684) { await page.waitForTimeout(4000); await page.screenshot({ path: `${out}/fish-swim-4s.png` }); await page.waitForTimeout(4000); await page.screenshot({ path: `${out}/fish-swim-8s.png` }); } }
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.locator('.exhibit-panel-actions button').first().click();
  await page.getByRole('button', { name: 'Creatures' }).click();
  await page.getByRole('button', { name: /Jade Streamling/ }).click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/fish-card-${seed}.png` });
  await page.getByRole('button', { name: 'Close' }).first().click();
  await page.locator('.island-navigator-toggle').click();
  await page.locator('.island-navigator-panel canvas').click({ position: { x: 115, y: 88 } });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/map-relocate-${seed}.png` });
  results.push({ seed, fishButtons, errors }); await page.close();
}
fs.writeFileSync(`${out}/qa.json`, JSON.stringify(results, null, 2)); console.log(JSON.stringify(results));
await browser.close();
