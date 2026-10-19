import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.GEMINI_MAX_ATTEMPTS='1';
process.env.GEMINI_MAX_REQUESTS_PER_SESSION='8';
process.env.GEMINI_MIN_INTERVAL_MS='1000';

const { geminiReview } = await import('../lib/ai.mjs');
let transportInstance=0;
const isolatedGeminiRequest=async()=> (await import(`../lib/gemini-transport.mjs?ai-test-${transportInstance++}`)).geminiRequest;
const mockResponse=(status,payload)=>({ok:status>=200&&status<300,status,headers:{get:()=>null},json:async()=>payload});
const success=data=>mockResponse(200,{candidates:[{content:{parts:[{text:JSON.stringify(data)}]}}],usageMetadata:{promptTokenCount:11,candidatesTokenCount:7,totalTokenCount:18}});
const quota=()=>mockResponse(429,{error:{details:[{'@type':'type.googleapis.com/google.rpc.QuotaFailure',violations:[{quotaValue:'0',quotaId:'requests-per-day'}]}]}});

async function makeReview(){
  const directory=await mkdtemp(join(tmpdir(),'packproof-vision-'));
  await mkdir(join(directory,'rendered'));
  const pages=Array.from({length:4},(_,index)=>({number:index+1,method:'vision_needed',image:`page-${index+1}.png`,text:''}));
  for(const page of pages)await writeFile(join(directory,'rendered',page.image),Buffer.from(`mock-image-${page.number}`));
  const review={documents:[{id:'art-1',name:'carton.pdf',role:'artwork',text:'',pages},{id:'spec-1',name:'spec.json',role:'spec',text:'{"product":{"net_quantity":"750 mL"}}',pages:[]}]};
  return {directory,review};
}
const pageLabels=request=>request.contents[0].parts.filter(part=>typeof part.text==='string'&&part.text.startsWith('Image: ')).map(part=>{
  const match=part.text.match(/documentId=([^,]+), page=(\d+)/);return {documentId:match[1],page:Number(match[2])};
});
const transcriptionPayload=(pages,observations=[],faceSuggestions=[])=>({facts:[],rules:[],observations,transcriptions:pages.map(item=>({...item,text:`Visible copy on page ${item.page}`})),faceSuggestions});

test('sends all four artwork pages in bounded image batches and combines transcripts',async()=>{
  const {directory,review}=await makeReview();const requests=[],requestGemini=await isolatedGeminiRequest();
  try{
    const result=await geminiReview(review,directory,'mock-key','gemini-test',async(_url,options)=>{
      const request=JSON.parse(options.body);requests.push(request);
      const pages=pageLabels(request);
      return success(transcriptionPayload(pages,requests.length===2?[{title:'Check page 4 copy',quote:'Visible copy on page 4',explanation:'Compare this panel content with the supplied product source.'}]:[]));
    },requestGemini);
    assert.equal(requests.length,2);
    assert.equal(pageLabels(requests[0]).length,3);
    assert.equal(pageLabels(requests[1]).length,1);
    assert.match(requests[1].systemInstruction.parts[0].text,/observations: at most 6/);
    assert.ok(JSON.parse(requests[1].contents[0].parts[0].text).sources.some(source=>source.id==='spec-1'));
    assert.equal(result.imagePagesSent,4);
    assert.equal(result.transport.requests,2);
    assert.equal(result.transport.attempts,2);
    assert.equal(result.visionComplete,true);
    assert.deepEqual(result.transcriptions.map(item=>item.page),[1,2,3,4]);
    assert.equal(result.observations.length,1);
    assert.deepEqual(result.warnings,[]);
    assert.equal(result.usage.totalTokenCount,36);
  }finally{await rm(directory,{recursive:true,force:true});}
});

test('keeps structural dielines out of product-artwork vision requests',async()=>{
  const {directory,review}=await makeReview();const requestGemini=await isolatedGeminiRequest();
  const dielinePage={number:1,method:'vision_needed',image:'dieline-p1.png',text:''};
  await writeFile(join(directory,'rendered',dielinePage.image),Buffer.from('mock-dieline'));
  review.documents.push({id:'die-1',name:'carton-dieline.pdf',role:'dieline',text:'FRONT PANEL',pages:[dielinePage]});
  let request;
  try{
    const result=await geminiReview(review,directory,'mock-key','gemini-test',async(_url,options)=>{
      request=JSON.parse(options.body);
      return success(transcriptionPayload(pageLabels(request)));
    },requestGemini);
    const serialized=JSON.stringify(request);
    assert.doesNotMatch(serialized,/die-1|carton-dieline|FRONT PANEL|dieline-p1/);
    assert.equal(result.imagePagesSent,4,'Only product artwork pages enter the visual transcription pass.');
  }finally{await rm(directory,{recursive:true,force:true});}
});

