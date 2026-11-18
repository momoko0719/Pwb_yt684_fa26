import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const out = path.resolve('docs/ui-qa-2026-11-08/final');
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://localhost:5181/#/atlas/wonderland-terrain', { waitUntil: 'domcontentloaded' });
await page.locator('.exhibit-loading-card').waitFor({ timeout: 20000 });
const spinA = await page.locator('.exhibit-spinner').evaluate(el => el.getAnimations()[0]?.currentTime ?? null);
await page.waitForTimeout(180);
const spinB = await page.locator('.exhibit-spinner').evaluate(el => el.getAnimations()[0]?.currentTime ?? null);
if (spinA === null || spinB === null || spinB <= spinA) throw new Error(`Spinner did not advance: ${spinA} -> ${spinB}`);
await page.screenshot({ path: path.join(out, 'loading-first.png') });
await page.locator('.exhibit-cameras').waitFor({ timeout: 60000 });
await page.getByRole('button', { name: 'Settings' }).click();
await page.getByRole('button', { name: 'Another island' }).click();
await page.locator('.exhibit-loading-card').waitFor({ timeout: 10000 });
await page.screenshot({ path: path.join(out, 'loading-another.png') });
await page.locator('.exhibit-cameras').waitFor({ timeout: 60000 });
await page.close();

const failed = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await failed.addInitScript(() => {
  const RealWorker = window.Worker;
  window.__failTerrain = true;
  window.Worker = function (...args) {
    if (!window.__failTerrain) return new RealWorker(...args);
    const fake = { onerror: null, onmessage: null, postMessage() {}, terminate() {} };
    setTimeout(() => fake.onerror?.(new Event('error')), 100);
    return fake;
  };
});
await failed.goto('http://localhost:5181/?islandSeed=42#/atlas/wonderland-terrain', { waitUntil: 'domcontentloaded' });
await failed.getByRole('button', { name: 'Try again' }).waitFor({ timeout: 30000 });
await failed.screenshot({ path: path.join(out, 'loading-failed.png') });
await failed.evaluate(() => { window.__failTerrain = false; });
await failed.getByRole('button', { name: 'Try again' }).click();
await failed.locator('.exhibit-cameras').waitFor({ timeout: 60000 });
await failed.screenshot({ path: path.join(out, 'loading-retried.png') });
console.log(`spinner advanced ${Math.round(spinB - spinA)} ms; first, another, failed, retry: observed`);
await failed.close();
await browser.close();
