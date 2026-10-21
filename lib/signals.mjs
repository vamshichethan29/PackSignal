import { createHash } from 'node:crypto';
import { evidence, safeCopyMatch } from './engine.mjs';
import { canonicalGtin, gtinDigits, hasValidGtinCheckDigit, suppliedGtinCandidates } from './gtin.mjs';
const id=s=>createHash('sha256').update(s).digest('hex').slice(0,14);
const languageSignals=[
  ['Spanish',['ingredientes','conservar','contenido neto','consumir preferentemente']],
  ['French',['ingrédients','à conserver','à consommer','voir emballage']],
  ['Hindi',['सामग्री','भंडारण','शुद्ध मात्रा','उपयोग करें']],
  ['Arabic',['المكونات','يحفظ','الوزن الصافي','يفضل استخدام']],
];
const environmentalClaimPatterns=[
  ['Eco-friendly packaging',/\b(?:eco[ -]?friendly|environmentally friendly)\b/ig],
  ['Carbon impact claim',/\bcarbon[- ]?(?:neutral|negative|positive)\b/ig],
  ['Compostability claim',/\b(?:home |industrially )?compostable\b/ig],
  ['Biodegradability claim',/\bbiodegradable\b/ig],
  ['Recyclability claim',/\b(?:100\s*%\s*)?recyclable\b/ig],
  ['Recycled-content claim',/\b(?:made with|contains)\s+\d{1,3}\s*%\s+recycled\s+(?:content|material|plastic|paper|board)\b/ig],
  ['Naturalness claim',/\b(?:100\s*%\s*(?:all[- ]?)?natural|all[- ]natural)\b/ig],
  ['Ocean-plastic claim',/\bocean[- ]?(?:bound )?plastic\b/ig],
  ['Sustainable-packaging claim',/\bsustainable packaging\b/ig],
  ['Zero-waste claim',/\bzero[- ]waste\b/ig],
];

function environmentalClaimFindings(review,art){
  const docs=review.documents||[],registers=docs.filter(doc=>doc.role==='claims');
  const output=[],seen=new Set();
  for(const [label,pattern] of environmentalClaimPatterns){
    pattern.lastIndex=0;
    for(const match of String(art.text||'').matchAll(pattern)){
      const quote=match[0].trim(),key=quote.toLocaleLowerCase();
      if(!quote||seen.has(key))continue;seen.add(key);
      const entry=registers.flatMap(doc=>(Array.isArray(doc.data?.entries)?doc.data.entries:[]).map(item=>({doc,item})))
        .find(({item})=>typeof item.text==='string'&&item.text.toLocaleLowerCase().includes(quote.toLocaleLowerCase()));
      const reference=entry&&['evidence_reference','substantiation','supporting_document','certification_reference']
        .map(field=>entry.item[field]).find(value=>typeof value==='string'&&value.trim());
      const artworkEvidence=evidence(art,quote);
      const sourceEvidence=entry?[evidence(entry.doc,entry.item.text,{location:`Claims register · ${entry.item.claim_id||entry.item.status||'entry'}`})]:[];
      const supportingEvidence=reference?[evidence(entry.doc,reference,{location:`Claims register · supporting reference`})]:[];
      const pages=(art.pages||[]).filter(page=>['ai_transcription','ocr_transcription','vision_needed'].includes(page.method));
      const support=reference
        ?`The supplied claims register lists a supporting reference (“${String(reference).slice(0,180)}”). A reviewer still needs to open it and confirm that it substantiates this exact claim, material, market and package.`
        :'No claim-specific substantiation reference was identified in the supplied files. Request and review supporting evidence before relying on the claim.';
      const visibility=pages.length?' Artwork visibility may also need visual confirmation.':'';
      output.push({
        id:id(`environmental-claim:${key}`),key:`environmental-claim:${key}`,
        title:`Environmental claim needs substantiation review`,status:'review',
        expected:'Claim-specific supporting evidence applicable to this exact claim and package.',
        observed:quote,
        explanation:`A packaging sustainability claim was detected (${label}). ${support} This is an evidence-gap prompt, not a finding that the claim is false or unlawful.${visibility}`,
        evidence:[...sourceEvidence,...supportingEvidence,artworkEvidence],
        rule:{text:'Reviewer prompt: inspect claim-specific substantiation supplied for this package. No universal certification requirement is inferred.'},
        severity:'minor',method:'environmental_claim_review',
      });
    }
  }
  return output;
}

