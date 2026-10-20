import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const escape=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');

test('image evidence renders as an observation, not a supplied reference or confirmed defect',()=>{
  const finding={id:'brand',method:'image_observation',status:'review',title:'Confirm visible Brand',observed:'MORI <MEADOW>',expected:'Confirm the image reading',explanation:'A draft reading',evidence:[{documentId:'art',role:'artwork',page:1,quote:'MORI <MEADOW>',location:'Page 1'}],rule:{text:'Observation only'}};
  const context=vm.createContext({
    current:{findings:[finding],counts:{issue:0,review:1,unable:0,match:0},decisions:{},documents:[{id:'art',pages:[{number:1,unit:'px',method:'ai_transcription'}]}]},
    selectedFindingId:'brand',activeEvidenceIndex:0,filter:'all',artworkMode:'2d',artworkPage:1,cartonRotation:0,cartonTilt:0,artworkZoom:100,showEvidenceBoxes:true,showPanelZones:false,status:{},
    names:{review:'Human review'},symbols:{review:'?'},esc:escape,compactEvidence:x=>x,nextBestQuestion:()=>null,workbenchArtwork:()=>'<div>Original image</div>',teamReviewView:()=>'',
  });
  vm.runInContext(app.slice(app.indexOf('function findingEvidenceCopy('),app.indexOf('function nextBestQuestion(')),context);
  const html=vm.runInContext('findingView()',context);
  assert.match(html,/Read from artwork/);
  assert.match(html,/Reviewer check/);
  assert.match(html,/ARTWORK → OBSERVATION → REVIEW/);
  assert.match(html,/Image reading can miss or misread/);
  assert.match(html,/Add product spec \/ checklist/);
  assert.match(html,/MORI &lt;MEADOW>/);
  assert.doesNotMatch(html,/Supplied source says|Applicable supplied requirement|PDF text extraction/);
  finding.method='exact_comparison';
  assert.match(vm.runInContext('findingView()',context),/Supplied source says/);
});

test('artwork-only review can open and submit Add references without a second artwork',async()=>{
  let rendered,handler,submitted,opened;
  const error={textContent:''},button={disabled:false},dialogElement={close(){}};
  const context=vm.createContext({
    current:{id:'camera-review',files:[{id:'art',role:'artwork'}],options:{}},uploads:[],revisionUpload:false,sourceRevisionUpload:false,intakeMode:'files',
    dialog:(title,html)=>{rendered=html;},esc:escape,modeSelector:()=>'',marketSelector:()=>'',workspaceDataLocation:{uploadNotice:''},
    document:{addEventListener:(name,callback)=>{if(name==='submit')handler=callback;},querySelector:()=>button},
    $:selector=>selector==='#dialog'?dialogElement:selector==='#dialog-error'?error:{value:selector==='#review-mode'?'ai':'none'},
    encode:async()=> 'e30=',api:async(path,options)=>{submitted=options.body;return{id:'with-spec'};},
    openReview:async id=>{opened=id;},toast:message=>{throw new Error(message);},tab:'',filter:'all',
  });
  vm.runInContext(app.slice(app.indexOf('function showUpload('),app.indexOf('async function convertCapturedMedia(')),context);
  vm.runInContext('showUpload(false,true)',context);
  assert.match(rendered,/Add an approved product spec/);
  assert.doesNotMatch(rendered,/<input[^>]+id="files"[^>]+disabled/);
  context.uploads=[{name:'product.json',role:'spec',type:'application/json',size:2,replaceFileId:''}];
  vm.runInContext(app.slice(app.indexOf('document.addEventListener("submit"'),app.lastIndexOf('\ntry {')),context);
  await handler({target:{id:'upload-form',matches:()=>false},preventDefault(){}});
  assert.equal(error.textContent,'');
  assert.equal(opened,'with-spec');
  assert.equal(submitted.sourceRevision,true);
  assert.equal(submitted.parentId,'camera-review');
  assert.equal(submitted.files[0].role,'spec');
  assert.equal(submitted.files[0].replacesFileId,undefined);
  assert.equal(button.disabled,false);
});
