const copyKey = value => String(value || '').normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase();

// Keep native PDF extraction independent from visual corroboration. Image-only
// pages may use the reading, but remain explicitly AI-transcribed. When a
// local OCR pass precedes Gemini, retain the OCR evidence separately and only
// carry a location into the corrected reading when there is one exact match.
export function applyTranscriptions(documents, transcriptions=[]){
  for(const reading of transcriptions){
    const doc=documents.find(doc=>doc.id===reading.documentId);
    const page=doc?.pages?.find(page=>page.number===reading.page);
    if(!page||typeof reading.text!=='string'||reading.text.length>=50000||!/[\p{L}\p{N}]/u.test(reading.text.replace(/\[\s*unreadable\s*\]/gi,'')))continue;
    page.visualText=reading.text;
    if(['vision_needed','ocr_transcription','ai_transcription'].includes(page.method)){
      if(page.method==='ocr_transcription'&&!page.ocrText){
        page.ocrText=page.text;
        page.ocrLines=(doc.lines||[]).filter(line=>line.page===page.number).map(line=>({...line}));
      }
      const ocrLines=Array.isArray(page.ocrLines)?page.ocrLines:[];
      const lines=reading.text.split('\n').filter(Boolean).map(text=>{
        const same=ocrLines.filter(line=>copyKey(line.text)===copyKey(text));
        return {text,page:page.number,box:same.length===1?same[0].box||null:null};
      });
      page.text=reading.text;page.method='ai_transcription';
      doc.lines=(doc.lines||[]).filter(line=>line.page!==page.number).concat(lines).sort((a,b)=>a.page-b.page);
      doc.text=doc.pages.map(page=>page.text||'').join('\n');
    }
  }
}
