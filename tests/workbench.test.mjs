import test from 'node:test';
import assert from 'node:assert/strict';
import { artworkMap, findingVisual, sourcePreviewZones, workbenchArtwork } from '../public/artwork-ui.js';
import { panelZoneMapper } from '../public/panel-zones.js';
import { reviewPipeline } from '../public/review-pipeline.js';

const review={
  id:'review-demo',
  documents:[{id:'art',name:'carton.pdf',role:'artwork',sha256:'a'.repeat(64),pages:[{number:1,width:1200,height:860,unit:'pt',image:'page-1.png'}]}],
  findings:[],counts:{issue:1,review:2,match:4,unable:0},rules:[{id:'quantity'}],conflicts:[{field:'net_quantity'}],
  options:{panelZones:{front:{page:1,box:[0.05,0.05,0.75,0.95]}}},
};
const finding={
  id:'quantity',title:'Net quantity mismatch',status:'issue',expected:'1000 mL',observed:'750 mL',
  evidence:[{documentId:'art',name:'carton.pdf',role:'artwork',quote:'NET 750 mL',page:1,box:[0.12,0.76,0.48,0.84],location:'Page 1'}],
};
review.findings=[finding];

test('2D workbench shows the located artwork and red-green source comparison',()=>{
  const html=workbenchArtwork(review,finding,{mode:'2d',pageNumber:1,activeEvidenceIndex:0});
  assert.match(html,/Original artwork page 1/);
  assert.match(html,/workbench-region issue/);
  assert.match(html,/workbench-diff-actual/);
  assert.match(html,/ARTWORK SAYS/);
  assert.match(html,/SUPPLIED SOURCE/);
  assert.match(html,/1000 mL/);
});

test('3D fold context maps reviewer panels and exposes selectable evidence pins',()=>{
  const html=workbenchArtwork(review,finding,{mode:'3d',pageNumber:1,activeEvidenceIndex:0,cartonRotation:45});
  assert.match(html,/aria-label="Rotate illustrative carton"/);
  assert.match(html,/data-carton-rotation/);
  assert.match(html,/rotateY\(45deg\)/);
  assert.match(html,/data-carton-scene/);
  assert.match(html,/data-carton-face="front"/);
  assert.match(html,/carton-pin issue/);
  assert.match(html,/carton-pin issue selected/);
  assert.match(html,/aria-pressed="true"/);
  assert.match(html,/Carton proportions are illustrative/);
  assert.match(html,/Evidence on Front/);
  assert.doesNotMatch(html,/carton-context-reveal|carton-focus-strip|carton-replay/);
  assert.match(html,/aria-label="Front panel"/);
  assert.match(html,/aria-label="Open Net quantity mismatch"/);
  assert.match(html,/Use 2D proof for exact artwork inspection/);
});

test('3D context does not claim a precise panel location when a finding has no mapped artwork box',()=>{
  const html=workbenchArtwork(review,{...finding,evidence:[]},{mode:'3d'});
  assert.match(html,/Mapped face Front/);
  assert.doesNotMatch(html,/Evidence on Front/);
  assert.match(html,/Carton proportions are illustrative/);
});

test('3D context keeps an interactive neutral carton for a non-sample review with no mapped artwork',()=>{
  const unmapped={...review,options:{panelZones:{}}};
  const html=workbenchArtwork(unmapped,finding,{mode:'3d'});
  assert.match(html,/carton-stage carton-studio unmapped-preview/);
  assert.match(html,/data-carton-rotation/);
  assert.match(html,/data-carton-face="front"/);
  assert.match(html,/Artwork faces not mapped/);
  assert.match(html,/Artwork not mapped/);
  assert.doesNotMatch(html,/<img[^>]+Mapped /);
  assert.match(html,/Map faces →/);
});

