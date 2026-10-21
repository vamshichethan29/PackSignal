import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze, evidence } from '../lib/engine.mjs';

function artwork(pages){
  return {id:'art',name:'milk-video-frames.pdf',role:'artwork',text:pages.join('\n'),cells:[],
    pages:pages.map((text,index)=>({number:index+1,width:960,height:1280,unit:'px',method:'ai_transcription',image:`frame-${index+1}.png`,text})),
    lines:pages.flatMap((page,index)=>page.split('\n').map((text,line)=>({text,page:index+1,line:line+1,box:[.1,.1+line*.1,.8,.18+line*.1]})))};
}
const reading=(page,field,value,quote=value)=>({documentId:'art',page,field,value,quote});
const run=(art,readings=[],sources=[])=>analyze({documents:[art,...sources],options:{},ai:{artworkReadings:readings},decisions:{},audit:[]});

test('ordinary unlabelled photo copy remains in the queue alongside recognized quantity and storage',()=>{
  const art=artwork(['MORI MEADOW\nWHOLE MILK\nNET QUANTITY 1 L\nKeep refrigerated']);
  const result=run(art);
  const observed=result.findings.filter(item=>item.method==='image_observation');
  assert.ok(observed.some(item=>item.field==='net_quantity'&&item.observed==='1 L'));
  assert.ok(observed.some(item=>item.field==='storage_statement'&&item.observed==='Keep refrigerated'));
  assert.ok(observed.some(item=>item.observed.includes('MORI MEADOW')&&item.observed.includes('WHOLE MILK')));
  assert.equal(result.counts.match,0);
  assert.equal(result.counts.issue,0);
});

test('grounded image classifications draft fields without becoming approved source facts',()=>{
  const art=artwork(['MORI MEADOW\nWHOLE MILK\nNET QUANTITY 1 L','Ingredients: Whole milk\nContains milk']);
  const before=structuredClone(art);
  const result=run(art,[reading(1,'brand','MORI MEADOW'),reading(1,'product_name','WHOLE MILK'),reading(2,'ingredients','Whole milk','Ingredients: Whole milk')]);
  const observed=result.findings.filter(item=>item.method==='image_observation');
  assert.ok(observed.some(item=>item.field==='brand'&&item.observed==='MORI MEADOW'));
  assert.ok(observed.some(item=>item.field==='product_name'&&item.observed==='WHOLE MILK'));
  assert.ok(observed.every(item=>item.status==='review'));
  assert.deepEqual(result.facts,[]);
  assert.deepEqual(art,before);
  assert.equal(result.counts.issue,0);
  assert.equal(result.counts.match,0);
});

test('wrong-page, hidden, and unreadable AI classifications cannot enter the field queue',()=>{
  const art=artwork(['MORI MEADOW\nNET QUANTITY 1 L','WHOLE MILK\n[unreadable]']);
  const result=run(art,[reading(2,'brand','MORI MEADOW'),reading(1,'manufacturer','Imaginary factory'),reading(2,'product_name','[unreadable]'),{...reading(1,'brand','MORI MEADOW'),documentId:'spec'}]);
  const observed=result.findings.filter(item=>item.method==='image_observation');
  assert.ok(!observed.some(item=>['brand','manufacturer','product_name'].includes(item.field)));
  assert.ok(!observed.some(item=>/\[unreadable\]/.test(item.observed)));
});

test('multi-word field labels and repeated occurrences have the correct page evidence',()=>{
  const art=artwork(['Product name: Whole Milk\nAllergen statement: Contains milk\nStorage instructions: Keep refrigerated','Product name: Whole Milk']);
  const result=run(art);
  const product=result.findings.find(item=>item.field==='product_name');
  assert.equal(product.observed,'Whole Milk');
  assert.deepEqual(product.evidence.map(item=>item.page),[1,2]);
  assert.ok(result.findings.some(item=>item.field==='allergen_statement'));
  assert.ok(result.findings.some(item=>item.field==='storage_statement'));
  art.lines[3].box=[.2,.6,.7,.7];
  assert.deepEqual(evidence(art,'Whole Milk',{page:2}).box,[.2,.6,.7,.7]);
});

