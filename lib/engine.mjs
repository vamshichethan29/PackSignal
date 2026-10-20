import {marketFindings} from './market-presets.mjs';
import {signalFindings} from './signals.mjs';
import { createHash } from 'node:crypto';
import { boxInsideZone, estimatedHeightMm, nutritionSanityFacts, textHasVisualAllergenCue } from './prepress.mjs';

export const normal = s => String(s ?? '').normalize('NFKC').toLowerCase().replace(/(?<=\d)\.(?=\d)/g,'decimalpoint').replace(/[^\p{L}\p{N}%]+/gu,'');
const flat = s => String(s ?? '').replace(/\s+/g,' ').trim();
const copyTokens = s => String(s ?? '').normalize('NFKC').toLowerCase().replace(/don['’]t/g,'dont').match(/[\p{L}]+|\d+(?:[.,]\d+)?|%/gu)||[];
const hasSequence = (tokens, needle) => needle.length>0&&tokens.some((_,i)=>needle.every((token,j)=>tokens[i+j]===token));
const staleCopy = /\b(?:obsolete|superseded|old copy|previous version|do not use|delete this|removed copy|struck out)\b/i;
const negativeCopy = tokens => {
  const tail=tokens.slice(-5).join(' ');
  return /(?:^| )(?:not|never|avoid|dont|no longer)$/.test(tail)||/(?:^| )do not$/.test(tail)||/(?:^| )must not$/.test(tail);
};
function copyOccurrences(text, phrase){
  const needle=copyTokens(phrase);if(!needle.length)return {positive:[],negative:[],context:[]};
  const paragraphs=String(text??'').split(/\n\s*\n+/);
  const statements=paragraphs.flatMap(page=>page.replace(/\r?\n+/g,' ').split(/(?<=[!?])\s+|(?<!\d)\.(?!\d)\s+/));
  const positive=[],negative=[],context=[];
  for(const statement of statements){
    const tokens=copyTokens(statement);if(!hasSequence(tokens,needle))continue;
    if(staleCopy.test(statement)){context.push(statement.trim());continue;}
    const index=tokens.findIndex((_,i)=>needle.every((token,j)=>tokens[i+j]===token));
    (negativeCopy(tokens.slice(0,index))?negative:positive).push(statement.trim());
  }
  // Exact package copy may legitimately span multiple sentences. Keep the
  // sentence-level checks above for negation/stale-context handling, then
  // look for a contiguous token sequence across wrapped sentence boundaries.
  // This avoids treating an exact multi-sentence storage instruction as a
  // mismatch merely because the PDF text contains a period in the middle.
  if(!positive.length&&!negative.length&&!context.length){
    for(const paragraph of paragraphs){
      const tokens=copyTokens(paragraph.replace(/\r?\n+/g,' '));
      const index=tokens.findIndex((_,i)=>needle.every((token,j)=>tokens[i+j]===token));
      if(index<0)continue;
      const nearby=tokens.slice(Math.max(0,index-10),index+needle.length+10).join(' ');
      if(staleCopy.test(nearby)){context.push(paragraph.trim());continue;}
      const preceding=tokens.slice(Math.max(0,index-6),index);
      (negativeCopy(preceding)?negative:positive).push(paragraph.trim());
    }
  }
  return {positive,negative,context};
}
export function safeCopyMatch(text, phrase){
  const found=copyOccurrences(text,phrase);
  return found.positive.length>0&&found.negative.length===0;
}
export function tokenSequencePresent(text, phrase){return hasSequence(copyTokens(text),copyTokens(phrase));}
export function spreadsheetContext(doc, cell, rowLabel=''){
  if(!cell)return null;
  const cells=(doc.cells||[]).filter(item=>item.sheet===cell.sheet&&String(item.value??'').trim());
  const left=cells.filter(item=>item.row===cell.row&&item.col<cell.col).sort((a,b)=>b.col-a.col)[0];
  const above=cells.filter(item=>item.col===cell.col&&item.row<cell.row&&cell.row-item.row<=8).sort((a,b)=>b.row-a.row)[0];
  const variantHeading=cells.find(item=>item.col===cell.col&&doc.variants?.includes(String(item.value).trim()));
  const identity=cells.filter(item=>item.col<cell.col&&item.row<=cell.row&&cell.row-item.row<=12&&/^(?:sku|variant|flavou?r|product(?: name)?)$/i.test(flat(item.value))).sort((a,b)=>b.row-a.row)[0];
  const identityValue=identity&&cells.find(item=>item.row===identity.row&&item.col===identity.col+1);
  const basis=doc.data?.nutrition?.basis;
  const basisText=typeof basis==='object'&&basis?`per ${basis.value} ${basis.unit}`:basis||cells.filter(item=>item.row<=cell.row&&cell.row-item.row<=12&&/\b(?:serving basis|per serving|nutrition per|per 100\s*(?:ml|g))\b/i.test(String(item.value))).sort((a,b)=>b.row-a.row)[0]?.value||'Not identified in this source';
  return {sheet:cell.sheet,cell:cell.cell,row:cell.row+1,rowLabel:rowLabel||left?.value||'',columnHeading:variantHeading?.value||above?.value||'',productVariant:identityValue?.value||doc.data?.product?.variant||doc.data?.product?.name||'Not identified in this sheet',basis:String(basisText)};
}
const id = s => createHash('sha256').update(s).digest('hex').slice(0,14);
const labels = {
  brand:'Brand', product_name:'Product identity', variant:'Variant', net_quantity:'Net quantity', ingredients:'Ingredients',
  allergen_statement:'Allergen wording', storage_statement:'Storage instructions', manufacturer:'Manufacturer',
  customer_care:'Customer care', recycling_copy:'Recycling statement', marketing_copy:'Marketing copy',
  servings:'Servings per package', serving_size:'Serving size', dietary_information:'Dietary information',
};
export const AI_FACT_FIELDS = new Set([
  'brand','product_name','variant','net_quantity','ingredients','allergen_statement','storage_statement',
  'manufacturer','customer_care','serving_size','servings','nutrition.basis',
  ...['energy_kj','energy_kcal','fat_g','protein_g','carbohydrate_g','sugars_g','salt_g','fibre_g','saturates_g',
    'calories','totalfat','saturatedfat','transfat','cholesterol','sodium','totalcarbohydrate','dietaryfiber',
    'totalsugars','incladdedsugars','protein','vitamind','calcium','iron','potassium'].map(field=>`nutrition.${field}`),
]);
const aliases = new Map(Object.entries({
  brand:'brand',product:'product_name',productname:'product_name',name:'product_name',legalnamestatementofidentity:'product_name',
  variant:'variant',netquantity:'net_quantity',packagesizenetweight:'net_quantity',netweight:'net_quantity',
  ingredients:'ingredients',ingredientlist:'ingredients',allergenstatement:'allergen_statement',allergeninformation:'allergen_statement',allergencopy:'allergen_statement',
  storagecopy:'storage_statement',storageinstructions:'storage_statement',storagestatement:'storage_statement',
  manufacturer:'manufacturer',customercare:'customer_care',recyclingcopy:'recycling_copy',marketingcopy:'marketing_copy',
  numberofservingsperpackage:'servings',servings:'servings',servingsize:'serving_size',dietaryinformation:'dietary_information',
}));
export const quantity = s => {
  const m=String(s).match(/(\d+(?:\.\d+)?)\s*(kg|mg|g|ml|cl|l|oz)\b/i); if(!m)return null;
  const unit=m[2].toLowerCase();return {value:Number(m[1])*({kg:1000,g:1,mg:.001,l:1000,cl:10,ml:1,oz:28.349523125}[unit]),dimension:['l','cl','ml'].includes(unit)?'volume':'mass'};
};
export const equalQuantity=(a,b)=>{const x=quantity(a),y=quantity(b);return x&&y&&x.dimension===y.dimension&&Math.abs(x.value-y.value)<.0001;};
export function evidence(doc, quote, extra={}) {
  const q=copyTokens(quote); let lines=(doc.lines||[]).filter(line=>!extra.page||line.page===extra.page), matches=[];
  const {preferredZone,...evidenceExtra}=extra;
  if(q.length){
    const singleMatches=lines.filter(l=>hasSequence(copyTokens(l.text),q));
    const preferred=preferredZone&&singleMatches.find(l=>l.page===preferredZone.page&&l.box&&boxInsideZone(l.box,preferredZone.box));
    if(preferred)matches=[preferred];
    else if(singleMatches.length)matches=[singleMatches[0]];
  }
  if(q.length&&!matches.length)for(let i=0;i<lines.length;i++){
    let accumulated=[];
    for(let j=i;j<Math.min(lines.length,i+30);j++){
      if(lines[j].page!==lines[i].page)break;
      accumulated.push(...copyTokens(lines[j].text));
      if(hasSequence(accumulated,q)){matches=lines.slice(i,j+1);while(matches.length>1&&hasSequence(matches.slice(1).flatMap(l=>copyTokens(l.text)),q))matches.shift();break;}
      if(accumulated.length>q.length*3+150)break;
    }
    if(matches.length)break;
  }
  const page=extra.page||matches[0]?.page;
  const boxes=matches.map(x=>x.box).filter(Boolean);
  const box=boxes.length?[Math.min(...boxes.map(x=>x[0])),Math.min(...boxes.map(x=>x[1])),Math.max(...boxes.map(x=>x[2])),Math.max(...boxes.map(x=>x[3]))]:null;
  const location=extra.location||(page?`Page ${page}`:matches[0]?.line?`Line ${matches[0].line}`:'Document');
  return {documentId:doc.id,name:doc.name,role:doc.role,quote:flat(quote).slice(0,1400),page,box,location,...evidenceExtra};
}

function addFact(result,doc,key,value,ev,options={}) {
  if(value===null||value===undefined||String(value).trim()==='')return;
  result.push({id:id(doc.id+'|'+key+'|'+String(value)),field:key,label:labels[key]||key.replace('nutrition.','Nutrition · ').replaceAll('_',' '),value:String(value),documentId:doc.id,evidence:ev||evidence(doc,String(value)),...options});
}
export function extractFacts(doc, options={}) {
  const facts=[]; const obj=doc.data;
  if(obj&&typeof obj==='object'&&!Array.isArray(obj)){
    for(const [key,v] of Object.entries(obj.product||{})) {
      const k=aliases.get(normal(key)); if(!k)continue;
      addFact(facts,doc,k,typeof v==='object'?`${v.value} ${v.unit}`:v,evidence(doc,typeof v==='object'?JSON.stringify(v):v,{location:`product.${key}`}));
    }
    if(obj.proposed_net_quantity)addFact(facts,doc,'net_quantity',`${obj.proposed_net_quantity.value} ${obj.proposed_net_quantity.unit}`,evidence(doc,obj.note||JSON.stringify(obj.proposed_net_quantity),{location:'proposed_net_quantity'}));
    if(Array.isArray(obj.facts))for(const f of obj.facts)if(typeof f.field==='string'&&typeof f.value!=='object')addFact(facts,doc,f.field,f.value,evidence(doc,String(f.value),{location:f.field}));
    for(const [k,v] of Object.entries(obj.nutrition||{})) {
      if(k==='basis'){addFact(facts,doc,'nutrition.basis',typeof v==='object'?`per ${v.value} ${v.unit}`:v,evidence(doc,JSON.stringify(v),{location:'nutrition.basis'}));continue;}
      addFact(facts,doc,`nutrition.${k}`,v+(k.endsWith('_g')?' g':k.endsWith('_kj')?' kJ':k.endsWith('_kcal')?' kcal':''),evidence(doc,String(v),{location:`nutrition.${k}`}));
    }
  }
  if(doc.rows?.length){
    const header=doc.rows[0].map(normal);const fi=header.indexOf('field'),vi=header.indexOf('value'),ui=header.indexOf('unit');
    for(let i=1;i<doc.rows.length;i++){
      const row=doc.rows[i],raw=fi>=0?row[fi]:row[0],v=vi>=0?row[vi]:row[1];
      const k=aliases.get(normal(raw))||(String(raw).startsWith('nutrition.')?raw:null);
      if(k)addFact(facts,doc,k,`${v??''}${ui>=0&&row[ui]?' '+row[ui]:''}`,evidence(doc,v,{location:`Row ${i+1}`}));
    }
  }
  if(doc.cells?.length){
    for(const cell of doc.cells){
      const k=aliases.get(normal(cell.value));if(!k)continue;
      const rowHeaders=doc.cells.filter(item=>item.sheet===cell.sheet&&item.row===cell.row&&aliases.has(normal(item.value)));
      if(rowHeaders.length>1)continue;
      const v=doc.cells.find(c=>c.sheet===cell.sheet&&c.row===cell.row&&c.col===cell.col+1);
      const note=doc.cells.find(c=>c.sheet===cell.sheet&&c.row===cell.row&&c.col===cell.col+2);
      if(v){const context=spreadsheetContext(doc,v,cell.value);addFact(facts,doc,k,v.value,evidence(doc,v.value,{location:`${v.sheet}!${v.cell}`,sheet:v.sheet,cell:v.cell,context}),{note:note?.value||'',sourceContext:context});}
    }
    const heading=doc.cells.find(c=>normal(c.value)==='nutrientcomposition');
    if(heading){
      const variants=doc.cells.filter(c=>c.sheet===heading.sheet&&c.row===heading.row&&c.col>heading.col&&quantity(c.value));
      doc.variants=variants.map(v=>v.value);
      const selected=variants.find(v=>v.value===options.nutritionVariant);
      for(const label of doc.cells.filter(c=>c.sheet===heading.sheet&&c.row>heading.row&&c.col===heading.col)){
        const values=variants.map(v=>({variant:v.value,cell:doc.cells.find(c=>c.sheet===v.sheet&&c.row===label.row&&c.col===v.col)})).filter(v=>v.cell).map(v=>({...v,context:spreadsheetContext(doc,v.cell,label.value)}));
        if(!values.length)continue;
        const value=selected?values.find(x=>x.variant===selected.value):null;
        const key='nutrition.'+normal(label.value);
        addFact(facts,doc,key,value?.cell.value||values.map(x=>`${x.variant}: ${x.cell.value}`).join(' | '),
          evidence(doc,value?.cell.value||label.value,{location:value?`${value.cell.sheet}!${value.cell.cell}`:`${label.sheet}!${label.cell}`,sheet:label.sheet,cell:value?.cell.cell||label.cell,context:value?.context||{sheet:label.sheet,row:label.row+1,rowLabel:label.value,columnHeading:'Multiple nutrition columns',productVariant:doc.data?.product?.variant||doc.data?.product?.name||'Not identified in this sheet'}}),
          {label:label.value,ambiguous:!selected||!options.nutritionBasisConfirmed,variants:values.map(x=>({variant:x.variant,value:x.cell.value,cell:x.cell.cell,context:x.context})),sourceContext:value?.context||null,note:'The source has multiple pack-size columns under a per-serving heading. Confirm the selected column and serving basis before comparing.'});
      }
    }
  }
  if(!facts.length&&doc.role==='spec'){
    for(const line of doc.lines||[]){
      const m=line.text.match(/^\s*(?:[-*]\s*)?([^:|]{2,55})\s*[:|]\s*(.+)/);
      if(m){const k=aliases.get(normal(m[1]));if(k)addFact(facts,doc,k,m[2],evidence(doc,line.text));}
    }
  }
  return facts;
}

function netAmounts(artwork){
  const source=artwork.lines?.length?artwork.lines:artwork.text.split(/\r?\n/).map((text,index)=>({text,line:index+1,page:1,box:null}));
  const lines=source.map(item=>({...item,text:flat(item.text)})).filter(item=>item.text),values=[];
  const nutrient=/^(?:energy|fat|total fat|saturates|saturated fat|trans fat|sugars|total sugars|protein|salt|sodium|fibre|fiber|dietary fib(?:er|re)|(?:total )?carbohydrates?|cholesterol|vitamin d|calcium|iron|potassium|serving size|per serving|per \d|(?:incl\.?|includes?|of which)?\s*(?:added )?sugars)\s*:?$/i;
  const quantityPattern=/(\d+(?:[.,]\d+)?\s*(?:kg|mg|g|ml|cl|l|oz)\b)/ig;
  for(let i=0;i<lines.length;i++){
    const line=lines[i], previous=lines[i-1], next=lines[i+1];
    if(nutrient.test(previous?.text||'')||/\b(?:serving size|per serving|per 100\s*(?:ml|g)|nutrition facts)\b/i.test(line.text))continue;
    for(const match of line.text.matchAll(quantityPattern)){
      const explicit=/\bnet\s*(?:wt\.?|weight|quantity)?\b/i.test(line.text)||/\bnet\s*(?:wt\.?|weight|quantity)?\b/i.test(previous?.text||'')||/\bnet\s*(?:wt\.?|weight|quantity)?\b/i.test(next?.text||'');
      const standalone=/^\s*(?:NET\s*(?:WT\.?|WEIGHT|QUANTITY)?\s*:?\s*)?\d+(?:[.,]\d+)?\s*(?:kg|mg|g|ml|cl|l|oz)\s*$/i.test(line.text);
      if(explicit||standalone)values.push({value:match[1],explicit,page:line.page||1,box:line.box||null,line:line.line||i+1,quote:line.text});
    }
  }
  return values;
}
function observedFor(field, artwork){
  const t=artwork.text;
  if(field==='net_quantity')return netAmounts(artwork).map(x=>x.value).join(' / ');
  if(field==='servings')return t.match(/(\d+(?:\.\d+)?)\s+servings?\s+per\s+(?:container|pack(?:age)?)/i)?.[0]||'';
  if(field==='serving_size')return t.match(/serving\s+size\s*:?\s*([^\r\n]+)/i)?.[0]||'';
  const patterns={
    ingredients:/INGREDIENTS\s*:?\s*([\s\S]*?)(?=ALLERGEN|DIETARY|NUTRITION|STORAGE|Contains\s+oats|$)/i,
    allergen_statement:/(?:ALLERGEN\s+INFORMATION\s*:\s*([\s\S]*?)(?=DIETARY|NUTRITION|STORAGE|$))|(Contains\s+oats\.?)/i,
    storage_statement:/(Store\s+in[\s\S]*?(?:pack\.|month\.|$))|(Refrigerate\s+after\s+opening\.?)/i,
    net_quantity:/(?:^|\n)\s*(?:NET\s*(?:WT\.?|WEIGHT|QUANTITY)?\s*)?(\d+(?:\.\d+)?\s*(?:kg|mg|g|ml|cl|l|oz))\s*(?:\r?\n|$)/ig,
  };
  if(patterns[field]){
    if(field==='net_quantity')return [...t.matchAll(patterns[field])].map(m=>m[1]).filter((v,i,a)=>a.indexOf(v)===i).join(' / ');
    const m=t.match(patterns[field]);if(m)return flat(m[1]||m[2]);
  }
  if(field.startsWith('nutrition.')){
    const key=field.slice(10);const names={energy_kj:'Energy',energy_kcal:'Energy',fat_g:'Fat',protein_g:'Protein',carbohydrate_g:'Carbohydrate',sugars_g:'Sugars',salt_g:'Salt',fibre_g:'Fibre',saturates_g:'Saturates',calories:'Calories',totalfat:'Total Fat',saturatedfat:'Saturated Fat',transfat:'Trans Fat',cholesterol:'Cholesterol',sodium:'Sodium',totalcarbohydrate:'Total Carbohydrate',dietaryfiber:'Dietary Fiber',totalsugars:'Total Sugars',incladdedsugars:'Incl. Added Sugars',protein:'Protein',vitamind:'Vitamin D',calcium:'Calcium',iron:'Iron',potassium:'Potassium'};
    const name=names[key];if(!name)return '';
    const lines=t.split(/\r?\n/);const matches=lines.filter(l=>normal(l).startsWith(normal(name))&&/\d/.test(l));
    if(key==='energy_kj'||key==='energy_kcal'){
      return matches.map(line=>line.match(key==='energy_kj'?/(\d+(?:\.\d+)?)\s*kJ/i:/(\d+(?:\.\d+)?)\s*kcal/i)?.[0]).filter(Boolean).join(' | ');
    }
    // Multiple nutrition panels require explicit basis selection, even if one value happens to match.
    return matches.map(flat).join(' | ');
  }
  return '';
}

// Readings describe the artwork only. They can never supply the expected value
// for a comparison, and the quote must be present on the cited artwork page.
function artworkReadings(review, art){
  const readings=[];
  const add=item=>{
    if(!item||!AI_FACT_FIELDS.has(item.field)||typeof item.value!=='string'||typeof item.quote!=='string')return;
    const page=art.pages.find(page=>page.number===item.page);
    const text=page?.text||(art.lines||[]).filter(line=>line.page===item.page).map(line=>line.text).join('\n');
    if(!page||!normal(item.value)||/\[\s*unreadable\s*\]/i.test(item.quote)||!tokenSequencePresent(text,item.quote)||!tokenSequencePresent(item.quote,item.value))return;
    readings.push({...item,value:flat(item.value),quote:flat(item.quote)});
  };
  for(const item of review.ai?.artworkReadings||[])if(item.documentId===art.id)add(item);
  for(const item of netAmounts(art))add({...item,field:'net_quantity'});
  const labels=[
    [/^brand$/i,'brand'],[/^product(?:\s+name)?$/i,'product_name'],[/^variant$/i,'variant'],
    [/^ingredients?$/i,'ingredients'],[/^(?:allergen(?:\s+(?:statement|information))?|contains)$/i,'allergen_statement'],
    [/^(?:storage(?:\s+instructions?)?|keep|store)$/i,'storage_statement'],[/^manufacturer$/i,'manufacturer'],
  ];
  for(const line of art.lines||[]){
    const text=flat(line.text),match=text.match(/^\s*([\p{L}][\p{L}\s]{0,40})\s*[:—-]\s*(.{2,})$/iu);
    const field=match&&labels.find(([pattern])=>pattern.test(match[1].trim()))?.[1];
    if(field)add({field,value:match[2],quote:text,page:line.page,box:line.box});
    else if(/^(?:keep|store|refrigerate)\s+\S/i.test(text))add({field:'storage_statement',value:text,quote:text,page:line.page,box:line.box});
    else if(/^(?:contains|may contain)\s+\S/i.test(text))add({field:'allergen_statement',value:text,quote:text,page:line.page,box:line.box});
  }
  return [...new Map(readings.map(item=>[`${item.page}:${item.field}:${normal(item.value)}:${normal(item.quote)}`,item])).values()].slice(0,80);
}

function rulesFrom(docs){
  const rules=[];
  for(const d of docs.filter(d=>d.role==='rules')){
    if(Array.isArray(d.data?.rules)){
      for(const [index,rule] of d.data.rules.slice(0,80).entries())if(rule&&typeof rule==='object')rules.push({...rule,id:d.id+':'+(rule.id||index),source:evidence(d,rule.rule_text||rule.text||rule.title,{location:rule.source_section||rule.id}),text:rule.rule_text||rule.text||rule.title});
    } else {
      // Retain requirement-like prose; headings and descriptive metadata are not separate checks.
      const candidates=(d.lines||[]).filter(l=>l.text.trim().length>15&&/\b(must|shall|required|include|retain|match|compare|every|each)\b/i.test(l.text)).slice(0,50);
      if(!candidates.length)rules.push({id:id(d.id+':uncompiled'),title:'Rule document needs interpretation',text:'No supported requirements were compiled from this supplied rule document.',comparison:'uncompiled',source:evidence(d,d.text.slice(0,800))});
      for(const line of candidates)rules.push({id:id(d.id+line.text),title:flat(line.text).slice(0,80),text:line.text,comparison:'uncompiled',source:evidence(d,line.text)});
    }
  }
  return rules;
}

export function analyze(review){
  const docs=review.documents;const art=docs.find(d=>d.role==='artwork');if(!art)throw new Error('An artwork file is required.');
  const sources=docs.filter(d=>d.role==='spec');let facts=sources.flatMap(d=>extractFacts(d,review.options));
  for(const f of review.ai?.facts||[]){
    if(!AI_FACT_FIELDS.has(f.field))continue;
    const d=docs.find(d=>d.id===f.documentId&&d.role==='spec');
    if(!d||!normal(f.quote)||!tokenSequencePresent(d.text,f.quote)||typeof f.value!=='string'||!tokenSequencePresent(f.quote,f.value))continue;
    if(!facts.some(x=>x.field===f.field&&x.documentId===d.id))addFact(facts,d,f.field,f.value,evidence(d,f.quote),{aiProposed:true});
  }
  const groups=Map.groupBy(facts,x=>x.field);const conflicts=[];const selected=[];
  for(const [field,list] of groups){
    const differing=list.filter((x,i)=>!list.slice(0,i).some(y=>field==='net_quantity'?equalQuantity(x.value,y.value):normal(x.value)===normal(y.value)));
    const chosen=list.find(x=>x.id===review.options?.factChoices?.[field]);
    if(differing.length>1&&!chosen)conflicts.push({field,label:list[0].label,facts:differing});
    selected.push(chosen||list[0]);
  }
  let rules=rulesFrom(docs);
  for(const r of review.ai?.rules||[]){
    const d=docs.find(d=>d.id===r.documentId&&d.role==='rules');
    if(d&&typeof r.quote==='string'&&normal(r.quote).length>8&&tokenSequencePresent(d.text,r.quote)){
      const existing=rules.find(x=>x.source.documentId===d.id&&x.comparison==='uncompiled'&&normal(r.quote).includes(normal(x.text)));
      if(existing){rules=rules.filter(x=>x===existing||x.source.documentId!==d.id||x.comparison!=='uncompiled'||!normal(r.quote).includes(normal(x.text)));existing.field=r.field;existing.title=r.title;existing.text=r.quote;existing.source=evidence(d,r.quote);existing.comparison=r.comparison;existing.literal_expected=r.expected||null;existing.aiProposed=true;}
      else rules.push({id:id(r.documentId+r.quote),title:r.title,text:r.quote,field:r.field,comparison:r.comparison,literal_expected:r.expected||null,source:evidence(d,r.quote),aiProposed:true});
    }
  }
  const findings=[];const add=(key,title,status,expected,observed,explanation,ev=[],rule=null,severity='major')=>{
    const uniqueEvidence=[...new Map(ev.filter(Boolean).map(item=>[JSON.stringify([item.documentId,item.page,item.quote,item.box,item.location]),item])).values()];
    findings.push({id:id(key),key,title,status,expected:expected??'',observed:observed??'',explanation,evidence:uniqueEvidence,rule,severity,method:'exact_comparison'});
  };
  const complete=Boolean(review.options?.completeArtwork)&&art.pages.length>0&&art.pages.every(p=>p.method==='pdf_text');
  const artNorm=normal(art.text);
  const draft=sources.filter(d=>/draft\s*(?:\/|or)?\s*(?:in\s*review)?|unconfirmed/i.test(d.data?.status||d.text));
  if(draft.length&&!review.options?.sourceConfirmed)add('source-status','Source approval needs confirmation','review','An approved reference for this review','Draft or unconfirmed source supplied','The source is suitable for comparison, but an observed difference is not proof that the artwork is wrong. Confirm source authority before release.',draft.map(d=>evidence(d,(d.text.match(/.{0,30}(?:Draft[^\n]*|UNCONFIRMED[^\n]*)/i)||['Draft / unconfirmed'])[0])),null,'major');
  for(const c of conflicts)add('conflict:'+c.field,`Conflicting sources · ${c.label}`,'review','One confirmed reference',c.facts.map(f=>f.value).join(' ↔ '),'Choose which source is authoritative in the Sources tab. Dependent checks remain unresolved.',c.facts.map(f=>f.evidence),null,'major');
  const supported=['exact_phrase','all_phrases','quantity_equivalence','exact_copy','numeric_pair_and_basis','numeric_and_basis','all_approved_fields','register_lookup','required_phrase','forbidden_phrase'];
  let tasks=rules.length?rules: selected.map(f=>({id:'derived:'+f.field,title:f.label,field:f.field,comparison:f.field==='net_quantity'?'quantity_equivalence':'exact_copy',text:'Compare this field with the supplied product reference.',source:f.evidence,derived:true}));
  const hasReferenceDocuments=docs.some(d=>d.role==='spec'||d.role==='rules');
  // An image-only review with no transcription has one shared blocker: no
  // artwork copy is available to compare. Keeping every dependent field as a
  // separate "not detected" result makes an extraction outage look like many
  // package defects, so defer those checks together until text is available.
  const imageTextUnavailable=art.pages.length>0&&art.pages.every(page=>page.method==='vision_needed')&&!normal(art.text);
  const mediaArtwork=art.pages.some(page=>page.unit==='px'||page.method==='vision_needed'||page.method==='ai_transcription');
  const visibleReadings=mediaArtwork?artworkReadings(review,art):[];
  const blockedImageChecks=new Map();
  if(!hasReferenceDocuments){
    add('missing-reference','Add a product spec to compare artwork','unable','An approved product specification or applicable checklist',`${art.pages.length} artwork page${art.pages.length===1?'':'s'} supplied without a product specification or rulebook`,'The artwork is ready for visual inspection, but no source was supplied to verify whether its product name, quantity, ingredients, and claims are correct. Add an approved product specification or checklist to run those comparisons.');
    findings.at(-1).method='review_input_gap';
    const unread=art.pages.filter(page=>(page.method==='vision_needed'&&!String(page.text||'').trim())||/\[\s*unreadable\s*\]/i.test(page.text||''));
    if(unread.length){
      add('artwork-text-unavailable','Review unreadable artwork text','unable','Readable package copy for supported content checks',`Text reading needs attention on page${unread.length===1?'':'s'} ${unread.map(page=>page.number).join(', ')}`,'These image pages are available in the 2D proof, but some or all of their copy could not be read. Inspect each page visually or provide sharper, closer face photos; missing transcription does not mean the package is missing text.',unread.map(page=>evidence(art,'',{page:page.number,location:`Page ${page.number}`})),null,'minor');
      findings.at(-1).method='artwork_readability';
    }
  }else if(!tasks.length)add('no-reference','No structured reference facts','unable','Product values or readable rules','No usable product facts extracted','Connect AI for document interpretation or upload a field/value CSV or JSON specification. No findings have been invented.');
  for(const task of tasks){
    let field=task.field;const key='rule:'+task.id;
    if(imageTextUnavailable&&supported.includes(task.comparison)){
      const source=task.source||null;
      const sourceId=source?.documentId||'source-unspecified';
      if(!blockedImageChecks.has(sourceId))blockedImageChecks.set(sourceId,{source,checks:[]});
      blockedImageChecks.get(sourceId).checks.push(task.title||labels[field]||field||'Artwork copy check');
      continue;
    }
    if(!supported.includes(task.comparison)){add(key,task.title||'Uncompiled rule','unable',task.text,'Rule needs interpretation','This rule was retained but could not be compiled into a supported comparison. Connect AI or supply a structured rulebook.',[task.source],task);continue;}
    if(task.comparison==='register_lookup'||field==='claims'){
      const registers=docs.filter(d=>d.role==='claims');const entries=registers.flatMap(d=>(Array.isArray(d.data?.entries)?d.data.entries:[]).filter(x=>x&&typeof x.text==='string').map(x=>({...x,doc:d})));
      const claims=[...new Set(['No Added Sugar','Suitable for Vegans','Certified Vegan','GMO Free','certified organic','Smooth & creamy',...entries.map(e=>e.text).filter(x=>typeof x==='string')])].filter(c=>safeCopyMatch(art.text,c));
      const skus=[...new Set(sources.map(d=>d.data?.product?.sku).filter(s=>typeof s==='string'))];
      const unapproved=claims.filter(c=>!entries.some(e=>normal(e.text)===normal(c)&&/^APPROVED(?:\b|_)/i.test(e.status||'')&&(!e.sku||(skus.length===1&&normal(skus[0])===normal(e.sku)))));
      let claimStatus=unapproved.length?'review':claims.length?'match':'unable';
      const uncertain=art.pages.some(p=>p.method==='ai_transcription')||(task.aiProposed&&!review.options?.aiRulesConfirmed);
      const conditional=entries.some(e=>claims.some(c=>normal(c)===normal(e.text))&&(e.condition||e.conditions));
      if(claimStatus==='match'&&(uncertain||conditional))claimStatus='review';
      const explanation=(unapproved.length?'The supplied evidence does not establish approval for these claims. This is not a conclusion that a claim is false or illegal.':claims.length?'Recognized claims match entries in the supplied register. Other claims, applicability and substantiation remain the reviewer’s responsibility.':'Claim detection was inconclusive.')+(conditional?' The register includes conditions that need human verification.':'')+(uncertain?' AI transcription or the proposed rule interpretation requires confirmation.':'');
      add(key,task.title||'Claim approval evidence',claimStatus,'Approval evidence for recognized claims',unapproved.join('; ')||claims.join('; ')||'No supported claim phrases detected',explanation,[task.source,...claims.map(c=>evidence(art,c)),...entries.map(e=>evidence(e.doc,e.text))],task);continue;
    }
    let targets=field==='identity'?selected.filter(f=>['brand','product_name'].includes(f.field)):
      field==='business_details'?selected.filter(f=>['manufacturer','customer_care'].includes(f.field)):
      field==='nutrition.energy'?selected.filter(f=>['nutrition.energy_kj','nutrition.energy_kcal'].includes(f.field)):
      selected.filter(f=>f.field===field);
    if(task.literal_expected!==null&&task.literal_expected!==undefined){targets=(Array.isArray(task.literal_expected)?task.literal_expected:[task.literal_expected]).map(v=>({field:field||'required_phrase',value:String(v),evidence:task.source}));}
    const constituents={identity:['brand','product_name'],business_details:['manufacturer','customer_care'],'nutrition.energy':['nutrition.energy_kj','nutrition.energy_kcal']}[field];
    if(constituents&&task.literal_expected==null&&constituents.some(k=>!targets.some(t=>t.field===k))){add(key,task.title,'unable',constituents.join(' + '),'Reference is incomplete','Every required component needs a source value before this combined check can pass.',[task.source,...targets.map(t=>t.evidence)],task);continue;}
    if(!targets.length||targets.some(t=>!normal(t.value))){add(key,task.title||labels[field]||field,'unable','A reference value for this rule','Missing reference value','A required source value is missing. It was not inferred from the artwork.',[task.source],task);continue;}
    if(targets.some(f=>conflicts.some(c=>c.field===f.field))){add(key,task.title,'review',targets.map(x=>x.value).join('; '),'Source conflict unresolved','Resolve the conflicting source values before judging the artwork.',[task.source,...targets.map(t=>t.evidence)],task);continue;}
    if(targets.some(f=>f.ambiguous||/not clearly|N\/A|confirm directly/i.test(f.value))){add(key,task.title||targets[0].label,'review',targets.map(t=>t.value).join('; '),observedFor(targets[0].field,art)||'Uncertain comparison basis','The reference is ambiguous or has no confirmed serving basis. Select the column and confirm its basis in Sources.',[task.source,...targets.map(t=>t.evidence)],task);continue;}
    const checks=targets.map(f=>{
      let expected=f.value; if(f.field==='ingredients')expected=expected.replace(/^INGREDIENTS\s*:\s*/i,'');
      let observed=observedFor(f.field,art);
      const readings=visibleReadings.filter(item=>item.field===f.field);
      if(readings.length)observed=[...new Set(readings.map(item=>item.value))].join(' | ');
      let copyCheck=copyOccurrences(art.text,expected);
      let matches=readings.length?readings.every(item=>safeCopyMatch(item.value,expected)):safeCopyMatch(art.text,expected);
      if(f.field==='ingredients'&&observed)matches=safeCopyMatch(art.text,expected)&&copyTokens(observed.replace(/^INGREDIENTS\s*:?\s*/i,'' )).join('|')===copyTokens(expected).join('|');
      if(!observed&&(copyCheck.negative.length||copyCheck.context.length))observed=[...copyCheck.negative,...copyCheck.context].join(' / ');
      let quantityObservations=[];
      if(f.field==='net_quantity'){
        quantityObservations=netAmounts(art);
        observed=quantityObservations.map(item=>item.value).join(' / ');
        matches=quantityObservations.length>0&&quantityObservations.every(item=>equalQuantity(expected,item.value));
      }
      if(f.field==='servings')matches=Boolean(observed)&&Number(observed.match(/\d+(?:\.\d+)?/)?.[0])===Number(expected.match(/\d+(?:\.\d+)?/)?.[0]);
      if(f.field.startsWith('nutrition.')&&f.field!=='nutrition.basis'){
        const nums=observed.match(/\d+(?:\.\d+)?/g)||[];const expectedNums=expected.match(/\d+(?:\.\d+)?/g)||[];
        const expectedUnit=expected.match(/(?:\d)\s*(mcg|mg|g|kj|kcal)\b/i)?.[1]?.toLowerCase();
        const observedUnit=observed.match(/(?:\d)\s*(mcg|mg|g|kj|kcal)\b/i)?.[1]?.toLowerCase();
        matches=nums.length>0&&expectedNums.length>0&&Number(nums[0])===Number(expectedNums[0])&&(!expectedUnit||expectedUnit===observedUnit);
        const basis=selected.find(x=>x.field==='nutrition.basis');if(basis&&!artNorm.includes(normal(basis.value)))matches=false;
      }
      if(task.comparison==='forbidden_phrase'){observed=copyCheck.positive.length||copyCheck.negative.length?expected:'';matches=copyCheck.positive.length===0&&copyCheck.negative.length===0;}
      return {f,expected,readings,observed:matches&&task.comparison!=='forbidden_phrase'?(observed||expected):observed,match:matches};
    });
    const ok=checks.every(c=>c.match);const hasObservation=checks.filter(c=>!c.match).every(c=>Boolean(c.observed));
    const multiNutrition=checks.some(c=>c.f.field.startsWith('nutrition.')&&c.observed.includes(' | '));
    const uncertainQuantity=checks.some(c=>c.f.field==='net_quantity')&&netAmounts(art).some(q=>!q.explicit)&&!review.options?.netQuantityConfirmed;
    const staleContextOnly=checks.some(c=>{const found=copyOccurrences(art.text,c.expected);return found.context.length>0&&found.positive.length===0;});
    let status=ok?'match':hasObservation||complete?'issue':'unable';
    if(staleContextOnly&&!complete)status='review';
    if(multiNutrition)status='review';
    if(uncertainQuantity)status='review';
    if(task.comparison==='forbidden_phrase'&&ok&&!complete)status='unable';
    if(art.pages.some(p=>p.method==='ai_transcription')&&status!=='unable')status='review';
    if(task.aiProposed&&!review.options?.aiRulesConfirmed)status='review';
    if(targets.some(t=>t.aiProposed)&&!review.options?.sourceConfirmed)status='review';
    if(targets.some(t=>t.field.startsWith('nutrition.'))&&!selected.some(t=>t.field==='nutrition.basis')&&!review.options?.nutritionBasisConfirmed)status='review';
    const observed=checks.map(c=>c.observed||'Not detected in extracted content').join('; ');
    const expected=checks.map(c=>c.expected).join('; ');
    const contextEvidence=checks.flatMap(c=>{const found=copyOccurrences(art.text,c.expected);return [...found.negative,...found.context].map(q=>evidence(art,q));});
    const preferredZone=task.panel&&task.panel!=='all'?review.options?.panelZones?.[task.panel]:null;
    const ev=[task.source,...targets.map(t=>t.evidence),...checks.flatMap(c=>c.readings.map(item=>evidence(art,item.quote,{page:item.page,...(item.box?{box:item.box}:{})}))),...contextEvidence,...checks.filter(c=>c.observed).flatMap(c=>c.f.field==='net_quantity'?netAmounts(art).map(item=>evidence(art,item.quote,{page:item.page,box:item.box,location:`Page ${item.page} · line ${item.line}`})):c.observed.split(' | ').map(q=>evidence(art,q,preferredZone?{preferredZone}:{})))];
    let explanation=ok?'The extracted artwork matches this supplied reference.':hasObservation?'The extracted artwork differs from the supplied reference.':'The required copy was not detected in extracted content.';
    if(checks.some(c=>{const found=copyOccurrences(art.text,c.expected);return found.negative.length>0;}))explanation='The phrase appears only in a negated instruction or is contradicted by one. It is not accepted as a match.';
    if(checks.some(c=>copyOccurrences(art.text,c.expected).context.length>0))explanation='The phrase appears in copy marked obsolete or superseded. It is not accepted as current artwork copy.';
    if(checks.some(c=>c.f.field==='net_quantity')&&netAmounts(art).length>1){const declarations=netAmounts(art);const expectedQuantity=checks.find(c=>c.f.field==='net_quantity')?.expected;const disagree=declarations.filter(item=>!equalQuantity(expectedQuantity,item.value));explanation=`${declarations.length} package-quantity declaration${declarations.length===1?'':'s'} found; ${disagree.length} disagree with the supplied reference. Every occurrence is checked, including repeated identical values.`;}
    if(task.comparison==='forbidden_phrase')explanation=ok?'The prohibited phrase was not detected.':'The prohibited phrase was detected in the artwork.';
    if(status==='unable')explanation+=' Absence is unconfirmed because extraction coverage has not been verified.';
    if(status==='issue'&&!hasObservation)explanation+=' All supplied panels were confirmed complete and readable for this review.';
    if(multiNutrition)explanation='Multiple possible nutrition values were found. A human must confirm the corresponding panel and serving basis.';
    if(uncertainQuantity)explanation='An unlabelled measurement was found. Confirm that it is a package net quantity, rather than a serving or nutrition amount, in Sources before accepting the comparison.';
    if(art.pages.some(p=>p.method==='ai_transcription'))explanation+=' Artwork text includes AI transcription and must be visually confirmed.';
    if(task.panel&&task.panel!=='all')explanation+=' This result covers content; panel placement is tracked separately.';
    if(task.aiProposed&&!review.options?.aiRulesConfirmed)explanation+=' The AI interpretation of this rule requires reviewer confirmation.';
    if(targets.some(t=>t.aiProposed)&&!review.options?.sourceConfirmed)explanation+=' Confirm the meaning and authority of the AI-extracted source fact.';
    if(draft.length&&!review.options?.sourceConfirmed&&!ok)explanation+=' The source itself is draft; this records a discrepancy, not an instruction to replace approved artwork.';
    if(status==='unable'&&!hasObservation&&art.pages.some(page=>page.method==='ai_transcription')){
      const source=task.source||targets[0]?.evidence||null;
      const sourceId=source?.documentId||'source-unspecified';
      if(!blockedImageChecks.has(sourceId))blockedImageChecks.set(sourceId,{source,checks:[]});
      blockedImageChecks.get(sourceId).checks.push(task.title||labels[field]||field||'Artwork copy check');
      continue;
    }
    add(key,task.title||targets[0].label,status,expected,observed,explanation,ev,task,task.severity_if_issue||'major');
  }
  if(blockedImageChecks.size){
    const pages=art.pages.map(page=>page.number);
    for(const [sourceId,group] of blockedImageChecks){
      const blocked=[...new Set(group.checks)];
      const partial=art.pages.some(page=>page.method==='ai_transcription');
      const title=partial?'Confirm unreadable package copy':'Read artwork copy';
      const explanation=partial
        ?'Image reading returned some copy but did not locate these supplied source values. This may mean the text is absent or the reading missed it; inspect the original pages before deciding. It is not an automatic mismatch.'
        :'Automatic image reading did not return usable copy. These source checks are waiting for a visual inspection or a successful image-reading pass; they have not been marked as missing or mismatched.';
      const observed=partial?`${blocked.length} source checks need visual confirmation`:`${pages.length} image page${pages.length===1?'':'s'} supplied; no text was extracted`;
      add(`artwork-text-unavailable:${sourceId}`,group.source?.name?`${title} · ${group.source.name}`:title, 'unable',`${blocked.length} source checks need readable package copy`,observed,explanation,[group.source,...pages.map(number=>evidence(art,'',{page:number,location:`Page ${number}`}))],null,'minor');
      findings.at(-1).method='artwork_readability';
      findings.at(-1).blockedChecks=blocked;
    }
  }
  if(mediaArtwork&&normal(art.text)){
    const coveredFields=new Set(tasks.flatMap(task=>task.comparison==='all_approved_fields'?selected.map(f=>f.field):({identity:['brand','product_name'],business_details:['manufacturer','customer_care'],'nutrition.energy':['nutrition.energy_kj','nutrition.energy_kcal']}[task.field]||[task.field])));
    const grouped=Map.groupBy(visibleReadings,item=>`${item.field}:${normal(item.value)}`);
    for(const [key,items] of [...grouped].slice(0,24)){
      const item=items[0];if(coveredFields.has(item.field))continue;
      add(`image-observation:${key}`,`Confirm visible ${item.field==='net_quantity'?'net quantity':labels[item.field]||item.field.replace('nutrition.','Nutrition · ').replaceAll('_',' ')}`,'review','Confirm the reading against the original image; add an approved source to check correctness',item.value,'Image reading found this visible package text. Confirm the wording against the original image. The image reading is not itself a verified product fact; an approved source is needed to check correctness.',items.map(item=>evidence(art,item.quote,{page:item.page,...(item.box?{box:item.box}:{})})),{text:'Image-derived observation only; no reference comparison has been made.'},'minor');
      findings.at(-1).method='image_observation';findings.at(-1).field=item.field;
    }
    // Keep unclassified copy visible even when a quantity was recognized. Never
    // infer brand/product identity merely from the order of lines in a photo.
    if(!hasReferenceDocuments)for(const page of art.pages){
      const lines=(art.lines||[]).filter(line=>line.page===page.number);
      const remaining=lines.filter(line=>{
        const text=flat(line.text);
        return text.length>=4&&normal(text)&&! /\[unreadable\]|camera sample|fictional|not for sale/i.test(text)&&!visibleReadings.some(item=>item.page===page.number&&tokenSequencePresent(item.quote,text));
      }).slice(0,8);
      if(!remaining.length)continue;
      const quotes=[...new Set(remaining.map(line=>flat(line.text)))];
      add(`image-observation:visible-copy:${page.number}`,`Confirm other visible text · page ${page.number}`,'review','Inspect the original image; add a product spec to check the wording',quotes.join(' · '),'These are draft readings of visible text that have not been classified as product facts. Confirm them against the original page; no source comparison has been made.',remaining.map(line=>evidence(art,line.text,{page:page.number,...(line.box?{box:line.box}:{})})),{text:'Visible artwork copy awaiting human confirmation.'},'minor');
      findings.at(-1).method='image_observation';
    }
  }
  // If the reviewer resolves a multi-SKU source conflict, keep sibling-variant
  // mentions visible as a review signal. They can be intentional, so this never
  // becomes an automatic issue or release block.
  const chosenVariant=selected.find(f=>f.field==='variant');
  const skuDocs=sources.filter(d=>typeof d.data?.product?.sku==='string'&&d.data.product.sku.trim());
  if(chosenVariant&&skuDocs.length>1&&!conflicts.some(c=>c.field==='variant')){
    const otherVariants=facts.filter(f=>f.field==='variant'&&f.documentId!==chosenVariant.documentId&&skuDocs.some(d=>d.id===f.documentId));
    for(const candidate of otherVariants){
      if(normal(candidate.value)===normal(chosenVariant.value))continue;
      const occurrences=copyOccurrences(art.text,candidate.value);
      if(!occurrences.positive.length)continue;
      const artworkProof=occurrences.positive.map(quote=>evidence(art,quote));
      add(`cross-sku:${candidate.documentId}:${normal(candidate.value)}`,'Possible copy from another supplied SKU','review',chosenVariant.value,`${candidate.value} appears in the artwork`,'This wording matches a different SKU in the supplied specifications. It may be intentional cross-promotion; inspect each artwork location and confirm the selected SKU before deciding.',[chosenVariant.evidence,candidate.evidence,...artworkProof],{text:'Cross-SKU carryover screening. A sibling-variant mention is a reviewer prompt, not an automatic defect.'},'minor');
      findings.at(-1).method='cross_sku_review';
    }
  }
  // Conservatively scan only clearly tabular product-family catalogs. A
  // sibling match is a review prompt: intentional cross-promotion is common.
  const skuHeaderAliases={
    sku:['sku','itemnumber','productcode'],variant:['variant','flavor','flavour'],
    product_name:['productname','product'],ingredients:['ingredients','ingredientlist'],
    allergen_statement:['allergenstatement','allergeninformation','allergens'],
    net_quantity:['netquantity','netweight','packagesize','packageweight'],
    barcode:['upc','barcode','gtin'],
  };
  const familyRows=[];
  for(const doc of sources){
    const sheets=new Map();
    for(const cell of doc.cells||[]){if(!String(cell.value??'').trim())continue;const key=`${cell.sheet}\0${cell.row}`;if(!sheets.has(key))sheets.set(key,[]);sheets.get(key).push(cell);}
    const allRows=[...sheets.entries()].map(([key,cells])=>({key,sheet:cells[0].sheet,row:cells[0].row,cells}));
    for(const headerRow of allRows){
      const columns={};
      for(const cell of headerRow.cells){const header=normal(cell.value);for(const [field,aliases] of Object.entries(skuHeaderAliases))if(aliases.some(alias=>header===normal(alias)))columns[field]=cell.col;}
      const signatureFields=Object.keys(columns).filter(field=>!['sku','variant','product_name'].includes(field));
      if(!columns.variant&&!columns.sku||signatureFields.length<1)continue;
      const rows=allRows.filter(row=>row.sheet===headerRow.sheet&&row.row>headerRow.row&&Object.values(columns).some(col=>row.cells.some(cell=>cell.col===col)));
      let emptyGap=0;
      for(const row of rows){
        const values={};
        for(const [field,col] of Object.entries(columns)){const cell=row.cells.find(item=>item.col===col);if(cell)values[field]={value:String(cell.value).trim(),cell};}
        const identity=values.variant||values.sku||values.product_name;
        if(!identity||!signatureFields.some(field=>values[field]?.value)){if(++emptyGap>=2)break;continue;}emptyGap=0;
        familyRows.push({doc,sheet:row.sheet,row:row.row,values});
      }
    }
  }
  if(familyRows.length>1){
    const identityFields=['variant','product_name','sku'];
    function fieldValue(row,field){return row.values[field]?.value||'';}
    function fieldMatchesArtwork(value,text){const digits=String(value).replace(/\D/g,'');if(digits.length<8)return false;const separated=digits.split('').join('[\\s-]*');return new RegExp(`(?<!\\d)${separated}(?!\\d)`).test(String(text));}
    function visibleIdentity(row){for(const field of identityFields){const value=fieldValue(row,field);if(value&&(field==='sku'?fieldMatchesArtwork(value,art.text):tokenSequencePresent(art.text,value)))return value;}return '';}
    const selectedIdentity=chosenVariant?.value||selected.find(f=>f.field==='product_name')?.value||'';
    const selectedRow=familyRows.find(row=>selectedIdentity&&identityFields.some(field=>normal(fieldValue(row,field))===normal(selectedIdentity)))||
      familyRows.find(row=>row.values.sku?.value&&sources.some(doc=>normal(doc.data?.product?.sku)===normal(row.values.sku.value)))||
      (familyRows.map(row=>({row,identity:visibleIdentity(row)})).filter(item=>item.identity).length===1?familyRows.find(row=>visibleIdentity(row)):null);
    const selectedValues=new Set(selectedRow?Object.values(selectedRow.values).map(item=>normal(item.value)):[]);
    for(const row of familyRows){
      if(row===selectedRow)continue;
      const identity=row.values.variant?.value||row.values.product_name?.value||row.values.sku?.value||`row ${row.row}`;
      const matches=[];
      for(const [field,item] of Object.entries(row.values)){
        const value=item.value,normalized=normal(value);
        if(!value||selectedValues.has(normalized))continue;
        let found=false;
        if(field==='barcode')found=fieldMatchesArtwork(value,art.text);
        else if(field==='net_quantity')found=netAmounts(art).some(amount=>equalQuantity(value,amount.value))&&(!selectedRow||!equalQuantity(value,fieldValue(selectedRow,'net_quantity')));
        else if(['variant','product_name','sku'].includes(field))found=field==='sku'?fieldMatchesArtwork(value,art.text):value.length>=4&&tokenSequencePresent(art.text,value);
        else if(field==='allergen_statement')found=value.length>=8&&tokenSequencePresent(art.text,value);
        else if(field==='ingredients')found=value.length>=18&&tokenSequencePresent(art.text,value);
        if(!found)continue;
        const rowEvidence=evidence(row.doc,value,{location:`${row.sheet}!${item.cell.cell}`,sheet:row.sheet,cell:item.cell.cell,row:row.row});
        const artworkEvidence=evidence(art,value);
        matches.push({field,value,rowEvidence,artworkEvidence});
      }
      if(!matches.length)continue;
      const chosenLabel=selectedRow?.values.variant?.value||selectedRow?.values.product_name?.value||selectedRow?.values.sku?.value||'the intended product row';
      const description=matches.map(item=>`${item.field}: ${item.value}`).join('; ');
      add(`cross-sku-table:${row.doc.id}:${row.sheet}:${row.row}`,'Possible sibling-SKU copy in artwork','review',chosenLabel,`${identity} row content detected: ${description}`,'This artwork text matches one or more values in a different product-family row from the supplied spreadsheet. It may be intentional; confirm the target SKU, inspect each artwork location, and check that the corresponding source row is authoritative.',[...matches.flatMap(item=>[item.rowEvidence,item.artworkEvidence])],{text:'Cross-SKU carryover screen from an explicit tabular product-family source. A match is a human-review prompt, never an automatic defect.'},'minor');
      findings.at(-1).method='cross_sku_catalog_review';
    }
  }
  const placements=tasks.filter(t=>t.panel&&t.panel!=='all');
  const zones=review.options?.panelZones||{};
  const configuredZones=placements.filter(t=>zones[t.panel]?.box&&Number.isInteger(zones[t.panel]?.page));
  const unconfiguredZones=placements.filter(t=>!zones[t.panel]?.box||!Number.isInteger(zones[t.panel]?.page));
  for(const task of configuredZones){
    const finding=findings.find(f=>f.rule?.id===task.id);
    const artEv=finding?.evidence?.find(ev=>ev.role==='artwork'&&ev.page&&Array.isArray(ev.box));
    const zone=zones[task.panel];
    if(!artEv){
      add(`panel-zone:${task.id}`,`Panel zone · ${task.title}`,'unable',`${task.panel} zone on page ${zone.page}`,'No located artwork evidence for this check','A reviewer-defined panel zone is available, but this check has no reliable text region to compare against it. Inspect the artwork manually.',[task.source],task,'minor');
      findings.at(-1).method='panel_geometry';
      continue;
    }
    const inside=artEv.page===zone.page&&boxInsideZone(artEv.box,zone.box);
    add(`panel-zone:${task.id}`,`Panel zone · ${task.title}`,inside?'match':'issue',`${task.panel} zone on page ${zone.page}`,inside?`Located evidence is inside the reviewer-defined ${task.panel} zone.`:`Located evidence is outside the reviewer-defined ${task.panel} zone or on page ${artEv.page}.`,'This geometric result uses the reviewer-drawn artwork zone. It does not determine the legally applicable principal display panel or replace visual approval.',[task.source,artEv],task,'minor');
    findings.at(-1).method='panel_geometry';
  }
  if(unconfiguredZones.length){add('panel-placement','Verify panel placement',review.options?.panelPlacementConfirmed?'match':'review',unconfiguredZones.map(t=>`${t.title}: ${t.panel}`).join('; '),review.options?.panelPlacementConfirmed?'Reviewer confirmed the specified locations':'Some required panel zones remain unmapped','Content matches do not establish that copy appears on the required panel. Define the remaining zones or inspect the artwork and record the result in Sources.',unconfiguredZones.map(t=>t.source),null,'minor');findings.at(-1).method='reviewer_confirmation';}
  if(!tasks.some(t=>t.comparison==='register_lookup')&&/no\s+added\s+sugar|vegan|certified\s+organic/i.test(art.text)){
    const claims=['No Added Sugar','Suitable for Vegans','certified organic'].filter(c=>artNorm.includes(normal(c)));
    if(claims.length)add('claim-review','Claims require supporting evidence','review','Applicable claim and certification evidence',claims.join('; '),'Artwork and product copy alone do not establish claim approval or certification. Request supporting evidence.',claims.map(c=>evidence(art,c)),{text:'Reviewer check: supporting evidence for promotional claims.'});
  }
  for(const note of review.ai?.observations||[]){
    if(typeof note.quote!=='string'||!normal(note.quote)||!artNorm.includes(normal(note.quote)))continue;
    add('ai:'+id(note.title+note.quote),String(note.title).slice(0,120),'review','Human review of AI observation',note.quote,String(note.explanation).slice(0,1000),[evidence(art,note.quote)],{text:'AI observation; not a verified rule violation.'});
    findings.at(-1).method='ai_observation';
  }
  // Physical-size screening turns the located PDF coordinates into an approximate print measurement.
  // It is deliberately a configurable workflow cue, not a statement of any jurisdiction's rule.
  for(const field of ['net_quantity','allergen_statement','ingredients']){
    const match=finding => finding.rule?.field===field||finding.rule?.field===({ingredients:'ingredients',allergen_statement:'allergen_statement',net_quantity:'net_quantity'}[field]);
    const linked=findings.find(match);
    const artEv=linked?.evidence?.find(ev=>ev.role==='artwork'&&ev.page&&Array.isArray(ev.box));
    if(!artEv)continue;
    const page=art.pages.find(p=>p.number===artEv.page);const mm=estimatedHeightMm(page,artEv.box);
    if(!Number.isFinite(mm))continue;
    const threshold=Number(review.options?.legibilityThresholdMm)||1.6,passes=mm>=threshold;
    add(`legibility:${field}`,`Legibility screening · ${labels[field]||field}`,'review',`Reviewer-set screening threshold: ${threshold.toFixed(1)} mm`,`Approx. ${mm.toFixed(1)} mm (${(mm/(25.4/72)).toFixed(1)} pt) from extracted PDF coordinates; ${passes?'above':'below'} the screening threshold`,passes?'The extracted text height is above the selected screening value. A reviewer must confirm actual glyph height, artwork scale and applicable requirement.':'The extracted text height is below the selected screening value. A prepress reviewer should check actual glyph height, artwork scale and the applicable requirement.',[artEv],{text:'Approximate PDF bounding-box height screen. This is not an applicable legal minimum or print approval.'},'minor');
    findings.at(-1).method='physical_legibility_screen';
  }
  const allergenFact=selected.find(f=>f.field==='allergen_statement');
  if(allergenFact){
    const observed=observedFor('allergen_statement',art);const artEv=evidence(art,observed||allergenFact.value);const cue=textHasVisualAllergenCue(observed,allergenFact.value);
    add('allergen-emphasis','Allergen visual-emphasis cue',cue.hasCue?'match':'review','An explicit CONTAINS cue or uppercase allergen cue for visual inspection',cue.hasCue?(cue.hasExplicitContains?'Explicit CONTAINS cue detected.':`Uppercase cue detected for ${cue.highlightedTerms.join(', ')}.`):'No explicit uppercase or CONTAINS cue detected in extracted text.','This checks visible text cues only. Font weight, contrast, language requirements and applicable allergen-formatting rules require visual and regulatory review.',[allergenFact.evidence,artEv],{text:'Visual cue screening; it does not establish allergen-format compliance.'},'minor');
    findings.at(-1).method='allergen_visual_cue';
  }
  const nutritionEvidence=selected.filter(f=>f.field.startsWith('nutrition.')).map(f=>f.evidence);
  for(const sanity of nutritionSanityFacts(selected)){
    if(sanity.type==='atwater'){
      const percent=Math.round(sanity.difference*100);
      add('nutrition-sanity:atwater','Nutrition sanity · calories vs macronutrients',sanity.passes?'match':'review','Calories within 20% of the 4-4-9 screening estimate',`Declared ${sanity.calories} kcal; 4-4-9 estimate ${sanity.estimate.toFixed(1)} kcal (${percent}% difference)`,sanity.passes?'The supplied nutrition values pass this internal plausibility screen. Rounding, fibre, polyols and jurisdiction-specific calculation rules still need review.':'The supplied nutrition values differ materially from the 4-4-9 screening estimate. This can result from a source error, basis mismatch, rounding or nutrients outside this simple screen; confirm the approved nutrition calculation.',nutritionEvidence,{text:'Internal nutrition plausibility screen; it compares source values with each other before artwork comparison.'},'minor');
      findings.at(-1).method='nutrition_math_screen';
    } else if(sanity.type==='serving-quantity'){
      add('nutrition-sanity:serving-quantity','Nutrition sanity · serving count vs net quantity',sanity.passes?'match':'review','Serving size × servings per container approximately equals net quantity',`Serving estimate ${sanity.estimated.toFixed(2)} ${sanity.unit}; net quantity ${sanity.net.toFixed(2)} ${sanity.unit} (${Math.round(sanity.difference*100)}% difference)`,sanity.passes?'The supplied serving count and net quantity are internally plausible within 5%.':'The supplied serving count and net quantity conflict or use incompatible units. Confirm each value and basis with the source owner.',nutritionEvidence,{text:'Internal quantity plausibility screen; density and declared package fill can affect mass/volume comparisons.'},'minor');
      findings.at(-1).method='nutrition_math_screen';
    } else {
      const labelsByType={sugars:['Sugars','Total carbohydrate'],saturates:['Saturated fat','Total fat']};const [lowerLabel,upperLabel]=labelsByType[sanity.type];
      add(`nutrition-sanity:${sanity.type}`,`Nutrition sanity · ${lowerLabel} ≤ ${upperLabel}`,sanity.passes?'match':'review',`${lowerLabel} must not exceed ${upperLabel} in the supplied values`,`${lowerLabel}: ${sanity.lower} g; ${upperLabel}: ${sanity.upper} g`,sanity.passes?'The supplied values satisfy this internal component relationship.':'The supplied values conflict internally. Confirm the source column, serving basis and approved nutrition data before relying on either source or artwork.',nutritionEvidence,{text:'Internal nutrition component relationship; it does not establish regulatory compliance.'},'minor');
      findings.at(-1).method='nutrition_math_screen';
    }
  }
  const criticalVisualFields=new Set(['identity','business_details','brand','product_name','variant','net_quantity','ingredients','allergen_statement','storage_statement','nutrition.energy','nutrition.energy_kj','nutrition.energy_kcal','nutrition.fat_g','nutrition.protein_g','claims']);
  for(const finding of [...findings]){
    if(finding.method!=='exact_comparison'||!criticalVisualFields.has(finding.rule?.field))continue;
    const artworkEvidence=finding.evidence.find(item=>item.role==='artwork'&&item.page);
    if(!artworkEvidence)continue;
    const page=art.pages.find(item=>item.number===artworkEvidence.page);
    if(!page)continue;
    if(typeof page.visualText==='string'){
      const corroborated=safeCopyMatch(page.visualText,artworkEvidence.quote);
      finding.visibility={state:corroborated?'image_text_corroborated':'needs_human_review',page:page.number,nativeQuote:artworkEvidence.quote,visualExcerpt:page.visualText.slice(0,1200)};
      if(!corroborated){
        add(`visibility:${finding.id}`,`Rendered text check · ${finding.title}`,'review',artworkEvidence.quote,'PDF text was not repeated in the image transcription','The visual transcription did not repeat text found in the PDF data. This may be a vision/OCR miss, so inspect the highlighted rendered crop; it is not proof that the text is invisible.',[artworkEvidence],{text:'Independent image transcription compared with native PDF text. A missed OCR phrase is inconclusive.'},'minor');
        findings.at(-1).method='visibility_review';
      }
    }else finding.visibility={state:'not_checked',page:page.number,nativeQuote:artworkEvidence.quote};
  }
  findings.push(...marketFindings(review),...signalFindings(review));
  const unique=Array.from(new Map(findings.map(f=>[f.id,f])).values());
  const counts={issue:0,review:0,unable:0,match:0};unique.forEach(f=>counts[f.status]++);
  return {facts,conflicts,rules,findings:unique,counts,coverage:{completeArtwork:complete,ruleCount:tasks.length,checks:unique.length,limits:[...(!hasReferenceDocuments?['No product specification or rulebook was supplied. Product-copy correctness remains unverified; observed artwork and detected signals are not approved reference facts.']:[]),'Only supplied sources and supported comparisons were evaluated.','Physical-size, allergen-cue, nutrition-math and reviewer-drawn panel-zone checks are screening aids; they are not a regulatory or print-production certification.','Native text can omit outlined or raster text. Confirm coverage before asserting absence.','Image transcription is a corroboration aid only. A vision/OCR miss requires a person to inspect the rendered crop and does not prove text is absent.']} };
}

export function compareRevisions(previous,current){
  const old=new Map(previous.findings.map(f=>[f.id,f]));const now=new Map(current.findings.map(f=>[f.id,f]));const changes=[];
  for(const f of current.findings){const before=old.get(f.id);const change=!before?'added':before.status!=='match'&&f.status==='match'?'resolved':before.status==='match'&&f.status!=='match'?'new_issue':before.status!==f.status?'changed':'unchanged';changes.push({id:f.id,title:f.title,before:before?.status||null,after:f.status,change});}
  for(const f of previous.findings)if(!now.has(f.id))changes.push({id:f.id,title:f.title,before:f.status,after:null,change:'not_rechecked'});
  const oldSources=new Map((previous.documents||[]).filter(d=>['spec','rules','claims'].includes(d.role)).map(d=>[d.id,d]));
  const newSources=new Map((current.documents||[]).filter(d=>['spec','rules','claims'].includes(d.role)).map(d=>[d.id,d]));
  const sourceIds=new Set([...oldSources.keys(),...newSources.keys()]);
  const changedSourceIds=new Set([...sourceIds].filter(id=>oldSources.get(id)?.sha256!==newSources.get(id)?.sha256));
  const sourceDocuments=[...changedSourceIds].map(id=>{
    const before=oldSources.get(id),after=newSources.get(id),source=after||before;
    return {id,role:source.role,name:source.name,beforeName:before?.name||null,afterName:after?.name||null,change:!before?'added':!after?'removed':'updated'};
  });
  const changedFacts=[];
  for(const documentId of changedSourceIds){
    const beforeDoc=oldSources.get(documentId),afterDoc=newSources.get(documentId),source=afterDoc||beforeDoc;
    const gather=(review,docId)=>Map.groupBy((review.facts||[]).filter(f=>f.documentId===docId),f=>f.field);
    const beforeFacts=gather(previous,documentId),afterFacts=gather(current,documentId);
    for(const field of new Set([...beforeFacts.keys(),...afterFacts.keys()])){
      const before=beforeFacts.get(field)||[],after=afterFacts.get(field)||[];
      const values=list=>list.map(f=>({value:f.value,location:f.evidence?.location||'',name:f.evidence?.name||source.name})).sort((a,b)=>normal(a.value).localeCompare(normal(b.value)));
      const oldValues=values(before),newValues=values(after);
      if(JSON.stringify(oldValues.map(x=>x.value))===JSON.stringify(newValues.map(x=>x.value)))continue;
      changedFacts.push({documentId,role:source.role,name:source.name,field,label:after[0]?.label||before[0]?.label||field,before:oldValues,after:newValues});
    }
  }
  const changedRequirements=[];
  for(const documentId of changedSourceIds){
    const beforeDoc=oldSources.get(documentId),afterDoc=newSources.get(documentId),source=afterDoc||beforeDoc;
    const gather=review=>(review.rules||[]).filter(rule=>rule.source?.documentId===documentId).map(rule=>({id:rule.id,title:rule.title||rule.text||'Supplied check',text:rule.text||rule.title||'',location:rule.source?.location||''}));
    const before=gather(previous),after=gather(current),identity=(rule,index)=>`${rule.location||rule.id}#${index}`;
    const indexRules=rules=>{
      const counts=new Map();return rules.map(rule=>{const key=rule.location||rule.id,index=counts.get(key)||0;counts.set(key,index+1);return [identity(rule,index),rule];});
    };
    const oldRules=new Map(indexRules(before)),newRules=new Map(indexRules(after));
    for(const key of new Set([...oldRules.keys(),...newRules.keys()])){
      const oldRule=oldRules.get(key),newRule=newRules.get(key);
      if(oldRule?.text===newRule?.text&&oldRule?.title===newRule?.title)continue;
      changedRequirements.push({documentId,role:source.role,name:source.name,change:!oldRule?'added':!newRule?'removed':'updated',before:oldRule||null,after:newRule||null});
    }
  }
  const referencesFindingSource=(finding,ids)=> (finding?.evidence||[]).some(item=>ids.has(item.documentId))||ids.has(finding?.rule?.source?.documentId);
  const affectedFindings=[];
  for(const id of new Set([...old.keys(),...now.keys()])){
    const before=old.get(id),after=now.get(id);
    if(!referencesFindingSource(before,changedSourceIds)&&!referencesFindingSource(after,changedSourceIds))continue;
    affectedFindings.push({id,title:after?.title||before?.title||'Check',before:before?.status||null,after:after?.status||null,change:changes.find(item=>item.id===id)?.change||'not_rechecked'});
  }
  const decisionRechecks=Object.entries(previous.decisions||{}).flatMap(([findingId,decision])=>{
    const finding=old.get(findingId);if(!finding||!referencesFindingSource(finding,changedSourceIds))return [];
    const sourceEvidence=(finding.evidence||[]).filter(item=>changedSourceIds.has(item.documentId)&&item.location&&item.location!=='Document');
    const sameSourceLocation=candidate=>(candidate.evidence||[]).some(item=>sourceEvidence.some(oldItem=>item.documentId===oldItem.documentId&&item.location===oldItem.location));
    const currentFinding=now.get(findingId)||(finding.key?(current.findings||[]).find(f=>f.key===finding.key):null)||(current.findings||[]).find(sameSourceLocation)||null;
    return [{findingId,currentFindingId:currentFinding?.id||null,title:finding.title,disposition:decision.disposition,note:decision.note||'',status:finding.status,currentStatus:currentFinding?.status||null,alreadyStale:Boolean(decision.stale)}];
  });
  return {previousId:previous.id,kind:current.revisionKind==='sources'?'sources':'artwork',changes,sourceDocuments,changedFacts,changedRequirements,affectedFindings,decisionRechecks};
}