test('new uploads preview the complete page as illustrative front art without inventing face mappings',()=>{
  const uploaded={...review,id:'review-upload',sample:undefined,options:{panelZones:{}}};
  const before=structuredClone(uploaded);
  assert.deepEqual(sourcePreviewZones(uploaded),{front:{page:1,box:[0,0,1,1]}});
  const html=workbenchArtwork(uploaded,finding,{mode:'3d'});
  assert.match(html,/carton-face carton-front preview-only/);
  assert.match(html,/full-page illustration only/);
  assert.match(html,/Full artwork page · preview only/);
  assert.match(html,/Map the real package faces before treating this illustrative 3D fold as package-specific/);
  assert.match(html,/Full artwork page · illustrative front only/);
  assert.match(html,/Illustrative front · 0 faces mapped/);
  assert.match(html,/--carton-w:198px;--carton-h:260px;--carton-d:58px/);
  assert.doesNotMatch(html,/Evidence on Front|Mapped face Front|carton-evidence-box/);
  assert.deepEqual(uploaded,before,'preview must not save geometry or change findings');
});

test('new uploads use positioned panel labels to place each crop on the matching illustrative 3D face',()=>{
  const labeled={...review,id:'review-labeled-upload',sample:undefined,options:{panelZones:{}},documents:[{
    ...review.documents[0],pages:[{...review.documents[0].pages[0],width:880,height:540}],lines:[
      {text:'BACK PANEL',page:1,box:[.02,.018,.075,.04]},
      {text:'LEFT SIDE',page:1,box:[.26,.018,.31,.04]},
      {text:'FRONT PANEL',page:1,box:[.51,.018,.57,.04]},
      {text:'RIGHT SIDE',page:1,box:[.76,.018,.82,.04]},
    ],
  }]};
  const before=structuredClone(labeled),zones=sourcePreviewZones(labeled);
  assert.deepEqual(Object.keys(zones),['back','left','front','right']);
  assert.deepEqual(zones.front,{page:1,box:[.51,0,.76,1]},'left-aligned panel labels locate the actual front column');
  assert.deepEqual(zones.left,{page:1,box:[.26,0,.51,1]});
  const html=workbenchArtwork(labeled,finding,{mode:'3d'});
  for(const face of ['back','left','front','right'])assert.match(html,new RegExp(`data-carton-face="${face}"[^>]*detected panel preview only`));
  assert.match(html,/Detected panels · preview only/);
  assert.match(html,/Confirm the detected face crops in Sources & decisions/);
  assert.match(html,/Detected panel crops · preview only/);
  assert.match(html,/the preview does not change review findings/);
  assert.match(html,/reviewer mapping not confirmed/);
  assert.doesNotMatch(html,/carton-pin |carton-evidence-box|Evidence on Front|Mapped face Front/);
  assert.deepEqual(labeled,before,'detected crops stay preview-only and never write reviewer geometry');
  const partiallyMapped={...labeled,options:{panelZones:{front:zones.front}}};
  const partialHtml=workbenchArtwork(partiallyMapped,finding,{mode:'3d'});
  assert.match(partialHtml,/carton-face carton-front mapped/);
  assert.match(partialHtml,/carton-face carton-back preview-only/);
  assert.match(partialHtml,/Confirm the detected face crops in Sources & decisions/,'remaining detected faces stay visible for reviewer confirmation');
});

test('reviewer-mapped bottle photos override unassigned capture labels in the 3D status',()=>{
  const bottle={...review,id:'wellman-photo-demo',sample:undefined,documents:[{...review.documents[0],pages:[1,2,3,4,5].map(number=>({number,width:1200,height:1900,unit:'px',image:`wellman-${number}.jpg`}))}],options:{
    packageType:'bottle_label',packageMappingConfirmed:true,
    captureFaces:[1,2,3,4,5].map(page=>({page,face:'unassigned',box:[0,0,1,1]})),
    panelZones:{front:{page:1,box:[.17,.2,.74,.91]},back:{page:3,box:[.18,.23,.76,.94]},right:{page:4,box:[.16,.25,.76,.94]},left:{page:5,box:[.18,.27,.76,.94]}},
  }};
  const html=workbenchArtwork(bottle,finding,{mode:'3d'});
  assert.match(html,/Interactive bottle label preview/);
  assert.match(html,/4 mapped faces · 1 extra capture/);
  assert.doesNotMatch(html,/5 captured pages · faces unassigned/);
  for(const face of ['front','back','left','right'])assert.match(html,new RegExp(`carton-face carton-${face} mapped`));
});

