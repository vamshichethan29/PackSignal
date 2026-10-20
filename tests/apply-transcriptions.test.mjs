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
