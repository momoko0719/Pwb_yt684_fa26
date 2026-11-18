import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
for (const seed of [684, 42]) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`http://localhost:5181/?islandSeed=${seed}#/atlas/wonderland-terrain`);
  await page.locator('.exhibit-cameras').waitFor({ timeout: 60000 });
  await page.waitForTimeout(10000);
  console.log(seed, await page.evaluate(() => ({ sites: window.__jadeSites, shader: ['material', 'built'].map(k => ({
    pool: window.__jadeShaders[k].uniforms.uJadePool.value,
    bend: window.__jadeShaders[k].uniforms.uJadeBend.value,
    active: window.__jadeShaders[k].uniforms.uJadeReveal.value,
    time: window.__jadeShaders[k].uniforms.uTime.value,
  })) })));
  await page.close();
}
await browser.close();