test('panel labels without page coordinates do not create guessed face mappings',()=>{
  const uploaded={...review,id:'review-no-coordinates',sample:undefined,options:{panelZones:{}},documents:[{
    ...review.documents[0],lines:[{text:'BACK PANEL'},{text:'FRONT PANEL'}],
  }]};
  assert.deepEqual(sourcePreviewZones(uploaded),{front:{page:1,box:[0,0,1,1]}});
});

test('existing reviews with one merged four-panel heading row still preview the four carton faces',()=>{
  const legacy={...review,id:'review-legacy-labeled-upload',sample:undefined,options:{panelZones:{}},documents:[{
    ...review.documents[0],pages:[{...review.documents[0].pages[0],width:880,height:540}],
    lines:[{text:'BACK PANEL LEFT SIDE FRONT PANEL RIGHT SIDE',page:1,box:[.02,.036,.816,.047]}],
  }]};
  assert.deepEqual(sourcePreviewZones(legacy),{
    back:{page:1,box:[0,0,.25,1]},left:{page:1,box:[.25,0,.5,1]},front:{page:1,box:[.5,0,.75,1]},right:{page:1,box:[.75,0,1,1]},
  });
});

test('existing Fieldday sample preview geometry stays unchanged',()=>{
  const sample={...review,id:'fieldday-preview',sample:'fieldday',documents:[{...review.documents[0],pages:[{...review.documents[0].pages[0],width:1800,height:860}]}],options:{panelZones:{
    front:{page:1,box:[40/1200,60/860,510/1200,802/860]},
    back:{page:1,box:[532/1200,60/860,1160/1200,802/860]},
  }}};
  const before=structuredClone(sample);
  assert.deepEqual(sourcePreviewZones(sample),{
    back:{page:1,box:[.02,.05,.25,.95]},
    left:{page:1,box:[.26,.05,.49,.95]},
    front:{page:1,box:[.50,.05,.74,.95]},
    right:{page:1,box:[.75,.05,.98,.95]},
  });
  const html=workbenchArtwork(sample,finding,{mode:'3d'});
  assert.match(html,/carton-face carton-left preview-only/);
  assert.match(html,/carton-face carton-right preview-only/);
  assert.match(html,/Source artwork preview/);
  assert.match(html,/data-reset-angle="-28"/,'Fieldday keeps its established turntable reset behavior');
  assert.deepEqual(sample,before,'the locked sample remains untouched');
});

test('organizer sample gets a non-persistent visual carton mockup from complete panel crops',()=>{
  const sample={...review,sample:'organizer',options:{panelZones:{}}};
  const before=structuredClone(sample);
  const html=workbenchArtwork(sample,finding,{mode:'3d'});
  assert.match(html,/carton-face carton-front preview-only/);
  assert.match(html,/carton-face carton-back preview-only/);
  assert.match(html,/carton-face carton-right preview-only/);
  assert.match(html,/Organizer artwork · illustrative fold/);
  assert.match(html,/preview does not change review findings/);
  assert.deepEqual(sample,before,'visual preview must not save geometry or change findings');
  assert.match(html,/Visual sample · 0 geometry maps/);
  const dimensions=html.match(/--carton-w:([\d.]+)px;--carton-h:([\d.]+)px;--carton-d:([\d.]+)px/);
  assert.ok(dimensions,'carton geometry is supplied');
  assert.match(html,/rotateY\(-28deg\)/);
  const crop=html.match(/alt="Mapped Front artwork panel" style="width:([\d.]+)%;height:([\d.]+)%;left:([\d.-]+)%;top:([\d.-]+)%"/);
  assert.ok(crop,'front face uses a crop from the supplied image');
  const [,cropWidth,cropHeight,,cropTop]=crop.map(Number);
  const top=-cropTop/cropHeight,bottom=(100-cropTop)/cropHeight;
  assert.ok(top>.35&&top<.4,'front crop begins below the logo flap');
  assert.ok(bottom>.78&&bottom<.81,'front crop includes the full lower panel');
  const page=sample.documents[0].pages[0];
  const sourceRatio=(100/cropWidth*page.width)/(100/cropHeight*page.height);
  assert.ok(Math.abs(Number(dimensions[1])/Number(dimensions[2])-sourceRatio)<.015,'carton front preserves source crop aspect ratio');
  assert.doesNotMatch(html,/carton-pin /);
});

