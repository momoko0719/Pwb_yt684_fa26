import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const phase = process.argv[2] || 'before';
const out = path.resolve('docs/ui-qa-2026-11-08', phase);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
page.on('console', msg => { if (msg.type() === 'error' || msg.text().includes('FRAME-ISLAND')) console.log('CONSOLE', msg.text()); });
await page.goto('http://localhost:5181/#/atlas/wonderland-terrain', { waitUntil: 'domcontentloaded' });
await page.screenshot({ path: path.join(out, 'loading.png') });
await page.waitForTimeout(14000);
await page.screenshot({ path: path.join(out, 'overview-684-wide.png') });
if (process.argv[3] === 'overview') { await context.close(); await browser.close(); process.exit(0); }
if (process.argv[3] === 'atlas') {
  await page.getByRole('button', { name: /Settings|设置/ }).first().click();
  await page.getByRole('button', { name: /Island field guide|图鉴/ }).first().click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(out, 'atlas-vegetation.png') });
  await page.getByRole('button', { name: /Creature|生灵/ }).last().click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(out, 'atlas-creature.png') });
  await page.getByRole('button', { name: /Jade Dweller|玉/ }).last().click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(out, 'atlas-creature-detail.png') });
  await page.getByRole('button', { name: /Terrain & water|地形与水系/ }).last().click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(out, 'atlas-terrain.png') });
  await context.close(); await browser.close(); process.exit(0);
}
await page.getByRole('button', { name: /Creature|生灵/ }).first().click();
const frames = path.join(out, 'life-frames');
fs.mkdirSync(frames, { recursive: true });
for (let i = 0; i < 50; i++) {
  await page.screenshot({ path: path.join(frames, `frame-${String(i).padStart(3, '0')}.png`) });
  await page.waitForTimeout(100);
}
await page.screenshot({ path: path.join(out, 'life-684.png') });
await page.getByRole('button', { name: /设置|Settings/ }).first().click();
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(out, 'settings.png') });
await context.close();
await browser.close();
console.log(out);
