import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEvidenceBox, artworkOccurrences, markersAt, clusterMarkers, filterFindings } from '../public/evidence-geometry.js';
import { pageFit, focusBox, sourcePoint } from '../public/artwork-viewport.js';
const page={number:1,width:1000,height:500,image:'p1.png'};
const box=[.1,.2,.4,.5];
test('normalized, pixels and PDF points produce the same displayed region without modifying source',()=>{
  for(const evidence of [{box},{box:[100,100,400,250],coordinateSpace:'pixels',sourceWidth:1000,sourceHeight:500},{box:[100,250,400,400],coordinateSpace:'pdf-points',sourceWidth:1000,sourceHeight:500}]) {
    const before=structuredClone(evidence), result=normalizeEvidenceBox(evidence,page);
    result.box.forEach((n,i)=>assert.ok(Math.abs(n-box[i])<1e-12));assert.deepEqual(evidence,before);assert.deepEqual(result.original,evidence.box);
  }
});
test('rejects invalid boxes, dimensions and unsupported geometry; clips partial bounds with audit warning',()=>{
  for(const invalid of [[NaN,0,1,1],[0,0,Infinity,1],[.4,0,.1,1],[0,0,0,1],[2,2,3,3],null]) assert.equal(normalizeEvidenceBox({box:invalid},page).box,null);
  assert.equal(normalizeEvidenceBox({box},{...page,width:-1}).box,null);
  assert.equal(normalizeEvidenceBox({box,coordinateSpace:'pixels'},page).box,null);
  const clipped=normalizeEvidenceBox({box:[-.1,.2,.5,1.1]},page);
  assert.deepEqual(clipped.box,[0,.2,.5,1]);assert.equal(clipped.warnings.length,1);
  assert.deepEqual(clipped.original,[-.1,.2,.5,1.1]);
});
test('rotation requires a declared coordinate frame and only supports quarter turns',()=>{
  assert.equal(normalizeEvidenceBox({box},{...page,rotation:90}).box,null);
  assert.equal(normalizeEvidenceBox({box,rotation:45,coordinateFrame:'unrotated'},page).box,null);
  assert.deepEqual(normalizeEvidenceBox({box,rotation:90,coordinateFrame:'unrotated'},page).box,[.5,.1,.8,.4]);
  assert.deepEqual(normalizeEvidenceBox({box,rotation:90,coordinateFrame:'rendered'},page).box,box);
});
test('one shared normalized transform survives page aspect ratios, resize, focus, zoom and pan',()=>{
  for(const dimensions of [[1000,500],[500,1000],[750,750]])for(const size of [[800,500],[360,600]]) {
    const layout=pageFit(...size,...dimensions), view=focusBox(box,layout,16);
    for(const [x,y] of [[box[0],box[1]],[box[2],box[3]]]) {
      const point={x:view.x+(x-.5)*layout.pageWidth*view.scale,y:view.y+(y-.5)*layout.pageHeight*view.scale};
      const actual=sourcePoint(view,point,layout);
      assert.ok(Math.abs(actual.x-x)<1e-10&&Math.abs(actual.y-y)<1e-10);
    }
  }
});
const review={documents:[{id:'art',role:'artwork',pages:[page,{...page,number:2,width:500,height:1000,image:'p2.png'}]},{id:'spec',role:'spec',pages:[page]}],findings:[]};
const finding={id:'quantity',status:'issue',title:'Quantity',observed:'750 mL',expected:'1000 mL',rule:{id:'NET-1'},evidence:[{documentId:'art',role:'artwork',page:1,box,quote:'750 mL'},{documentId:'art',role:'artwork',page:2,box:[.6,.7,.8,.9],quote:'1000 mL'},{documentId:'spec',role:'spec',page:1,box},{documentId:'spec',role:'artwork',page:1,box}]};
review.findings=[finding,...['review','match','unable'].map(status=>({...finding,id:status,status,evidence:status==='unable'?[]:finding.evidence.slice(0,1)}))];
test('occurrences preserve document identity, page, differing quote, and evidence index',()=>{
  const occurrences=artworkOccurrences(review,finding);
  assert.equal(occurrences.length,2);assert.deepEqual(occurrences.map(m=>m.page.number),[1,2]);
  assert.deepEqual(occurrences.map(m=>m.evidence.quote),['750 mL','1000 mL']);
  assert.deepEqual(occurrences.map(m=>m.index),[0,1]);
  assert.equal(artworkOccurrences(review,{evidence:[{documentId:'missing',role:'artwork',page:1,box}]}).length,0);
});
test('overlaps retain every finding and low-zoom clusters never union evidence boxes',()=>{
  const markers=review.findings.flatMap(f=>artworkOccurrences(review,f)).filter(m=>m.page.number===1);
  assert.equal(markersAt(markers,.2,.3).length,3);
  const clusters=clusterMarkers(markers,600,400);
  assert.equal(clusters.length,1);assert.equal(clusters[0].members.length,3);
  assert.deepEqual(clusters[0].members[0].box,box);
});
test('filters and search include all statuses, missing geometry, source text and rule IDs',()=>{
  for(const status of ['issue','review','match','unable'])assert.equal(filterFindings(review,status).length,1);
  assert.equal(filterFindings(review,'unlocated')[0].id,'unable');
  assert.equal(filterFindings(review,'located').length,3);
  assert.equal(filterFindings(review,'all','NET-1').length,4);
  assert.equal(filterFindings(review,'all','1000').length,4);
  assert.equal(filterFindings(review,'all','absent').length,0);
});