test('Dancing Fish keeps its established artwork crops and illustrative carton dimensions',()=>{
  const sample={...review,id:'dancing-fish-geometry-lock',sample:'organizer',documents:[{
    ...review.documents[0],pages:[{...review.documents[0].pages[0],image:'dancing-fish-source.png'}],
  }],options:{panelZones:{}}};
  const before=structuredClone(sample),zones=sourcePreviewZones(sample),html=workbenchArtwork(sample,finding,{mode:'3d'});
  assert.deepEqual(zones,{
    back:{page:1,box:[.04,.375,.335,.786]},
    left:{page:1,box:[.346,.375,.514,.786]},
    front:{page:1,box:[.528,.375,.82,.786]},
    right:{page:1,box:[.834,.375,.993,.786]},
  });
  assert.match(html,/--carton-w:162px;--carton-h:163px;--carton-d:88px/);
  assert.match(html,/data-reset-angle="-28"/,'Dancing Fish keeps its established turntable reset behavior');
  assert.match(html,/src="\/api\/reviews\/dancing-fish-geometry-lock\/images\/dancing-fish-source.png"/);
  assert.deepEqual(sample,before,'the locked sample geometry and review data remain unchanged');
});

test('the fold model renders all six explicitly mapped carton faces',()=>{
  const mapped={...review,options:{panelZones:Object.fromEntries([
    ['front',[.05,.05,.45,.95]],['back',[.55,.05,.72,.95]],['left',[.73,.05,.8,.95]],
    ['right',[.81,.05,.88,.95]],['top',[.05,.02,.45,.09]],['bottom',[.05,.91,.45,.98]],
  ].map(([name,box])=>[name,{page:1,box}]))}};
  const html=workbenchArtwork(mapped,finding,{mode:'3d'});
  for(const face of ['front','back','left','right','top','bottom'])assert.match(html,new RegExp(`carton-face carton-${face} mapped`));
  assert.match(html,/Proportions follow your mapped faces/);
  assert.equal((html.match(/<img[^>]+alt="Mapped /g)||[]).length,6);
  for(const face of ['Front','Back','Left side','Right side','Top','Bottom'])assert.ok(html.includes(`alt="Mapped ${face} artwork panel"`));
});

test('2D prepress HUD includes calibrated PDF coordinates, layer controls, zoom and source hash state',()=>{
  const html=workbenchArtwork(review,finding,{mode:'2d',pageNumber:1,activeEvidenceIndex:0});
  assert.match(html,/data-workbench-zoom/);
  assert.match(html,/data-layer-boxes/);
  assert.match(html,/data-layer-zones/);
  assert.match(html,/hide-zones/);
  assert.match(html,/data-unit="pt"/);
  assert.match(html,/data-source-hash/);
  assert.match(html,/The 2D proof is unaltered/);
});

test('panel mapper shows the supplied face impact without adding reviewer-authored placement checks',()=>{
  const html=panelZoneMapper(review);
  assert.match(html,/Only supplied checklist checks assigned to that face are recalculated/);
  assert.match(html,/data-zone-impact/);
  assert.doesNotMatch(html,/reviewerPanelRequirements|placement check/i);
  assert.match(html,/value="left"/);
  assert.match(html,/value="right"/);
});

test('proof dialog artwork starts centered on the evidence with an adjustable spotlight',()=>{
  const html=findingVisual(review,finding);
  assert.match(html,/data-proof-spotlight/);
  assert.match(html,/data-proof-zoom/);
  assert.match(html,/data-trace-target/);
  assert.match(html,/OBSERVED ARTWORK/);
});

test('artwork coverage map does not add a synthetic placement guide',()=>{
  const html=artworkMap({...review,options:{panelZones:{front:{page:1,box:[.1,.1,.9,.9]}}}});
  assert.doesNotMatch(html,/LOWER 30% GUIDE|placement-guide/);
  assert.match(html,/No located check/);
});

test('review pipeline reports actual unresolved sources and does not claim a seal before export',()=>{
  const html=reviewPipeline(review,'findings');
  assert.match(html,/Sources &amp; authority/);
  assert.match(html,/1 input · 1 open decision/);
  assert.match(html,/Artwork verification/);
  assert.match(html,/1 supported or retained check/);
  assert.match(html,/1 issue · 2 for review/);
  assert.match(html,/Seal is created when you export/);
});