const languageNames={en:'English',es:'Spanish',fr:'French',hi:'Hindi',ar:'Arabic'};
function translationParityFindings(review,art){
  const rows=(review.documents||[]).flatMap(doc=>
    (Array.isArray(doc.data?.translation_pairs)?doc.data.translation_pairs:[])
      .filter(pair=>pair&&pair.required===true&&pair.translations&&typeof pair.translations==='object')
      .map((pair,index)=>({doc,pair,index})));
  return rows.flatMap(({doc,pair,index})=>{
    const translations=Object.entries(pair.translations)
      .filter(([language,phrase])=>/^[a-z]{2}$/i.test(language)&&typeof phrase==='string'&&phrase.trim())
      .map(([language,phrase])=>({language:language.toLowerCase(),phrase:phrase.trim()}));
    if(translations.length<2)return [];
    const checked=translations.map(item=>({...item,found:safeCopyMatch(art.text,item.phrase)}));
    const missing=checked.filter(item=>!item.found);
    const sourceConfirmed=Boolean(review.options?.sourceConfirmed);
    const pages=art.pages||[];
    const imageReading=pages.some(page=>['ai_transcription','ocr_transcription','vision_needed'].includes(page.method)||page.unit==='px');
    const coverageConfirmed=Boolean(review.options?.completeArtwork)&&pages.length>0&&pages.every(page=>page.method==='pdf_text')&&!imageReading;
    const pairApproved=String(pair.status||'').trim().toLocaleUpperCase()==='APPROVED';
    const authorityConfirmed=sourceConfirmed&&pairApproved;
    const status=missing.length
      ?coverageConfirmed?(authorityConfirmed?'issue':'review'):'unable'
      :authorityConfirmed&&!imageReading?'match':'review';
    const identifier=String(pair.id||pair.message||index+1);
    const expected=translations.map(item=>(languageNames[item.language]||item.language.toUpperCase())+': '+item.phrase).join(' · ');
    const observed=checked.map(item=>(languageNames[item.language]||item.language.toUpperCase())+': '+(item.found?'exact supplied wording located':'exact supplied wording not located')).join(' · ');
    const sourceEvidence=translations.map(item=>evidence(doc,item.phrase,{location:'translation_pairs.'+identifier+'.translations.'+item.language}));
    const artworkEvidence=checked.filter(item=>item.found).map(item=>evidence(art,item.phrase));
    let explanation=missing.length
      ?coverageConfirmed
        ?authorityConfirmed
          ?'One or more required, source-supplied language versions were not found in the inspected artwork text. This is an exact-copy comparison against the supplied pair; a reviewer should inspect the cited regions and confirm the correction.'
          :'One or more language versions were not found, but the translation pair is not marked APPROVED and confirmed as authoritative.'
        :'One or more language versions were not found in extracted text. Confirm artwork coverage and inspect the relevant panels before treating this as an omission.'
      :authorityConfirmed
        ?imageReading
          ?'The image transcription contains all supplied language versions. Confirm the visible wording on the original artwork before accepting this comparison.'
          :'All supplied exact phrases were found. This verifies wording presence only; it does not assess whether translations have equivalent legal meaning.'
        :'All supplied exact phrases were found, but the pair is not marked APPROVED and confirmed as authoritative.';
    if(imageReading)explanation+=' Image reading needs visual confirmation against the original pages; it cannot establish that wording is correct or absent.';
    return [{
      id:id('translation-pair:'+doc.id+':'+identifier),key:'translation-pair:'+identifier,
      title:missing.length?'Required bilingual copy needs attention':'Bilingual copy pair check',
      status,expected,observed,explanation,
      evidence:[...sourceEvidence,...artworkEvidence],
      rule:{text:'Exact-copy parity check against reviewer-supplied paired wording. No machine translation or semantic equivalence decision is made.'},
      severity:'minor',method:'translation_pair_exact_copy',
    }];
  });
}

