const recognizedFields=new Set([
  'gtin','gtin8','gtin12','gtin13','gtin14','barcode','ean','ean8','ean13',
  'upc','upca','upce','globaltradeitemnumber',
]);
const fieldAliases=new Set(['gtin','gtin8','gtin12','gtin13','gtin14','barcode','ean','ean8','ean13','upc','upca','upce','globaltradeitemnumber']);

export function gtinDigits(value){
  const text=String(value??'').normalize('NFKC').trim();
  if(!/^[\d\s-]+$/.test(text))return '';
  return text.replace(/[\s-]/g,'');
}

export function hasValidGtinCheckDigit(value){
  const digits=gtinDigits(value);
  if(!/^\d{8}$|^\d{12}$|^\d{13}$|^\d{14}$/.test(digits))return false;
  const body=digits.slice(0,-1);
  let sum=0,weight=3;
  for(let index=body.length-1;index>=0;index--){sum+=Number(body[index])*weight;weight=weight===3?1:3;}
  return (10-(sum%10))%10===Number(digits.at(-1));
}

export function canonicalGtin(value){
  const digits=gtinDigits(value);
  return hasValidGtinCheckDigit(digits)?digits.padStart(14,'0'):'';
}

export function validateBarcodeCheckDigit(value) {
  const digits = gtinDigits(value);
  const valid = hasValidGtinCheckDigit(digits);
  const type = digits.length === 12 ? 'UPC-A / GTIN-12' :
               digits.length === 13 ? 'EAN-13 / GTIN-13' :
               digits.length === 14 ? 'GTIN-14' :
               digits.length === 8 ? 'GTIN-8' : 'Barcode';
  const body = digits.slice(0, -1);
  let sum = 0, weight = 3;
  for (let index = body.length - 1; index >= 0; index--) {
    sum += Number(body[index]) * weight;
    weight = weight === 3 ? 1 : 3;
  }
  const calculatedCheckDigit = (10 - (sum % 10)) % 10;
  const observedCheckDigit = digits.length ? Number(digits.at(-1)) : null;

  return {
    digits,
    valid,
    type,
    calculatedCheckDigit,
    observedCheckDigit
  };
}

function fieldName(value){return String(value??'').normalize('NFKC').toLowerCase().replace(/[^a-z0-9]/g,'');}
function identifier(value){
  if(typeof value!=='string'&&typeof value!=='number')return '';
  const text=String(value).trim();
  if(!/^[\d\s-]+$/.test(text))return '';
  const digits=text.replace(/[\s-]/g,'');
  return digits.length>=6&&digits.length<=14?digits:'';
}
function spreadsheetValue(cell){
  const value=cell?.value;
  if(typeof value==='number'&&Number.isSafeInteger(value)){
    const format=String(cell.numberFormat||'').split(';')[0].replace(/"[^"]*"/g,'').trim();
    if(/^0{8,14}$/.test(format))return String(value).padStart(format.length,'0');
  }
  return value;
}

export function suppliedGtinCandidates(documents=[]){
  const found=[],seen=new Set();
  const add=(doc,value,location)=>{
    const digits=identifier(value);
    if(!digits)return;
    const key=`${doc.id||doc.name||''}\0${digits}\0${location||''}`;
    if(seen.has(key))return;seen.add(key);
    found.push({value:digits,documentId:doc.id,name:doc.name,location});
  };
  const visit=(doc,value,path='')=>{
    if(Array.isArray(value)){value.forEach((item,index)=>visit(doc,item,`${path}[${index}]`));return;}
    if(!value||typeof value!=='object')return;
    for(const [key,item] of Object.entries(value)){
      const field=fieldName(key),next=path?`${path}.${key}`:key;
      if(recognizedFields.has(field))add(doc,item,next);
      else if(item&&typeof item==='object')visit(doc,item,next);
    }
  };
  const labelPattern=/\b(?:global\s+trade\s+item\s+number|gtin(?:[-\s]?(?:8|12|13|14))?|ean(?:[-\s]?(?:8|13))?|upc(?:[-\s]?(?:a|e))?|barcode)\b\s*["']?\s*[:=#]\s*["']?\s*([\d][\d\s-]{5,20})/ig;
  for(const doc of documents){
    if(doc.role!=='spec')continue;
    visit(doc,doc.data);
    for(const line of doc.lines||[]){
      labelPattern.lastIndex=0;
      for(const match of String(line.text||'').matchAll(labelPattern))add(doc,match[1],line.line?`Line ${line.line}`:line.paragraph?`Paragraph ${line.paragraph}`:'Source text');
    }
    // Spreadsheet tables commonly use a UPC / EAN / GTIN column header.
    const bySheet=new Map();
    for(const cell of doc.cells||[]){
      const key=String(cell.sheet||'')+'\0'+String(cell.row||'');
      if(!bySheet.has(key))bySheet.set(key,[]);bySheet.get(key).push(cell);
    }
    const rows=[...bySheet.values()];
    for(const header of rows){
      const columns=header.filter(cell=>fieldAliases.has(fieldName(cell.value)));
      for(const column of columns){
        for(const row of rows){
          if(row[0]?.sheet!==column.sheet||Number(row[0]?.row)<=Number(column.row))continue;
          const value=row.find(cell=>Number(cell.col)===Number(column.col));
          const displayValue=spreadsheetValue(value);
          if(value&&identifier(displayValue))add(doc,displayValue,`${column.sheet}!${value.cell||`row ${value.row}`}`);
        }
      }
    }
    for(let headerIndex=0;headerIndex<(doc.rows||[]).length;headerIndex++){
      const header=doc.rows[headerIndex]||[];
      for(let column=0;column<header.length;column++)if(fieldAliases.has(fieldName(header[column]))){
        for(let rowIndex=headerIndex+1;rowIndex<(doc.rows||[]).length;rowIndex++){
          const value=doc.rows[rowIndex]?.[column];
          if(identifier(value))add(doc,value,`CSV row ${rowIndex+1}, column ${column+1}`);
        }
      }
    }
    // Preserve explicit key/value pairs represented as two spreadsheet cells.
    for(const row of rows){
      const sorted=[...row].sort((a,b)=>Number(a.col)-Number(b.col));
      for(let index=0;index<sorted.length-1;index++)if(fieldAliases.has(fieldName(sorted[index].value)))add(doc,spreadsheetValue(sorted[index+1]),`${sorted[index+1].sheet}!${sorted[index+1].cell||`row ${sorted[index+1].row}`}`);
    }
  }
  return found;
}

export function classifyGtinFormat(value) {
  const digits = gtinDigits(value);
  if (/^\d{8}$/.test(digits)) return 'GTIN-8';
  if (/^\d{12}$/.test(digits)) return 'GTIN-12';
  if (/^\d{13}$/.test(digits)) return 'GTIN-13';
  if (/^\d{14}$/.test(digits)) return 'GTIN-14';
  return 'UNKNOWN_FORMAT';
}

export const GTIN_VERIFICATION_DISCLAIMERS = {
  CHECKSUM_ONLY: 'GS1 modulo-10 check digit mathematically verified. This check does not verify barcode quiet-zone dimensions, print contrast, symbol grade, or scan reliability on press.',
};