test('returns only valid face suggestions tied to submitted artwork pages',async()=>{
  const {directory,review}=await makeReview();const requestGemini=await isolatedGeminiRequest();review.documents[0].pages=review.documents[0].pages.slice(0,2);review.options={captureFaces:[{page:1,face:'unassigned',box:[0,0,1,1]},{page:2,face:'unassigned',box:[0,0,1,1]}]};let request;
  try{
    const result=await geminiReview(review,directory,'mock-key','gemini-test',async(_url,options)=>{
      request=JSON.parse(options.body);
      const pages=pageLabels(request);
      return success(transcriptionPayload(pages,[],[
        {documentId:'art-1',page:1,face:'front',reason:'Brand and product name face the camera.'},
        {documentId:'art-1',page:2,face:'back',reason:'Nutrition panel is visible.'},
        {documentId:'art-1',page:99,face:'left',reason:'Page was not sent.'},
        {documentId:'art-1',page:1,face:'sideways',reason:'Unsupported face.'},
      ]));
    },requestGemini);
    assert.deepEqual(result.faceSuggestions.map(item=>[item.page,item.face]),[[1,'front'],[2,'back']]);
    assert.match(request.generationConfig.responseJsonSchema.properties.faceSuggestions.items.properties.face.enum.join(','),/front.*back/);
    assert.match(request.contents[0].parts[0].text,/unassigned/,'the model receives context that these are unlabelled capture frames');
  }finally{await rm(directory,{recursive:true,force:true});}
});

test('retains completed batch results and names image-only pages when a later batch is quota-limited',async()=>{
  const {directory,review}=await makeReview();const requestGemini=await isolatedGeminiRequest();let requests=0;
  try{
    const result=await geminiReview(review,directory,'mock-key','gemini-test',async(_url,options)=>{
      requests++;
      if(requests===2)return quota();
      return success(transcriptionPayload(pageLabels(JSON.parse(options.body))));
    },requestGemini);
    assert.equal(requests,2);
    assert.equal(result.transcriptions.length,3);
    assert.deepEqual(result.unverifiedPages,[{documentId:'art-1',page:4}]);
    assert.equal(result.visionComplete,false);
    assert.ok(result.warnings.some(warning=>warning.includes('Vision processing stopped')));
    assert.ok(result.warnings.some(warning=>warning.includes('Artwork text could not be cross-checked')));
    assert.ok(result.warnings.some(warning=>warning.includes('carton.pdf, page 4')));
    assert.equal(result.transport.attempts,2);
  }finally{await rm(directory,{recursive:true,force:true});}
});

test('constrains AI fact fields in the response schema and drops unsupported proposals',async()=>{
  const {directory,review}=await makeReview();const requestGemini=await isolatedGeminiRequest();
  review.documents[0].pages=review.documents[0].pages.slice(0,1);
  review.documents[1].text='Net quantity 750 mL\nFDA approved';
  let request;
  try{
    const result=await geminiReview(review,directory,'schema-test-key','gemini-test',async(_url,options)=>{
      request=JSON.parse(options.body);
      return success({
        facts:[
          {documentId:'spec-1',field:'net_quantity',value:'750 mL',quote:'Net quantity 750 mL'},
          {documentId:'spec-1',field:'legal_approval',value:'FDA approved',quote:'FDA approved'},
        ],
        rules:[],observations:[],transcriptions:transcriptionPayload(pageLabels(request)).transcriptions,
      });
    },requestGemini);
    const factFields=request.generationConfig.responseJsonSchema.properties.facts.items.properties.field.enum;
    assert.ok(factFields.includes('net_quantity'));
    assert.ok(!factFields.includes('legal_approval'));
    assert.deepEqual(result.facts.map(item=>item.field),['net_quantity']);
  }finally{await rm(directory,{recursive:true,force:true});}
});