export function signalFindings(review){
  const art=review.documents?.find(d=>d.role==='artwork');if(!art)return [];
  const text=String(art.text||'').toLocaleLowerCase();const results=[];
  for(const [language,cues] of languageSignals){
    const matched=cues.filter(c=>text.includes(c));if(matched.length<2)continue;
    results.push({id:id(`language:${language}:${matched.join('|')}`),key:`language:${language}`,title:`${language} label text detected`,status:'review',expected:'An approved source and reviewer verification for the detected language content.',observed:matched.join(' · '),explanation:`Multiple ${language} packaging cues were detected. PackSignal did not verify translation equivalence, language applicability, typography, or approval.`,evidence:[evidence(art,matched[0])],rule:{text:'Language detection is a review signal, not translation validation.'},severity:'minor',method:'language_detection'});
  }
  const codes=(art.pages||[]).flatMap(page=>(page.codes||[]).map(code=>({page,code})));
  const supplied=suppliedGtinCandidates(review.documents||[]);
  const codeEvidence=(page,code,type)=>({documentId:art.id,name:art.name,role:'artwork',quote:`${type} detected`,page:page.number,box:code.box||null,location:`Page ${page.number}`});
  const sourceEvidence=candidate=>{
    const doc=(review.documents||[]).find(item=>item.id===candidate.documentId);
    return doc?evidence(doc,candidate.value,{location:candidate.location||'Product identifier'}):null;
  };
  for(const {page,code} of codes){
    const type=String(code.format||'code').replace(/^BarcodeFormat\./,'');
    const key=`code:${page.number}:${type}:${JSON.stringify(code.box||[])}`;
    const codeEv=codeEvidence(page,code,type);
    const decoded=gtinDigits(code.gtin);
    if(!decoded){
      results.push({id:id(key),key,title:`${type} detected on artwork`,status:'review',expected:'Reviewer verification of code purpose, print quality, and market or retailer requirements.',observed:`${type} detected on page ${page.number}${code.box?' at an approximate location':''}; no GTIN was isolated.`,explanation:'A code was detected, but it did not contain a locally recognized GTIN representation. PackSignal does not retain or follow arbitrary barcode or QR payloads. A reviewer must check code purpose, scan quality, retail assignment, and legal applicability.',evidence:[codeEv],rule:{text:'Code scanning is a review signal. Print quality, legal acceptability, and distribution requirements require human review.'},severity:'minor',method:'barcode_detection'});
      continue;
    }
    const digitCount=decoded.length,valid=hasValidGtinCheckDigit(decoded),canonical=canonicalGtin(decoded);
    const validSources=supplied.filter(item=>hasValidGtinCheckDigit(item.value));
    const sourceKeys=new Set(validSources.map(item=>canonicalGtin(item.value)));
    const invalidSources=supplied.filter(item=>!hasValidGtinCheckDigit(item.value));
    const ambiguous=sourceKeys.size>1;
    let status='review',title='GTIN needs product-record review',expected='One valid GTIN in the supplied product record.',observed=`Decoded GTIN-${digitCount}: ${decoded}.`;
    let explanation='The decoded value has a valid GS1 Mod-10 check digit, but PackSignal could not identify one unambiguous valid GTIN in the supplied product specification. Confirm the intended product record and identifier.';
    if(!valid){status='issue';title='Decoded GTIN has an invalid check digit';expected=`A GTIN-8, GTIN-12, GTIN-13, or GTIN-14 with a valid GS1 Mod-10 check digit.`;observed=`Decoded ${digitCount}-digit value ${decoded}; its check digit does not validate.`;explanation='The decoded GTIN-shaped value fails the deterministic GS1 Mod-10 check-digit calculation. Confirm the artwork code and the source record before release.';}
    else if(ambiguous){observed+=` The supplied product specification contains ${sourceKeys.size} different valid GTINs.`;explanation='The code has a valid check digit, but the supplied specification contains multiple distinct valid GTINs. Confirm which product record and code apply before treating this comparison as a match.';results.push({id:id(`${key}:gtin`),key:`${key}:gtin`,title,status,expected,observed,explanation,evidence:[codeEv,...validSources.map(sourceEvidence).filter(Boolean)],rule:{text:'GTIN length and GS1 Mod-10 check-digit validation; ambiguous product records require human confirmation.'},severity:'minor',method:'gtin_record_check'});}
    else if(validSources.length){
      const expectedSource=validSources[0];
      const expectedCanonical=canonicalGtin(expectedSource.value);
      const sourceEv=validSources.map(sourceEvidence).filter(Boolean);
      if(expectedCanonical===canonical&&!invalidSources.length){status='match';title='Decoded GTIN matches product record';expected=`${expectedSource.value} (${expectedSource.location||expectedSource.name})`;observed=`Decoded GTIN-${digitCount}: ${decoded}; check digit valid and identifier matches the supplied product record.`;explanation='The decoded GTIN has a valid GS1 Mod-10 check digit and matches the unambiguous valid GTIN supplied in the product specification. This confirms identifier consistency only; print quality, legal acceptability, and retail assignment still need human review.';}
      else if(expectedCanonical!==canonical){status='issue';title='Decoded GTIN differs from product record';expected=`${expectedSource.value} (${expectedSource.location||expectedSource.name})`;observed=`Decoded GTIN-${digitCount}: ${decoded}; check digit valid.`;explanation='The decoded GTIN is internally valid, but it does not match the valid GTIN in the supplied product specification. Confirm the intended SKU and correct the source or artwork as appropriate.';}
      else{observed+=` It matches ${expectedSource.value}, but the product record also contains an invalid GTIN-shaped identifier.`;explanation='A valid identifier match was found, but another supplied GTIN-shaped source value has an invalid length or check digit. Confirm the product record before relying on this match.';}
      results.push({id:id(`${key}:gtin`),key:`${key}:gtin`,title,status,expected,observed,explanation,evidence:[codeEv,...sourceEv],rule:{text:'GTIN length and GS1 Mod-10 check-digit validation, followed by exact product-record comparison. Leading-zero padding is normalized across GTIN-8/12/13/14 representations.'},severity:status==='issue'?'major':'minor',method:'gtin_record_check'});
    }else{
      observed+=invalidSources.length?` The supplied product record has no valid GTIN (${invalidSources.map(item=>item.value).join(', ')} failed length or check-digit validation).`:'';
      explanation=invalidSources.length?'The decoded GTIN is valid, but the supplied product record contains only invalid GTIN-shaped values. Confirm the source identifier before comparing it with artwork.':'The decoded GTIN has a valid GS1 Mod-10 check digit, but no explicit GTIN / EAN / UPC / barcode identifier was found in the supplied product specification.';
      results.push({id:id(`${key}:gtin`),key:`${key}:gtin`,title,status,expected,observed,explanation,evidence:[codeEv,...supplied.map(sourceEvidence).filter(Boolean)],rule:{text:'GTIN length and GS1 Mod-10 check-digit validation; comparison is performed only against explicit identifiers in a supplied product specification.'},severity:'minor',method:'gtin_record_check'});
    }
    if(!valid){
      results.push({id:id(`${key}:gtin`),key:`${key}:gtin`,title,status,expected,observed,explanation,evidence:[codeEv],rule:{text:'GTIN length and GS1 Mod-10 check-digit validation.'},severity:'major',method:'gtin_record_check'});
    }
    results.push({id:id(`${key}:human`),key:`${key}:human`,title:'Print quality and barcode applicability need human review',status:'review',expected:'A reviewer confirms print/scan quality and the applicable legal, retailer, and distribution requirements.',observed:`${type} is present on page ${page.number}${valid?' with a decoded GTIN':' with a GTIN-shaped value that needs correction'}.`,explanation:'A successful decode and checksum do not assess quiet zones, contrast, dimensions, print grade, correct retail assignment, legal acceptability, or market-specific requirements. Inspect the original artwork and confirm applicable requirements.',evidence:[codeEv],rule:{text:'Print quality, legal acceptability, and distribution requirements are human checks; PackSignal does not certify them.'},severity:'minor',method:'barcode_human_review'});
  }
  // No decoded code is not a finding by itself: without a supplied requirement,
  // PackSignal cannot know whether a barcode is required or whether decoding
  // failed. Report code findings only when a symbol was actually detected.
  results.push(...environmentalClaimFindings(review,art));
  results.push(...translationParityFindings(review,art));
  return results;
}
