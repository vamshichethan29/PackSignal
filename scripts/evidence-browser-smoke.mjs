// Optional browser verification. Uses an existing Playwright installation;
// no production dependency is added. Start a local server before running.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const {chromium} = process.env.PLAYWRIGHT_MODULE ? await import(process.env.PLAYWRIGHT_MODULE) : require('playwright');
const base = process.env.PACKSIGNAL_TEST_URL || 'http://127.0.0.1:4173';
assert.ok(/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base),'Browser tests may only target localhost.');
const browser = await chromium.launch({channel:'chrome',headless:true});
const page = await browser.newPage({viewport:{width:1600,height:1100}});
page.setDefaultTimeout(15000);
const errors=[]; page.on('pageerror',e=>errors.push(e.message));
async function createReview(body) {
  const response=await page.request.get(`${base}/api/status`), status=await response.json();
  const created=await page.request.post(`${base}/api/reviews`,{headers:{'x-packproof-token':status.csrf},data:body});
  assert.ok(created.ok(),await created.text());const initial=await created.json();
  for(let n=0;n<150;n++) {
    const r=await (await page.request.get(`${base}/api/reviews/${initial.id}`)).json();
    if(r.status==='ready')return r;
    assert.notEqual(r.status,'failed',r.error);
    await new Promise(resolve=>setTimeout(resolve,200));
  }
  throw new Error('Review processing timed out');
}
async function openReview(review) {
  await page.goto(`${base}/?inspection=${review.id}#review/${review.id}`);
  await page.locator('.evidence-overlay').waitFor();
  await page.waitForFunction(()=>document.querySelector('[data-workbench-image] img')?.naturalWidth>0);
}
async function selectFinding(finding,index=0) {
  await page.locator(`[data-canvas-finding="${finding.id}"]`).click();
  await page.waitForFunction(({id,index})=>document.querySelector('.workbench-evidence')?.dataset.findingId===id && Number(document.querySelector('[data-workbench-frame]')?.dataset.zoom)>100,{id:finding.id,index});
  await page.waitForTimeout(350);
  assert.ok(await page.locator(`[data-marker="${finding.id}:${index}"]`).isVisible());
}
async function aligned(markerKey,box) {
  const data=await page.evaluate(key=>{
    const image=document.querySelector('[data-workbench-image] img').getBoundingClientRect();
    const rect=[...document.querySelectorAll('[data-marker]')].find(n=>n.dataset.marker===key)?.querySelector('rect').getBoundingClientRect();
    return {image:{x:image.x,y:image.y,width:image.width,height:image.height},rect:rect&&{x:rect.x,y:rect.y,width:rect.width,height:rect.height}};
  },markerKey);
  assert.ok(data.rect,'Marker is present');
  for(const [actual,expected] of [[data.rect.x,data.image.x+box[0]*data.image.width],[data.rect.y,data.image.y+box[1]*data.image.height],[data.rect.width,(box[2]-box[0])*data.image.width],[data.rect.height,(box[3]-box[1])*data.image.height]])assert.ok(Math.abs(actual-expected)<1.5,`Aligned geometry: ${actual} vs ${expected}`);
}
try {
  const organizer=await createReview({sample:'organizer',mode:'local'});
  console.log('Organizer created',organizer.id);
  await openReview(organizer);
  const finding=organizer.findings.find(f=>f.evidence.some(e=>e.role==='artwork'&&e.box));
  const index=finding.evidence.findIndex(e=>e.role==='artwork'&&e.box);
  await selectFinding(finding,index);
  const evidence=finding.evidence[index];
  assert.ok((await page.locator('[data-workbench-frame]').getAttribute('data-page-key')).endsWith(`:${evidence.page}`));
  await aligned(`${finding.id}:${index}`,evidence.box);
  // Clicking a real rendered marker exercises hit testing and overlap selection.
  await page.locator(`[data-marker="${finding.id}:${index}"] rect`).click();
  if(await page.locator('.evidence-chooser').isVisible())await page.locator(`[data-choose-marker="${finding.id}:${index}"]`).click();
  assert.equal(await page.locator('.workbench-evidence').getAttribute('data-finding-id'),finding.id);
  await page.locator('[data-viewport-fit]').click();
  assert.equal(await page.locator('[data-workbench-frame]').getAttribute('data-zoom'),'100');
  await page.screenshot({path:'/tmp/packsignal-evidence-organizer.png',fullPage:true});
  const fieldday=await createReview({sample:'fieldday',mode:'local'});
  await openReview(fieldday);
  const quantity=fieldday.findings.find(f=>f.status==='issue'&&f.evidence.some(e=>e.role==='artwork'&&e.box));
  await selectFinding(quantity,quantity.evidence.findIndex(e=>e.role==='artwork'&&e.box));
  assert.ok((await page.locator('.workbench-evidence .detail-values').innerText()).includes(quantity.expected));
  await page.screenshot({path:'/tmp/packsignal-evidence-fieldday.png',fullPage:true});
  // Fresh PDF and source JSON pass through the real upload/extraction/engine path.
  // Page sizes differ, and the repeated quantity differs between pages.
  const pdf=spawnSync('python3',['-c',`from reportlab.pdfgen import canvas
from io import BytesIO
import base64
b=BytesIO(); c=canvas.Canvas(b,pagesize=(800,600))
for w,h,value in [(800,600,'750 mL'),(500,900,'1000 mL')]:
 c.setPageSize((w,h)); c.setFont('Helvetica',18)
 c.drawString(40,h-55,'FIELD TEST - Packaging quantity inspection')
 c.drawString(40,h-100,'NET '+value)
 c.drawString(40,h-140,'Brand: FIELD TEST')
 c.drawString(40,h-180,'Keep refrigerated')
 c.showPage()
c.save(); print(base64.b64encode(b.getvalue()).decode())`],{encoding:'utf8'});
  assert.equal(pdf.status,0,pdf.stderr);
  const multiple=await createReview({name:'Canvas multi-page browser test',mode:'local',options:{completeArtwork:true},files:[{name:'two-page-artwork.pdf',role:'artwork',base64:pdf.stdout.trim()},{name:'source.json',role:'spec',base64:Buffer.from(JSON.stringify({product:{brand:'FIELD TEST',net_quantity:{value:1000,unit:'mL'},storage_statement:'Keep refrigerated'}})).toString('base64')}]});
  await openReview(multiple);
  const repeated=multiple.findings.find(f=>f.evidence.filter(e=>e.role==='artwork'&&e.box).length>=2);
  assert.ok(repeated,'Real extraction retains separate occurrences');
  const occurrences=repeated.evidence.map((e,i)=>({...e,index:i})).filter(e=>e.role==='artwork'&&e.box);
  await selectFinding(repeated,occurrences[0].index);
  await page.evaluate(()=>{window.testCanvasIdentity=document.querySelector('[data-workbench-frame]');});
  await page.locator('[data-occurrence-step="1"]').click();
  await page.waitForTimeout(400);
  assert.ok((await page.locator('[data-workbench-frame]').getAttribute('data-page-key')).endsWith(':2'));
  await aligned(`${repeated.id}:${occurrences[1].index}`,occurrences[1].box);
  assert.ok(await page.evaluate(()=>window.testCanvasIdentity===document.querySelector('[data-workbench-frame]')),'Selection does not remount viewport');
  assert.equal(await page.locator(`[data-marker="${repeated.id}:${occurrences[0].index}"]`).count(),0,'Page 1 marker absent on page 2');
  assert.ok((await page.locator('.workbench-evidence .detail-values').innerText()).includes('1000 mL'));
  await page.locator('[data-evidence-filter]').selectOption('unlocated');
  assert.equal(await page.locator('.workbench-evidence').getAttribute('data-finding-id'),repeated.id,'Filter preserves selection');
  await page.locator('[data-evidence-filter]').selectOption('all');
  await page.locator('[data-evidence-search]').fill('NET');
  assert.ok(await page.locator(`[data-canvas-finding="${repeated.id}"]`).isVisible());
  await page.locator('[data-evidence-search]').fill('');
  await page.locator('[data-overlay-mode]').selectOption('issues');
  assert.equal(await page.locator('.evidence-marker:not(.issue)').count(),0);
  await page.locator('[data-overlay-mode]').selectOption('all');
  await page.locator('[data-overlay-labels]').uncheck();
  assert.ok(await page.locator('.evidence-overlay').evaluate(n=>n.classList.contains('without-labels')));
  await page.locator('[data-layer-boxes]').uncheck();
  assert.equal(await page.locator('.evidence-overlay').isVisible(),false);
  await page.locator('[data-layer-boxes]').check();
  const frame=page.locator('[data-workbench-frame]');
  await frame.focus();await page.keyboard.press('+');await page.keyboard.press('ArrowRight');
  await aligned(`${repeated.id}:${occurrences[1].index}`,occurrences[1].box);
  const selectedBefore=await page.locator('.workbench-evidence').getAttribute('data-finding-id');
  const bounds=await frame.boundingBox();
  await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);await page.mouse.down();await page.mouse.move(bounds.x+bounds.width/2+40,bounds.y+bounds.height/2+20,{steps:5});await page.mouse.up();
  assert.equal(await page.locator('.workbench-evidence').getAttribute('data-finding-id'),selectedBefore,'Dragging cannot select a marker');
  await aligned(`${repeated.id}:${occurrences[1].index}`,occurrences[1].box);
  await page.locator('[data-canvas-page="0"]').click();
  await page.locator('[data-canvas-page="1"]').click();
  await aligned(`${repeated.id}:${occurrences[1].index}`,occurrences[1].box);
  await frame.focus();await page.keyboard.press('Home');
  assert.equal(await frame.getAttribute('data-zoom'),'100');
  await page.setViewportSize({width:390,height:844});
  await page.locator('[data-canvas-reset]').first().click();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Mobile has no horizontal overflow');
  await page.locator('[data-inspector-toggle]').click();
  assert.equal(await page.locator('.workbench-evidence').isVisible(),false);
  await page.locator('[data-inspector-toggle]').click();
  await page.screenshot({path:'/tmp/packsignal-evidence-mobile.png',fullPage:true});
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({result:'PASS',organizer:organizer.id,fieldday:fieldday.id,multiPage:multiple.id,checks:['real local reviews','finding focus','aligned SVG','marker selection','full-page reset','source comparison','multi-page upload and occurrences','persistent viewport','filters preserve selection','overlay controls','keyboard zoom and pan','drag suppression','per-page state','responsive mobile inspector'],errors},null,2));
} catch(error) { await page.screenshot({path:'/tmp/packsignal-evidence-failure.png',fullPage:true}); console.error('Browser errors',errors); throw error; } finally { await browser.close(); }
