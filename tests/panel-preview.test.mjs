import test from 'node:test';
import assert from 'node:assert/strict';
import { selectedFacePreview, panelZoneMapper } from '../public/panel-zones.js';
import { captureFaceSuggestions, sourcePreviewZones, workbenchArtwork } from '../public/artwork-ui.js';

const review = () => ({id:'preview-check',sample:'organizer',options:{panelZones:{}},findings:[],documents:[{role:'artwork',name:'carton.pdf',pages:[{number:1,width:1800,height:1507,image:'page-1.png'},{number:2,width:900,height:1200,image:'page-2.png'}]}]});
test('each organizer face previews its own source crop without creating a mapping',()=>{
  const r=review(),before=JSON.stringify(r);
  const front=selectedFacePreview(r,{},'front'),back=selectedFacePreview(r,{},'back');
  assert.notEqual(front,back);
  assert.match(front,/Front panel artwork crop/);assert.match(back,/Back panel artwork crop/);
  assert.match(front,/Organizer preview · not a saved map/);
  assert.equal(JSON.stringify(r),before);
  const zones=sourcePreviewZones(r);zones.front.box[0]=0;
  assert.notEqual(sourcePreviewZones(r).front.box[0],0);
});
test('new upload face mapper labels the whole-page illustration and asks for a real face map',()=>{
  const r=review();r.id='new-upload';r.sample=undefined;r.options.panelZones={};
  const html=selectedFacePreview(r,r.options.panelZones,'front');
  assert.match(html,/Full page preview · not a saved map/);
  assert.match(html,/complete supplied page is shown as an illustration only/);
  assert.doesNotMatch(html,/Organizer preview/);
  assert.match(panelZoneMapper(r),/Draw each supplied artwork face/);
});
test('mapped faces override sample crops and show the correct page and draft status',()=>{
  const r=review(),zones={front:{page:2,box:[.1,.2,.7,.8]}};
  const html=selectedFacePreview(r,zones,'front',true);
  assert.match(html,/page-2.png/);assert.match(html,/Unsaved face crop/);assert.doesNotMatch(html,/Organizer preview/);
  assert.match(selectedFacePreview(r,zones,'front'),/Saved face crop/);
  assert.match(selectedFacePreview(r,{},'top'),/No artwork mapped/);
  assert.doesNotMatch(selectedFacePreview(r,{front:{page:1,box:[0,0,0,0]}},'front',true),/NaN|Infinity/);
});
test('mapping a single organizer face preserves the other source preview faces',()=>{
  const r=review();r.options.panelZones.front={page:2,box:[.1,.2,.7,.8]};
  const html=workbenchArtwork(r,null,{mode:'3d'});
  assert.match(html,/data-carton-face="front"[^>]*>[\s\S]*?page-2.png/);
  const right=html.split('data-carton-face="right"')[1].split('</div>')[0];
  assert.match(right,/page-1.png/);
  assert.doesNotMatch(right,/carton-pin/);
  assert.deepEqual(Object.keys(r.options.panelZones),['front']);
});
test('mapping form exposes an immediate selected-face preview',()=>{
  const html=panelZoneMapper(review());
  assert.match(html,/Preview \/ map face/);
  assert.match(html,/data-zone-face-preview aria-live="polite"/);
  assert.match(html,/Front panel artwork crop/);
});

test('captured face photos preview their own pages and remain unconfirmed until mapped',()=>{
  const r=review();delete r.sample;
  r.options.captureFaces=[{page:1,face:'front',box:[0,0,1,.96]},{page:2,face:'back',box:[0,0,1,.95]}];
  const before=structuredClone(r);
  assert.deepEqual(sourcePreviewZones(r),{
    front:{page:1,box:[0,0,1,.96]},back:{page:2,box:[0,0,1,.95]},
  });
  const html=workbenchArtwork(r,null,{mode:'3d'});
  assert.match(html,/Captured artwork · preview only/);
  assert.match(html,/data-carton-face="back"[^>]*>[\s\S]*?page-2.png/);
  assert.match(html,/Captured artwork · preview only/);
  assert.doesNotMatch(html,/data-cad-export|data-geometry-source="dxf"|carton-pin /);
  assert.match(selectedFacePreview(r,{},'back'),/Captured face photo · not a saved map/);
  assert.deepEqual(r,before);
});

