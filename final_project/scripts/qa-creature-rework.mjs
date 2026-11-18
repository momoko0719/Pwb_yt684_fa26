import { chromium } from 'playwright';
import fs from 'node:fs';
const out = 'docs/art-direction-2026-11-09/creature-rework-2026-11-10';
fs.mkdirSync(out, {recursive:true});
const browser = await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const page = await browser.newPage({viewport:{width:1440,height:900}});
const errors=[]; page.on('pageerror', e=>errors.push(String(e)));
await page.goto('http://localhost:5181/?islandSeed=684#/atlas/wonderland-terrain');
await page.locator('.exhibit-loading-card').waitFor({timeout:20000});
const values=[];
for(let i=0;i<20;i++){
 const el=page.locator('.exhibit-loading-percent');
 if(await el.count()) {
  const value=await el.textContent(); values.push(value);
  if(value==='24%' && values.filter(v=>v==='24%').length===1) await page.screenshot({path:`${out}/loading-progress.png`});
 }
 if(await page.locator('.exhibit-cameras').count()) break;
 await page.waitForTimeout(180);
}
await page.locator('.exhibit-cameras').waitFor({timeout:90000});
await page.getByRole('button',{name:'Settings'}).click();
await page.getByRole('button',{name:'Meet the creature'}).click();
await page.locator('.morph-panel canvas').waitFor();
await page.waitForTimeout(300);
await page.screenshot({path:`${out}/atlas.png`});
await page.getByRole('button',{name:'Close'}).click();
await page.getByRole('button',{name:'Creature'}).click();
await page.waitForTimeout(3000);
await page.screenshot({path:`${out}/life.png`});
console.log(JSON.stringify({values,errors}));
await browser.close();
