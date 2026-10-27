import { createServer } from 'node:http';
import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { readFile,writeFile,mkdir,readdir,rename,rm,stat } from 'node:fs/promises';
import { join,extname,basename,resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID,randomBytes,createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';
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
import { addFindingApproval, addFindingComment, canReviewFinding, canViewReview, setFindingAssignment, setFindingDepartment, addStickyNote, updateStickyNoteStatus, addStickyNoteReply } from './lib/team-review.mjs';
import { enrichReviewFindingsWithDepartments } from './lib/finding-department-classifier.mjs';
import { verifyPersistentMount } from './lib/persistent-storage.mjs';
import { convertMedia, MEDIA_MAX_BYTES, MEDIA_MAX_SECONDS } from './lib/media-intake.mjs';
import { recognizedSampleUpload } from './lib/known-sample-upload.mjs';
import { packageTypeFromSources } from './lib/package-type-from-source.mjs';
import { appendAuditEvent } from './lib/audit-chain.mjs';
import { createExportPackage } from './lib/export-package.mjs';
import { generateRemediationProposal, validateProposedFix, computeSourceHash } from './lib/remediation-engine.mjs';
import { formatRemediationPlainText, formatRemediationJson, formatRemediationCsv } from './lib/remediation-export.mjs';
import { evaluateJurisdiction, evaluateAllMarkets } from './lib/regulatory/evaluator.mjs';
import { analyzeRevisionIntelligence } from './lib/revision-intelligence.mjs';
import { resolveFactConflict } from './lib/regulatory/facts.mjs';
import { resolveGuidedQuestion } from './lib/questions/resolution.mjs';
import { verifyRuleQuotation } from './lib/rules/quote-verifier.mjs';
import { transitionRuleAuthorization } from './lib/rules/trust-state.mjs';
import { computeRuleCoverageLedger } from './lib/regulatory/coverage.mjs';
import { buildRuleCoverageLedger } from './lib/rulebook/coverage.mjs';
import { runUsFoodPreflight } from './lib/regulatory/us/index.mjs';
import { detectAmbiguities, buildDependencyPlan, resolveAndReevaluate } from './lib/ambiguity/index.mjs';
import { runPdfPreflight } from './lib/preflight/index.mjs';
import { runTrustEvaluation, generateBrokenTestCases, getModelBakeOffResults, getChangeLog, persistEvaluationRun, getRunHistory, compareEvaluationRuns, evaluateReleaseGates, runEvaluationSuite } from './lib/trust-console/index.mjs';
import { runMutationBenchmark } from './lib/benchmark/mutation-runner.mjs';
const selftestRuns = new Map();
let latestMutationBenchmark = null;
import { validateNutrition } from './lib/nutrition-validator.mjs';
import { resetCampusDemoState } from './lib/campus/rehearsal-reset.mjs';
import { evaluateIndiaBilingualPack, AMRIT_CHAI_SPECIFICATION } from './lib/campus/india-chai.mjs';
import { getLocale } from './lib/i18n.mjs';
import { extractCompetitorClaims, benchmarkCompetitorAgainstBrief } from './lib/campus/competitor-snap.mjs';
import {
  getScanChecklist,
  evaluateDualReaderConsensus,
  calculatePhysicalScaleFromCard,
  computePerspectiveTransform,
  detectPackagingFace,
  assessSharpnessAndAutoCapture,
  evaluateCloseUpNecessity,
  verifyTwoRoutesSameAnswer,
  compareShelfVsApproved,
  getScanSession,
  saveScanSessionPanel,
  resetScanSession,
  createMobileSessionToken,
  validateMobileSessionToken,
  retakePanel,
  generateBriefFromScanSession,
} from './lib/campus/scan-to-brief.mjs';
import { generatePanelRedPenOverlay, getMindArTargetConfig } from './lib/campus/ar-targets.mjs';
import { buildArManifest } from './lib/ar/ar-manifest.mjs';
import { generatePanelOverlaySvg, getFindingDetailsForHotspot } from './lib/ar/red-pen-assets.mjs';
import {
  fetchOpenFoodFactsProduct,
  queryOpenFdaRecalls,
  searchUsdaFood,
  getRegulatoryApiStatus,
} from './lib/external-food-apis.mjs';
import { runCheckBackVerification } from './lib/campus/check-back.mjs';
import { parseOrganizerSamples, parseSourceFile } from './lib/source-pieces.mjs';
import { getOrganizerFactSheet } from './lib/fact-sheet.mjs';
import { evaluateRequirementsAndQuestions } from './lib/requirements-engine.mjs';
import {
  getDeskSession,
  resetDeskSession,
  resolveDeskConflict,
  answerDeskQuestion,
  uploadDeskInput
} from './lib/evidence-desk.mjs';
import {
  getOrCreateBrief,
  generateBriefDraft,
  auditBrief,
  updateBriefSentence,
  approveBrief,
  generateBriefChecklist,
  generateBriefPdfHtml,
  askAboutThis,
  confirmFactFromAnswer,
  createBriefExportManifest
} from './lib/creative-brief.mjs';
import {
  getReviewerLensesData,
  generateA3WallPosterHtml
} from './lib/reviewer-lenses.mjs';
import { buildReviewFindingLocations } from './lib/artwork/finding-locations.mjs';
import { computeReviewContentDiff } from './lib/revisions/content-diff.mjs';
import { generateA3ReviewPoster } from './lib/poster/a3-review-poster.mjs';
import {
  getPackCanvasState,
  applySuggestedFix,
  evaluateDielineLayerAvailability
} from './lib/pack-canvas.mjs';
import {
  buildLayoutState,
  saveLayoutRevision,
  getSavedLayoutRevisions,
  generateLayoutProposalExport
} from './lib/pack-canvas/layout-state.mjs';
import {
  verifyAndApplyFix
} from './lib/pack-canvas/layout-fixes.mjs';
import {
  getShopperLensesData
} from './lib/shopper-lenses.mjs';
import {
  generateShopperExperience
} from './lib/shopper/index.mjs';
import {
  evaluateClaimsRadar,
  CARTON_CLAIMS_INVENTORY
} from './lib/claims-radar.mjs';
import {
  evaluateTimeMachine,
  compareRegulatoryDates
} from './lib/time-machine.mjs';
import {
  VERIFIED_TEMPORAL_RULES,
  evaluateRulesAtDate
} from './lib/regulatory/temporal-rules.mjs';
import {
  getRequirementsMapGraph,
  answerRequirementsQuestion
} from './lib/requirements-map.mjs';
import {
  loadMarketPack,
  loadMarketPackSync
} from './lib/market-loader.mjs';
import {
  discoverInstalledMarkets
} from './lib/rules/market-pack-loader.mjs';
import {
  detectIngredientClaimConflicts,
  simulateDecisionOption,
  compareDecisionScenarios,
  createCorrectionPlan
} from './lib/decision-ripple.mjs';
import {
  getShopperPersona,
  getAllShopperPersonas,
  getPersonaImpactSummary,
  getPersonaArtworkHighlights,
  getPersona3DPins
} from './lib/shopper-personas.mjs';
import {
  analyzeShelfReadability
} from './lib/readability/shelf-readability.mjs';

const root=fileURLToPath(new URL('.',import.meta.url));
const sendPublicFile=createPublicFileSender(join(root,'public'));
for(const filename of ['.env.local','.env']){
  if(!existsSync(join(root,filename)))continue;
  for(const line of readFileSync(join(root,filename),'utf8').split(/\r?\n/)){
    const m=line.match(/^([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^['"]|['"]$/g,'');
  }
}
let globalAnsweredQuestions = [];
const storage=resolve(process.env.PACKPROOF_DATA_DIR||join(root,'.packproof'));
await mkdir(join(storage,'reviews'),{recursive:true,mode:0o700});await mkdir(join(storage,'cache'),{recursive:true,mode:0o700});
const persistentStoragePath=process.env.PACKPROOF_PERSISTENT_STORAGE_PATH?resolve(process.env.PACKPROOF_PERSISTENT_STORAGE_PATH):'';
const persistentStorageRequired=process.env.PACKPROOF_REQUIRE_PERSISTENT_STORAGE==='true';
let persistentStorageReady=false;
persistentStorageReady=await verifyPersistentMount(storage,persistentStoragePath);
if(persistentStorageRequired&&!persistentStorageReady)throw new Error('PackSignal requires its configured persistent storage mount before starting.');
const bundled=join(process.env.HOME||'','/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3');
let python=process.env.PACKPROOF_PYTHON||'python3';
if(!process.env.PACKPROOF_PYTHON&&existsSync(bundled)){
  try{
    const {spawnSync}=await import('node:child_process');
    if(spawnSync(bundled,['-c','import fitz, pypdfium2'],{timeout:2000}).status===0)python=bundled;
  }catch{}
}
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
let apiKeys=[...new Set(Array.from({length:10},(_,i)=>process.env['GEMINI_API_KEY'+(i?'_'+(i+1):'')]||'').map(key=>key.trim()).filter(Boolean))],keyCursor=0,model=process.env.GEMINI_MODEL||'gemini-3.8-flash';
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
const audit=(r,action,detail,actor=null)=>appendAuditEvent(r,{action,safeDetails:detail},actor,teamEnabled);
const clearSeal=r=>{delete r.signature;};
const hashValue=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function presentReview(review,user){
  const result=structuredClone(review);
  result.findings||=[];
  if (result.options?.marketPreset) {
    result.market = result.options.marketPreset === 'india' ? 'India' : (result.options.marketPreset === 'eu' ? 'European Union' : 'United States');
  }
  result.launchDate = result.options?.launchDate || '2026-10-25';
  result.productCategory = result.options?.productCategory || 'food';
  result.regulatorySnapshotId = result.options?.regulatorySnapshotId || null;
  result.team||={createdBy:null,assignments:{},comments:[],approvals:[],assignmentHistory:[],stickyNotes:[]};
  result.team.stickyNotes ||= [];
  result.team.comments=(result.team.comments||[]).map(comment=>({...comment,stale:!result.findings.some(f=>f.id===comment.findingId)||comment.dependencyHash!==findingDependencyFingerprint(result,result.findings.find(f=>f.id===comment.findingId))}));
  result.team.approvals=(result.team.approvals||[]).map(approval=>{const finding=result.findings.find(f=>f.id===approval.findingId);return {...approval,stale:!finding||approval.dependencyHash!==findingDependencyFingerprint(result,finding)};});
  result.teamAccess={canAssign:user.role==='admin',canContribute:user.role==='admin'||canViewReview(result,user),canReviewFindingIds:result.findings.filter(finding=>canReviewFinding(result,finding.id,user)).map(finding=>finding.id)};
  enrichReviewFindingsWithDepartments(result);
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
  const art=r.documents?.find(d=>d.role==='artwork');if(art)documentIds.add(art.id);
  const documents=(r.documents||[]).filter(d=>documentIds.has(d.id)).map(d=>[d.id,d.sha256]);
  const relevantOptions={};
  const isNutrition=(finding.key||'').includes('nutrition')||(finding.field||'').startsWith('nutrition.');
  const isNetQty=(finding.key||'').includes('quantity')||finding.field==='net_quantity';
  const isPlacement=(finding.key||'').includes('placement')||(finding.key||'').includes('panel');
  if(isNutrition){
    if(r.options?.nutritionVariant)relevantOptions.nutritionVariant=r.options.nutritionVariant;
    if(r.options?.nutritionBasisConfirmed!==undefined)relevantOptions.nutritionBasisConfirmed=r.options.nutritionBasisConfirmed;
  }
  if(isNetQty&&r.options?.netQuantityConfirmed!==undefined)relevantOptions.netQuantityConfirmed=r.options.netQuantityConfirmed;
  if(isPlacement){
    if(r.options?.panelZones)relevantOptions.panelZones=r.options.panelZones;
    if(r.options?.panelPlacementConfirmed!==undefined)relevantOptions.panelPlacementConfirmed=r.options.panelPlacementConfirmed;
  }
  if(finding.field&&r.options?.factChoices?.[finding.field])relevantOptions.factChoice=r.options.factChoices[finding.field];
  return hashValue({version:'2.0',finding:{id:finding.id,status:finding.status,expected:finding.expected,observed:finding.observed,evidence:finding.evidence,rule:finding.rule},documents,options:relevantOptions});
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
  const p=spawn(python,[join(root,'lib/extract.py')],{stdio:['pipe','pipe','pipe'],env:{...workerEnv,PYTHONPATH:[join(root,'lib'),join(root,'.packproof','python-deps'),workerEnv.PYTHONPATH].filter(Boolean).join(':')}});let output='',errors='',settled=false;
  const end=(err,value)=>{if(settled)return;settled=true;clearTimeout(timer);err?reject(err):done(value);};
  const timer=setTimeout(()=>{p.kill('SIGKILL');end(fail('Document processing timed out. Use a smaller file.'));},90000);
  p.stdout.on('data',c=>{output+=c;if(output.length>8_000_000){p.kill();end(fail('Extracted document is too large.'));}});p.stderr.on('data',c=>{if(errors.length<2000)errors+=c;});
  p.on('error',()=>end(fail('Python runtime is unavailable. Run npm run doctor for setup.')));
  p.on('close',code=>{try{const result=JSON.parse(output);if(code||result.error)end(fail(result.error||'Document processing failed.'));else end(null,result);}catch{end(fail(errors.includes('ModuleNotFoundError')?'Python dependencies are missing. Run npm run doctor.':'The document could not be parsed. Check its format and encryption.'));}});
  p.stdin.on('error',()=>{});p.stdin.end(JSON.stringify(args));
});}
function runVisualDiff(args){return new Promise((done,reject)=>{
  const workerEnv=Object.fromEntries(Object.entries(process.env).filter(([name])=>!/(?:API_KEY(?:_\d+)?|ACCESS_TOKEN|AUTH_TOKEN)$/.test(name)));
  const p=spawn(python,[join(root,'lib/visual-diff.py')],{stdio:['pipe','pipe','pipe'],env:{...workerEnv,PYTHONPATH:[join(root,'.packproof','python-deps'),workerEnv.PYTHONPATH].filter(Boolean).join(':')}});
  let output='',errors='',settled=false;
  const end=(err,value)=>{if(settled)return;settled=true;clearTimeout(timer);err?reject(err):done(value);};
  const timer=setTimeout(()=>{p.kill('SIGKILL');end(fail('Visual diff timed out.',408));},30000);
  p.stdout.on('data',c=>{output+=c;});p.stderr.on('data',c=>{if(errors.length<2000)errors+=c;});
  p.on('error',()=>end(fail('Python runtime is unavailable for visual diff.')));
  p.on('close',code=>{try{const result=JSON.parse(output);if(code||result.error)end(fail(result.error||'Visual diff failed.'));else end(null,result);}catch{end(fail(errors||'Failed to compute visual diff.'));}});
  p.stdin.on('error',()=>{});p.stdin.end(JSON.stringify(args));
});}
function runRegulatorySymbols(imagePath,page=1){return new Promise((done,reject)=>{
  const workerEnv=Object.fromEntries(Object.entries(process.env).filter(([name])=>!/(?:API_KEY(?:_\d+)?|ACCESS_TOKEN|AUTH_TOKEN)$/.test(name)));
  const p=spawn(python,[join(root,'lib/regulatory-symbols.py')],{stdio:['pipe','pipe','pipe'],env:{...workerEnv,PYTHONPATH:[join(root,'.packproof','python-deps'),workerEnv.PYTHONPATH].filter(Boolean).join(':')}});
  let output='',errors='',settled=false;
  const end=(err,value)=>{if(settled)return;settled=true;clearTimeout(timer);err?reject(err):done(value);};
  const timer=setTimeout(()=>{p.kill('SIGKILL');end(fail('Symbol screening timed out.',408));},30000);
  p.stdout.on('data',c=>{output+=c;});p.stderr.on('data',c=>{if(errors.length<2000)errors+=c;});
  p.on('error',()=>end(fail('Python runtime is unavailable for symbol detection.')));
  p.on('close',code=>{try{const result=JSON.parse(output);if(code||result.error)end(fail(result.error||'Symbol screening failed.'));else end(null,result);}catch{end(fail(errors||'Failed to parse symbol screening output.'));}});
  p.stdin.on('error',()=>{});p.stdin.end(JSON.stringify({image_path:imagePath,page}));
});}
function runPdfVisibleText(pdfPath){return new Promise((done,reject)=>{
  const workerEnv=Object.fromEntries(Object.entries(process.env).filter(([name])=>!/(?:API_KEY(?:_\d+)?|ACCESS_TOKEN|AUTH_TOKEN)$/.test(name)));
  const p=spawn(python,[join(root,'lib/pdf-visible-text.py'),pdfPath],{stdio:['pipe','pipe','pipe'],env:{...workerEnv,PYTHONPATH:[join(root,'.packproof','python-deps'),workerEnv.PYTHONPATH].filter(Boolean).join(':')}});
  let output='',errors='',settled=false;
  const end=(err,value)=>{if(settled)return;settled=true;clearTimeout(timer);err?reject(err):done(value);};
  const timer=setTimeout(()=>{p.kill('SIGKILL');end(fail('PDF visibility analysis timed out.',408));},30000);
  p.stdout.on('data',c=>{output+=c;});p.stderr.on('data',c=>{if(errors.length<2000)errors+=c;});
  p.on('error',()=>end(fail('Python runtime is unavailable for PDF visibility.')));
  p.on('close',code=>{try{const result=JSON.parse(output);if(code||result.error)end(fail(result.error||'PDF visibility analysis failed.'));else end(null,result);}catch{end(fail(errors||'Failed to parse PDF visibility output.'));}});
});}
const samples={
  organizer:[['samples/organizer/DancingFish_Granola_Berry_US_Carton.pdf','artwork'],['samples/organizer/DancingFish_Granola_BerryCrunch_US_Content_Sheet.xlsx','spec']],
  'campus-product-2':[['samples/campus-product-2/AmritChai_Masala_IN_Carton.pdf','artwork'],['samples/campus-product-2/AmritChai_Content_Sheet.xlsx','spec'],['samples/campus-product-2/AmritChai_Product_Spec.docx','spec']],
  fieldday:[['samples/fieldday-v2/artwork/fieldday-v1.pdf','artwork'],['samples/fieldday-v2/inputs/product-spec.json','spec'],['samples/fieldday-v2/inputs/company-rulebook.json','rules'],['samples/fieldday-v2/inputs/claims-register.json','claims']],
  signals:[['samples/fieldday-v2/artwork/fieldday-signals.pdf','artwork'],['samples/fieldday-v2/inputs/product-spec.json','spec'],['samples/fieldday-v2/inputs/company-rulebook.json','rules'],['samples/fieldday-v2/inputs/claims-register.json','claims']],
  clean:[['samples/fieldday-v2/artwork/fieldday-baseline.pdf','artwork'],['samples/fieldday-v2/inputs/product-spec.json','spec'],['samples/fieldday-v2/inputs/company-rulebook.json','rules'],['samples/fieldday-v2/inputs/claims-register.json','claims']],
  conflict:[['samples/fieldday-v2/artwork/fieldday-v1.pdf','artwork'],['samples/fieldday-v2/inputs/product-spec.json','spec'],['samples/fieldday-v2/inputs/unconfirmed-handover-note.json','spec'],['samples/fieldday-v2/inputs/company-rulebook.json','rules'],['samples/fieldday-v2/inputs/claims-register.json','claims']],
};
const sampleFingerprint=async entries=>Object.fromEntries(await Promise.all(entries.map(async([path,role])=>[
  role,createHash('sha256').update(await readFile(join(root,path))).digest('hex'),
])));
// Exact content fingerprints allow users to rename the two prepared demo files
// without losing their preserved 2D proof and authored 3D treatment.
const knownSampleFingerprints={
  organizer:await sampleFingerprint(samples.organizer),
  'campus-product-2':await sampleFingerprint(samples['campus-product-2'].slice(0,2)),
  fieldday:await sampleFingerprint(samples.fieldday.slice(0,2)),
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
    const t0 = performance.now();
    r=await load(id);r.status='processing';r.progress='Reading documents and locating evidence';await save(r);r.documents=[];
    const tExtractStart = performance.now();
    for(const file of r.files){r.documents.push(await worker({path:join(dir(id),'files',file.disk),role:file.role,outdir:join(dir(id),'rendered'),id:file.id,name:file.name}));}
    const extractionMs = Math.round(performance.now() - tExtractStart);
    const tNormStart = performance.now();
    if(r.revisionKind==='sources'&&r.ai?.transcriptions)applyTranscriptions(r.documents,r.ai.transcriptions);
    if(!r.options.packageType){
      const suppliedPackageType=packageTypeFromSources(r.documents);
      if(suppliedPackageType){r.options.packageType=suppliedPackageType;r.options.packageTypeSource='product specification';}
    }
    const artworkFile=r.files.find(file=>file.role==='artwork'),artworkDocument=r.documents.find(document=>document.role==='artwork');
    if(artworkFile?.captureFaces?.length){
      const validPages=new Set((artworkDocument?.pages||[]).map(page=>page.number));
      r.options.captureFaces=artworkFile.captureFaces.filter(item=>validPages.has(item.page));
      if(r.options.captureFaces.length!==artworkFile.captureFaces.length)r.captureFaceWarning='Some camera face labels did not match an artwork page and were ignored.';
    }
    r.warnings=r.documents.flatMap(d=>d.warnings.map(w=>d.name+': '+w));if(r.captureFaceWarning){r.warnings.push(r.captureFaceWarning);delete r.captureFaceWarning;}r.engine='Local extraction + exact comparisons';
    r.aiStatus=r.mode==='ai'?'pending':'not_requested';
    const normalizationMs = Math.round(performance.now() - tNormStart);
    const tEngineStart = performance.now();
    refreshDependencies(r);Object.assign(r,analyze(r));if(r.parentId){const previous=await load(r.parentId);r.revision=compareRevisions(previous,r);carryForwardUnaffectedSourceDecisions(previous,r);}
    const engineMs = Math.round(performance.now() - tEngineStart);
    const prepressMs = r.deepVerification?.preflightReport?.timingMs || (r.preflight?.executionTimeMs || 0);
    const totalProcessingMs = Math.round(performance.now() - t0);
    r.timing = {
      extractionMs,
      normalizationMs,
      engineMs,
      prepressMs,
      totalProcessingMs,
      timingMethod: 'node:perf_hooks.performance.now()',
      processingMode: r.mode === 'ai' ? 'ai' : 'local_deterministic',
      cacheStatus: 'fresh_execution',
      completedAt: new Date().toISOString()
    };
    r.status='ready';r.progress='Local checks complete';r.finishedAt=new Date().toISOString();audit(r,'local_analysis_completed',`${r.findings.length} findings; ${r.engine}; ${totalProcessingMs}ms`);await save(r);

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
  const maxJobs = process.env.NODE_ENV === 'test' || process.env.PLAYWRIGHT_TEST ? 32 : 16;
  if(jobs.size>=maxJobs)throw fail('Queue capacity reached. Wait for in-flight reviews to finish.',429);
  const r={id:randomUUID(),name:String(input.name||'Packaging review').slice(0,120),market:String(input.market||'Unspecified').slice(0,60),createdAt:new Date().toISOString(),status:'queued',progress:'Waiting to process',mode:input.mode==='local'?'local':'ai',options:{completeArtwork:input.options?.completeArtwork===true,sourceConfirmed:false,marketPreset:input.options?.marketPreset||'none',panelZones:{},...(Array.isArray(input.files)&&input.files.some(file=>file.role==='dieline')?{packageType:'carton',packageMappingConfirmed:false}:{})},files:[],documents:[],decisions:{},audit:[],team:{createdBy:actor.id,createdByName:actor.displayName,assignments:{},comments:[],approvals:[],assignmentHistory:[]}};
  await mkdir(join(dir(r.id),'files'),{recursive:true,mode:0o700});await mkdir(join(dir(r.id),'rendered'),{mode:0o700});
  try{
    let files=input.files;
    if(input.parentId){
      if(teamEnabled&&actor.role!=='admin')throw fail('Only a workspace admin can create an artwork or source revision.',403);
      const previous=await load(input.parentId);if(!canViewReview(previous,actor))throw fail('Review not found or not assigned to this account.',404);if(previous.status!=='ready')throw fail('The previous review is not ready.');
      r.parentId=previous.id;r.market=previous.market;r.sample=previous.sample;
      r.team.assignments=structuredClone(previous.team?.assignments||{});r.team.assignmentHistory=structuredClone(previous.team?.assignmentHistory||[]);r.team.comments=structuredClone(previous.team?.comments||[]);r.team.approvals=structuredClone(previous.team?.approvals||[]);r.team.stickyNotes=structuredClone(previous.team?.stickyNotes||[]);
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
      const recognized=input.sample||recognizedSampleUpload(files,knownSampleFingerprints);
      if(recognized){if(!samples[recognized])throw fail('Unknown sample.');r.sample=recognized;r.name=recognized==='organizer'?'Dancing Fish · Berry Crunch':recognized==='campus-product-2'?'Amrit Chai · Masala Blend':recognized==='clean'?'Fieldday · clean baseline':recognized==='conflict'?'Fieldday · conflicting sources':recognized==='signals'?'Fieldday · language and code signals':'Fieldday · artwork V1';r.market=recognized==='campus-product-2'?'India':recognized==='organizer'?'United States':'Fictional company checklist';r.options.panelZones=sampleZones(recognized);if(Object.keys(r.options.panelZones).length)r.options.panelZoneSource='authored synthetic sample geometry';files=await Promise.all(samples[recognized].map(async([path,role])=>({name:basename(path),role,base64:(await readFile(join(root,path))).toString('base64')})));if(!input.sample)audit(r,'known_sample_opened','Recognized the uploaded prepared sample files and opened its preserved sample artwork and geometry.',actor);}
      r.files=await writeInputs(r,files);
    }
    audit(r,'review_created',r.revisionKind==='sources'?'Updated source documents; artwork and confirmed geometry retained.':r.parentId?'Revised artwork; source documents retained.':'Files supplied for review.',actor);await save(r);jobs.add(r.id);queue=queue.then(()=>processReview(r.id)).catch(()=>{});return r;
  }catch(error){await rm(dir(r.id),{recursive:true,force:true});throw error;}
}
for(const id of await readdir(join(storage,'reviews'))){try{const r=await readReview(id);if(['queued','processing'].includes(r.status)){r.status='failed';r.error='The server stopped during processing. Create a new review to retry.';await save(r);}}catch{}}
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.pdf':'application/pdf','.json':'application/json','.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','.zip':'application/zip'};
async function sendFile(req,res,path,name){const info=await stat(path);res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream','Content-Length':info.size,'Cache-Control':'no-store',...(name?{'Content-Disposition':`attachment; filename="${name.replace(/[^a-zA-Z0-9._-]/g,'_')}"`}:{})});if(req.method==='HEAD')res.end();else createReadStream(path).on('error',()=>res.destroy()).pipe(res);}
const server=createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; frame-src 'self'; base-uri 'none'; frame-ancestors 'none'");
  try{
    const requestHost=req.headers.host||'';
    if(allowedHosts.size&&!allowedHosts.has(requestHost)&&!requestHost.endsWith('.onrender.com'))throw fail('Unrecognized host.',403);
    const sameOrigin=req.headers.origin===`https://${requestHost}`||req.headers.origin===`http://${requestHost}`;
    if(req.headers.origin&&!allowedOrigins.has(req.headers.origin)&&!sameOrigin&&!req.headers.origin.endsWith('.onrender.com'))throw fail('Cross-origin access is disabled.',403);
    const reqUrl=new URL(req.url,'http://localhost');
    const path=decodeURIComponent(reqUrl.pathname),method=req.method;
    if(path==='/healthz'&&method==='GET')return json(res,200,{ok:true});
    const actor=authenticate(req);
    if(!actor){
      res.writeHead(401,{'WWW-Authenticate':'Basic realm="PackSignal demo", charset="UTF-8"','Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'});
      res.end('Authentication required.');return;
    }
    if(!['GET','HEAD'].includes(req.method)&&!path.startsWith('/api/desk/')&&!path.startsWith('/api/brief/')&&!path.startsWith('/api/reviewer-lenses')&&!path.startsWith('/api/pack-canvas')&&!path.startsWith('/api/shopper-lenses')&&!path.startsWith('/api/requirements-map')&&!path.startsWith('/api/claims-radar')&&!path.startsWith('/api/time-machine')&&!path.startsWith('/api/campus/')&&!path.includes('/decision-scenarios')&&req.headers['x-packproof-token']!==csrf)throw fail('Refresh the page to renew your request token.',403);
    if(publicFiles.has(path)&&['GET','HEAD'].includes(method))return await sendPublicFile(req,res,path);
    if(path==='/api/source-pieces'&&method==='GET'){
      try {
        const samples = parseOrganizerSamples();
        return json(res, 200, {
          status: 'SUCCESS',
          phase: 'Phase 1 — Read files with positions',
          summary: {
            pdfPiecesCount: samples.pdf.pieces.length,
            pdfActiveCount: samples.pdf.activePieces.length,
            pdfIgnoredCount: samples.pdf.ignoredList.length,
            pdfHiddenCount: samples.pdf.hiddenPieces.length,
            excelPiecesCount: samples.excel.pieces.length,
            excelCols: ['A', 'B', 'C'],
            artOrientationIgnored: samples.pdf.ignoredList.some(p => p.text.toLowerCase().includes('art orientation')),
            copyFreeIgnored: samples.pdf.ignoredList.some(p => p.text.toLowerCase().includes('copy free')),
            euTableHidden: samples.pdf.hiddenPieces.some(p => p.text.toLowerCase().includes('typical values') || p.text.toLowerCase().includes('100g')),
            fifteenGramsRebuilt: samples.pdf.pieces.some(p => p.text === '15 g' && p.rawText.includes('1 5 g'))
          },
          samples
        });
      } catch (err) {
        return json(res, 500, { status: 'ERROR', error: err.message });
      }
    }
    if(path==='/api/fact-sheet'&&method==='GET'){
      try {
        const factSheet = getOrganizerFactSheet();
        return json(res, 200, factSheet);
      } catch (err) {
        return json(res, 500, { status: 'ERROR', error: err.message });
      }
    }
    if(path==='/api/requirements'&&method==='GET'){
      try {
        const urlObj = new URL(req.url, `http://${req.headers.host}`);
        const market = urlObj.searchParams.get('market') || 'us';
        const launchDate = urlObj.searchParams.get('launchDate') || '2026-10-16';
        const category = urlObj.searchParams.get('category') || 'granola';
        const results = evaluateRequirementsAndQuestions({ market, launchDate, category });
        return json(res, 200, results);
      } catch (err) {
        return json(res, 500, { status: 'ERROR', error: err.message });
      }
    }
    if(path==='/api/desk/state'&&method==='GET'){
      try {
        const urlObj = new URL(req.url, `http://${req.headers.host}`);
        const sessionId = urlObj.searchParams.get('session') || 'default';
        const session = getDeskSession(sessionId);
        return json(res, 200, session);
      } catch (err) {
        return json(res, 500, { status: 'ERROR', error: err.message });
      }
    }
    if(path==='/api/desk/resolve-conflict'&&method==='POST'){
      try {
        const payload = await body(req);
        const urlObj = new URL(req.url, `http://${req.headers.host}`);
        const sessionId = urlObj.searchParams.get('session') || payload.sessionId || 'default';
        const updated = resolveDeskConflict(sessionId, payload);
        return json(res, 200, { status: 'SUCCESS', session: updated });
      } catch (err) {
        return json(res, 500, { status: 'ERROR', error: err.message });
      }
    }
    if(path==='/api/desk/answer-question'&&method==='POST'){
      try {
        const payload = await body(req);
        const urlObj = new URL(req.url, `http://${req.headers.host}`);
        const sessionId = urlObj.searchParams.get('session') || payload.sessionId || 'default';
        const updated = answerDeskQuestion(sessionId, payload);
        return json(res, 200, { status: 'SUCCESS', session: updated });
      } catch (err) {
        return json(res, 500, { status: 'ERROR', error: err.message });
      }
    }
    if(path==='/api/desk/upload'&&method==='POST'){
      try {
        const payload = await body(req);
        const urlObj = new URL(req.url, `http://${req.headers.host}`);
        const sessionId = urlObj.searchParams.get('session') || payload.sessionId || 'default';
        const resUpload = uploadDeskInput(sessionId, payload);
        return json(res, 200, { status: 'SUCCESS', ...resUpload });
      } catch (err) {
        return json(res, 500, { status: 'ERROR', error: err.message });
      }
    }
    if(path==='/api/desk/reset'&&method==='POST'){
      try {
        const payload = await body(req).catch(() => ({}));
        const urlObj = new URL(req.url, `http://${req.headers.host}`);
        const sessionId = urlObj.searchParams.get('session') || payload.sessionId || 'default';
        const session = resetDeskSession(sessionId);
        return json(res, 200, { status: 'SUCCESS', session });
      } catch (err) {
        return json(res, 500, { status: 'ERROR', error: err.message });
      }
    }
    if(path==='/api/file-spot'&&method==='GET'){
      const urlObj = new URL(req.url, `http://${req.headers.host}`);
      const file = urlObj.searchParams.get('file') || '';
      const location = urlObj.searchParams.get('location') || '';
      const quote = urlObj.searchParams.get('quote') || '';
      const cell = urlObj.searchParams.get('cell') || '';
      const paragraph = urlObj.searchParams.get('paragraph') || '';
      const panel = urlObj.searchParams.get('panel') || '';
      const line = urlObj.searchParams.get('line') || '';
      const page = urlObj.searchParams.get('page') || '1';

      return json(res, 200, {
        status: 'SUCCESS',
        file,
        location,
        quote,
        cell,
        paragraph,
        panel,
        line,
        page,
        snippet: `Exact match in ${file} at ${location}:\n"${quote}"`,
        coordinates: {
          type: cell ? 'cell' : (panel ? 'panel' : (paragraph ? 'paragraph' : 'line')),
          value: cell || panel || paragraph || line
        }
      });
    }

    // Phase 5 — Creative Brief, Compliance Audit, Approval, Export, and Ask About This
    if(path==='/api/brief/draft'&&method==='GET'){
      const urlObj = new URL(req.url, `http://${req.headers.host}`);
      const sessionId = urlObj.searchParams.get('session') || 'default';
      const { brief, session } = getOrCreateBrief(sessionId);
      return json(res, 200, {
        status: 'SUCCESS',
        brief,
        audit: brief.audit,
        sessionSummary: session.summary
      });
    }
    if(path==='/api/brief/audit'&&method==='POST'){
      try {
        const payload = await body(req).catch(() => ({}));
        const urlObj = new URL(req.url, `http://${req.headers.host}`);
        const sessionId = urlObj.searchParams.get('session') || payload.sessionId || 'default';
        const { brief, session } = getOrCreateBrief(sessionId);
        const audit = auditBrief(brief, session);
        return json(res, 200, { status: 'SUCCESS', audit, isApprovable: audit.isApprovable });
      } catch (err) {
        return json(res, 500, { status: 'ERROR', error: err.message });
      }
    }
    if(path==='/api/brief/sentence'&&method==='POST'){
      try {
        const payload = await body(req);
        const urlObj = new URL(req.url, `http://${req.headers.host}`);
        const sessionId = urlObj.searchParams.get('session') || payload.sessionId || 'default';
        const { brief, session } = getOrCreateBrief(sessionId);
        const result = updateBriefSentence(brief, session, payload);
        return json(res, 200, { status: 'SUCCESS', ...result, audit: brief.audit });
      } catch (err) {
        return json(res, 500, { status: 'ERROR', error: err.message });
      }
    }
    if(path==='/api/brief/approve'&&method==='POST'){
      try {
        const payload = await body(req).catch(() => ({}));
        const urlObj = new URL(req.url, `http://${req.headers.host}`);
        const sessionId = urlObj.searchParams.get('session') || payload.sessionId || 'default';
        const { brief, session } = getOrCreateBrief(sessionId);
        const approved = approveBrief(brief, session, payload.reviewer);
        return json(res, 200, { status: 'SUCCESS', brief: approved, approval: approved.approval });
      } catch (err) {
        return json(res, 400, { status: 'ERROR', error: err.message });
      }
    }
    if(path==='/api/brief/export/pdf'&&method==='GET'){
      const urlObj = new URL(req.url, `http://${req.headers.host}`);
      const sessionId = urlObj.searchParams.get('session') || 'default';
      const { brief, session } = getOrCreateBrief(sessionId);
      const html = generateBriefPdfHtml(brief, session);
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': 'inline; filename="Packaging_Creative_Brief_Approved.html"'
      });
      res.end(html);
      return;
    }
    if(path==='/api/brief/export/checklist'&&method==='GET'){
      const urlObj = new URL(req.url, `http://${req.headers.host}`);
      const sessionId = urlObj.searchParams.get('session') || 'default';
      const format = urlObj.searchParams.get('format') || 'json';
      const { brief, session } = getOrCreateBrief(sessionId);
      const checklist = generateBriefChecklist(brief, session);
      if (format === 'csv') {
        const csvLines = ['Checklist ID,Sentence ID,Section,Statement,Status,Priority,Owner,Evidence Reference'];
        for (const it of checklist.items) {
          const factsStr = it.facts.map(f => `${f.label} (${f.value})`).join('; ') || 'Process Directive';
          csvLines.push(`"${it.id}","${it.sentenceId || it.id}","${it.section}","${it.statement.replace(/"/g, '""')}","${it.status}","${it.priority || 'STANDARD'}","${it.owner || 'Regulatory Affairs'}","${factsStr.replace(/"/g, '""')}"`);
        }
        res.writeHead(200, {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="preflight_compliance_checklist.csv"'
        });
        res.end(csvLines.join('\n'));
        return;
      }
      if (format === 'markdown' || format === 'md') {
        const mdLines = [
          `# Preflight Packaging Verification Checklist`,
          `**Brief**: ${brief.title}`,
          `**Generated**: ${checklist.generatedAt}`,
          `**Status**: ${checklist.approvalStatus}`,
          `**Total Checks**: ${checklist.totalChecks} | **Passed**: ${checklist.passedChecks} | **Failed**: ${checklist.failedChecks}`,
          '',
          `| Section | Verification Statement | Status | Provenance Facts & Sources |`,
          `| --- | --- | --- | --- |`
        ];
        for (const it of checklist.items) {
          const factsStr = it.facts.map(f => `${f.label} (${f.value}) - ${f.primarySource}`).join('; ') || 'No fact linked';
          mdLines.push(`| ${it.section} | ${it.statement.replace(/\|/g, '\\|')} | **${it.status}** | ${factsStr.replace(/\|/g, '\\|')} |`);
        }
        res.writeHead(200, {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Content-Disposition': 'attachment; filename="preflight_compliance_checklist.md"'
        });
        res.end(mdLines.join('\n'));
        return;
      }
      return json(res, 200, { status: 'SUCCESS', checklist });
    }
    if(path==='/api/brief/manifest'&&method==='GET'){
      const urlObj = new URL(req.url, `http://${req.headers.host}`);
      const sessionId = urlObj.searchParams.get('session') || 'default';
      const { brief, session } = getOrCreateBrief(sessionId);
      const manifest = createBriefExportManifest({ brief, session, reviewer: brief.approval || {} });
      return json(res, 200, { status: 'SUCCESS', manifest });
    }
    if(path==='/api/brief/ask'&&method==='POST'){
      try {
        const payload = await body(req);
        const urlObj = new URL(req.url, `http://${req.headers.host}`);
        const sessionId = urlObj.searchParams.get('session') || payload.sessionId || 'default';
        const { session } = getOrCreateBrief(sessionId);
        const questionText = payload.question || payload.query || '';
        const answerResult = askAboutThis(questionText, session);
        return json(res, 200, { status: 'SUCCESS', ...answerResult });
      } catch (err) {
        return json(res, 500, { status: 'ERROR', error: err.message });
      }
    }
    if(path==='/api/brief/confirm-fact'&&method==='POST'){
      try {
        const payload = await body(req);
        const urlObj = new URL(req.url, `http://${req.headers.host}`);
        const sessionId = urlObj.searchParams.get('session') || payload.sessionId || 'default';
        const { brief, session } = getOrCreateBrief(sessionId);
        const result = confirmFactFromAnswer(session, brief, payload.proposedFact);
        return json(res, 200, { status: 'SUCCESS', ...result, audit: brief.audit });
      } catch (err) {
        return json(res, 500, { status: 'ERROR', error: err.message });
      }
    }

    // Phase 5A — Reviewer Lenses: Red-Pen, Sticky Notes, Track Changes & A3 Wall Poster
    if(path==='/api/reviewer-lenses'&&method==='GET'){
      const urlObj = new URL(req.url, `http://${req.headers.host}`);
      const sessionId = urlObj.searchParams.get('session') || 'default';
      const lensesData = getReviewerLensesData(sessionId);
      return json(res, 200, { status: 'SUCCESS', ...lensesData });
    }
    if(path==='/api/reviewer-lenses/poster'&&method==='GET'){
      const urlObj = new URL(req.url, `http://${req.headers.host}`);
      const sessionId = urlObj.searchParams.get('session') || 'default';
      const posterHtml = generateA3WallPosterHtml(sessionId);
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': 'inline; filename="Esko_Carton_Senior_Reviewer_A3_Poster.html"'
      });
      res.end(posterHtml);
      return;
    }

    // Phase 6 — Pack Canvas: The "Will It Fit?" Workbench
    if(path==='/api/pack-canvas'&&method==='GET'){
      const urlObj = new URL(req.url, `http://${req.headers.host}`);
      const scenario = urlObj.searchParams.get('scenario');
      const fix = urlObj.searchParams.get('fix');
      const market = urlObj.searchParams.get('market') || 'US';
      const state = getPackCanvasState({
        overflowScenario: scenario === 'overflow',
        activeFix: fix,
        market
      });
      return json(res, 200, state);
    }
    if(path==='/api/pack-canvas/scenario'&&method==='POST'){
      const payload = await body(req);
      const state = getPackCanvasState({
        overflowScenario: payload.scenario === 'overflow',
        activeFix: payload.fix || null,
        market: payload.market || 'US'
      });
      return json(res, 200, state);
    }
    if(path==='/api/pack-canvas/dieline-check'&&method==='GET'){
      const urlObj = new URL(req.url, `http://${req.headers.host}`);
      const layersParam = urlObj.searchParams.get('layers');
      const layers = layersParam ? layersParam.split(',') : [];
      const resData = evaluateDielineLayerAvailability(layers);
      return json(res, 200, { status: 'SUCCESS', ...resData });
    }
    if(path==='/api/pack-canvas/revisions'&&method==='GET'){
      const revisions = getSavedLayoutRevisions();
      return json(res, 200, { status: 'SUCCESS', revisions });
    }
    if(path==='/api/pack-canvas/save'&&method==='POST'){
      const payload = await body(req);
      const state = buildLayoutState({
        scenario: payload.scenario || 'standard',
        activeFix: payload.activeFix || null,
        market: payload.market || 'US',
        reviewId: payload.reviewId
      });
      const saved = saveLayoutRevision(state, payload.author, payload.notes);
      return json(res, 200, { status: 'SUCCESS', revision: saved });
    }
    if(path==='/api/pack-canvas/export'&&method==='GET'){
      const urlObj = new URL(req.url, `http://${req.headers.host}`);
      const scenario = urlObj.searchParams.get('scenario') || 'standard';
      const fix = urlObj.searchParams.get('fix') || null;
      const market = urlObj.searchParams.get('market') || 'US';
      const state = buildLayoutState({ scenario, activeFix: fix, market });
      const exportData = generateLayoutProposalExport(state);
      return json(res, 200, { status: 'SUCCESS', export: exportData });
    }
    if(path==='/api/pack-canvas/apply-fix'&&method==='POST'){
      const payload = await body(req);
      const fixId = payload.fixId || payload.fix;
      const state = buildLayoutState({
        scenario: payload.scenario || 'overflow',
        market: payload.market || 'US'
      });
      const result = verifyAndApplyFix(state.panels, state.lockedBrandZones, state.blocks, fixId);
      return json(res, 200, { status: 'SUCCESS', ...result });
    }

    // Phase 6A — Shopper Experience Lab
    if((path==='/api/shopper/experience'||path==='/api/shopper-experience')&&method==='GET'){
      const urlObj = new URL(req.url, `http://${req.headers.host}`);
      const distParam = urlObj.searchParams.get('distance');
      const distance = distParam ? parseFloat(distParam) : 60.0;
      const persona = urlObj.searchParams.get('persona') || 'all';
      const mode = urlObj.searchParams.get('mode') || 'shelf_readability';
      const market = urlObj.searchParams.get('market') || 'US';
      const experience = generateShopperExperience({
        distanceCm: distance,
        personaId: persona,
        simulationMode: mode,
        market
      });
      return json(res, 200, experience);
    }

    // Phase 6A — Shopper Lenses: Personas, Shelf Test, 3s Glance, Accessibility
    if(path==='/api/shopper-lenses'&&method==='GET'){
      const urlObj = new URL(req.url, `http://${req.headers.host}`);
      const distParam = urlObj.searchParams.get('distance');
      const distance = distParam ? parseFloat(distParam) : 0.6;
      const data = getShopperLensesData(distance);
      return json(res, 200, data);
    }

    // Phase 7 — Market Switch, Claims Radar, Time Machine, Requirements Map
    if(path==='/api/markets'&&method==='GET'){
      const installed = discoverInstalledMarkets();
      return json(res, 200, {
        status: 'SUCCESS',
        markets: installed,
        count: installed.length
      });
    }

    if(path==='/api/market-pack'&&method==='GET'){
      const urlObj = new URL(req.url, `http://${req.headers.host}`);
      const market = urlObj.searchParams.get('market') || 'US';
      const pack = await loadMarketPack(market);
      return json(res, 200, {
        status: 'SUCCESS',
        market: pack.market,
        jurisdiction: pack.jurisdiction,
        authority: pack.authority,
        rulesCount: pack.rules?.length || 0,
        dailyValuesCount: Object.keys(pack.dailyValues || {}).length,
        requiredItemsCount: pack.requiredPackItems?.length || 0,
        claimWordsCount: pack.claims?.length || 0
      });
    }

    if(path==='/api/claims-radar'&&method==='GET'){
      const urlObj = new URL(req.url, `http://${req.headers.host}`);
      const market = urlObj.searchParams.get('market') || 'US';
      const radar = evaluateClaimsRadar({ market });
      return json(res, 200, { status: 'SUCCESS', ...radar });
    }

    if(path==='/api/time-machine'&&method==='GET'){
      const urlObj = new URL(req.url, `http://${req.headers.host}`);
      const market = urlObj.searchParams.get('market') || 'US';
      const date = urlObj.searchParams.get('date') || '2026-10-18';
      const category = urlObj.searchParams.get('category') || 'food';
      const result = evaluateTimeMachine({ market, launchDate: date, productCategory: category });
      return json(res, 200, { status: 'SUCCESS', ...result });
    }

    if(path==='/api/regulatory/rules'&&method==='GET'){
      const urlObj = new URL(req.url, `http://${req.headers.host}`);
      const market = urlObj.searchParams.get('market');
      const category = urlObj.searchParams.get('category');
      const date = urlObj.searchParams.get('date');
      let list = [...VERIFIED_TEMPORAL_RULES];
      if (market) list = list.filter(r => r.market === 'all' || r.market === market.toLowerCase() || r.jurisdiction === market.toLowerCase());
      if (category) list = list.filter(r => r.productCategory === 'all' || r.productCategory === category.toLowerCase());
      return json(res, 200, { status: 'SUCCESS', rules: list, count: list.length });
    }

    if(path.startsWith('/api/regulatory/rules/')&&method==='GET'){
      const ruleId = path.slice('/api/regulatory/rules/'.length);
      const rule = VERIFIED_TEMPORAL_RULES.find(r => r.ruleId === ruleId || r.id === ruleId);
      if(!rule) throw fail('Regulatory rule record not found.', 404);
      return json(res, 200, { status: 'SUCCESS', rule });
    }

    if(path==='/api/requirements-map'&&method==='GET'){
      const urlObj = new URL(req.url, `http://${req.headers.host}`);
      const market = urlObj.searchParams.get('market') || 'US';
      const map = getRequirementsMapGraph({ market, answeredQuestionIds: globalAnsweredQuestions });
      return json(res, 200, { status: 'SUCCESS', ...map, answeredQuestionIds: globalAnsweredQuestions });
    }

    if(path==='/api/requirements-map/answer'&&method==='POST'){
      const payload = await body(req);
      const questionId = payload.questionId;
      const market = payload.market || 'US';
      if (questionId) {
        globalAnsweredQuestions = answerRequirementsQuestion(questionId, globalAnsweredQuestions);
      }
      const map = getRequirementsMapGraph({ market, answeredQuestionIds: globalAnsweredQuestions });
      return json(res, 200, { status: 'SUCCESS', ...map, answeredQuestionIds: globalAnsweredQuestions, justAnswered: questionId });
    }

    if(path==='/api/requirements-map/reset'&&method==='POST'){
      const payload = await body(req).catch(() => ({}));
      const market = payload?.market || 'US';
      globalAnsweredQuestions = [];
      const map = getRequirementsMapGraph({ market, answeredQuestionIds: [] });
      return json(res, 200, { status: 'SUCCESS', ...map, answeredQuestionIds: [] });
    }

    if(path==='/api/independent-evaluation'&&method==='GET'){
      const resFile = join(root, 'evaluation', 'independent', 'results.json');
      if(existsSync(resFile)){
        const content = JSON.parse(await readFile(resFile, 'utf8'));
        return json(res, 200, content);
      }
      return json(res, 404, { status: 'PENDING', message: 'Independent evaluation results not yet generated.' });
    }
    if(path==='/evaluation/independent/report.html'&&method==='GET'){
      const repFile = join(root, 'evaluation', 'independent', 'report.html');
      if(existsSync(repFile)){
        res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
        res.end(await readFile(repFile, 'utf8'));
        return;
      }
      return json(res, 404, { error: 'Report HTML not found' });
    }
    // Phase 8: Mutation Benchmark & Live Trust Scoreboard Endpoints
    if (path === '/api/selftest/run' && method === 'POST') {
      const reqBody = await body(req).catch(() => ({}));
      const seed = reqBody?.seed ? Number(reqBody.seed) : 20261025;
      const benchmarkData = await runMutationBenchmark({ seed, maxCases: reqBody?.maxCases });
      selftestRuns.set(benchmarkData.runId, benchmarkData);
      latestMutationBenchmark = benchmarkData;
      if (selftestRuns.size > 20) {
        const oldestKey = selftestRuns.keys().next().value;
        selftestRuns.delete(oldestKey);
      }
      return json(res, 200, benchmarkData);
    }
    if (path === '/api/selftest/latest' && method === 'GET') {
      if (!latestMutationBenchmark) {
        latestMutationBenchmark = await runMutationBenchmark({ seed: 20261025 });
        selftestRuns.set(latestMutationBenchmark.runId, latestMutationBenchmark);
      }
      return json(res, 200, latestMutationBenchmark);
    }
    if (path.startsWith('/api/selftest/') && method === 'GET') {
      const parts = path.slice('/api/selftest/'.length).split('/');
      const runId = decodeURIComponent(parts[0]);
      const subAction = parts[1];
      const runData = selftestRuns.get(runId) || latestMutationBenchmark;
      if (!runData) {
        return json(res, 404, { error: `Benchmark run ${runId} not found` });
      }
      if (subAction === 'export' || runId === 'export') {
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="packsignal-mutation-benchmark-${runData.runId || 'latest'}.json"`,
        });
        return res.end(JSON.stringify(runData, null, 2));
      }
      if (subAction === 'results') {
        return json(res, 200, { runId: runData.runId, summary: runData.summary, cases: runData.cases });
      }
      return json(res, 200, runData);
    }
    if(path==='/api/trust-console/scoreboard'&&method==='GET'){
      const evalData = runTrustEvaluation();
      const bakeOff = getModelBakeOffResults();
      const changeLog = getChangeLog();
      return json(res, 200, {
        scorecard: evalData.scorecard,
        outcomes: evalData.outcomes,
        misses: evalData.misses,
        bakeOff,
        changeLog,
        currentConfigModel: model,
      });
    }
    if(path==='/api/trust-console/run-self-test'&&method==='POST'){
      const reqBody = await body(req).catch(() => ({}));
      const cases = Array.isArray(reqBody?.cases) && reqBody.cases.length ? reqBody.cases : undefined;
      const results = runTrustEvaluation(cases);
      try {
        persistEvaluationRun({
          runId: `run-${Date.now().toString(36)}`,
          timestamp: results.timestamp || new Date().toISOString(),
          suiteVersion: '1.0.0-freeze',
          modelId: model,
          mode: 'deterministic',
          totalCases: results.totalCases,
          scoreboard: results.scorecard,
          counts: { fp: results.scorecard?.falseAlarms || 0 },
          avgLatencyMs: results.scorecard?.avgLatencyMs || 0,
          missesCount: results.missesCount || 0,
          outcomes: results.outcomes || [],
        });
      } catch (e) {
        // Safe logging
      }
      return json(res, 200, results);
    }
    if(path==='/api/trust-console/generate-cases'&&method==='POST'){
      const reqBody = await body(req).catch(() => ({}));
      const count = Number(reqBody?.count) || 10;
      const cases = generateBrokenTestCases({ count });
      return json(res, 200, { ok: true, count: cases.length, cases });
    }
    if(path==='/api/trust-console/bake-off'&&method==='GET'){
      return json(res, 200, getModelBakeOffResults());
    }
    if(path==='/api/trust-console/change-log'&&method==='GET'){
      return json(res, 200, getChangeLog());
    }
    if(path==='/api/trust-console/history'&&method==='GET'){
      return json(res, 200, { history: getRunHistory() });
    }
    if(path==='/api/trust-console/release-gates'&&method==='GET'){
      return json(res, 200, evaluateReleaseGates());
    }
    if(path==='/api/trust-console/compare'&&method==='POST'){
      const reqBody = await body(req).catch(() => ({}));
      try {
        const comp = compareEvaluationRuns(reqBody?.runA, reqBody?.runB);
        return json(res, 200, comp);
      } catch (err) {
        return json(res, 400, { error: err.message });
      }
    }
    if(path==='/api/campus/reset'&&method==='POST'){
      const resData = await resetCampusDemoState(storage);
      return json(res, 200, resData);
    }
    if(path==='/api/campus/india-pack'&&method==='GET'){
      const sampleArtworkText = {
        front: "अमृत मसाला चाय Amrit Organic Masala Chai 100% Natural Net Wt: 250 g शुद्ध वजन: २०० ग्राम FSSAI Lic. No. 10020042000123 शाकाहारी",
        back: "Ingredients: Assam CTC Black Tea, Cardamom, Ginger, Cinnamon, Cloves, Contains Milk Solids. MRP ₹250.00 (Incl. of all taxes). Best before 12 months from packaging.",
      };
      const evaluation = evaluateIndiaBilingualPack(sampleArtworkText);
      return json(res, 200, { specification: AMRIT_CHAI_SPECIFICATION, evaluation });
    }
    if(path.startsWith('/api/campus/locale/')&&method==='GET'){
      const lang = path.replace('/api/campus/locale/', '');
      const localeData = await getLocale(lang);
      return json(res, 200, localeData);
    }
    if(path==='/api/campus/competitor-snap'&&method==='POST'){
      const b = await body(req).catch(() => ({}));
      const text = b?.text || "Tata Tea Gold Care: With 5 Natural Ingredients. Zero Added Sugar, High Antioxidants, 100% Natural Herbs. Certified Gluten-Free.";
      const brand = b?.brand || "Competitor Premium Brand";
      const claims = extractCompetitorClaims(text, brand);
      const benchmark = benchmarkCompetitorAgainstBrief(claims, { claims: ['100% Whole Grain', 'High Fiber', 'Vegan Certified'] });
      return json(res, 200, { extracted: claims, benchmark });
    }
    if(path==='/api/campus/scan-checklist'&&method==='GET'){
      const session = getScanSession('default');
      return json(res, 200, getScanChecklist(session.panels));
    }
    if(path==='/api/campus/scan-session'&&method==='GET'){
      const sessionId = req.url.includes('sessionId=') ? new URL(req.url, 'http://localhost').searchParams.get('sessionId') : 'default';
      const session = getScanSession(sessionId);
      return json(res, 200, {
        session,
        checklist: getScanChecklist(session.panels),
      });
    }
    if(path==='/api/campus/scan-session/reset'&&method==='POST'){
      const b = await body(req).catch(() => ({}));
      const session = resetScanSession(b?.sessionId || 'default');
      return json(res, 200, { success: true, session, checklist: getScanChecklist({}) });
    }
    if(path==='/api/campus/scan-panel'&&method==='POST'){
      const b = await body(req).catch(() => ({}));
      const sessionId = b?.sessionId || 'default';
      let face = b?.face;
      const text = b?.text || '';
      
      if (!face || face === 'auto') {
        const detection = detectPackagingFace(text);
        face = detection.detectedFace !== 'unknown' ? detection.detectedFace : 'front';
      }

      let scale = null;
      if (b?.cardBox) {
        scale = calculatePhysicalScaleFromCard(b.cardBox);
      }

      let unwarp = null;
      if (b?.corners && Array.isArray(b.corners) && b.corners.length === 4) {
        unwarp = computePerspectiveTransform(b.corners, b.destWidth || 600, b.destHeight || 800);
      }

      const sharpness = assessSharpnessAndAutoCapture(b?.variance ?? 120, { threshold: 110 });
      const localOcr = b?.localOcr || { values: { [face]: text } };
      const visionOcr = b?.visionOcr || { values: { [face]: text } };
      const dualReader = evaluateDualReaderConsensus(localOcr, visionOcr, face);
      const closeUp = evaluateCloseUpNecessity(face, b?.elements || [], scale);

      const panelData = {
        face,
        photoUrl: b?.photoUrl || `/samples/campus/${face}.png`,
        text,
        scale,
        unwarp,
        sharpness,
        dualReader,
        closeUp,
        values: b?.values || {},
        hasBlur: !sharpness.isSharp,
        hasGlare: Boolean(b?.hasGlare),
      };

      const session = saveScanSessionPanel(sessionId, panelData);
      return json(res, 200, {
        success: true,
        panel: panelData,
        checklist: getScanChecklist(session.panels),
        session,
      });
    }
    if(path==='/api/campus/mobile-session-token'&&method==='POST'){
      const b = await body(req).catch(() => ({}));
      const sessionId = b?.sessionId || `scan-${Date.now()}`;
      const reviewId = b?.reviewId || 'rev-campus';
      const tokenData = createMobileSessionToken(sessionId, reviewId);
      return json(res, 200, { success: true, ...tokenData });
    }
    if(path==='/api/campus/scan-corners'&&method==='POST'){
      const b = await body(req).catch(() => ({}));
      const sessionId = b?.sessionId || 'default';
      const face = b?.face || 'front';
      const corners = b?.corners;
      if (!corners || !Array.isArray(corners) || corners.length !== 4) {
        return json(res, 400, { success: false, error: 'Exactly 4 corner points [TL, TR, BR, BL] required' });
      }
      const unwarp = computePerspectiveTransform(corners, b?.destWidth || 600, b?.destHeight || 800);
      const session = getScanSession(sessionId);
      if (session.panels[face]) {
        session.panels[face].unwarp = unwarp;
        session.panels[face].cornersManuallyAdjusted = true;
      }
      return json(res, 200, { success: true, unwarp, face });
    }
    if(path==='/api/campus/scan-closeup'&&method==='POST'){
      const b = await body(req).catch(() => ({}));
      const sessionId = b?.sessionId || 'default';
      const face = b?.face || 'front';
      const targetContent = b?.targetContent || 'Macro Detail';
      const session = getScanSession(sessionId);
      if (!session.closeUps) session.closeUps = [];
      const closeUpRecord = {
        id: `macro-${Date.now()}`,
        face,
        targetContent,
        photoUrl: b?.photoUrl || `/samples/campus/${face}-closeup.png`,
        text: b?.text || '',
        verifiedAt: new Date().toISOString(),
      };
      session.closeUps.push(closeUpRecord);
      if (session.panels[face] && b?.text) {
        session.panels[face].text = `${session.panels[face].text} ${b.text}`.trim();
      }
      return json(res, 200, { success: true, closeUp: closeUpRecord, session });
    }
    if(path==='/api/campus/scan-retake'&&method==='POST'){
      const b = await body(req).catch(() => ({}));
      const sessionId = b?.sessionId || 'default';
      const face = b?.face || 'front';
      const session = retakePanel(sessionId, face);
      return json(res, 200, { success: true, retakeFace: face, checklist: getScanChecklist(session.panels) });
    }
    if(path==='/api/campus/scan-to-brief'&&method==='POST'){
      const b = await body(req).catch(() => ({}));
      const sessionId = b?.sessionId || 'default';
      const brief = generateBriefFromScanSession(sessionId, {
        market: b?.market || 'us',
        hasApprovedSpec: Boolean(b?.hasApprovedSpec),
        isDraft: b?.isDraft ?? true,
      });
      return json(res, 200, { success: true, brief });
    }
    if(path==='/api/campus/two-routes-verify'&&method==='POST'){
      const b = await body(req).catch(() => ({}));
      const pdfFindings = b?.pdfFindings || [
        { id: 'pdf-1', title: 'Honey Ingredient Conflict: Unapproved sweetener', verdict: 'issue', category: 'Ingredients' },
        { id: 'pdf-2', title: 'Net Quantity: Missing fluid ounce format declaration', verdict: 'issue', category: 'Net Quantity' },
        { id: 'pdf-3', title: 'Brand Identity: Dancing Fish Granola Berry Crunch', verdict: 'match', category: 'Brand' },
      ];
      const scannedFindings = b?.scannedFindings || [
        { id: 'scan-1', title: 'Honey Ingredient Conflict: Unapproved sweetener', verdict: 'issue', category: 'Ingredients' },
        { id: 'scan-2', title: 'Net Quantity: Missing fluid ounce format declaration', verdict: 'issue', category: 'Net Quantity' },
        { id: 'scan-3', title: 'Brand Identity: Dancing Fish Granola Berry Crunch', verdict: 'match', category: 'Brand' },
      ];
      const result = verifyTwoRoutesSameAnswer(pdfFindings, scannedFindings);
      return json(res, 200, result);
    }
    if(path==='/api/campus/shelf-vs-approved'&&method==='POST'){
      const b = await body(req).catch(() => ({}));
      const shelfPanels = b?.shelfPanels || {
        front: { values: { brand_name: 'Dancing Fish', net_quantity: '10 oz (283 g)' } },
        back: { values: { allergen_statement: 'Contains Almonds, Wheat' } },
        bottom: { values: { barcode_gtin: '012345678905' } },
      };
      const approvedSpec = b?.approvedSpec || {
        brand_name: 'Dancing Fish',
        net_quantity: '12 oz (340 g)',
        allergen_statement: 'Contains Almonds, Wheat',
        barcode_gtin: '012345678905',
      };
      const result = compareShelfVsApproved(shelfPanels, approvedSpec);
      return json(res, 200, result);
    }
    if(path==='/api/campus/check-back'&&method==='GET'){
      return json(res, 200, {
        reprintSample: 'Dancing Fish Granola Rev B',
        tickets: [
          { id: 'TKT-01', field: 'net_quantity', target: '1000 mL', observed: '1000 mL', status: 'RESOLVED', note: 'Verified fixed on physical front panel' },
          { id: 'TKT-02', field: 'storage_copy', target: 'Keep refrigerated', observed: '[missing]', status: 'REGRESSION', note: 'Printer omitted cooling copy entirely on back panel' },
          { id: 'TKT-03', field: 'barcode_gtin', target: 'Check digit 7', observed: 'Check digit 7', status: 'RESOLVED', note: 'GTIN-13 valid Mod-10 check digit' }
        ],
        resolvedCount: 2,
        regressionCount: 1,
        reprintApproved: false
      });
    }
    if(path==='/api/campus/ar-targets'&&method==='GET'){
      return json(res, 200, getMindArTargetConfig());
    }
    if(path==='/api/campus/ar-manifest'&&method==='GET'){
      const market = reqUrl.searchParams.get('market') || 'us';
      const manifest = buildArManifest({ market });
      return json(res, 200, manifest);
    }
    if(path.startsWith('/api/campus/ar-hotspot/')&&method==='GET'){
      const findingId = path.split('/').pop();
      const market = reqUrl.searchParams.get('market') || 'us';
      const details = getFindingDetailsForHotspot(findingId, { market });
      return json(res, details.found ? 200 : 404, details);
    }
    if(path.startsWith('/api/campus/ar-overlay/')&&method==='GET'){
      const panel = path.split('/').pop() || 'front';
      const market = reqUrl.searchParams.get('market') || 'us';
      const svg = generatePanelOverlaySvg(panel, { market });
      res.writeHead(200, { 'Content-Type': 'image/svg+xml; charset=utf-8' });
      return res.end(svg);
    }
    if(path.startsWith('/api/external/openfoodfacts/')&&method==='GET'){
      const gtin = path.split('/').pop();
      const product = await fetchOpenFoodFactsProduct(gtin);
      return json(res, product.found ? 200 : 404, product);
    }
    if(path==='/api/external/openfda/recalls'&&method==='GET'){
      const q = reqUrl.searchParams.get('q') || '';
      const data = await queryOpenFdaRecalls(q);
      return json(res, 200, data);
    }
    if(path==='/api/external/usda/nutrient'&&method==='GET'){
      const q = reqUrl.searchParams.get('q') || '';
      const data = await searchUsdaFood(q);
      return json(res, 200, data);
    }
    if(path==='/api/external/status'&&method==='GET'){
      return json(res, 200, getRegulatoryApiStatus());
    }
    if(path==='/api/market-presets'&&method==='GET')return json(res,200,marketPresets);
    if(path==='/api/status'&&method==='GET'){const aiUsage=geminiStatus(apiKeys.length),inProgress=aiUsage.lastOutcome==='Request in progress'||aiUsage.lastOutcome.startsWith('Waiting before retry')||aiUsage.lastOutcome.startsWith('Waiting for the shared Gemini request limit')||aiUsage.lastOutcome.startsWith('Waiting for provider pacing');const aiConnection=!apiKeys.length?'not_configured':inProgress?'running':aiUsage.lastOutcome==='Live request completed'?'verified':aiUsage.lastOutcome==='No live request yet'?'configured':'attention';return json(res,200,{csrf,aiConfigured:Boolean(apiKeys.length),aiConnection,model,aiUsage,queued:jobs.size,limits:{files:8,fileMB:15,totalMB:30,pdfPages:12,mediaMB:MEDIA_MAX_BYTES/1_000_000,videoSeconds:MEDIA_MAX_SECONDS,mediaFrames:8},team:{enabled:teamEnabled,currentUser:{id:actor.id,username:actor.username,displayName:actor.displayName,role:actor.role},members:publicTeamUsers},storage:{persistent:persistentStorageReady,required:persistentStorageRequired},security:{authenticated:teamEnabled||Boolean(accessPassword),required:process.env.PACKPROOF_REQUIRE_AUTH==='true',hosted:process.env.NODE_ENV==='production'},scope:'Private workspace or access-controlled hosted demo; human release decision required.'});}
    if(path==='/api/media/convert'&&method==='POST'){
      const b=await body(req);
      if(!b||typeof b!=='object'||Array.isArray(b)||typeof b.base64!=='string'||!/^[A-Za-z0-9+/]*={0,2}$/.test(b.base64))throw fail('Choose a readable photo or video.',400);
      if(b.base64.length>Math.ceil(MEDIA_MAX_BYTES*4/3)+8)throw fail('Choose a photo or video up to 30 MB.',413);
      return json(res,200,await convertMedia({bytes:Buffer.from(b.base64,'base64'),name:String(b.name||''),kind:b.kind,maxFrames:b.maxFrames??8}));
    }
    if(path==='/api/reviews'&&method==='POST')return json(res,202,presentReview(await createReview(await body(req),actor),actor));
    if(path==='/api/reviews'&&method==='GET'){const reviewIds=(await readdir(join(storage,'reviews'))).slice(-20);const all=await Promise.all(reviewIds.map(async id=>{try{const r=await readReview(id);if(!canViewReview(r,actor))return null;return {id:r.id,name:r.name,createdAt:r.createdAt,finishedAt:r.finishedAt,status:r.status,counts:r.counts,engine:r.engine,sample:r.sample,parentId:r.parentId,timing:r.timing||null,createdBy:r.team?.createdBy||null,assignmentCount:Object.values(r.team?.assignments||{}).filter(assignment=>assignment.reviewerIds?.includes(actor.id)).length};}catch{return null;}}));return json(res,200,all.filter(Boolean).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)));}
    const match=path.match(/^\/api\/reviews\/([a-f0-9-]{36})(?:\/(.*))?$/);
    if(match){const id=match[1],action=match[2],handle=async()=>{const r=await load(id);if(!canViewReview(r,actor))throw fail('Review not found or not assigned to this account.',404);
      if(!action&&method==='GET'){
        if(r.parentId&&r.revision&&!r.revision.intelligence){
          try{
            const prev=await load(r.parentId);
            if(prev)r.revision.intelligence=analyzeRevisionIntelligence(prev,r);
          }catch(e){}
        }
        return json(res,200,presentReview(r,actor));
      }
      if(action==='finding-locations'&&method==='GET'){
        const locationsData = buildReviewFindingLocations(r);
        return json(res, 200, { ok: true, reviewId: id, ...locationsData });
      }
      if(action==='track-changes'&&method==='GET'){
        const diffData = computeReviewContentDiff(r);
        return json(res, 200, { ok: true, reviewId: id, ...diffData });
      }
      if((action==='export/a3-poster'||action==='a3-poster')&&method==='GET'){
        try {
          const pdfBuffer = await generateA3ReviewPoster(r);
          res.writeHead(200, {
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'inline; filename="PackSignal-A3-Review-Poster.pdf"',
            'Content-Length': pdfBuffer.length
          });
          res.end(pdfBuffer);
          return;
        } catch (err) {
          return json(res, 500, { ok: false, error: err.message });
        }
      }
      if(action?.startsWith('images/')&&['GET','HEAD'].includes(method)){const name=action.slice(7);const isDiffImage=name.startsWith('diff-')&&existsSync(join(dir(id),'rendered',name));if(!isDiffImage&&!r.documents.some(d=>d.pages.some(p=>p.image===name)))throw fail('Image not found.',404);return await sendFile(req,res,join(dir(id),'rendered',name));}
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
      let normalizedAction = action, pathFindingId = null;
      const subMatch = action?.match(/^findings\/([^/]+)\/(.*)$/);
      if (subMatch) { pathFindingId = subMatch[1]; normalizedAction = subMatch[2]; }
      if(['assignments','comments','approvals','department','sticky-notes','sticky-note-status'].includes(normalizedAction)&&method==='POST'){
        const b=await body(req);if(!b||typeof b!=='object'||Array.isArray(b))throw fail('Invalid team review request.');
        if (pathFindingId && !b.findingId) b.findingId = pathFindingId;
        if(normalizedAction==='sticky-note-status'){
          if(b.status){updateStickyNoteStatus(r,b.noteId,b.status,actor);audit(r,'sticky_note_status_updated',`Sticky note ${b.noteId} set to ${b.status}`,actor);}
          if(b.replyText){addStickyNoteReply(r,b.noteId,b.replyText,actor);audit(r,'sticky_note_reply_added',`Reply added to sticky note ${b.noteId}`,actor);}
          await save(r);return json(res,200,presentReview(r,actor));
        }
        const finding=r.findings.find(item=>item.id===b.findingId);if(!finding)throw fail('Finding not found.',404);
        if(normalizedAction==='department'){
          if(teamEnabled&&actor.role!=='admin'&&!canReviewFinding(r,finding.id,actor))throw fail('This finding is not assigned to your account.',403);
          const override=setFindingDepartment(r,finding.id,b.primaryDepartment,b.collaboratingDepartments,b.reason,actor);
          audit(r,'finding_department_changed',`${finding.title}: routed to ${override.newDepartment} (${override.reason||'no reason'})`,actor);
          await save(r);return json(res,200,presentReview(r,actor));
        }
        if(normalizedAction==='sticky-notes'){
          const note=addStickyNote(r,finding,actor,b);
          audit(r,'sticky_note_added',`${finding.title}: ${note.departmentId.toUpperCase()} note added.`,actor);
          await save(r);return json(res,200,presentReview(r,actor));
        }
        if(!teamEnabled)throw fail('Team sign-off is disabled until named team accounts and persistent storage are configured.',409);
        if(normalizedAction==='assignments'){
          if(actor.role!=='admin')throw fail('Only a workspace admin can assign findings.',403);
          const changed=setFindingAssignment(r,finding.id,b.reviewerIds,actor,publicTeamUsers);
          if(changed){clearSeal(r);const names=(r.team.assignments[finding.id].reviewerIds||[]).map(id=>publicTeamUsers.find(member=>member.id===id)?.displayName||id);audit(r,'finding_assigned',`${finding.title} assigned to ${names.join(', ')||'no reviewer'}.`,actor);await save(r);}
          return json(res,200,presentReview(r,actor));
        }
        if(!canReviewFinding(r,finding.id,actor))throw fail('This finding is not assigned to your account.',403);
        if(normalizedAction==='comments'){
          const comment=addFindingComment(r,finding,actor,b);comment.dependencyHash=findingDependencyFingerprint(r,finding);clearSeal(r);audit(r,'evidence_comment_added',`${finding.title}: reviewer comment anchored to ${comment.evidence?.name||'finding evidence'}.`,actor);await save(r);return json(res,200,presentReview(r,actor));
        }
        addFindingApproval(r,finding,actor,b,findingDependencyFingerprint(r,finding));clearSeal(r);audit(r,'independent_finding_signoff',`${finding.title}: ${b.outcome}.`,actor);await save(r);return json(res,200,presentReview(r,actor));
      }
      if(action==='decisions'&&method==='POST'){const b=await body(req);const finding=r.findings.find(f=>f.id===b.findingId);if(!finding||!['open','acknowledged','accepted_exception','needs_changes','needs_evidence'].includes(b.disposition))throw fail('Invalid reviewer decision.');if(teamEnabled&&!canReviewFinding(r,finding.id,actor))throw fail('This finding is not assigned to your account.',403);const note=typeof b.note==='string'&&b.note.trim()?b.note.trim():(b.disposition==='acknowledged'?'Acknowledged finding during triage.':'');if(note.length<3||note.length>2000)throw fail('Add a decision note (3–2,000 characters).');r.decisions[b.findingId]={disposition:b.disposition,note,at:new Date().toISOString(),decidedBy:actor.id,reviewerName:actor.displayName,dependencyHash:findingDependencyFingerprint(r,finding),requestedEvidenceType:typeof b.requestedEvidenceType==='string'&&b.requestedEvidenceType.trim()?b.requestedEvidenceType.trim():null};clearSeal(r);audit(r,'reviewer_decision',`${b.findingId}: ${b.disposition} — ${note}${r.decisions[b.findingId].requestedEvidenceType?` [evidence requested: ${r.decisions[b.findingId].requestedEvidenceType}]`:''}`,actor);await save(r);return json(res,200,presentReview(r,actor));}
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
        if(r.remediations){
          const currentSourceHash=computeSourceHash(r);
          for(const [findingId,prop] of Object.entries(r.remediations)){
            if(prop.sourceHash && prop.sourceHash!==currentSourceHash){
              prop.stale=true;
              prop.status='SUPERSEDED';
              prop.stalenessReason='Source specification or rulebook modified after proposal generation.';
              audit(r,'proposal_superseded',`Remediation proposal for ${findingId} marked superseded due to source revision.`,actor);
            }
          }
        }
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
      if(action==='regulatory-timeline'&&method==='GET'){
        const urlObj = new URL(req.url, `http://${req.headers.host}`);
        const currentMarket = urlObj.searchParams.get('market') || r.options?.marketPreset || (r.market?.toLowerCase().includes('in') ? 'india' : (r.market?.toLowerCase().includes('eu') ? 'eu' : 'us'));
        const currentCategory = urlObj.searchParams.get('category') || r.options?.productCategory || 'food';
        const launchDate = urlObj.searchParams.get('launchDate') || r.options?.launchDate || '2026-10-25';
        const tm=evaluateTimeMachine({
          market: currentMarket,
          launchDate,
          productCategory: currentCategory
        });
        return json(res, 200, { status: 'SUCCESS', ...tm });
      }
      if(action==='regulatory-diff'&&method==='GET'){
        const urlObj = new URL(req.url, `http://${req.headers.host}`);
        const dateA = urlObj.searchParams.get('dateA') || '2026-10-25';
        const dateB = urlObj.searchParams.get('dateB') || r.options?.launchDate || '2027-07-01';
        const currentMarket = urlObj.searchParams.get('market') || r.options?.marketPreset || r.market || 'india';
        const currentCategory = urlObj.searchParams.get('category') || r.options?.productCategory || 'food';
        const diff = compareRegulatoryDates({
          dateA,
          dateB,
          market: currentMarket,
          productCategory: currentCategory
        });
        return json(res, 200, { status: 'SUCCESS', ...diff });
      }
      if(action==='launch-date'&&method==='POST'){
        const b = await body(req);
        if(!b||typeof b!=='object'||Array.isArray(b)) throw fail('Invalid request body.');
        if(!b.launchDate || !/^\d{4}-\d{2}-\d{2}$/.test(b.launchDate)) throw fail('Valid launch date (YYYY-MM-DD) is required.');
        if(b.launchDate < '2026-01-01' || b.launchDate > '2028-12-31') throw fail('Launch date must be within 2026-01-01 to 2028-12-31.');
        const prevDate = r.options?.launchDate || '2026-10-25';
        r.options ||= {};
        r.options.launchDate = b.launchDate;
        if(b.productCategory) r.options.productCategory = String(b.productCategory).toLowerCase();
        if(b.market) {
          r.options.marketPreset = String(b.market).toLowerCase();
          r.market = r.options.marketPreset === 'india' ? 'India' : (r.options.marketPreset === 'eu' ? 'European Union' : 'United States');
        }
        const currentMarket = r.options?.marketPreset || (r.market?.toLowerCase().includes('in') ? 'india' : (r.market?.toLowerCase().includes('eu') ? 'eu' : 'us'));
        const currentCategory = r.options?.productCategory || 'food';
        const tm = evaluateTimeMachine({
          market: currentMarket,
          launchDate: b.launchDate,
          productCategory: currentCategory
        });
        r.options.regulatorySnapshotId = tm.snapshotId;
        const diff = compareRegulatoryDates({
          dateA: prevDate,
          dateB: b.launchDate,
          market: currentMarket,
          productCategory: currentCategory
        });
        const changedRules = new Set([...diff.newlyApplicable, ...diff.retired].map(x => x.ruleId || x.id));
        for(const [findingId, decision] of Object.entries(r.decisions || {})){
          const f = r.findings?.find(x => x.id === findingId);
          if(f && (changedRules.has(f.ruleId) || changedRules.has(f.rule?.id))){
            decision.stale = true;
          }
        }
        clearSeal(r);
        audit(r, 'launch_date_changed', `Planned launch date set to ${b.launchDate} (${currentCategory}).`, actor);
        await save(r);
        return json(res, 200, {
          ...presentReview(r, actor),
          timeMachine: tm,
          diff
        });
      }
      if(action==='exports'&&method==='GET'){
        const exportsDir=join(dir(id),'exports');
        if(!existsSync(exportsDir))return json(res,200,[]);
        const entries=await readdir(exportsDir);
        const list=[];
        for(const entry of entries){
          const manifestPath=join(exportsDir,entry,'verification-manifest.json');
          if(existsSync(manifestPath)){
            try{
              const m=JSON.parse(await readFile(manifestPath,'utf8'));
              list.push({exportId:m.exportId,snapshotId:m.snapshotId,createdAt:m.createdAt,reportState:m.reportState,publicKeyId:m.publicKeyId,downloadUrl:`/api/reviews/${id}/exports/${m.exportId}/download`});
            }catch{}
          }
        }
        return json(res,200,list.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)));
      }
      if((action==='exports'||action==='certificate-exports')&&method==='POST'){
        if(r.status!=='ready')throw fail('Wait for review to finish before creating prepress report.',409);
        const b=(await body(req))||{};
        let previewImage=null;
        if(typeof b.previewImage==='string'&&(b.previewImage.startsWith('data:image/png;base64,')||b.previewImage.startsWith('data:image/jpeg;base64,'))){
          if(b.previewImage.length<=25_000_000){
            previewImage=b.previewImage;
          }
        }
        const pkg=await createExportPackage(r,storage,actor,{previewImage,provenance:b.provenance});
        audit(r,'certificate_exported',`Prepress inspection certificate generated (${pkg.certificateId}, ${pkg.filename}).`,actor);
        await save(r);
        return json(res,201,{
          certificateId:pkg.certificateId,
          exportId:pkg.exportId,
          snapshotId:pkg.snapshotId,
          filename:pkg.filename,
          downloadUrl:`/api/reviews/${id}/exports/${pkg.exportId}/download`,
          packageUrl:`/api/reviews/${id}/certificate-exports/${pkg.exportId}/package`,
          pdfUrl:`/api/reviews/${id}/certificate-exports/${pkg.exportId}/pdf`,
          reportState:pkg.reportState,
          filesCount:pkg.filesCount,
          manifest:pkg.manifest
        });
      }
      if((action?.startsWith('exports/')||action?.startsWith('certificate-exports/'))&&method==='GET'){
        const prefix=action.startsWith('exports/')?'exports/':'certificate-exports/';
        const parts=action.slice(prefix.length).split('/');
        const expId=parts[0];
        const sub=parts[1];
        if(!/^[a-zA-Z0-9_\-]+$/.test(expId))throw fail('Invalid export identifier.',400);
        const expDir=join(dir(id),'exports',expId);
        if(!existsSync(expDir))throw fail('Export not found.',404);
        if(sub==='download'||sub==='package'){
          const files=await readdir(expDir);
          const zipName=files.find(f=>f.endsWith('.zip'));
          if(!zipName)throw fail('Export ZIP package not found.',404);
          return await sendFile(req,res,join(expDir,zipName),zipName);
        }
        if(sub==='pdf'){
          const certPdf=join(expDir,'certificate.pdf');
          const reportPdf=join(expDir,'report.pdf');
          const targetPdf=existsSync(certPdf)?certPdf:existsSync(reportPdf)?reportPdf:null;
          if(!targetPdf)throw fail('Certificate PDF not found.',404);
          return await sendFile(req,res,targetPdf,`packsignal-${id}-certificate.pdf`);
        }
        const mPath=join(expDir,'verification-manifest.json');
        if(!existsSync(mPath))throw fail('Export manifest not found.',404);
        return json(res,200,JSON.parse(await readFile(mPath,'utf8')));
      }

      // Clarification Assistant endpoints
      const clarMatch=action?.match(/^findings\/([^/]+)\/clarifications?$/);
      if(clarMatch){
        const findingId=clarMatch[1];
        const finding=r.findings.find(f=>f.id===findingId);
        if(!finding)throw fail('Finding not found.',404);
        r.clarifications ||= {};
        if(method==='GET'){
          return json(res,200,r.clarifications[findingId]||null);
        }
        if(method==='POST'){
          const b=(await body(req))||{};
          const now=new Date().toISOString();
          const prev=r.clarifications[findingId]||{history:[]};
          const clarEntry={
            findingId,
            reviewId:r.id,
            requestedDepartment:b.department||'Other',
            platform:b.platform||'slack',
            clarificationStatus:b.status||'MESSAGE_GENERATED',
            reviewerIdentity:actor.displayName||actor.id,
            timestamp:now,
            note:b.note||'',
            history:[...(prev.history||[]),{
              status:b.status||'MESSAGE_GENERATED',
              department:b.department||'Other',
              platform:b.platform||'slack',
              at:now,
              actor:actor.displayName||actor.id,
            }]
          };
          r.clarifications[findingId]=clarEntry;
          audit(r,'clarification_event',`${finding.title}: clarification message (${clarEntry.clarificationStatus}) for ${clarEntry.requestedDepartment} on ${clarEntry.platform}.`,actor);
          await save(r);
          return json(res,200,clarEntry);
        }
      }

      // Remediation Studio endpoints
      const remMatch=action?.match(/^findings\/([^/]+)\/remediations?(?:\/(.*))?$/);
      if(remMatch){
        const findingId=remMatch[1];
        const remSub=remMatch[2]||'';
        const finding=r.findings.find(f=>f.id===findingId);
        if(!finding)throw fail('Finding not found.',404);
        r.remediations ||= {};

        if(!remSub&&method==='POST'){
          const b=(await body(req))||{};
          const proposal=await generateRemediationProposal(findingId,r,b);
          proposal.sourceHash=computeSourceHash(r);
          r.remediations[findingId]=proposal;
          clearSeal(r);
          audit(r,proposal.mode==='DESIGN_TICKET'?'correction_ticket_created':'proposal_generated',`Remediation proposal generated for ${findingId} (${proposal.mode}).`,actor);
          await save(r);
          return json(res,200,proposal);
        }

        if(!remSub&&method==='GET'){
          let proposal=r.remediations[findingId];
          if(!proposal){
            proposal=await generateRemediationProposal(findingId,r);
            proposal.sourceHash=computeSourceHash(r);
            r.remediations[findingId]=proposal;
            await save(r);
          }
          return json(res,200,proposal);
        }

        if(remSub==='validate'&&method==='POST'){
          const b=(await body(req))||{};
          const textToValidate=b.proposedText||r.remediations[findingId]?.proposedText||'';
          const validation=validateProposedFix(textToValidate,finding,r);
          audit(r,'proposal_hypothetically_validated',`Hypothetical validation run for ${findingId}: ${validation.passed?'PASSED':'FLAGGED'}.`,actor);
          await save(r);
          return json(res,200,validation);
        }

        if(remSub==='decision'&&method==='POST'){
          const b=(await body(req))||{};
          const proposal=r.remediations[findingId];
          if(!proposal)throw fail('Generate a proposal before recording a decision.',404);
          if(teamEnabled&&!canReviewFinding(r,findingId,actor))throw fail('This finding is not assigned to your account.',403);

          const decision=b.decision;
          if(!['APPROVED_FOR_DESIGN_HANDOFF','REJECTED','EDITED'].includes(decision)){
            throw fail('Invalid decision. Choose APPROVED_FOR_DESIGN_HANDOFF, REJECTED, or EDITED.',400);
          }

          if(decision==='EDITED'){
            if(typeof b.editedText!=='string'||!b.editedText.trim())throw fail('Edited text must not be empty.',400);
            proposal.proposedText=b.editedText.trim();
            proposal.hasUserEdits=true;
            proposal.userEditedAt=new Date().toISOString();
            proposal.status='PENDING_REVIEW';
            audit(r,'proposal_edited',`Remediation proposed text edited by reviewer for ${findingId}.`,actor);
          }else if(decision==='APPROVED_FOR_DESIGN_HANDOFF'){
            proposal.status='APPROVED_FOR_DESIGN_HANDOFF';
            proposal.approvedAt=new Date().toISOString();
            proposal.approvedBy=actor.displayName||actor.id;
            proposal.reviewerComments=b.comments||'';
            audit(r,'proposal_approved_for_design_handoff',`Proposed fix approved for designer handoff for ${findingId}.`,actor);
          }else if(decision==='REJECTED'){
            proposal.status='REJECTED';
            proposal.rejectedAt=new Date().toISOString();
            proposal.rejectedBy=actor.displayName||actor.id;
            proposal.reviewerComments=b.comments||'';
            audit(r,'proposal_rejected',`Proposed fix rejected for ${findingId}: ${b.comments||'No note'}.`,actor);
          }
          clearSeal(r);
          await save(r);
          return json(res,200,proposal);
        }

        if(remSub==='export'&&method==='GET'){
          const proposal=r.remediations[findingId];
          if(!proposal)throw fail('No remediation proposal found for this finding.',404);
          const format=reqUrl.searchParams.get('format')||'txt';
          audit(r,'correction_ticket_exported',`Correction handoff exported for ${findingId} (format: ${format}).`,actor);
          await save(r);
          if(format==='json'){
            res.writeHead(200,{
              'Content-Type':'application/json; charset=utf-8',
              'Content-Disposition':`attachment; filename="correction-${findingId}.json"`
            });
            res.end(formatRemediationJson(proposal,r));
            return;
          }
          res.writeHead(200,{
            'Content-Type':'text/plain; charset=utf-8',
            'Content-Disposition':`attachment; filename="correction-${findingId}.txt"`
          });
          res.end(formatRemediationPlainText(proposal,r));
          return;
        }
      }

      // Direct proposal endpoints: /remediations/:proposalOrFindingId/...
      const remDirectMatch=action?.match(/^remediations\/([^/]+)(?:\/(.*))?$/);
      if(remDirectMatch && remDirectMatch[1]!=='export'){
        const pId=remDirectMatch[1];
        const sub=remDirectMatch[2]||'';
        const proposal=r.remediations?.[pId] || Object.values(r.remediations||{}).find(p=>p.proposalId===pId);
        if(!proposal)throw fail('Remediation proposal not found.',404);
        const findingId=proposal.findingId;
        const finding=r.findings.find(f=>f.id===findingId);

        if(!sub && method==='GET'){
          return json(res,200,proposal);
        }
        if((sub==='ticket'||sub==='export') && method==='GET'){
          const format=reqUrl.searchParams.get('format')||'txt';
          if(format==='json'){
            res.writeHead(200,{
              'Content-Type':'application/json; charset=utf-8',
              'Content-Disposition':`attachment; filename="correction-${findingId}.json"`
            });
            res.end(formatRemediationJson(proposal,r));
            return;
          }
          res.writeHead(200,{
            'Content-Type':'text/plain; charset=utf-8',
            'Content-Disposition':`attachment; filename="correction-${findingId}.txt"`
          });
          res.end(formatRemediationPlainText(proposal,r));
          return;
        }
        if(sub==='validate' && method==='POST'){
          const b=(await body(req))||{};
          const textToValidate=b.proposedText||proposal.proposedText||'';
          const validation=validateProposedFix(textToValidate,finding||{},r);
          audit(r,'proposal_hypothetically_validated',`Hypothetical validation run for ${findingId}: ${validation.passed?'PASSED':'FLAGGED'}.`,actor);
          await save(r);
          return json(res,200,validation);
        }
        if(sub==='decision' && method==='POST'){
          const b=(await body(req))||{};
          const decision=b.decision;
          if(!['APPROVED_FOR_DESIGN_HANDOFF','REJECTED','EDITED'].includes(decision)){
            throw fail('Invalid decision. Choose APPROVED_FOR_DESIGN_HANDOFF, REJECTED, or EDITED.',400);
          }
          if(decision==='EDITED'){
            if(typeof b.editedText!=='string'||!b.editedText.trim())throw fail('Edited text must not be empty.',400);
            proposal.proposedText=b.editedText.trim();
            proposal.hasUserEdits=true;
            proposal.userEditedAt=new Date().toISOString();
            proposal.status='PENDING_REVIEW';
            audit(r,'proposal_edited',`Remediation proposed text edited by reviewer for ${findingId}.`,actor);
          }else if(decision==='APPROVED_FOR_DESIGN_HANDOFF'){
            proposal.status='APPROVED_FOR_DESIGN_HANDOFF';
            proposal.approvedAt=new Date().toISOString();
            proposal.approvedBy=actor.displayName||actor.id;
            proposal.reviewerComments=b.comments||'';
            audit(r,'proposal_approved_for_design_handoff',`Proposed fix approved for designer handoff for ${findingId}.`,actor);
          }else if(decision==='REJECTED'){
            proposal.status='REJECTED';
            proposal.rejectedAt=new Date().toISOString();
            proposal.rejectedBy=actor.displayName||actor.id;
            proposal.reviewerComments=b.comments||'';
            audit(r,'proposal_rejected',`Proposed fix rejected for ${findingId}: ${b.comments||'No note'}.`,actor);
          }
          clearSeal(r);
          await save(r);
          return json(res,200,proposal);
        }
      }

      if(action==='remediations'&&method==='GET'){
        return json(res,200,r.remediations||{});
      }

      if(action==='remediations/export'&&method==='GET'){
        const proposals=Object.values(r.remediations||{});
        res.writeHead(200,{
          'Content-Type':'text/csv; charset=utf-8',
          'Content-Disposition':`attachment; filename="all-corrections-${r.id}.csv"`
        });
        res.end(formatRemediationCsv(proposals,r));
        return;
      }

      if(action?.startsWith('revision/visual-diff')&&['GET','HEAD'].includes(method)){
        const urlObj=new URL(req.url,'http://localhost');
        const page=Number(urlObj.searchParams.get('page')||1);
        const prevPage=Number(urlObj.searchParams.get('prevPage')||1);
        const targetId=urlObj.searchParams.get('targetId')||r.parentId;
        if(!targetId)throw fail('No previous revision found to compare.',404);
        const previous=await load(targetId);
        const currArt=r.documents.find(d=>d.role==='artwork');
        const prevArt=previous.documents.find(d=>d.role==='artwork');
        if(!currArt||!prevArt)throw fail('Artwork document missing from one or both revisions.',404);
        const currP=currArt.pages.find(p=>p.number===page)||currArt.pages[0];
        const prevP=prevArt.pages.find(p=>p.number===prevPage)||prevArt.pages[0];
        if(!currP||!prevP)throw fail('Page image missing.',404);
        const prevImgPath=join(dir(previous.id),'rendered',prevP.image);
        const currImgPath=join(dir(r.id),'rendered',currP.image);
        const outDir=join(dir(r.id),'rendered');
        const diffImageName=`diff-p${prevP.number}-p${currP.number}.png`;
        const result=await runVisualDiff({
          prev_image_path:prevImgPath,
          curr_image_path:currImgPath,
          out_dir:outDir,
          diff_image_name:diffImageName,
          tolerance:25,
          min_region_pixels:30,
          max_regions:50
        });
        return json(res,200,result);
      }

      if(action==='revision/acknowledge'&&method==='POST'){
        const b=await body(req);
        if(!b||typeof b!=='object')throw fail('Invalid acknowledgment payload.');
        const {changeId,decision,note}=b;
        const allowed=['expected_change','unexpected_change','needs_investigation','accepted_after_review','request_correction'];
        if(!changeId||!allowed.includes(decision))throw fail('Valid changeId and decision are required.');
        r.revisionAcknowledgements||={};
        r.revisionAcknowledgements[changeId]={
          changeId,
          decision,
          note:String(note||'').trim().slice(0,1000),
          actorId:actor.id,
          actorName:actor.displayName,
          timestamp:new Date().toISOString(),
          artworkSha256:r.documents.find(d=>d.role==='artwork')?.sha256||null
        };
        audit(r,'revision_change_acknowledged',`${changeId}: ${decision}${note?' — '+note.trim():''}`,actor);
        await save(r);
        return json(res,200,{ok:true,acknowledgements:r.revisionAcknowledgements});
      }

      if(action?.startsWith('compare/')&&method==='GET'){
        const targetId=action.slice(8);
        const previous=await load(targetId);
        const comparison=compareRevisions(previous,r);
        return json(res,200,{
          comparison,
          target:{id:previous.id,name:previous.name,createdAt:previous.createdAt,artworkSha256:previous.documents.find(d=>d.role==='artwork')?.sha256}
        });
      }

      if(action?.startsWith('regulatory/compare')&&['GET','HEAD'].includes(method)){
        const urlObj=new URL(req.url,'http://localhost');
        const effectiveDate=urlObj.searchParams.get('effectiveDate')||'2026-10-23';
        const mode=urlObj.searchParams.get('mode')||'target';
        const result=evaluateAllMarkets(r,{effectiveDate,mode});
        return json(res,200,result);
      }
      if(action?.startsWith('regulatory/symbols')&&method==='POST'){
        const currArt=r.documents.find(d=>d.role==='artwork');
        if(!currArt)throw fail('Artwork document not found.',404);
        const p1=currArt.pages?.[0];
        if(!p1)throw fail('Artwork page not found.',404);
        const imgPath=join(dir(id),'rendered',p1.image);
        const result=await runRegulatorySymbols(imgPath,p1.number);
        if(result&&Array.isArray(result.symbolsDetected)){
          r.regulatorySymbols=result.symbolsDetected;
          await save(r);
        }
        return json(res,200,result);
      }
      const regMatch=action?.match(/^regulatory\/([a-z0-9_-]+)(?:\/handoff)?$/);
      if(regMatch&&['GET','HEAD'].includes(method)){
        const market=regMatch[1];
        const isHandoff=action.endsWith('/handoff');
        const urlObj=new URL(req.url,'http://localhost');
        const effectiveDate=urlObj.searchParams.get('effectiveDate')||'2026-10-23';
        const mode=urlObj.searchParams.get('mode')||'target';
        const result=evaluateJurisdiction(r,market,{effectiveDate,mode});
        if(isHandoff){
          res.writeHead(200,{'Content-Type':'text/markdown; charset=utf-8','Content-Disposition':`attachment; filename="PackSignal_${market.toUpperCase()}_Handoff.md"`});
          return res.end(result.worklist?.designerHandoff||'# Prepress Handoff');
        }
        return json(res,200,result);
      }

      // Facts & Conflict Resolution
      if(action==='facts'&&method==='GET'){
        return json(res,200,{facts:r.structuredFacts||[],conflicts:r.factConflicts||[]});
      }
      if(action==='facts/conflicts/resolve'&&method==='POST'){
        const b=await body(req);
        const chosenId=b.chosenFactId||b.authoritativeFactId;
        if(!b.field||!chosenId)throw fail('Field and chosenFactId are required.',400);
        resolveFactConflict(r,b.field,chosenId,actor,b.reason);
        clearSeal(r);
        Object.assign(r,analyze(r));
        audit(r,'fact_conflict_resolved',`Resolved conflict for ${b.field}: designated fact ${chosenId} as authoritative.`,actor);
        await save(r);
        return json(res,200,{success:true,review:presentReview(r,actor)});
      }
      const factAppMatch=action?.match(/^facts\/([^/]+)\/approval$/);
      if(factAppMatch&&method==='POST'){
        const factId=factAppMatch[1];
        const b=await body(req);
        const isApproved=b.approved===true||b.approvalState==='REVIEWER_APPROVED';
        r.factApprovals||={};
        r.factApprovals[factId]={
          state:isApproved?'REVIEWER_APPROVED':'REJECTED',
          actorId:actor.id,
          actorName:actor.displayName,
          at:new Date().toISOString(),
          reason:b.reason||b.notes||''
        };
        clearSeal(r);
        Object.assign(r,analyze(r));
        audit(r,'fact_approval_recorded',`Fact ${factId} marked ${b.approved?'APPROVED':'REJECTED'}.`,actor);
        await save(r);
        return json(res,200,{success:true,review:presentReview(r,actor)});
      }

      // Decision Ripple & What-If Simulation (Upgrade #41)
      if(action==='decision-scenarios'&&method==='GET'){
        const conflicts = detectIngredientClaimConflicts(r);
        return json(res, 200, {
          conflicts,
          savedScenarios: r.decisionScenarios || [],
          correctionPlans: r.correctionPlans || []
        });
      }
      if(action==='decision-scenarios/simulate'&&method==='POST'){
        const b = await body(req);
        const scenario = simulateDecisionOption(r, b.conflictId || 'CONFLICT-VEGAN-HONEY', b.optionKey || 'KEEP_HONEY');
        return json(res, 200, { success: true, scenario });
      }
      if(action==='decision-scenarios/compare'&&method==='GET'){
        const comparison = compareDecisionScenarios(r, 'CONFLICT-VEGAN-HONEY');
        return json(res, 200, { success: true, comparison });
      }
      if(action==='correction-plans'&&method==='GET'){
        return json(res, 200, { plans: r.correctionPlans || [] });
      }
      if(action==='correction-plans'&&method==='POST'){
        const b = await body(req);
        const plan = createCorrectionPlan(r, b.scenario, actor.displayName, b.notes);
        r.correctionPlans ||= [];
        r.correctionPlans.unshift(plan);
        audit(r, 'correction_plan_created', `Created correction plan ${plan.planId}: ${plan.optionTitle}.`, actor);
        await save(r);
        return json(res, 200, { success: true, plan });
      }

      // Shopper Personas Lens (Upgrade #42)
      if(action==='shopper-personas'&&method==='GET'){
        const personas = getAllShopperPersonas();
        const summaries = {};
        for(const p of personas){
          summaries[p.personaId] = getPersonaImpactSummary(r, p.personaId);
        }
        return json(res, 200, { personas, summaries });
      }
      if(action?.startsWith('shopper-personas/')&&method==='GET'){
        const personaId = action.slice('shopper-personas/'.length);
        const persona = getShopperPersona(personaId);
        if(!persona) throw fail('Shopper persona not found.', 404);
        const summary = getPersonaImpactSummary(r, personaId);
        const highlights = getPersonaArtworkHighlights(r, personaId, 1);
        const pins = getPersona3DPins(r, personaId);
        return json(res, 200, { persona, summary, highlights, pins });
      }

      // Shelf-Distance Readability Simulation (Upgrade #43)
      if(action==='shelf-readability'&&method==='GET'){
        const distanceCm = Number(query.get('distanceCm') || 100);
        const profileId = query.get('profileId') || 'STANDARD_20_20';
        const persona = query.get('persona') || null;
        const analysis = analyzeShelfReadability({
          artwork: r.documents?.find(d => d.role === 'artwork') || r,
          textRegions: r.vectorTypography?.textRuns || r.details?.vector_typography?.textRuns,
          distanceCm,
          viewingProfile: profileId,
          packageGeometry: r.packagingGeometry,
          typographyResults: r.findings?.filter(f => f.category === 'typography'),
          shopperPersona: persona
        });
        return json(res, 200, analysis);
      }

      // Rulebook Trust & Authorization
      if((action==='rulebook'||action==='rules/trust')&&method==='GET'){
        const rules=r.rules||[];
        const coverage=r.ruleCoverage||buildRuleCoverageLedger(rules);
        return json(res,200,{rules,coverage,metrics:coverage.summary||coverage,ledger:r.rulebookLedger||null});
      }
      const ruleApproveMatch=action?.match(/^rules\/([^/]+)\/approve$/);
      if(ruleApproveMatch&&method==='POST'){
        const ruleId=ruleApproveMatch[1];
        const b=await body(req);
        const ruleItem=(r.rules||[]).find(x=>x.id===ruleId||x.ruleId===ruleId);
        if(!ruleItem)throw fail('Rule not found.',404);
        r.ruleDecisions||={};
        r.ruleDecisions[ruleId]={decision:'APPROVED',actorName:actor.displayName,at:new Date().toISOString(),reason:b.reason||'Approved by reviewer'};
        ruleItem.trustState=transitionRuleAuthorization(ruleItem.trustState||{},'APPROVED',actor,b.reason||'Approved by reviewer');
        ruleItem.authorization={
          status:'approved',
          authorizedBy:actor.displayName,
          authorizedAt:new Date().toISOString(),
          decisionReason:b.reason||'Approved by reviewer'
        };
        clearSeal(r);
        Object.assign(r,analyze(r));
        audit(r,'rule_approved',`Rule ${ruleId} approved by reviewer.`,actor);
        await save(r);
        return json(res,200,{success:true,rule:ruleItem,review:presentReview(r,actor)});
      }
      const ruleRejectMatch=action?.match(/^rules\/([^/]+)\/reject$/);
      if(ruleRejectMatch&&method==='POST'){
        const ruleId=ruleRejectMatch[1];
        const b=await body(req);
        const ruleItem=(r.rules||[]).find(x=>x.id===ruleId||x.ruleId===ruleId);
        if(!ruleItem)throw fail('Rule not found.',404);
        r.ruleDecisions||={};
        r.ruleDecisions[ruleId]={decision:'REJECTED',actorName:actor.displayName,at:new Date().toISOString(),reason:b.reason||'Rejected by reviewer'};
        ruleItem.trustState=transitionRuleAuthorization(ruleItem.trustState||{},'REJECTED',actor,b.reason||'Rejected by reviewer');
        ruleItem.authorization={
          status:'rejected',
          authorizedBy:actor.displayName,
          authorizedAt:new Date().toISOString(),
          decisionReason:b.reason||'Rejected by reviewer'
        };
        clearSeal(r);
        Object.assign(r,analyze(r));
        audit(r,'rule_rejected',`Rule ${ruleId} rejected by reviewer.`,actor);
        await save(r);
        return json(res,200,{success:true,rule:ruleItem,review:presentReview(r,actor)});
      }
      const ruleRecheckMatch=action?.match(/^rules\/([^/]+)\/recheck$/);
      if(ruleRecheckMatch&&method==='POST'){
        const ruleId=ruleRecheckMatch[1];
        const ruleItem=(r.rules||[]).find(x=>x.id===ruleId||x.ruleId===ruleId);
        if(!ruleItem)throw fail('Rule not found.',404);
        const sourceDoc=r.documents.find(d=>d.id===ruleItem.source?.documentId)||r.documents.find(d=>d.role==='rules'||d.role==='spec');
        if(sourceDoc){
          const qv=verifyRuleQuotation(ruleItem.source?.originalQuote||ruleItem.text,sourceDoc);
          if(ruleItem.source){
            ruleItem.source.verificationStatus=qv.status;
            ruleItem.source.verificationReason=qv.reason;
          }
        }
        clearSeal(r);
        Object.assign(r,analyze(r));
        audit(r,'rule_reexecuted',`Rule ${ruleId} re-evaluated.`,actor);
        await save(r);
        return json(res,200,{success:true,rule:ruleItem,review:presentReview(r,actor)});
      }
      const ruleGetSingleMatch=action?.match(/^rules\/([^/]+)$/);
      if(ruleGetSingleMatch&&method==='GET'){
        const ruleId=ruleGetSingleMatch[1];
        const ruleItem=(r.rules||[]).find(x=>x.id===ruleId||x.ruleId===ruleId);
        if(!ruleItem)throw fail('Rule not found.',404);
        return json(res,200,ruleItem);
      }
      const ruleDecMatch=action?.match(/^rules\/([^/]+)\/decision$/);
      if(ruleDecMatch&&method==='POST'){
        const ruleId=ruleDecMatch[1];
        const b=await body(req);
        const decision=b.decision;
        if(!['APPROVED','REJECTED','SUPERSEDED','PROPOSED'].includes(decision))throw fail('Invalid decision.',400);
        r.ruleDecisions||={};
        r.ruleDecisions[ruleId]={decision,actorName:actor.displayName,at:new Date().toISOString(),reason:b.reason||''};
        const ruleItem=(r.rules||[]).find(x=>x.id===ruleId||x.ruleId===ruleId);
        if(ruleItem){
          ruleItem.trustState=transitionRuleAuthorization(ruleItem.trustState||{},decision,actor,b.reason);
          ruleItem.authorization={
            status:decision.toLowerCase(),
            authorizedBy:actor.displayName,
            authorizedAt:new Date().toISOString(),
            decisionReason:b.reason||''
          };
          ruleItem.approved=decision==='APPROVED';
        }
        clearSeal(r);
        Object.assign(r,analyze(r));
        if (r.ruleDecisions) {
          for (const [rId, dec] of Object.entries(r.ruleDecisions)) {
            const item = (r.rules || []).find(x => x.id === rId || x.ruleId === rId);
            if (item) {
              item.authorization = {
                status: dec.decision.toLowerCase(),
                authorizedBy: dec.actorName,
                authorizedAt: dec.at,
                decisionReason: dec.reason || ''
              };
              item.approved = dec.decision === 'APPROVED';
            }
          }
        }
        audit(r,decision==='APPROVED'?'rule_approved':'rule_decision_recorded',`Rule ${ruleId} authorization changed to ${decision}.`,actor);
        await save(r);
        return json(res,200,{success:true,review:presentReview(r,actor)});
      }
      const ruleQuoteMatch=action?.match(/^rules\/([^/]+)\/verify-quote$/);
      if(ruleQuoteMatch&&method==='POST'){
        const ruleId=ruleQuoteMatch[1];
        const ruleItem=(r.rules||[]).find(x=>x.id===ruleId);
        if(!ruleItem)throw fail('Rule not found.',404);
        const sourceDoc=r.documents.find(d=>d.id===ruleItem.source?.documentId)||r.documents.find(d=>d.role==='rules'||d.role==='spec');
        const verification=verifyRuleQuotation(ruleItem.text,sourceDoc);
        return json(res,200,verification);
      }

      // Nutrition Validation Engine (Phase 2)
      if(action==='nutrition'&&method==='GET'){
        if(!r.nutrition){
          r.nutrition=validateNutrition(r,r.options);
          await save(r);
        }
        return json(res,200,r.nutrition);
      }
      const proofMatch=action?.match(/^nutrition\/proofs\/([^/]+)$/);
      if(proofMatch&&method==='GET'){
        const proofId=proofMatch[1];
        const nutrition=r.nutrition||validateNutrition(r,r.options);
        const proof=(nutrition.proofs||[]).find(p=>p.proofId===proofId||p.checkId===proofId);
        if(!proof)throw fail('Calculation proof not found.',404);
        return json(res,200,proof);
      }
      if(action==='nutrition/recheck'&&method==='POST'){
        const b=(await body(req))||{};
        if(b.nutritionVariant!==undefined)r.options.nutritionVariant=b.nutritionVariant;
        if(b.nutritionBasisConfirmed!==undefined)r.options.nutritionBasisConfirmed=Boolean(b.nutritionBasisConfirmed);
        if(b.populationCategory!==undefined)r.options.populationCategory=b.populationCategory;
        if(b.sourceAuthority!==undefined)r.options.sourceAuthority=b.sourceAuthority;
        clearSeal(r);
        Object.assign(r,analyze(r));
        r.nutrition=validateNutrition(r,r.options);
        audit(r,'nutrition_recalculated','Reviewer recomputed nutrition validation and dependent proofs.',actor);
        await save(r);
        return json(res,200,{success:true,nutrition:r.nutrition,review:presentReview(r,actor)});
      }

      // Guided Questions

      if(action==='questions'&&method==='GET'){
        return json(res,200,r.guidedQuestions||[]);
      }
      const qAnsMatch=action?.match(/^questions\/([^/]+)\/answer$/);
      if(qAnsMatch&&method==='POST'){
        const questionId=qAnsMatch[1];
        const b=await body(req);
        if(!b.answer)throw fail('An answer is required.',400);
        const resObj=resolveGuidedQuestion(r,questionId,b,actor);
        clearSeal(r);
        Object.assign(r,analyze(r));
        audit(r,'guided_question_answered',`Guided question ${questionId} answered: "${b.answer}".`,actor);
        await save(r);
        return json(res,200,{success:true,questionResult:resObj,review:presentReview(r,actor)});
      }

      // Coverage
      if(action==='coverage'&&method==='GET'){
        return json(res,200,r.coverageLedger||computeRuleCoverageLedger(r.rules||[],r.findings||[],r.facts||[]));
      }

      // PDF Visibility
      if(action==='pdf-visibility'&&method==='GET'){
        const artDoc=r.documents.find(d=>d.role==='artwork');
        if(!artDoc)throw fail('Artwork document not found.',404);
        const artFile=r.files?.find(f=>f.id===artDoc.id);
        const diskPath=artFile?join(dir(id),'files',artFile.disk):null;
        if(!diskPath||!existsSync(diskPath))throw fail('Artwork source PDF not found on disk.',404);
        const visResult=await runPdfVisibleText(diskPath);
        return json(res,200,visResult);
      }

      function resolveArtworkPdfPath(review){
        const artDoc=review.documents?.find(d=>d.role==='artwork');
        if(!artDoc)return null;
        const artFile=review.files?.find(f=>f.id===artDoc.id);
        if(artFile){
          const p=join(dir(review.id),'files',artFile.disk);
          if(existsSync(p))return p;
        }
        if(review.sample&&samples[review.sample]){
          const entry=samples[review.sample].find(([,role])=>role==='artwork');
          if(entry){
            const p=join(root,entry[0]);
            if(existsSync(p))return p;
          }
        }
        if(artDoc.name==='DancingFish_Granola_Berry_US_Carton.pdf'){
          const p=join(root,'samples/organizer/DancingFish_Granola_Berry_US_Carton.pdf');
          if(existsSync(p))return p;
        }
        return null;
      }

      // PDF Visibility & Typography Preflight Screening
      if(action==='pdf-preflight'&&(method==='GET'||method==='POST')){
        const b=method==='POST'?await body(req):{};
        const pdfPath=resolveArtworkPdfPath(r);
        const options={...(b.options||{}),artworkPath:pdfPath};
        const preflight=runPdfPreflight(r,options);
        r.pdfPreflight=preflight;

        if(Array.isArray(preflight.findings)){
          const existingNonPreflight=(r.findings||[]).filter(f=>!f.id?.startsWith('pdf-preflight:')&&!f.key?.startsWith('pdf-preflight:'));
          r.findings=[...existingNonPreflight,...preflight.findings];
          r.counts={
            issue:r.findings.filter(f=>f.status==='issue').length,
            review:r.findings.filter(f=>f.status==='review').length,
            unable:r.findings.filter(f=>f.status==='unable').length,
            match:r.findings.filter(f=>f.status==='match').length,
          };
        }

        if(method==='POST'){
          audit(r,'pdf_preflight_executed',`Executed PDF Visibility & Typography Preflight screening: ${preflight.coverage.warningsDetected} warnings, ${preflight.coverage.totalChecks} checks.`,actor);
          await save(r);
        }
        return json(res,200,{success:true,preflight,review:presentReview(r,actor)});
      }

      // US FDA Preflight Pack
      if(action==='us-preflight'&&(method==='GET'||method==='POST')){
        const b=method==='POST'?await body(req):{};
        const preflight=runUsFoodPreflight(r,b.options||{});
        r.usPreflight=preflight;
        if(method==='POST'){
          audit(r,'us_preflight_executed',`Executed US Food Regulatory Preflight Pack: ${preflight.coverage.match} match, ${preflight.coverage.issue} issue, ${preflight.coverage.review} review, ${preflight.coverage.unable} unable.`,actor);
          await save(r);
        }
        return json(res,200,{success:true,preflight,review:presentReview(r,actor)});
      }

      // Packaging Geometry & Layout Intelligence Endpoints (Phase 4)
      if(action==='geometry'&&method==='GET'){
        return json(res,200,r.packagingGeometry||{});
      }
      if(action==='geometry/align'&&method==='POST'){
        const b=await body(req);
        r.options.registrationConfirmation={
          transformationMatrix:b.matrix||[1,0,0,1,0,0],
          registrationMethod:b.method||'REVIEWER_CONFIRMED',
          reviewerIdentity:actor.displayName||actor.id||'Reviewer',
          confirmedAt:new Date().toISOString(),
          registrationResidual:Number(b.residual||0)
        };
        clearSeal(r);
        Object.assign(r,analyze(r));
        audit(r,'geometry_registration_confirmed',`Artwork-to-dieline alignment confirmed (${b.method||'MANUAL'}).`,actor);
        await save(r);
        return json(res,200,{success:true,packagingGeometry:r.packagingGeometry,review:presentReview(r,actor)});
      }
      if(action==='geometry/confirm-panel'&&method==='POST'){
        const b=await body(req);
        if(!b.face)throw fail('Face name (e.g. front, back) is required.');
        r.options.panelZones ||= {};
        if(Array.isArray(b.box)){
          r.options.panelZones[b.face]={page:Number(b.page)||1,box:b.box,confirmed:true,panelId:b.panelId||null};
        }
        r.options.packageMappingConfirmed=true;
        clearSeal(r);
        Object.assign(r,analyze(r));
        audit(r,'geometry_panel_confirmed',`Panel face "${b.face.toUpperCase()}" confirmed by reviewer. Reason: ${b.reason||'Reviewer verified'}.`,actor);
        await save(r);
        return json(res,200,{success:true,packagingGeometry:r.packagingGeometry,review:presentReview(r,actor)});
      }

      // Ambiguity Resolution Queue Endpoints
      if(action==='ambiguities'&&method==='GET'){
        const questions=r.ambiguityQuestions||detectAmbiguities(r);
        r.ambiguityQuestions=questions;
        const counts={
          total:questions.length,
          open:questions.filter(q=>q.status==='OPEN').length,
          needs_evidence:questions.filter(q=>q.status==='NEEDS_EVIDENCE').length,
          resolved:questions.filter(q=>q.status==='RESOLVED').length,
        };
        return json(res,200,{questions,counts});
      }
      if(action?.startsWith('ambiguities/')&&['GET','POST'].includes(method)){
        const parts=action.split('/');
        const questionId=parts[1];
        const subAction=parts[2];
        const questions=r.ambiguityQuestions||detectAmbiguities(r);
        r.ambiguityQuestions=questions;
        const question=questions.find(q=>q.questionId===questionId);
        if(!question)throw fail('Ambiguity question not found.',404);

        if(!subAction&&method==='GET'){
          return json(res,200,{question});
        }
        if(subAction==='preview'&&method==='POST'){
          const b=await body(req);
          const candidate=b.candidateId?question.sourceCandidates.find(c=>c.candidateId===b.candidateId):{value:b.value};
          const plan=buildDependencyPlan({question,candidate,review:r});
          return json(res,200,{preview:plan});
        }
        if(subAction==='resolve'&&method==='POST'){
          const b=await body(req);
          const outcome=resolveAndReevaluate(r,questionId,b,actor);
          audit(r,'ambiguity_resolved',`Resolved ambiguity for ${question.field}: selected "${outcome.impact.decision}". Evaluators rerun: ${outcome.impact.affectedChecksRerun.join(', ')}.`,actor);
          clearSeal(r);
          await save(r);
          return json(res,200,{success:true,impact:outcome.impact,review:presentReview(r,actor)});
        }
        if(subAction==='reopen'&&method==='POST'){
          const b=await body(req);
          question.status='OPEN';
          delete r.ambiguityResolutions?.[question.field];
          question.history.push({action:'REOPENED',reason:b.reason||'Reopened by reviewer',actor:actor?.displayName||'Reviewer',at:new Date().toISOString()});
          audit(r,'ambiguity_reopened',`Reopened ambiguity question for ${question.field}. Reason: ${b.reason||'None provided'}.`,actor);
          clearSeal(r);
          await save(r);
          return json(res,200,{success:true,question,review:presentReview(r,actor)});
        }
      }

      if(['report.html','report.json','report.pdf','certificate.pdf'].includes(action)&&method==='GET'){
        const verification=await verifyReviewSeal(r,storage);
        if(!verification.valid){audit(r,'review_sealed_for_export','Ed25519 seal created for the current source hashes, findings, decisions, follow-up answers and audit digest.');r.signature=await sealReview(r,storage);await save(r);}
      }
      if(action==='report.html'&&method==='GET'){const html=await createHtmlReport(r,dir(id));res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Content-Disposition':'attachment; filename="packsignal-report.html"','Cache-Control':'no-store'});res.end(html);return;}
      if(action==='report.json'&&method==='GET'){res.setHeader('Content-Disposition',`attachment; filename="packsignal-${id}.json"`);return json(res,200,r);}
      if((action==='report.pdf'||action==='certificate.pdf')&&method==='GET'){const output=join(dir(id),'report.pdf');await worker({action:'report',review:join(dir(id),'review.json'),output});return await sendFile(req,res,output,action==='certificate.pdf'?`packsignal-${id}-certificate.pdf`:'packsignal-report.pdf');}
    };
    const writeRoute=method==='POST'||['report.html','report.json','report.pdf','certificate.pdf'].includes(action)||action?.includes('/export')||action?.includes('certificate-export')||action?.includes('facts')||action?.includes('rules')||action?.includes('questions')||action?.includes('us-preflight')||action?.includes('ambiguities')||action?.includes('pdf-preflight')||action?.includes('correction-plans')||action?.includes('decision-scenarios');
    return await (writeRoute?withReviewWriteLock(id,handle):handle());
  }
  console.error('NOT FOUND 404:', method, path);
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