test('ambiguous and invalid capture faces never become geometry suggestions',()=>{
  const r=review();delete r.sample;
  r.options.captureFaces=[
    {page:1,face:'front',box:[0,0,1,.96]}, {page:2,face:'front',box:[0,0,1,.96]},
    {page:1,face:'unassigned',box:[0,0,1,.96]}, {page:9,face:'back',box:[0,0,1,.96]},
    {page:1,face:'right',box:[-.1,0,1,.96]}, {page:1,face:'bottom',box:[.5,0,.4,.96]},
  ];
  assert.deepEqual(captureFaceSuggestions(r),{});
  delete r.sample;
  r.options.captureFaces=[];
  r.ai={faceSuggestions:[{page:1,face:'front',reason:'No crop coordinates were returned.'}]};
  assert.deepEqual(captureFaceSuggestions(r),{},'a whole-page fallback must not be mistaken for a detected face crop');
  r.sample='organizer';r.options.captureFaces=[{page:2,face:'front',box:[0,0,1,1]}];
  assert.deepEqual(captureFaceSuggestions(r),{});
  assert.equal(sourcePreviewZones(r).front.page,1);
});

test('unlabelled video stills offer explicit face mapping without silently confirming geometry',()=>{
  const r=review();delete r.sample;
  r.options.captureFaces=[
    {page:1,face:'unassigned',box:[0,0,1,1]},
    {page:2,face:'unassigned',box:[0,0,1,1]},
  ];
  const html=panelZoneMapper(r);
  assert.match(html,/Review captured pages/);
  assert.match(html,/confirm the orientation and crop/);
  assert.match(html,/data-capture-map-face="1"/);
  assert.match(html,/data-capture-map-page="2"/);
  assert.match(html,/data-package-confirm[^>]*disabled/);
  assert.doesNotMatch(html,/data-package-confirm[^>]*checked/);
  const preview=workbenchArtwork(r,null,{mode:'3d'});
  assert.match(preview,/2 captured pages · assign faces/);
  assert.match(preview,/Captured pages need face labels/);
  assert.match(preview,/data-angle="0" data-tilt="-7" data-reset-angle="0"/,'unassigned camera reviews open and reset to the front preview');
});

test('AI face suggestions improve camera previews but remain unconfirmed crops',()=>{
  const r=review();delete r.sample;
  r.documents[0].pages.push({number:3,width:900,height:1200,image:'page-3.png'});
  r.options.captureFaces=[1,2,3].map(page=>({page,face:'unassigned',box:[0,0,1,1]}));
  r.ai={faceSuggestions:[
    {page:1,face:'front',box:[.1,.1,.9,.9],reason:'The product name and brand face the camera.'},
    {page:2,face:'back',box:[.1,.1,.9,.9],reason:'The nutrition panel is visible.'},
    {page:3,face:'left',box:[.1,.1,.9,.9],reason:'Ingredients copy appears on the narrow side.'},
  ]};
  assert.deepEqual(Object.keys(captureFaceSuggestions(r)),['front','back','left']);
  const preview=workbenchArtwork(r,null,{mode:'3d'});
  assert.match(preview,/3 AI face crops · unconfirmed/);
  assert.match(preview,/Package preview · 0 faces mapped/);
  assert.match(preview,/AI-suggested face preview only/);
  assert.match(preview,/Suggestions do not establish folds or dimensions/);
  assert.match(preview,/data-geometry-source="illustrative"/);
  assert.doesNotMatch(preview,/data-cad-export/);
  const mapper=panelZoneMapper(r);
  assert.match(mapper,/AI suggests Front/);
  assert.match(mapper,/Use suggested faces as starting crops/);
  assert.match(mapper,/Vision suggested this as the front panel because The product name and brand face the camera/);
  assert.match(mapper,/data-package-confirm[^>]*disabled/);
  assert.doesNotMatch(mapper,/data-package-confirm checked/);
});