test('adding a spec compares supplied values against observed readings, never against itself',()=>{
  const art=artwork(['MORI MEADOW\nWHOLE MILK\nNET QUANTITY 1 L\nKeep refrigerated']);
  const readings=[reading(1,'brand','MORI MEADOW'),reading(1,'product_name','WHOLE MILK')];
  const data={product:{brand:'Different Dairy',name:'Whole Milk',net_quantity:{value:946,unit:'mL'}}};
  const spec={id:'spec',name:'approved-product.json',role:'spec',text:JSON.stringify(data),data,pages:[],lines:[],cells:[]};
  const result=run(art,readings,[spec]);
  assert.ok(!result.findings.some(item=>item.key==='missing-reference'));
  const brand=result.findings.find(item=>item.title==='Brand');
  assert.equal(brand.expected,'Different Dairy');
  assert.equal(brand.observed,'MORI MEADOW');
  assert.equal(brand.status,'review');
  assert.ok(brand.evidence.some(item=>item.role==='artwork'&&item.page===1&&item.quote==='MORI MEADOW'));
  assert.equal(brand.evidence.filter(item=>item.role==='spec').length,1,'the same source is not repeated as two evidence cards');
  assert.equal(brand.evidence.filter(item=>item.role==='artwork').length,1,'the same visible reading is not repeated');
  const net=result.findings.find(item=>item.title==='Net quantity');
  assert.equal(net.expected,'946 mL');
  assert.equal(net.observed,'1 L');
  assert.equal(net.status,'review');
  assert.ok(result.findings.some(item=>item.field==='storage_statement'&&item.method==='image_observation'),'visible fields outside the spec still get a review prompt');
  assert.ok(!result.findings.some(item=>item.field==='brand'&&item.method==='image_observation'),'source comparisons replace duplicate observation prompts');
  assert.ok(result.facts.every(item=>item.documentId==='spec'));
});

test('local OCR drafts a queue without a provider and cannot certify correctness or omissions',()=>{
  const art=artwork(['MORI MEADOW\nNET QUANTITY 1 L\nKeep refrigerated\nContains milk']);
  art.pages[0].method='ocr_transcription';
  art.pages[0].unit='pt'; // Raster content in a PDF must receive the same caution.
  const draft=run(art);
  assert.ok(draft.findings.some(item=>item.field==='net_quantity'&&item.observed==='1 L'));
  assert.ok(draft.findings.some(item=>item.method==='image_observation'&&item.observed.includes('MORI MEADOW')));
  const data={product:{brand:'MORI MEADOW',net_quantity:'946 mL',ingredients:'Whole milk',allergen_statement:'Contains milk'}};
  const spec={id:'spec',role:'spec',name:'product.json',data,text:JSON.stringify(data),pages:[],lines:[],cells:[]};
  const compared=analyze({documents:[art,spec],options:{completeArtwork:true,sourceConfirmed:true},decisions:{},audit:[]});
  assert.equal(compared.findings.find(item=>item.title==='Brand').status,'review');
  assert.equal(compared.findings.find(item=>item.title==='Net quantity').status,'review');
  assert.ok(compared.findings.some(item=>item.method==='artwork_readability'));
  assert.equal(compared.counts.issue,0);
  assert.equal(compared.findings.find(item=>item.key==='allergen-emphasis').status,'review');
  assert.equal(compared.coverage.completeArtwork,false);
  const rules={id:'rules',role:'rules',name:'checklist.json',text:'Compare net quantity',data:{rules:[{id:'quantity',field:'net_quantity',title:'Quantity',comparison:'quantity_equivalence',panel:'front'}]},pages:[],lines:[],cells:[]};
  const placed=analyze({documents:[art,spec,rules],options:{panelZones:{front:{page:1,box:[0,0,1,1]}}},decisions:{},audit:[]});
  assert.equal(placed.findings.find(item=>item.method==='panel_geometry').status,'review');
  assert.ok(!placed.findings.some(item=>item.method==='physical_legibility_screen'));
});

test('an image reading cannot independently corroborate itself',()=>{
  for(const method of ['ai_transcription','ocr_transcription']){
    const art=artwork(['NET QUANTITY 1 L']);
    art.pages[0].method=method;
    art.pages[0].visualText=art.pages[0].text;
    const data={product:{net_quantity:'1 L'}};
    const spec={id:'spec',role:'spec',name:'product.json',data,text:JSON.stringify(data),pages:[],lines:[],cells:[]};
    const compared=analyze({documents:[art,spec],options:{},decisions:{},audit:[]});
    const quantity=compared.findings.find(item=>item.title==='Net quantity');
    assert.equal(quantity.status,'review');
    assert.equal(quantity.visibility.state,'not_checked');
    assert.ok(!compared.findings.some(item=>item.method==='visibility_review'));
  }
});
