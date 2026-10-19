// One provider credential per request. A retry never switches keys or providers.
const configNumber=(name,fallback,min,max)=>{
  const raw=process.env[name];if(raw===undefined||raw==='')return fallback;
  const value=Number(raw);return Number.isFinite(value)?Math.min(max,Math.max(min,Math.floor(value))):fallback;
};
const limits=()=>({
  maxAttempts:configNumber('GEMINI_MAX_ATTEMPTS',3,1,3),
  sessionLimit:configNumber('GEMINI_MAX_REQUESTS_PER_SESSION',20,1,100),
  maxRequestsPerMinute:configNumber('GEMINI_MAX_REQUESTS_PER_MINUTE',5,1,60),
  minIntervalMs:configNumber('GEMINI_MIN_INTERVAL_MS',6000,1000,60000),
});
let outboundAttempts=0,lastStartedAt=0,cooldownReason='',lastOutcome='No live request yet',poolCooldownUntil=0,poolCooldownScope='';
const keyCooldowns=new Map();
let requestStarts=[];
let serial=Promise.resolve();
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const error=(message,code,retryAt)=>Object.assign(new Error(message),{code,...(retryAt?{retryAt:new Date(retryAt).toISOString()}:{})});

export function projectWindowDelay(requestTimes,now,maxRequestsPerMinute){
  const recent=requestTimes.filter(startedAt=>now-startedAt<60000);
  return recent.length>=maxRequestsPerMinute?Math.max(0,recent[0]+60000-now):0;
}

export function shouldFailoverCredential(err){
  if(['GEMINI_PROJECT_LIMIT','GEMINI_PROVIDER_OVERLOADED','PROJECT_QUOTA_COOLDOWN','PROVIDER_OVERLOAD_COOLDOWN'].includes(err?.code))return false;
  return ['GEMINI_HTTP_429','GEMINI_HTTP_503','PROVIDER_COOLDOWN'].includes(err?.code)||/quota|429|503|unavailable|demand/i.test(String(err?.message||''));
}

export function geminiStatus(configuredCredentials=0){
  const policy=limits();
  const now=Date.now();
  const activeCooldowns=[...keyCooldowns.entries()].filter(([_,time])=>time>now);
  const recent=requestStarts.filter(startedAt=>now-startedAt<60000);
  const cooldowns=activeCooldowns.map(([_,until])=>({until,scope:'credential'}));
  if(poolCooldownUntil>now)cooldowns.push({until:poolCooldownUntil,scope:poolCooldownScope});
  const cooldown=cooldowns.sort((a,b)=>b.until-a.until)[0];
  return {...policy,configuredCredentials,outboundAttempts,remainingAttempts:Math.max(0,policy.sessionLimit-outboundAttempts),
    recentRequests:recent.length,cooldownUntil:cooldown?new Date(cooldown.until).toISOString():null,
    cooldownScope:cooldown?.scope||null,cooldownReason:cooldown?cooldownReason:null,
    lastOutcome,provider:'Gemini',policy:'Shared request pool across configured credentials; rate limits apply to the project, not each API key.'};
}

function providerDelay(response,payload,now){
  const delays=[],header=response.headers.get('retry-after');
  if(header){const seconds=Number(header),date=Date.parse(header);if(Number.isFinite(seconds))delays.push(Math.max(0,seconds*1000));else if(Number.isFinite(date))delays.push(Math.max(0,date-now));}
  const details=Array.isArray(payload?.error?.details)?payload.error.details:[];
  for(const detail of details){
    if(!String(detail?.['@type']||'').endsWith('google.rpc.RetryInfo'))continue;
    const duration=detail.retryDelay;
    if(typeof duration==='string'&&/^\d+(?:\.\d+)?s$/.test(duration))delays.push(Number(duration.slice(0,-1))*1000);
    else if(duration&&typeof duration==='object'){
      const seconds=Number(duration.seconds||0),nanos=Number(duration.nanos||0);
      if(Number.isFinite(seconds)&&Number.isFinite(nanos)&&seconds>=0&&nanos>=0)delays.push(seconds*1000+nanos/1e6);
    }
  }
  return delays.length?Math.max(...delays):null;
}

function classifyQuota(payload){
  const details=Array.isArray(payload?.error?.details)?payload.error.details:[];
  const violations=details.filter(d=>String(d?.['@type']||'').endsWith('google.rpc.QuotaFailure')).flatMap(d=>Array.isArray(d.violations)?d.violations:[]);
  return violations.some(v=>Number(v.quotaValue)===0||/per.?day|daily/i.test(String(v.quotaId||v.quotaMetric||'')));
}

