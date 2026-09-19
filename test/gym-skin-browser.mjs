import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=(process.env.POSECRAFT_URL||'http://127.0.0.1:5181').replace(/\/$/,''),browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
try{
 const page=await browser.newPage({viewport:{width:1366,height:900},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(30000);
 await page.goto(base+'/demos.html?legacy=1#gym-routine');await page.locator('#scene-full-set').click();await page.locator('#demo-scrub').fill('42');await page.locator('#demo-scrub').dispatchEvent('input');await page.waitForFunction(()=>Math.abs(+document.querySelector('#demo-art svg')?.dataset.sceneTime-42)<.03);
 assert.equal(await page.locator('#demo-art [data-part="trunk"]').count(),1);assert.ok(await page.locator('#demo-art [data-source-part="trunk"][data-mesh-path]').count()>=128);assert.equal(await page.locator('#demo-art [data-part="leftarm"]').count(),0);
 await page.locator('#demo-art').screenshot({path:'test-results/gym-skin-release-bench.png'});
 const pending=page.waitForEvent('download');await page.locator('#download-demo').click();const doc=JSON.parse(await fs.readFile(await(await pending).path(),'utf8')),mesh=doc.packs.atlas.parts.find(p=>p.id==='trunk').spatial.mesh;assert.ok(doc.requiredFeatures.includes('skinned-mesh'));assert.ok(mesh.vertices.length>300&&mesh.triangles.length>600);
 await page.locator('#edit-demo').click();await page.locator('#character-workspace').click();await page.locator('#actors').selectOption('atlas');await page.locator('[data-panel="surface"]').click();await page.locator('#mesh-part').selectOption('trunk');await page.locator('#mesh-vertex').selectOption({value:'0'});const old=+(await page.locator('#mesh-x').inputValue());await page.locator('#mesh-x').fill(String(old+1));await page.locator('#mesh-apply-bind').click();assert.equal(+(await page.locator('#mesh-x').inputValue()),old+1);await page.locator('#undo').click();assert.equal(+(await page.locator('#mesh-x').inputValue()),old);
 await page.screenshot({path:'test-results/gym-skin-release-studio.png'});assert.doesNotMatch(await page.locator('body').innerText(),/Ãƒ|Ã‚|â€|â€¦|Â°/,'Studio text must preserve UTF-8 punctuation');assert.deepEqual(errors,[]);console.log('Atlas connected mesh verified in bench preview, downloaded scene and Studio vertex editing with undo.');
}finally{await browser.close();}
