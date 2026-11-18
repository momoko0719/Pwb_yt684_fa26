import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const page = await browser.newPage({ viewport: { width: 800, height: 700 } });
await page.goto('http://localhost:5181/?islandSeed=684#/atlas/wonderland-terrain', { waitUntil: 'domcontentloaded' });
await page.locator('.exhibit-cameras').waitFor({ timeout: 60000 });
await page.getByRole('button', { name: 'Settings' }).click();
await page.getByRole('button', { name: 'Meet the creature' }).click();
await page.locator('.resource-atlas.has-detail').waitFor();
const dimensions = await page.locator('.resource-atlas').evaluate(el => ({
  width: el.getBoundingClientRect().width,
  height: el.getBoundingClientRect().height,
  viewportWidth: innerWidth,
  viewportHeight: innerHeight,
  detailScrollHeight: el.querySelector('.resource-detail')?.scrollHeight,
  detailClientHeight: el.querySelector('.resource-detail')?.clientHeight,
}));
await page.screenshot({ path: 'docs/ui-qa-2026-11-08/final/atlas-narrow-detail.png' });
const detail = page.locator('.resource-detail');
const scrolled = await detail.evaluate(el => { el.scrollTop = el.scrollHeight; return el.scrollTop; });
if (scrolled <= 0) throw new Error('Atlas detail did not scroll');
await page.screenshot({ path: 'docs/ui-qa-2026-11-08/final/atlas-narrow-scrolled.png' });
console.log(dimensions);
console.log('detail scrollTop', scrolled);
await browser.close();