test('one photo can suggest two cropped carton faces without stretching a whole image across both',()=>{
  const r=review();delete r.sample;
  r.options.captureFaces=[{page:1,face:'unassigned',box:[0,0,1,1]}];
  r.ai={faceSuggestions:[
    {page:1,face:'front',box:[.12,.18,.76,.86],reason:'Main brand panel faces camera.'},
    {page:1,face:'right',box:[.76,.2,.94,.85],reason:'Narrow side panel is visible.'},
  ]};
  const crops=captureFaceSuggestions(r);
  assert.deepEqual(crops.front,{page:1,box:[.12,.18,.76,.86],aiSuggested:true,reason:'Main brand panel faces camera.'});
  assert.deepEqual(crops.right,{page:1,box:[.76,.2,.94,.85],aiSuggested:true,reason:'Narrow side panel is visible.'});
  const preview=workbenchArtwork(r,null,{mode:'3d'});
  assert.match(preview,/data-carton-face="front"[^>]*>[\s\S]*?style="width:156\.25%;height:[^;]+;left:-18\.75%;top:-26\.4705882352941[^%]*%"/);
  assert.match(preview,/data-carton-face="right"[^>]*>[\s\S]*?style="width:555\.555555555555[\d]*%;height:[^;]+;left:-422\.222222222222[\d]*%;top:-30\.7692307692307[\d]*%"/);
  assert.equal((preview.match(/AI-suggested face preview only/g)||[]).length,2);
  assert.match(preview,/data-geometry-source="illustrative"/);
  assert.doesNotMatch(preview,/data-cad-export/);
});

test('four video stills can texture all four carton faces after two independent sample passes',()=>{
  const pages=[1,2,3,4].map(number=>({number,width:960,height:1280,image:`milk-frame-${number}.jpg`}));
  const expected=[['front',[.1,.12,.9,.9]],['right',[.2,.08,.85,.94]],['back',[.08,.1,.92,.92]],['left',[.15,.08,.8,.94]]];
  for(let pass=1;pass<=2;pass++){
    const r={id:`milk-video-pass-${pass}`,options:{packageType:'carton',captureFaces:pages.map(page=>({page:page.number,face:'unassigned',box:[0,0,1,1]}))},findings:[],documents:[{id:'art',name:'milk.mp4',role:'artwork',pages}],ai:{faceSuggestions:expected.map(([face,box],index)=>({documentId:'art',page:index+1,face,box,reason:`Visible ${face} face.`}))}};
    const crops=captureFaceSuggestions(r);
    assert.deepEqual(Object.keys(crops),['front','right','back','left'],`pass ${pass}: all four face crops are recognized`);
    for(const [face,box] of expected)assert.deepEqual(crops[face],{page:expected.findIndex(([name])=>name===face)+1,box,aiSuggested:true,reason:`Visible ${face} face.`},`pass ${pass}: ${face} crop is preserved`);
    const html=workbenchArtwork(r,null,{mode:'3d'});
    for(const face of ['front','right','back','left'])assert.match(html,new RegExp(`data-carton-face="${face}"[^>]*>[\\s\\S]*?milk-frame-${expected.findIndex(([name])=>name===face)+1}\\.jpg`),`pass ${pass}: ${face} uses its own video still`);
    assert.match(html,/4 AI face crops · unconfirmed/);
    assert.match(html,/Package preview · 0 faces mapped/,'AI suggestions should clear the unassigned-frame label');
    assert.match(html,/unseen faces and package shape remain illustrative/i);
    assert.equal((html.match(/AI-suggested face preview only/g)||[]).length,4);
    assert.match(html,/data-geometry-source="illustrative"/);
    assert.doesNotMatch(html,/data-cad-export/);
  }
});

test('the included milk photo shows distinct front and narrow side crops on the carton preview',()=>{
  const r=review();delete r.sample;
  r.documents[0].pages=[{number:1,width:960,height:1280,image:'fictional-milk-carton-photo-page.png'}];
  r.options.captureFaces=[{page:1,face:'unassigned',box:[0,0,1,1]}];
  // Coordinates follow the visible front and right-side boundaries in the supplied fictional photo.
  r.ai={faceSuggestions:[
    {documentId:r.documents[0].id,page:1,face:'front',box:[.295,.296,.62,.743],reason:'The main Whole Milk panel faces the camera.'},
    {documentId:r.documents[0].id,page:1,face:'right',box:[.62,.296,.705,.743],reason:'The narrow ingredients panel is visible on the right.'},
  ]};
  const html=workbenchArtwork(r,null,{mode:'3d'});
  assert.match(html,/data-carton-face="front"[^>]*>[\s\S]*?fictional-milk-carton-photo-page\.png/);
  assert.match(html,/data-carton-face="right"[^>]*>[\s\S]*?fictional-milk-carton-photo-page\.png/);
  assert.equal((html.match(/AI-suggested face preview only/g)||[]).length,2);
  assert.match(html,/Package preview · 0 faces mapped/);
  assert.match(html,/rotateY\(0deg\)/,'a new photo review starts on the front face');
  assert.match(html,/data-geometry-source="illustrative"/);
  assert.doesNotMatch(html,/data-cad-export/);
});

