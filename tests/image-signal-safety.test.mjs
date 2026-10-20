import test from 'node:test';
import assert from 'node:assert/strict';
import { signalFindings } from '../lib/signals.mjs';

const english='Contains milk';
const spanish='Contiene leche';
const reference={
  id:'approved-copy',name:'approved-copy.json',role:'spec',text:'Approved bilingual copy.',
  lines:[],pages:[],cells:[],
  data:{translation_pairs:[{
    id:'milk-allergen',required:true,status:'APPROVED',
    translations:{en:english,es:spanish},
  }]},
};

function bilingualResult({text=english,pages=[{number:1,method:'ai_transcription',unit:'px'}]}={}){
  const art={
    id:'artwork',name:'package-faces.pdf',role:'artwork',text,
    lines:text.split('\n').map(text=>({text,page:1,box:null})),
    pages:pages.map(page=>({...page,text:page.number===1?text:''})),
  };
  return signalFindings({
    documents:[art,reference],
    options:{sourceConfirmed:true,completeArtwork:true},
  }).find(finding=>finding.method==='translation_pair_exact_copy');
}

test('a confirmed camera review cannot turn an OCR miss into a bilingual-copy issue',()=>{
  const finding=bilingualResult();
  assert.equal(finding.status,'unable');
  assert.match(finding.explanation,/Image reading needs visual confirmation/);
  assert.match(finding.explanation,/cannot establish that wording is correct or absent/);
  assert.ok(finding.evidence.some(item=>item.role==='artwork'&&item.quote===english));
  assert.equal(finding.evidence.some(item=>item.role==='artwork'&&item.quote===spanish),false);
});

test('matching both bilingual phrases in an image transcription still needs human review',()=>{
  const finding=bilingualResult({text:`${english}\n${spanish}`});
  assert.equal(finding.status,'review');
  assert.match(finding.explanation,/Image reading needs visual confirmation/);
  assert.deepEqual(finding.evidence.filter(item=>item.role==='artwork').map(item=>item.quote),[english,spanish]);
});

test('unread image pages and missing page coverage cannot certify a bilingual omission',()=>{
  for(const pages of [
    [{number:1,method:'pdf_text'},{number:2,method:'vision_needed',unit:'px'}],
    [{number:1,method:'vision_needed',unit:'px'}],
    [],
  ]){
    assert.equal(bilingualResult({pages}).status,'unable');
  }
});

test('confirmed native-PDF bilingual comparisons retain their exact-copy outcomes',()=>{
  const pages=[{number:1,method:'pdf_text',unit:'pt'}];
  assert.equal(bilingualResult({pages}).status,'issue');
  const match=bilingualResult({text:`${english}\n${spanish}`,pages});
  assert.equal(match.status,'match');
  assert.doesNotMatch(match.explanation,/Image reading needs visual confirmation/);
});
