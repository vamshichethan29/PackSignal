import test from 'node:test';
import assert from 'node:assert/strict';
import { applyTranscriptions } from '../lib/apply-transcriptions.mjs';

test('reuses a retained camera reading when adding references and updates it without duplicate evidence',()=>{
  const art={id:'art',text:'',pages:[{number:1,text:'',method:'vision_needed'}],lines:[]};
  applyTranscriptions([art],[{documentId:'art',page:1,text:'MORI MEADOW\n1 L'}]);
  assert.equal(art.pages[0].method,'ai_transcription');
  assert.equal(art.text,'MORI MEADOW\n1 L');
  applyTranscriptions([art],[{documentId:'art',page:1,text:'MORI MEADOW\n946 mL'}]);
  assert.equal(art.text,'MORI MEADOW\n946 mL');
  assert.equal(art.lines.length,2);
  assert.equal(art.lines[1].text,'946 mL');
});

test('empty or unreadable-only readings do not erase evidence or complete image reading',()=>{
  const art={id:'art',text:'',pages:[{number:1,text:'',method:'vision_needed'}],lines:[]};
  for(const text of ['', '   ', '[unreadable]', '[ unreadable ]\n[unreadable]'])applyTranscriptions([art],[{documentId:'art',page:1,text}]);
  assert.equal(art.pages[0].method,'vision_needed');
  assert.equal(art.lines.length,0);
  applyTranscriptions([art],[{documentId:'art',page:1,text:'MORI [unreadable]'}]);
  assert.equal(art.text,'MORI [unreadable]');
});

test('native PDF text is preserved independently of image transcription',()=>{
  const art={id:'art',text:'native',pages:[{number:1,text:'native',method:'pdf_text'}],lines:[{text:'native',page:1,box:[0,0,1,1]}]};
  applyTranscriptions([art],[{documentId:'art',page:1,text:'visual'}]);
  assert.equal(art.text,'native');
  assert.equal(art.pages[0].text,'native');
  assert.equal(art.pages[0].visualText,'visual');
  assert.equal(art.lines[0].text,'native');
});

test('AI can correct local OCR without reusing the wrong evidence location',()=>{
  const art={id:'art',text:'MORI MEAOOW\n1 L',pages:[{number:1,text:'MORI MEAOOW\n1 L',method:'ocr_transcription'}],lines:[
    {text:'MORI MEAOOW',page:1,box:[.1,.1,.8,.2]},
    {text:'1 L',page:1,box:[.4,.7,.6,.8]},
  ]};
  applyTranscriptions([art],[{documentId:'art',page:1,text:'MORI MEADOW\n1 L'}]);
  assert.equal(art.pages[0].method,'ai_transcription');
  assert.equal(art.pages[0].ocrText,'MORI MEAOOW\n1 L');
  assert.equal(art.lines[0].box,null);
  assert.deepEqual(art.lines[1].box,[.4,.7,.6,.8]);
  assert.deepEqual(art.pages[0].ocrLines.map(line=>line.text),['MORI MEAOOW','1 L']);
});

test('ambiguous OCR locations are never borrowed for an AI transcription',()=>{
  const art={id:'art',text:'1 L\n1 L',pages:[{number:1,text:'1 L\n1 L',method:'ocr_transcription'}],lines:[
    {text:'1 L',page:1,box:[.1,.1,.2,.2]}, {text:'1 L',page:1,box:[.6,.6,.7,.7]},
  ]};
  applyTranscriptions([art],[{documentId:'art',page:1,text:'1 L'}]);
  assert.equal(art.lines[0].box,null);
});