async function send(key,model,body,fetcher){
  const policy=limits(),deadline=Date.now()+120000;let waited=0;
  for(let attempt=1;attempt<=policy.maxAttempts;attempt++){
    if(outboundAttempts>=policy.sessionLimit)throw error('AI reading is paused for this session. Your exact checks are still available. See AI status in Settings.','LOCAL_REQUEST_LIMIT');
    const remainingCooldown=(keyCooldowns.get(key)||0)-Date.now();
    if(remainingCooldown>0)throw error('Gemini credential is cooling down after a provider limit or outage. Alternative keys will be tried if configured.','PROVIDER_COOLDOWN',keyCooldowns.get(key));
    if(poolCooldownUntil>Date.now()){
      const projectLimit=poolCooldownScope==='project';
      throw error(projectLimit?'Gemini project quota is paused across the shared key pool; exact checks remain available.':'Gemini is temporarily overloaded. The shared request pool is paused; exact checks remain available.',projectLimit?'PROJECT_QUOTA_COOLDOWN':'PROVIDER_OVERLOAD_COOLDOWN',poolCooldownUntil);
    }
    while(true){
      const now=Date.now();
      requestStarts=requestStarts.filter(startedAt=>now-startedAt<60000);
      const rateDelay=projectWindowDelay(requestStarts,now,policy.maxRequestsPerMinute);
      const paceDelay=Math.max(0,lastStartedAt+policy.minIntervalMs-now);
      const wait=Math.max(rateDelay,paceDelay);
      if(!wait)break;
      if(now+wait+1000>=deadline)throw error('The bounded AI request time was reached while waiting for the shared request limit. Exact checks remain available.','AI_TIME_LIMIT');
      lastOutcome=rateDelay>=paceDelay?'Waiting for the shared Gemini request limit':'Waiting for provider pacing';
      await pause(wait);
    }
    const timeout=Math.min(60000,deadline-Date.now());
    if(timeout<1000)throw error('The bounded AI request time was reached. Exact checks remain available.','AI_TIME_LIMIT');
    outboundAttempts++;lastStartedAt=Date.now();requestStarts.push(lastStartedAt);lastOutcome='Request in progress';
    let response;
    try{
      response=await fetcher(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{
        method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},signal:AbortSignal.timeout(timeout),body,
      });
    }catch(cause){
      lastOutcome=cause?.name==='TimeoutError'?'Timed out':'Network unavailable';
      throw error(cause?.name==='TimeoutError'?'AI request timed out. It was not retried because the provider may have processed it.':'Could not reach Gemini. Check the connection; exact checks remain available.','AI_CONNECTION');
    }
    let payload;
    try{payload=await response.json();}catch{lastOutcome='Unreadable response';throw error('Gemini returned an unreadable response. Exact checks remain available.','AI_RESPONSE');}
    if(response.ok){lastOutcome='Live request completed';return {payload,transport:{attempts:attempt,cacheHit:false,provider:'Gemini'}};}
    lastOutcome=`HTTP ${response.status}`;
    if(![429,503].includes(response.status)){
      const reasons={400:'Gemini rejected the key, request, or output schema. Check the key and model.',401:'The API key was rejected.',403:'The key or project does not have access.',404:'The configured model is unavailable.',500:'Gemini could not process this request.'};
      throw error(reasons[response.status]||`AI request failed (HTTP ${response.status}).`,'GEMINI_HTTP_'+response.status);
    }
    const hint=providerDelay(response,payload,Date.now()),quotaUnavailable=response.status===429&&classifyQuota(payload);
    const delay=hint??(response.status===429?60000:1000*2**(attempt-1)+Math.floor(Math.random()*500));
    const canRetry=!quotaUnavailable&&attempt<policy.maxAttempts&&outboundAttempts<policy.sessionLimit&&waited+delay<=30000&&Date.now()+Math.max(delay,policy.minIntervalMs)+1000<deadline;
    if(!canRetry){
      // Preserve a provider's requested delay, even when it exceeds our retry budget.
      const cdTime=Date.now()+Math.max(delay,quotaUnavailable?300000:response.status===429?60000:30000);
      if(response.status===503){
        poolCooldownUntil=Math.max(poolCooldownUntil,cdTime);poolCooldownScope='provider';
        cooldownReason='Gemini service temporarily overloaded';
        throw error('Gemini is temporarily overloaded. Requests across all configured credentials are paused; exact checks remain available.','GEMINI_PROVIDER_OVERLOADED',poolCooldownUntil);
      }
      if(response.status===429){
        poolCooldownUntil=Math.max(poolCooldownUntil,cdTime);poolCooldownScope='project';
        cooldownReason='Gemini project quota reached';
        throw error('Gemini project quota reached. The shared key pool is paused; exact checks remain available.','GEMINI_PROJECT_LIMIT',poolCooldownUntil);
      }
      keyCooldowns.set(key,cdTime);
      cooldownReason=response.status===429?'Project/key quota reached':'Provider temporarily unavailable';
      throw error(`${cooldownReason}. Work on this key paused; failover to other configured keys.`,'GEMINI_HTTP_'+response.status,cdTime);
    }
    waited+=delay;lastOutcome=`Waiting before retry ${attempt+1} of ${policy.maxAttempts}`;
    await pause(delay);
  }
}

export function geminiRequest(key,model,body,fetcher=fetch){
  const result=serial.then(async()=>{
    const before=outboundAttempts;
    try{return await send(key,model,body,fetcher);}
    catch(cause){if(cause&&typeof cause==='object')cause.attempts=outboundAttempts-before;throw cause;}
  });serial=result.catch(()=>{});return result;
}
