import fs from 'node:fs';
import vm from 'node:vm';
import {chromium} from '@playwright/test';
const c=vm.createContext({});vm.runInContext(fs.readFileSync(process.argv[2],'utf8'),c);
const browser=await chromium.launch({headless:true,channel:process.platform==='win32'?'msedge':undefined});const page=await browser.newPage();
for(const name of ['head','rusty-sit','rusty-sit-head']) {
 const parts=c.OnaTraces.parts[name];
 await page.setContent(`<svg xmlns="http://www.w3.org/2000/svg">${parts.map((p,i)=>`<path data-i="${i}" d="${p.d}" fill="${p.fill}" transform="${p.transform}"/>`).join('')}</svg>`);
 console.log(name, await page.locator('path').evaluateAll(paths=>paths.map(p=>{const b=p.getBBox();return {i:p.dataset.i,x:Math.round(b.x),y:Math.round(b.y),w:Math.round(b.width),h:Math.round(b.height)};})));
}
await browser.close();
