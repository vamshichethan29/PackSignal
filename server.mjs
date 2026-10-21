import { createServer } from 'node:http';
import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { readFile,writeFile,mkdir,readdir,rename,rm,stat } from 'node:fs/promises';
import { join,extname,basename,resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID,randomBytes,createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { analyze,compareRevisions,tokenSequencePresent } from './lib/engine.mjs';
import { geminiReview } from './lib/ai.mjs';
import { geminiStatus, shouldFailoverCredential } from './lib/gemini-transport.mjs';
import { marketPresets } from './lib/market-presets.mjs';
import { createHtmlReport } from './lib/html-report.mjs';
import { sealReview, verifyReviewSeal } from './lib/audit-signature.mjs';
import { answerFindingQuestion } from './lib/finding-qa.mjs';
import { publicFiles, createPublicFileSender } from './lib/public-files.mjs';
import { buildSourceRevisionInputs } from './lib/source-revision-inputs.mjs';
import { applyTranscriptions } from './lib/apply-transcriptions.mjs';
import { authenticateLegacyUser, authenticateTeamUser, parseTeamUsers } from './lib/team-auth.mjs';
import { addFindingApproval, addFindingComment, canReviewFinding, canViewReview, setFindingAssignment } from './lib/team-review.mjs';
import { verifyPersistentMount } from './lib/persistent-storage.mjs';
import { convertMedia, MEDIA_MAX_BYTES, MEDIA_MAX_SECONDS } from './lib/media-intake.mjs';
import { recognizedSampleUpload } from './lib/known-sample-upload.mjs';

const root=fileURLToPath(new URL('.',import.meta.url));
const sendPublicFile=createPublicFileSender(join(root,'public'));
for(const filename of ['.env.local','.env']){
  if(!existsSync(join(root,filename)))continue;
  for(const line of readFileSync(join(root,filename),'utf8').split(/\r?\n/)){
    const m=line.match(/^([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^['"]|['"]$/g,'');
  }
}
const storage=resolve(process.env.PACKPROOF_DATA_DIR||join(root,'.packproof'));
await mkdir(join(storage,'reviews'),{recursive:true,mode:0o700});await mkdir(join(storage,'cache'),{recursive:true,mode:0o700});
const persistentStoragePath=process.env.PACKPROOF_PERSISTENT_STORAGE_PATH?resolve(process.env.PACKPROOF_PERSISTENT_STORAGE_PATH):'';
const persistentStorageRequired=process.env.PACKPROOF_REQUIRE_PERSISTENT_STORAGE==='true';
let persistentStorageReady=false;
persistentStorageReady=await verifyPersistentMount(storage,persistentStoragePath);
if(persistentStorageRequired&&!persistentStorageReady)throw new Error('PackSignal requires its configured persistent storage mount before starting.');
const bundled=join(process.env.HOME||'','/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3');
const python=process.env.PACKPROOF_PYTHON||(existsSync(bundled)?bundled:'python3');
const port=Number(process.env.PORT||4173);const host=process.env.HOST||(process.env.NODE_ENV==='production'?'0.0.0.0':'127.0.0.1');
const localOrigins=new Set([`http://127.0.0.1:${port}`,`http://localhost:${port}`]);
const publicOrigin=(process.env.PACKPROOF_PUBLIC_ORIGIN||'').replace(/\/$/,'');
const allowedOrigins=new Set([...localOrigins,...(publicOrigin?[publicOrigin]:[])]);
const allowedHosts=new Set([...['127.0.0.1','localhost'].map(name=>`${name}:${port}`),...(process.env.PACKPROOF_ALLOWED_HOSTS||'').split(',').map(value=>value.trim()).filter(Boolean)]);
if(publicOrigin){try{allowedHosts.add(new URL(publicOrigin).host);}catch{throw new Error('PACKPROOF_PUBLIC_ORIGIN must be an absolute origin such as https://example.onrender.com');}}
const accessUser=process.env.PACKPROOF_ACCESS_USER||'judge';
const accessPassword=process.env.PACKPROOF_ACCESS_PASSWORD||'';
const teamUsers=parseTeamUsers(process.env.PACKPROOF_TEAM_USERS||'');
const teamEnabled=teamUsers.length>0;
if(process.env.NODE_ENV==='production'&&process.env.PACKPROOF_REQUIRE_AUTH==='true'&&!teamEnabled&&!accessPassword)throw new Error('Set PACKPROOF_ACCESS_PASSWORD or configure named PACKPROOF_TEAM_USERS before starting in production.');
if(process.env.NODE_ENV==='production'&&teamEnabled&&!persistentStorageReady)throw new Error('Named team reviews require the configured persistent storage mount.');
function authenticate(req){
  if(teamEnabled)return authenticateTeamUser(req.headers.authorization,teamUsers);
  if(accessPassword)return authenticateLegacyUser(req.headers.authorization,accessUser,accessPassword);
  if(process.env.NODE_ENV==='production'&&process.env.PACKPROOF_REQUIRE_AUTH==='true')return null;
  return {id:'local-user',username:'local',displayName:'Local reviewer',role:'admin'};
}
const publicTeamUsers=teamUsers.map(({id,username,displayName,role})=>({id,username,displayName,role}));
const csrf=randomBytes(24).toString('hex');
let apiKeys=[...new Set(Array.from({length:5},(_,i)=>process.env['GEMINI_API_KEY'+(i?'_'+(i+1):'')]||'').map(key=>key.trim()).filter(Boolean))],keyCursor=0,model=process.env.GEMINI_MODEL||'gemini-3.8-flash';
let queue=Promise.resolve();const jobs=new Set(),reviewWriteQueues=new Map();
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const withReviewWriteLock=(id,operation)=>{
  const previous=reviewWriteQueues.get(id)||Promise.resolve();
  const current=previous.then(operation,operation);
  const settled=current.then(()=>{},()=>{});
  reviewWriteQueues.set(id,settled);
  settled.then(()=>{if(reviewWriteQueues.get(id)===settled)reviewWriteQueues.delete(id);});
  return current;
};
function dir(id){if(!/^[a-f0-9-]{36}$/.test(id))throw fail('Invalid review identifier.');return join(storage,'reviews',id);}
const readReview=async id=>JSON.parse(await readFile(join(dir(id),'review.json'),'utf8'));
const load=async id=>{const review=await readReview(id);refreshDependencies(review);return review;};
async function save(r){const f=join(dir(r.id),'review.json'),tmp=f+'.'+randomUUID()+'.tmp';await writeFile(tmp,JSON.stringify(r,null,2),{mode:0o600});await rename(tmp,f);}
const audit=(r,action,detail,actor=null)=>r.audit.push({at:new Date().toISOString(),action,detail,...(actor?{actorId:actor.id,actorName:actor.displayName}:{})});
const clearSeal=r=>{delete r.signature;};
const hashValue=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function presentReview(review,user){
  const result=structuredClone(review);
  result.findings||=[];
  result.team||={createdBy:null,assignments:{},comments:[],approvals:[],assignmentHistory:[]};
  result.team.comments=(result.team.comments||[]).map(comment=>({...comment,stale:!result.findings.some(f=>f.id===comment.findingId)||comment.dependencyHash!==findingDependencyFingerprint(result,result.findings.find(f=>f.id===comment.findingId))}));
  result.team.approvals=(result.team.approvals||[]).map(approval=>{const finding=result.findings.find(f=>f.id===approval.findingId);return {...approval,stale:!finding||approval.dependencyHash!==findingDependencyFingerprint(result,finding)};});
  result.teamAccess={canAssign:user.role==='admin',canContribute:user.role==='admin'||canViewReview(result,user),canReviewFindingIds:result.findings.filter(finding=>canReviewFinding(result,finding.id,user)).map(finding=>finding.id)};
  return result;
}
function confirmationFingerprint(r,key){
  const sources=r.documents.filter(d=>d.role==='spec').map(d=>[d.id,d.sha256]);
  const artwork=r.documents.filter(d=>d.role==='artwork').map(d=>[d.id,d.sha256,d.pages?.map(p=>[p.number,p.method])]);
  const rules=r.documents.filter(d=>d.role==='rules').map(d=>[d.id,d.sha256]);
  const dielines=r.documents.filter(d=>d.role==='dieline').map(d=>[d.id,d.sha256,d.pages?.map(p=>[p.number,p.image])]);
  const dependencies={sourceConfirmed:{sources,factChoices:r.options.factChoices||{}},completeArtwork:{artwork},nutritionBasisConfirmed:{sources,factChoices:r.options.factChoices||{},nutritionVariant:r.options.nutritionVariant||''},netQuantityConfirmed:{artwork},panelPlacementConfirmed:{artwork,panelZones:r.options.panelZones||{}},packageMappingConfirmed:{artwork,dielines,packageType:r.options.packageType||'carton',panelZones:r.options.panelZones||{}},aiRulesConfirmed:{rules,proposedRules:r.ai?.rules||[]}}[key];
  return hashValue(dependencies||{});
}
function findingDependencyFingerprint(r,finding){
  const documentIds=new Set((finding.evidence||[]).map(e=>e.documentId).filter(Boolean));
  const art=r.documents.find(d=>d.role==='artwork');if(art)documentIds.add(art.id);
  const documents=r.documents.filter(d=>documentIds.has(d.id)).map(d=>[d.id,d.sha256]);
  return hashValue({finding:{id:finding.id,status:finding.status,expected:finding.expected,observed:finding.observed,evidence:finding.evidence,rule:finding.rule},documents,options:r.options});
}
function refreshDependencies(r){
  r.options ||= {};r.options.confirmationFingerprints ||= {};r.options.staleConfirmations ||= {};
  for(const key of ['sourceConfirmed','completeArtwork','nutritionBasisConfirmed','netQuantityConfirmed','panelPlacementConfirmed','packageMappingConfirmed','aiRulesConfirmed']){
    if(!r.options[key])continue;
    const expected=r.options.confirmationFingerprints[key];
    if(!expected||expected!==confirmationFingerprint(r,key)){r.options[key]=false;delete r.options.confirmationFingerprints[key];r.options.staleConfirmations[key]=true;}
  }
  for(const [id,decision] of Object.entries(r.decisions||{})){
    const finding=r.findings?.find(item=>item.id===id);
    if(!finding||!decision.dependencyHash||decision.dependencyHash!==findingDependencyFingerprint(r,finding))decision.stale=true;
  }
}
function carryForwardUnaffectedSourceDecisions(previous,current){
  if(current.revision?.kind!=='sources')return;
  const recheckIds=new Set(current.revision.decisionRechecks.map(item=>item.findingId));
  for(const [findingId,decision] of Object.entries(previous.decisions||{})){
    if(recheckIds.has(findingId)||decision.stale)continue;
    const oldFinding=previous.findings.find(item=>item.id===findingId);
    const nextFinding=current.findings.find(item=>item.id===findingId)||(oldFinding?.key?current.findings.find(item=>item.key===oldFinding.key):null);
    if(!nextFinding)continue;
    current.decisions[nextFinding.id]={...structuredClone(decision),stale:false,dependencyHash:findingDependencyFingerprint(current,nextFinding),carriedFrom:{reviewId:previous.id,findingId}};
  }
}
function panelZones(value, artwork){
  if(value===undefined)return undefined;
  if(typeof value==='string'){try{value=JSON.parse(value);}catch{throw fail('Panel zones must contain valid JSON.');}}
  if(!value||typeof value!=='object'||Array.isArray(value))throw fail('Panel zones must be a map of named artwork rectangles.');
  const result={};
  for(const [name,zone] of Object.entries(value)){
    if(!['front','back','left','right','top','bottom'].includes(name)||!zone||typeof zone!=='object'||!Number.isInteger(zone.page)||!Array.isArray(zone.box)||zone.box.length!==4)throw fail('Invalid panel zone.');
    const [x0,y0,x1,y1]=zone.box.map(Number);const page=artwork?.pages?.find(item=>item.number===zone.page);
    if(!page||![x0,y0,x1,y1].every(Number.isFinite)||x0<0||y0<0||x1>1||y1>1||x0>=x1||y0>=y1)throw fail('Panel zones must be drawn within a supplied artwork page.');
    result[name]={page:zone.page,box:[x0,y0,x1,y1]};
  }
  return result;
}
const json=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
async function body(req){let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>45_000_000)throw fail('Upload is too large.',413);chunks.push(chunk);}try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw fail('Request must contain valid JSON.');}}
function worker(args){return new Promise((done,reject)=>{
  const workerEnv=Object.fromEntries(Object.entries(process.env).filter(([name])=>!/(?:API_KEY(?:_\d+)?|ACCESS_TOKEN|AUTH_TOKEN)$/.test(name)));
  const p=spawn(python,[join(root,'lib/extract.py')],{stdio:['pipe','pipe','pipe'],env:{...workerEnv,PYTHONPATH:[join(root,'.packproof','python-deps'),workerEnv.PYTHONPATH].filter(Boolean).join(':')}});let output='',errors='',settled=false;
  const end=(err,value)=>{if(settled)return;settled=true;clearTimeout(timer);err?reject(err):done(value);};
  const timer=setTimeout(()=>{p.kill('SIGKILL');end(fail('Document processing timed out. Use a smaller file.'));},90000);
  p.stdout.on('data',c=>{output+=c;if(output.length>8_000_000){p.kill();end(fail('Extracted document is too large.'));}});p.stderr.on('data',c=>{if(errors.length<2000)errors+=c;});
  p.on('error',()=>end(fail('Python runtime is unavailable. Run npm run doctor for setup.')));
  p.on('close',code=>{try{const result=JSON.parse(output);if(code||result.error)end(fail(result.error||'Document processing failed.'));else end(null,result);}catch{end(fail(errors.includes('ModuleNotFoundError')?'Python dependencies are missing. Run npm run doctor.':'The document could not be parsed. Check its format and encryption.'));}});
  p.stdin.on('error',()=>{});p.stdin.end(JSON.stringify(args));
});}
const samples={
  organizer:[['samples/organizer/DancingFish_Granola_Berry_US_Carton.pdf','artwork'],['samples/organizer/DancingFish_Granola_BerryCrunch_US_Content_Sheet.xlsx','spec']],
  fieldday:[['samples/fieldday-v2/artwork/fieldday-v1.pdf','artwork'],['samples/fieldday-v2/inputs/product-spec.json','spec'],['samples/fieldday-v2/inputs/company-rulebook.json','rules'],['samples/fieldday-v2/inputs/claims-register.json','claims']],
  signals:[['samples/fieldday-v2/artwork/fieldday-signals.pdf','artwork'],['samples/fieldday-v2/inputs/product-spec.json','spec'],['samples/fieldday-v2/inputs/company-rulebook.json','rules'],['samples/fieldday-v2/inputs/claims-register.json','claims']],
  clean:[['samples/fieldday-v2/artwork/fieldday-baseline.pdf','artwork'],['samples/fieldday-v2/inputs/product-spec.json','spec'],['samples/fieldday-v2/inputs/company-rulebook.json','rules'],['samples/fieldday-v2/inputs/claims-register.json','claims']],
  conflict:[['samples/fieldday-v2/artwork/fieldday-v1.pdf','artwork'],['samples/fieldday-v2/inputs/product-spec.json','spec'],['samples/fieldday-v2/inputs/unconfirmed-handover-note.json','spec'],['samples/fieldday-v2/inputs/company-rulebook.json','rules'],['samples/fieldday-v2/inputs/claims-register.json','claims']],
};
const fielddaySampleZones={front:{page:1,box:[40/1200,60/860,510/1200,802/860]},back:{page:1,box:[532/1200,60/860,1160/1200,802/860]}};
const sampleZones=sample=>['fieldday','clean','conflict','signals'].includes(sample)?structuredClone(fielddaySampleZones):{};
async function writeInputs(r,files){
  if(!Array.isArray(files)||files.length<1||files.length>8)throw fail('Supply one artwork and optional references, up to eight files.');
  if(files.filter(f=>f.role==='artwork').length!==1)throw fail('Choose exactly one artwork file.');
  if(files.some(f=>f.captureFaces!==undefined&&f.role!=='artwork'))throw fail('Face labels can only be attached to artwork.');
  let total=0;const written=[];
  for(const f of files){
    const name=basename(String(f.name||'')).replace(/[\x00-\x1f]/g,'').slice(0,160),ext=extname(name).toLowerCase();
    if(!['.pdf','.png','.jpg','.jpeg','.webp','.xlsx','.docx','.csv','.json','.txt','.md','.dxf'].includes(ext))throw fail('Unsupported file type: '+name);
    if(!['artwork','dieline','spec','rules','claims'].includes(f.role))throw fail('Invalid document role.');
    if(f.role==='artwork'&&!['.pdf','.png','.jpg','.jpeg','.webp'].includes(ext))throw fail('Artwork must be a PDF or image.');
    if(f.role==='dieline'&&!['.pdf','.png','.jpg','.jpeg','.webp','.dxf'].includes(ext))throw fail('A dieline must be a PDF, image, or ASCII DXF file.');
    if(ext==='.dxf'&&f.role!=='dieline')throw fail('DXF files are supported only as a dieline / structural reference.');
    if(typeof f.base64!=='string'||!f.base64.length||!/^[A-Za-z0-9+/]*={0,2}$/.test(f.base64))throw fail('Invalid encoded file.');
    const bytes=Buffer.from(f.base64,'base64');total+=bytes.length;
    if(bytes.length>15_000_000||total>30_000_000)throw fail('Limit: 15 MB per file, 30 MB per review.',413);
    let captureFaces;
    if(f.captureFaces!==undefined){
      if(!Array.isArray(f.captureFaces)||f.captureFaces.length>8)throw fail('Artwork face labels are invalid.');
      captureFaces=f.captureFaces.map(item=>{
        if(!item||!Number.isInteger(item.page)||item.page<1||!['front','right','back','left','top','bottom','unassigned'].includes(item.face)||!Array.isArray(item.box)||item.box.length!==4)throw fail('Artwork face labels are invalid.');
        const box=item.box.map(Number);if(!box.every(Number.isFinite)||box.some(value=>value<0||value>1)||box[0]>=box[2]||box[1]>=box[3])throw fail('Artwork face labels are invalid.');
        return {page:item.page,face:item.face,box};
      });
    }
    const id=randomUUID(),disk=id+ext;await writeFile(join(dir(r.id),'files',disk),bytes,{mode:0o600});written.push({id,name,role:f.role,disk,...(captureFaces?{captureFaces}:{})});
  }
  if(written.filter(file=>file.role==='dieline').length>1)throw fail('Add at most one dieline document per review.');
  return written;
}
async function processReview(id){
  let r;
  try{
    r=await load(id);r.status='processing';r.progress='Reading documents and locating evidence';await save(r);r.documents=[];
    for(const file of r.files){r.documents.push(await worker({path:join(dir(id),'files',file.disk),role:file.role,outdir:join(dir(id),'rendered'),id:file.id,name:file.name}));}
    if(r.revisionKind==='sources'&&r.ai?.transcriptions)applyTranscriptions(r.documents,r.ai.transcriptions);
    const artworkFile=r.files.find(file=>file.role==='artwork'),artworkDocument=r.documents.find(document=>document.role==='artwork');
    if(artworkFile?.captureFaces?.length){
      const validPages=new Set((artworkDocument?.pages||[]).map(page=>page.number));
      r.options.captureFaces=artworkFile.captureFaces.filter(item=>validPages.has(item.page));
      if(r.options.captureFaces.length!==artworkFile.captureFaces.length)r.captureFaceWarning='Some camera face labels did not match an artwork page and were ignored.';
    }
    r.warnings=r.documents.flatMap(d=>d.warnings.map(w=>d.name+': '+w));if(r.captureFaceWarning){r.warnings.push(r.captureFaceWarning);delete r.captureFaceWarning;}r.engine='Local extraction + exact comparisons';
    r.aiStatus=r.mode==='ai'?'pending':'not_requested';
    refreshDependencies(r);Object.assign(r,analyze(r));if(r.parentId){const previous=await load(r.parentId);r.revision=compareRevisions(previous,r);carryForwardUnaffectedSourceDecisions(previous,r);}
    r.status='ready';r.progress='Local checks complete';r.finishedAt=new Date().toISOString();audit(r,'local_analysis_completed',`${r.findings.length} findings; ${r.engine}`);await save(r);

    if(r.mode==='ai'){
      if(!apiKeys.length){
        clearSeal(r);r.aiStatus='unavailable';r.aiError='Packaging intelligence is not configured on this server. Local extraction and exact checks are available.';r.aiFailure={code:'AI_NOT_CONFIGURED',retryAt:null};r.warnings.push('Multimodal intelligence was not run because no server-side API key is configured. Local results are available.');audit(r,'ai_unavailable',r.aiError);await save(r);
      }else{
        r.aiStatus='running';r.progress='Local checks are ready; Packaging intelligence is analyzing sources in the background';await save(r);
        const cacheId=createHash('sha256').update(JSON.stringify({version:9,model,docs:r.documents.map(d=>[d.sha256,d.role,d.name])})).digest('hex');const cache=join(storage,'cache',cacheId+'.json');
        const cacheHit=existsSync(cache),canonical={documents:r.documents.map((d,index)=>({...d,id:'source-'+index})),options:structuredClone(r.options)};
        try{
          let ai=null,lastError=null;
          if(cacheHit){
            ai=JSON.parse(await readFile(cache,'utf8'));
          }else{
            for(let i=0;i<apiKeys.length;i++){
              const currentKey=apiKeys[(keyCursor+i)%apiKeys.length];
              try{
                ai=await geminiReview(canonical,dir(id),currentKey,model);
                keyCursor=(keyCursor+i)%apiKeys.length;
                break;
              }catch(err){
                lastError=err;
                if(apiKeys.length>1&&shouldFailoverCredential(err)){
                  const failedIndex=(keyCursor+i)%apiKeys.length+1;
                  audit(r,'key_failover',`Key ${failedIndex}/${apiKeys.length} quota/limit reached; rotating to key ${(failedIndex%apiKeys.length)+1}.`);
                  // Advance the global cursor so the next review starts from the next key.
                  keyCursor=(keyCursor+i+1)%apiKeys.length;
                  continue;
                }
                throw err;
              }
            }
            if(!ai&&lastError)throw lastError;
            if(ai&&ai.visionComplete){const temporary=cache+'.'+randomUUID()+'.tmp';await writeFile(temporary,JSON.stringify(ai),{mode:0o600});await rename(temporary,cache);}
          }
          // Another request can record a reviewer decision while Gemini is running.
          // Reload before applying AI output so those decisions and source choices survive.
          r=await load(id);r.ai=structuredClone(ai);
          for(const field of ['facts','rules','transcriptions','artworkReadings','faceSuggestions','sentPages','unverifiedPages','omittedPages'])r.ai[field]=(r.ai[field]||[]).map(item=>{
            const index=canonical.documents.findIndex(d=>d.id===item.documentId);return index<0?null:{...item,documentId:r.documents[index].id};
          }).filter(Boolean);
          r.ai.transport={...r.ai.transport,cacheHit,...(cacheHit?{attempts:0}:{})};
          r.warnings.push(...(r.ai.warnings||[]));
          audit(r,cacheHit?'ai_cache_reused':'ai_request_completed',cacheHit?'Saved complete intelligence result reused for identical files, roles, and model. No provider request.':`Packaging intelligence processed ${r.ai.imagePagesSent} image page(s) using ${r.ai.transport.requests} request(s) and ${r.ai.transport.attempts} outbound attempt(s).`);
          applyTranscriptions(r.documents,r.ai.transcriptions);
          clearSeal(r);r.engine='Packaging Intelligence + exact comparisons';r.aiStatus='complete';r.progress='Intelligence and local review complete';refreshDependencies(r);Object.assign(r,analyze(r));if(r.parentId){const previous=await load(r.parentId);r.revision=compareRevisions(previous,r);carryForwardUnaffectedSourceDecisions(previous,r);}audit(r,'analysis_completed',`${r.findings.length} findings; ${r.engine}`);await save(r);
        }catch(error){
          r=await load(id);clearSeal(r);r.aiStatus='unavailable';r.aiError=error.name==='TimeoutError'?'Intelligence request timed out.':error.message;r.aiFailure={code:error.code||'AI_UNAVAILABLE',retryAt:error.retryAt||null};r.warnings.push('Packaging intelligence unavailable: '+r.aiError+' Local checks remain available.');r.progress='Local review complete; Intelligence engine unavailable';audit(r,'ai_unavailable',r.aiError);await save(r);
        }
      }
    }
  }catch(error){if(r){try{r=await load(id);}catch{}if(r.status==='ready'){clearSeal(r);r.aiStatus='unavailable';r.aiError=error.message;r.aiFailure={code:error.code||'AI_UNAVAILABLE',retryAt:error.retryAt||null};r.warnings.push('Background AI could not complete: '+error.message+' Local checks remain available.');audit(r,'ai_unavailable',error.message);}else{r.status='failed';r.error=error.message;r.progress='Review could not complete';audit(r,'analysis_failed',error.message);}await save(r);}}
  finally{jobs.delete(id);}
}
async function createReview(input,actor){
  if(input.options?.marketPreset!==undefined&&!['none','us','india','eu'].includes(input.options.marketPreset))throw fail('Unknown market preset.');
  if(jobs.size>=4)throw fail('Four reviews are already queued. Wait for one to finish.',429);
  const r={id:randomUUID(),name:String(input.name||'Packaging review').slice(0,120),market:String(input.market||'Unspecified').slice(0,60),createdAt:new Date().toISOString(),status:'queued',progress:'Waiting to process',mode:input.mode==='local'?'local':'ai',options:{completeArtwork:input.options?.completeArtwork===true,sourceConfirmed:false,marketPreset:input.options?.marketPreset||'none',panelZones:{},...(Array.isArray(input.files)&&input.files.some(file=>file.role==='dieline')?{packageType:'carton',packageMappingConfirmed:false}:{})},files:[],documents:[],decisions:{},audit:[],team:{createdBy:actor.id,createdByName:actor.displayName,assignments:{},comments:[],approvals:[],assignmentHistory:[]}};
  await mkdir(join(dir(r.id),'files'),{recursive:true,mode:0o700});await mkdir(join(dir(r.id),'rendered'),{mode:0o700});
  try{
    let files=input.files;
    if(input.parentId){
      if(teamEnabled&&actor.role!=='admin')throw fail('Only a workspace admin can create an artwork or source revision.',403);
      const previous=await load(input.parentId);if(!canViewReview(previous,actor))throw fail('Review not found or not assigned to this account.',404);if(previous.status!=='ready')throw fail('The previous review is not ready.');
      r.parentId=previous.id;r.market=previous.market;r.sample=previous.sample;
      r.team.assignments=structuredClone(previous.team?.assignments||{});r.team.assignmentHistory=structuredClone(previous.team?.assignmentHistory||[]);r.team.comments=structuredClone(previous.team?.comments||[]);r.team.approvals=structuredClone(previous.team?.approvals||[]);
      if(input.sourceRevision===true){
        r.revisionKind='sources';r.name=previous.name+' · source update';r.mode=input.mode==='local'?'local':'ai';r.options={...structuredClone(previous.options),marketPreset:input.options?.marketPreset??previous.options.marketPreset??'none'};
        r.documents=structuredClone(previous.documents);
        if(previous.ai){
          r.ai=structuredClone(previous.ai);
          const replacedIds=new Set((input.files||[]).map(file=>file.replacesFileId));
          for(const key of ['facts','rules','transcriptions','artworkReadings','sentPages','unverifiedPages','omittedPages'])if(Array.isArray(r.ai[key]))r.ai[key]=r.ai[key].filter(item=>!replacedIds.has(item.documentId));
          const replacedNames=new Set(previous.files.filter(file=>replacedIds.has(file.id)).map(file=>file.name));
          if(Array.isArray(r.ai.warnings))r.ai.warnings=r.ai.warnings.filter(warning=>![...replacedNames].some(name=>warning.includes(name)));
          delete r.ai.transport;
        }
        files=await buildSourceRevisionInputs(previous.files,input.files,async file=>readFile(join(dir(previous.id),'files',file.disk)));
        r.files=await writeInputs(r,files);r.files.forEach((file,index)=>{if(previous.files[index])file.id=previous.files[index].id;});
      }else{
        r.revisionKind='artwork';r.name=previous.name+' · revision';r.options={...previous.options,marketPreset:input.options?.marketPreset??previous.options.marketPreset??'none',completeArtwork:input.options?.completeArtwork===true,panelPlacementConfirmed:false,packageMappingConfirmed:false,panelZones:sampleZones(previous.sample),...(['fieldday','clean','conflict','signals'].includes(previous.sample)?{panelZoneSource:'authored synthetic sample geometry'}:{}),nutritionBasisConfirmed:false,netQuantityConfirmed:false,...(input.mode==='ai'?{aiRulesConfirmed:false}:{})};
        const references=previous.files.filter(f=>f.role!=='artwork');
        let revised=input.files;
        if(input.sampleRevision){if(!['fieldday','clean','conflict'].includes(previous.sample))throw fail('The sample revision is only available for Fieldday.');revised=[{name:'fieldday-v2.pdf',role:'artwork',base64:(await readFile(join(root,'samples/fieldday-v2/artwork/fieldday-v2.pdf'))).toString('base64')}];}
        if(!Array.isArray(revised)||revised.length!==1||revised[0].role!=='artwork')throw fail('Supply exactly one revised artwork.');
        files=[...revised,...await Promise.all(references.map(async f=>({name:f.name,role:f.role,base64:(await readFile(join(dir(previous.id),'files',f.disk))).toString('base64')})))];
        r.files=await writeInputs(r,files);references.forEach((f,i)=>{r.files[i+1].id=f.id;});
      }
    }else{
      const recognized=input.sample||recognizedSampleUpload(files);
      if(recognized){if(!samples[recognized])throw fail('Unknown sample.');r.sample=recognized;r.name=recognized==='organizer'?'Dancing Fish · Berry Crunch':recognized==='clean'?'Fieldday · clean baseline':recognized==='conflict'?'Fieldday · conflicting sources':recognized==='signals'?'Fieldday · language and code signals':'Fieldday · artwork V1';r.market=recognized==='organizer'?'United States':'Fictional company checklist';r.options.panelZones=sampleZones(recognized);if(Object.keys(r.options.panelZones).length)r.options.panelZoneSource='authored synthetic sample geometry';files=await Promise.all(samples[recognized].map(async([path,role])=>({name:basename(path),role,base64:(await readFile(join(root,path))).toString('base64')})));if(!input.sample)audit(r,'known_sample_opened','Recognized the uploaded prepared sample files and opened its preserved sample artwork and geometry.',actor);}
      r.files=await writeInputs(r,files);
    }
    audit(r,'review_created',r.revisionKind==='sources'?'Updated source documents; artwork and confirmed geometry retained.':r.parentId?'Revised artwork; source documents retained.':'Files supplied for review.',actor);await save(r);jobs.add(r.id);queue=queue.then(()=>processReview(r.id)).catch(()=>{});return r;
  }catch(error){await rm(dir(r.id),{recursive:true,force:true});throw error;}
}
for(const id of await readdir(join(storage,'reviews'))){try{const r=await readReview(id);if(['queued','processing'].includes(r.status)){r.status='failed';r.error='The server stopped during processing. Create a new review to retry.';await save(r);}}catch{}}
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.pdf':'application/pdf','.json':'application/json','.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'};
async function sendFile(req,res,path,name){const info=await stat(path);res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream','Content-Length':info.size,'Cache-Control':'no-store',...(name?{'Content-Disposition':`attachment; filename="${name.replace(/[^a-zA-Z0-9._-]/g,'_')}"`}:{})});if(req.method==='HEAD')res.end();else createReadStream(path).on('error',()=>res.destroy()).pipe(res);}
const server=createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; frame-src 'self'; base-uri 'none'; frame-ancestors 'none'");
  try{
    const requestHost=req.headers.host||'';
    if(allowedHosts.size&&!allowedHosts.has(requestHost)&&!requestHost.endsWith('.onrender.com'))throw fail('Unrecognized host.',403);
    const sameOrigin=req.headers.origin===`https://${requestHost}`||req.headers.origin===`http://${requestHost}`;
    if(req.headers.origin&&!allowedOrigins.has(req.headers.origin)&&!sameOrigin&&!req.headers.origin.endsWith('.onrender.com'))throw fail('Cross-origin access is disabled.',403);
    const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname),method=req.method;
    if(path==='/healthz'&&method==='GET')return json(res,200,{ok:true});
    const actor=authenticate(req);
    if(!actor){
      res.writeHead(401,{'WWW-Authenticate':'Basic realm="PackSignal demo", charset="UTF-8"','Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'});
      res.end('Authentication required.');return;
    }
    if(!['GET','HEAD'].includes(req.method)&&req.headers['x-packproof-token']!==csrf)throw fail('Refresh the page to renew your request token.',403);
    if(publicFiles.has(path)&&['GET','HEAD'].includes(method))return await sendPublicFile(req,res,path);
    if(path==='/api/market-presets'&&method==='GET')return json(res,200,marketPresets);
    if(path==='/api/status'&&method==='GET'){const aiUsage=geminiStatus(apiKeys.length),inProgress=aiUsage.lastOutcome==='Request in progress'||aiUsage.lastOutcome.startsWith('Waiting before retry')||aiUsage.lastOutcome.startsWith('Waiting for the shared Gemini request limit')||aiUsage.lastOutcome.startsWith('Waiting for provider pacing');const aiConnection=!apiKeys.length?'not_configured':inProgress?'running':aiUsage.lastOutcome==='Live request completed'?'verified':aiUsage.lastOutcome==='No live request yet'?'configured':'attention';return json(res,200,{csrf,aiConfigured:Boolean(apiKeys.length),aiConnection,model,aiUsage,queued:jobs.size,limits:{files:8,fileMB:15,totalMB:30,pdfPages:12,mediaMB:MEDIA_MAX_BYTES/1_000_000,videoSeconds:MEDIA_MAX_SECONDS,mediaFrames:8},team:{enabled:teamEnabled,currentUser:{id:actor.id,username:actor.username,displayName:actor.displayName,role:actor.role},members:publicTeamUsers},storage:{persistent:persistentStorageReady,required:persistentStorageRequired},security:{authenticated:teamEnabled||Boolean(accessPassword),required:process.env.PACKPROOF_REQUIRE_AUTH==='true',hosted:process.env.NODE_ENV==='production'},scope:'Private workspace or access-controlled hosted demo; human release decision required.'});}
    if(path==='/api/media/convert'&&method==='POST'){
      const b=await body(req);
      if(!b||typeof b!=='object'||Array.isArray(b)||typeof b.base64!=='string'||!/^[A-Za-z0-9+/]*={0,2}$/.test(b.base64))throw fail('Choose a readable photo or video.',400);
      if(b.base64.length>Math.ceil(MEDIA_MAX_BYTES*4/3)+8)throw fail('Choose a photo or video up to 30 MB.',413);
      return json(res,200,await convertMedia({bytes:Buffer.from(b.base64,'base64'),name:String(b.name||''),kind:b.kind,maxFrames:b.maxFrames??8}));
    }
    if(path==='/api/reviews'&&method==='POST')return json(res,202,presentReview(await createReview(await body(req),actor),actor));
    if(path==='/api/reviews'&&method==='GET'){const all=await Promise.all((await readdir(join(storage,'reviews'))).map(async id=>{try{const r=await readReview(id);if(!canViewReview(r,actor))return null;return {id:r.id,name:r.name,createdAt:r.createdAt,finishedAt:r.finishedAt,status:r.status,counts:r.counts,engine:r.engine,sample:r.sample,parentId:r.parentId,createdBy:r.team?.createdBy||null,assignmentCount:Object.values(r.team?.assignments||{}).filter(assignment=>assignment.reviewerIds?.includes(actor.id)).length};}catch{return null;}}));return json(res,200,all.filter(Boolean).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)));}
    const match=path.match(/^\/api\/reviews\/([a-f0-9-]{36})(?:\/(.*))?$/);
    if(match){const id=match[1],action=match[2],handle=async()=>{const r=await load(id);if(!canViewReview(r,actor))throw fail('Review not found or not assigned to this account.',404);
      if(!action&&method==='GET')return json(res,200,presentReview(r,actor));
      if(action?.startsWith('images/')&&['GET','HEAD'].includes(method)){const name=action.slice(7);if(!r.documents.some(d=>d.pages.some(p=>p.image===name)))throw fail('Image not found.',404);return await sendFile(req,res,join(dir(id),'rendered',name));}
      if(action?.startsWith('files/')&&['GET','HEAD'].includes(method)){const f=r.files.find(f=>f.id===action.slice(6));if(!f)throw fail('File not found.',404);return await sendFile(req,res,join(dir(id),'files',f.disk),f.name);}
      if(action==='retry-ai'&&method==='POST'){
        if(r.status!=='ready')throw fail('Wait for this review to finish.',409);
        if(r.mode!=='ai')throw fail('This review used local-only analysis and has no image-reading request to retry.',409);
        if(r.aiStatus!=='unavailable')throw fail('Image reading can only be retried after an unsuccessful request.',409);
        if(!apiKeys.length)throw fail('Image reading is not configured on this server.',503);
        if(jobs.has(id))throw fail('This review is already queued for processing.',409);
        if(jobs.size>=4)throw fail('Four reviews are already queued. Wait for one to finish.',429);
        r.aiRetryCount=(r.aiRetryCount||0)+1;if(r.aiRetryCount>3)throw fail('This review has reached its three retry limit. Create a new review if you need another attempt.',429);
        r.status='queued';r.aiStatus='pending';r.progress='Retrying artwork reading and comparisons';delete r.aiError;delete r.aiFailure;clearSeal(r);audit(r,'ai_retry_queued','Reviewer requested another artwork image-reading attempt.',actor);await save(r);jobs.add(id);queue=queue.then(()=>processReview(id)).catch(()=>{});return json(res,202,presentReview(r,actor));
      }
      if(r.status!=='ready')throw fail('Wait for this review to finish.',409);
      if(['assignments','comments','approvals'].includes(action)&&method==='POST'){
        if(!teamEnabled)throw fail('Team sign-off is disabled until named team accounts and persistent storage are configured.',409);
        const b=await body(req);if(!b||typeof b!=='object'||Array.isArray(b))throw fail('Invalid team review request.');
        const finding=r.findings.find(item=>item.id===b.findingId);if(!finding)throw fail('Finding not found.',404);
        if(action==='assignments'){
          if(actor.role!=='admin')throw fail('Only a workspace admin can assign findings.',403);
          const changed=setFindingAssignment(r,finding.id,b.reviewerIds,actor,publicTeamUsers);
          if(changed){clearSeal(r);const names=(r.team.assignments[finding.id].reviewerIds||[]).map(id=>publicTeamUsers.find(member=>member.id===id)?.displayName||id);audit(r,'finding_assigned',`${finding.title} assigned to ${names.join(', ')||'no reviewer'}.`,actor);await save(r);}
          return json(res,200,presentReview(r,actor));
        }
        if(!canReviewFinding(r,finding.id,actor))throw fail('This finding is not assigned to your account.',403);
        if(action==='comments'){
          const comment=addFindingComment(r,finding,actor,b);comment.dependencyHash=findingDependencyFingerprint(r,finding);clearSeal(r);audit(r,'evidence_comment_added',`${finding.title}: reviewer comment anchored to ${comment.evidence?.name||'finding evidence'}.`,actor);await save(r);return json(res,200,presentReview(r,actor));
        }
        addFindingApproval(r,finding,actor,b,findingDependencyFingerprint(r,finding));clearSeal(r);audit(r,'independent_finding_signoff',`${finding.title}: ${b.outcome}.`,actor);await save(r);return json(res,200,presentReview(r,actor));
      }
      if(action==='decisions'&&method==='POST'){const b=await body(req);const finding=r.findings.find(f=>f.id===b.findingId);if(!finding||!['open','acknowledged','accepted_exception','needs_changes'].includes(b.disposition))throw fail('Invalid reviewer decision.');if(teamEnabled&&!canReviewFinding(r,finding.id,actor))throw fail('This finding is not assigned to your account.',403);if(typeof b.note!=='string'||b.note.trim().length<3||b.note.length>2000)throw fail('Add a decision note (3–2,000 characters).');r.decisions[b.findingId]={disposition:b.disposition,note:b.note.trim(),at:new Date().toISOString(),decidedBy:actor.id,reviewerName:actor.displayName,dependencyHash:findingDependencyFingerprint(r,finding)};clearSeal(r);audit(r,'reviewer_decision',`${b.findingId}: ${b.disposition} — ${b.note.trim()}`,actor);await save(r);return json(res,200,presentReview(r,actor));}
      if(action==='sources'&&method==='POST'){
        if(teamEnabled&&actor.role!=='admin')throw fail('Only a workspace admin can change source and checklist confirmations.',403);
        const b=await body(req);if(typeof b.reason!=='string'||b.reason.trim().length<3||b.reason.length>2000)throw fail('Explain the source decision.');
        const priorConfirmations={};for(const key of ['sourceConfirmed','completeArtwork','aiRulesConfirmed','nutritionBasisConfirmed','panelPlacementConfirmed','packageMappingConfirmed','netQuantityConfirmed'])priorConfirmations[key]={value:r.options[key]===true,fingerprint:r.options.confirmationFingerprints?.[key]};
        if(b.marketPreset!==undefined){if(!['none','us','india','eu'].includes(b.marketPreset))throw fail('Unknown market preset.');r.options.marketPreset=b.marketPreset;}
        if(b.packageType!==undefined){if(!['carton','pouch','bottle_label','sleeve'].includes(b.packageType))throw fail('Choose a supported package type.');r.options.packageType=b.packageType;}
        if(b.factChoices){for(const [field,factId]of Object.entries(b.factChoices)){if(!r.facts.some(f=>f.field===field&&(factId===''||f.id===factId)))throw fail('Invalid source choice.');}r.options.factChoices={...r.options.factChoices,...b.factChoices};}
        const artwork=r.documents.find(document=>document.role==='artwork');const nextZones=panelZones(b.panelZones,artwork);if(nextZones!==undefined)r.options.panelZones=nextZones;
        if(b.legibilityThresholdMm!==undefined){const threshold=Number(b.legibilityThresholdMm);if(!Number.isFinite(threshold)||threshold<0.1||threshold>10)throw fail('Text-height screening value must be between 0.1 and 10 mm.');r.options.legibilityThresholdMm=threshold;}
        if(b.nutritionVariant!==undefined){if(typeof b.nutritionVariant!=='string'||b.nutritionVariant.length>30)throw fail('Invalid nutrition column.');r.options.nutritionVariant=b.nutritionVariant;}
        refreshDependencies(r);
        if(b.packageMappingConfirmed===true&&!r.options.panelZones?.front?.box)throw fail('Map and inspect the front artwork face before confirming the 3D package preview.');
        r.options.confirmationFingerprints ||= {};r.options.staleConfirmations ||= {};
        for(const key of ['sourceConfirmed','completeArtwork','aiRulesConfirmed','nutritionBasisConfirmed','panelPlacementConfirmed','packageMappingConfirmed','netQuantityConfirmed'])if(typeof b[key]==='boolean'){
          const nextFingerprint=confirmationFingerprint(r,key),prior=priorConfirmations[key];
          if(!b[key]){r.options[key]=false;delete r.options.confirmationFingerprints[key];}
          else if(key==='packageMappingConfirmed'){
            r.options[key]=true;r.options.confirmationFingerprints[key]=nextFingerprint;delete r.options.staleConfirmations[key];
          }
          else if(prior.value&&(!prior.fingerprint||prior.fingerprint!==nextFingerprint)){r.options[key]=false;delete r.options.confirmationFingerprints[key];r.options.staleConfirmations[key]=true;}
          else{r.options[key]=true;r.options.confirmationFingerprints[key]=nextFingerprint;delete r.options.staleConfirmations[key];}
        }
        const decisionHashes=new Map(Object.entries(r.decisions).map(([findingId,decision])=>[findingId,decision.dependencyHash]));
        clearSeal(r);Object.assign(r,analyze(r));for(const [findingId,decision]of Object.entries(r.decisions)){const f=r.findings.find(f=>f.id===findingId);if(!f||!decisionHashes.get(findingId)||decisionHashes.get(findingId)!==findingDependencyFingerprint(r,f))decision.stale=true;}
        if(r.parentId)r.revision=compareRevisions(await load(r.parentId),r);audit(r,'source_decision',b.reason.trim(),actor);r.audit.at(-1).options=structuredClone(r.options);await save(r);return json(res,200,presentReview(r,actor));
      }
      if(action==='ask'&&method==='POST'){
        const b=await body(req);if(typeof b.question!=='string'||b.question.trim().length<3||b.question.length>1000)throw fail('Ask a focused question of 3–1,000 characters.');
        const finding=r.findings.find(item=>item.id===b.findingId);if(!finding)throw fail('Finding not found.');if(teamEnabled&&!canReviewFinding(r,finding.id,actor))throw fail('This finding is not assigned to your account.',403);if(!apiKeys.length)throw fail('Packaging intelligence is not configured on this server. Local checks and evidence remain available.');
        let answer=null,lastError=null;
        for(let i=0;i<apiKeys.length;i++){
          const activeKey=apiKeys[(keyCursor+i)%apiKeys.length];
          try{
            answer=await answerFindingQuestion(finding,b.question.trim(),activeKey,model);
            keyCursor=(keyCursor+i)%apiKeys.length;
            break;
          }catch(err){
            lastError=err;
            if(apiKeys.length>1&&shouldFailoverCredential(err)){
              keyCursor=(keyCursor+i+1)%apiKeys.length;
              continue;
            }
            throw err;
          }
        }
        if(!answer&&lastError)throw lastError;
        clearSeal(r);r.followUps||=[];r.followUps.push({findingId:finding.id,question:b.question.trim(),answer:answer.answer,evidenceUsed:answer.evidenceUsed,at:new Date().toISOString(),actorId:actor.id,actorName:actor.displayName});audit(r,'finding_question_answered',`Evidence-scoped AI answer returned for ${finding.id}.`,actor);await save(r);return json(res,200,answer);
      }
      if(action==='signature'&&method==='GET')return json(res,200,await verifyReviewSeal(r,storage));
      if(['report.html','report.json','report.pdf'].includes(action)&&method==='GET'){
        const verification=await verifyReviewSeal(r,storage);
        if(!verification.valid){audit(r,'review_sealed_for_export','Ed25519 seal created for the current source hashes, findings, decisions, follow-up answers and audit digest.');r.signature=await sealReview(r,storage);await save(r);}
      }
      if(action==='report.html'&&method==='GET'){const html=await createHtmlReport(r,dir(id));res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Content-Disposition':'attachment; filename="packsignal-report.html"','Cache-Control':'no-store'});res.end(html);return;}
      if(action==='report.json'&&method==='GET'){res.setHeader('Content-Disposition',`attachment; filename="packsignal-${id}.json"`);return json(res,200,r);}
      if(action==='report.pdf'&&method==='GET'){const output=join(dir(id),'report.pdf');await worker({action:'report',review:join(dir(id),'review.json'),output});return await sendFile(req,res,output,'packsignal-report.pdf');}
    };
    const writeRoute=method==='POST'||['report.html','report.json','report.pdf'].includes(action);
    return await (writeRoute?withReviewWriteLock(id,handle):handle());}
    throw fail('Not found.',404);
  }catch(error){if(process.env.NODE_ENV!=='production')console.error(error);if(!res.headersSent)json(res,error.code==='ENOENT'?404:error.status||500,{error:error.code==='ENOENT'?'File or review not found.':error.status?error.message:'The request could not complete. Try again.'});else res.destroy();}
});
server.requestTimeout=120000;server.headersTimeout=15000;
server.on('error',error=>{
  if(error.code==='EADDRINUSE')console.error(`PackSignal is already listening at http://${host}:${port}. Keep that server running and refresh the browser, or stop it before starting another.`);
  else console.error(`PackSignal could not start: ${error.message}`);
  process.exitCode=1;
});
server.listen(port,host,()=>console.log(`PackSignal is running at http://${host}:${port}`));