test('the included milk video yields a four-sided carton and leaves its unseen side blank in two consecutive passes',()=>{
  const visibleFaces=[['front',1],['right',2],['back',3]];
  for(let pass=1;pass<=2;pass++){
    const r=review();delete r.sample;
    r.id=`fictional-milk-video-pass-${pass}`;
    r.documents[0].pages=[1,2,3,4].map(number=>({number,width:750,height:350,image:`milk-video-contact-frame-${number}.jpg`}));
    r.options.captureFaces=r.documents[0].pages.map(page=>({page:page.number,face:'unassigned',box:[0,0,1,1]}));
    r.ai={faceSuggestions:visibleFaces.map(([face,page])=>({documentId:r.documents[0].id,page,face,box:[.3,.1,.7,.9],reason:`The ${face} package panel is visible in the sample video.`}))};
    const html=workbenchArtwork(r,null,{mode:'3d'});
    assert.match(html,/data-carton-face="front"[^>]*>[\s\S]*?milk-video-contact-frame-1\.jpg/);
    assert.match(html,/data-carton-face="right"[^>]*>[\s\S]*?milk-video-contact-frame-2\.jpg/);
    assert.match(html,/data-carton-face="back"[^>]*>[\s\S]*?milk-video-contact-frame-3\.jpg/);
    assert.match(html,/<div class="carton-face carton-left unmapped[^\"]*" data-carton-face="left"[^>]*>[\s\S]*?Artwork not mapped/,'the hidden fourth face is not fabricated');
    assert.match(html,/data-angle="0"/);
    assert.match(html,/rotateY\(0deg\)/);
    assert.match(html,/data-geometry-source="illustrative"/);
    assert.match(html,/4-side|four-sided|unseen faces and package shape remain illustrative/i);
    assert.doesNotMatch(html,/data-cad-export/);
    const proof=workbenchArtwork(r,null,{mode:'2d'});
    assert.match(proof,/2D proof/);
    assert.match(proof,/milk-video-contact-frame-1\.jpg/);
  }
});

test('camera-only face mapper permits package selection and confirmation without a dieline',()=>{
  const r=review();delete r.sample;
  r.options.captureFaces=[{page:1,face:'front',box:[0,0,1,.96]}];
  const empty=panelZoneMapper(r);
  assert.match(empty,/PHOTO & ARTWORK PACKAGE PREVIEW/);
  assert.match(empty,/name="packageType"/);
  assert.match(empty,/Use suggested faces as starting crops/);
  assert.match(empty,/data-zone-page-use/);
  assert.match(empty,/data-package-confirm[^>]*disabled/);
  r.options.panelZones.front={page:1,box:[.1,.1,.8,.9]};
  r.options.packageMappingConfirmed=true;
  assert.match(panelZoneMapper(r),/data-package-confirm checked/);
  assert.doesNotMatch(panelZoneMapper(review()),/PHOTO & ARTWORK PACKAGE PREVIEW|data-zone-page-use/);
});

test('photo reviews use each selected package shape without granting a CAD export',()=>{
  for(const type of ['pouch','bottle_label','sleeve']){
    const r=review();delete r.sample;
    r.options={packageType:type,packageMappingConfirmed:true,panelZones:{front:{page:1,box:[.1,.1,.8,.9]},back:{page:2,box:[.1,.1,.8,.9]}}};
    const html=workbenchArtwork(r,null,{mode:'3d'});
    assert.match(html,new RegExp(`class="carton-model package-${type.replace('_','-')}"`));
    assert.match(html,/data-geometry-source="illustrative"/);
    assert.doesNotMatch(html,/data-cad-export/);
  }
});
