// Keep native PDF extraction independent from visual corroboration. Image-only
// pages may use the reading, but remain explicitly AI-transcribed.
export function applyTranscriptions(documents, transcriptions=[]){
  for(const reading of transcriptions){
    const doc=documents.find(doc=>doc.id===reading.documentId);
    const page=doc?.pages?.find(page=>page.number===reading.page);
    if(!page||typeof reading.text!=='string'||reading.text.length>=50000||!/[\p{L}\p{N}]/u.test(reading.text.replace(/\[\s*unreadable\s*\]/gi,'')))continue;
    page.visualText=reading.text;
    if(['vision_needed','ai_transcription'].includes(page.method)){
      page.text=reading.text;page.method='ai_transcription';
      doc.lines=(doc.lines||[]).filter(line=>line.page!==page.number).concat(reading.text.split('\n').filter(Boolean).map(text=>({text,page:page.number,box:null}))).sort((a,b)=>a.page-b.page);
      doc.text=doc.pages.map(page=>page.text||'').join('\n');
    }
  }
}
