"""Bounded document parsing. Uploaded content is data; macros and links are never run."""
import sys, json, re, csv, io, hashlib, zipfile, logging
from pathlib import Path
_lib_dir = str(Path(__file__).resolve().parent)
if _lib_dir not in sys.path:
    sys.path.insert(0, _lib_dir)
from xml.sax.saxutils import escape
from local_ocr import read_artwork
from pdf_visibility import analyze_pdf_visibility
logging.disable(logging.CRITICAL)
MAX_PAGES = 12

def scan_codes(image):
    """Return type/location and an isolated GTIN, never arbitrary barcode payloads."""
    try:
        import zxingcpp
        width,height=image.size; found=[]
        for result in zxingcpp.read_barcodes(image,return_errors=True):
            format_name=getattr(result.format,'name',str(result.format))
            # A decoded EAN/UPC value can still have a bad check digit. Keep it
            # long enough for the review engine to report that defect. For
            # other symbologies, preserve the old decoder-validity gate.
            decoded=getattr(result,'text','') or ''
            candidate=gtin_from_payload(decoded,format_name)
            if not result.valid and not candidate: continue
            points=[result.position.top_left,result.position.top_right,result.position.bottom_left,result.position.bottom_right]
            xs=[point.x for point in points]; ys=[point.y for point in points]
            item=dict(format=format_name,box=[max(0,min(1,min(xs)/width)),max(0,min(1,min(ys)/height)),max(0,min(1,max(xs)/width)),max(0,min(1,max(ys)/height))])
            if candidate:item['gtin']=candidate
            found.append(item)
        return found, None
    except ImportError:
        return [], 'Local barcode scanner is unavailable; code presence was not verified.'
    except Exception:
        return [], 'Local barcode scanner could not read this rendered page; code presence remains unverified.'

def gtin_from_payload(payload, format_name):
    """Extract only a GTIN-shaped value from known barcode formats or GS1 AI 01."""
    value=str(payload or '').strip()
    # GS1 AI 01 explicitly identifies the following 14 digits as a GTIN.
    gs1=re.search(r'(?:\(01\)|\]C101|\]d201|\]Q301|(?:^|/)01/|^01)(\d{14})(?!\d)',value,re.I)
    if gs1:return gs1.group(1)
    fmt=re.sub(r'[^a-z0-9]','',str(format_name or '').lower())
    digits=re.sub(r'[\s-]','',value)
    if not digits.isdigit():return None
    if fmt in ('upce','upce0','upce1') and len(digits)==8:
        ns,a,b,c,d,e,last,check=digits
        if last in '012':upc_a=ns+a+b+last+'0000'+c+d+e+check
        elif last=='3':upc_a=ns+a+b+c+'00000'+d+e+check
        elif last=='4':upc_a=ns+a+b+c+d+'00000'+e+check
        else:upc_a=ns+a+b+c+d+e+'0000'+last+check
        return upc_a
    # ZXing-C++ can normalize UPC-A / UPC-E to the EAN-13 representation by
    # adding a leading zero; accept that canonical form as well as native UPC-E.
    if fmt in ('ean8','ean13','upca','upce','itf','itf14','databar','databarexpanded','databaromni','databarstacked') and len(digits) in (8,12,13,14):
        return digits
    # Some scanner builds expose GTIN-14 symbols under a more specific ITF name.
    if fmt.startswith('itf') and len(digits)==14:return digits
    return None

def detect_structural_edges(image):
    """Suggest long straight dieline strokes from a rendered page, without classifying cut vs fold."""
    try:
        from PIL import ImageFilter
        gray=image.convert('L')
        gray.thumbnail((720,720))
        width,height=gray.size
        if width<80 or height<80:return []
        # Avoid interpreting a printed/color-heavy artwork page as a structural drawing.
        dark=gray.point(lambda value:255 if value<155 else 0)
        if dark.histogram()[255]/max(1,width*height)>.34:return []
        # Thicken hairlines slightly so antialiasing does not break a stroke into gaps.
        dark=dark.filter(ImageFilter.MaxFilter(3));pixels=dark.load()
        edges=[]
        def scan(axis,positions,span):
            found=[];gap_limit=max(3,round(span*.012))
            for position in range(positions):
                run=hits=longest=gap=0;first=last=None
                for offset in range(span):
                    hit=any(pixels[min(width-1,max(0,position+delta)),offset] for delta in (-1,0,1)) if axis=='vertical' else any(pixels[offset,min(height-1,max(0,position+delta))] for delta in (-1,0,1))
                    if hit:
                        if first is None:first=offset
                        last=offset;hits+=1;gap=0;run=(run or 0)+1;longest=max(longest,run)
                    elif run is not None:
                        gap+=1
                        if gap>gap_limit:run=None;gap=0
                if hits>=span*.22 and longest>=span*.18 and first is not None and last-first>=span*.2:
                    found.append((position,first,last))
            groups=[]
            for item in found:
                if not groups or item[0]-groups[-1][-1][0]>4:groups.append([item])
                else:groups[-1].append(item)
            for group in groups:
                position=round(sum(item[0] for item in group)/len(group));start=min(item[1] for item in group);end=max(item[2] for item in group)
                if axis=='vertical':edges.append(dict(axis=axis,position=position/width,extent=[start/height,end/height],source='rendered line candidate'))
                else:edges.append(dict(axis=axis,position=position/height,extent=[start/width,end/width],source='rendered line candidate'))
        scan('vertical',width,height)
        scan('horizontal',height,width)
        return edges[:80]
    except Exception:
        # Structural suggestions are optional. Extraction and ordinary review must still complete.
        return []

def _dxf_kind(layer, linetype=''):
    """Use explicit DXF layer/linetype names only; never infer semantics from color."""
    def tokens(value):
        value=re.sub(r'(?<=[a-z])(?=[A-Z])',' ',str(value or ''))
        return re.findall(r'[a-z]+',value.lower())
    words=set(tokens(layer)+tokens(linetype))
    joined=''.join(tokens(layer)+tokens(linetype))
    if words.intersection({'cut','knife','cutline','cutting'}) or 'diecut' in joined or 'cutcontour' in joined:return 'cut'
    if words.intersection({'crease','fold','score','bend'}):return 'crease'
    if words.intersection({'glue','adhesive'}):return 'glue'
    if words.intersection({'perf','perforation','perforate'}):return 'perforation'
    return 'unclassified'

def extract_dxf(path, outdir, artifact_id, name):
    """Read bounded ASCII DXF lines, lightweight polylines and face labels."""
    p=Path(path); raw=p.read_bytes()
    if len(raw)>15_000_000:raise ValueError('DXF exceeds the 15 MB file limit.')
    if b'\x00' in raw:raise ValueError('Binary DXF is not supported. Export an ASCII DXF with LINE or LWPOLYLINE entities.')
    try:source=raw.decode('utf-8-sig')
    except UnicodeDecodeError:raise ValueError('DXF must be ASCII or UTF-8 encoded.')
    rows=source.splitlines()
    if len(rows)>200_000:raise ValueError('DXF exceeds 100,000 group-code pairs.')
    if len(rows)%2:raise ValueError('Malformed DXF group-code stream.')
    pairs=[]
    try:
        for index in range(0,len(rows),2):pairs.append((int(rows[index].strip()),rows[index+1].strip()))
    except ValueError:raise ValueError('Malformed DXF group-code stream.')
    if len(pairs)>1_000_000:raise ValueError('DXF has too many group codes.')
    section='';records=[];header=[];index=0
    while index<len(pairs):
        code,value=pairs[index]
        if code==0 and value=='SECTION' and index+1<len(pairs):
            section=pairs[index+1][1] if pairs[index+1][0]==2 else ''
            index+=2;continue
        if code==0 and value=='ENDSEC':section='';index+=1;continue
        if section=='HEADER':header.append((code,value))
        if section=='ENTITIES' and code==0:
            entity=value;groups=[];index+=1
            while index<len(pairs) and pairs[index][0]!=0:
                groups.append(pairs[index]);index+=1
            records.append((entity,groups));continue
        index+=1
    if len(records)>25_000:raise ValueError('DXF exceeds 25,000 entities; export only the active dieline.')
    units_code=None
    for position,(code,value) in enumerate(header):
        if code==9 and value=='$INSUNITS' and position+1<len(header) and header[position+1][0]==70:
            try:units_code=int(header[position+1][1])
            except ValueError:pass
    units={0:'unitless',1:'inches',2:'feet',4:'millimeters',5:'centimeters',6:'meters',7:'kilometers',8:'microinches',9:'mils',10:'yards',11:'angstroms',12:'nanometers',13:'microns',14:'decimeters',15:'decameters',16:'hectometers',17:'gigameters',18:'astronomical units',19:'light years',20:'parsecs'}
    def group_values(groups,code):return [value for item,value in groups if item==code]
    def number(groups,code,default=None):
        values=group_values(groups,code)
        try:return float(values[0]) if values else default
        except ValueError:return default
    segments=[];polylines=[];labels=[];unsupported=set()
    for entity,groups in records:
        layer=(group_values(groups,8) or ['0'])[0][:128]
        linetype=(group_values(groups,6) or [''])[0][:128]
        if entity=='LINE':
            x0=number(groups,10);y0=number(groups,20);x1=number(groups,11);y1=number(groups,21)
            if None not in (x0,y0,x1,y1):segments.append(dict(points=[[x0,y0],[x1,y1]],layer=layer,kind=_dxf_kind(layer,linetype)))
        elif entity=='LWPOLYLINE':
            xs=group_values(groups,10);ys=group_values(groups,20)
            try:points=[[float(x),float(y)] for x,y in zip(xs,ys)]
            except ValueError:points=[]
            if len(points)>=2:
                try:closed=bool((int((group_values(groups,70) or ['0'])[0])&1))
                except ValueError:closed=False
                poly=dict(points=points,closed=closed,layer=layer,kind=_dxf_kind(layer,linetype))
                polylines.append(poly)
                pairs=list(zip(points,points[1:]))+([(points[-1],points[0])] if closed else [])
                segments.extend(dict(points=[a,b],layer=layer,kind=poly['kind']) for a,b in pairs)
        elif entity in ('TEXT','MTEXT'):
            x=number(groups,10);y=number(groups,20);value=' '.join(group_values(groups,1)+group_values(groups,3)).replace('\\P',' ').strip()
            if x is not None and y is not None and value:labels.append(dict(text=value[:200],point=[x,y],layer=layer))
        elif entity not in ('POINT','SEQEND','VERTEX','END'):unsupported.add(entity)
    points=[point for segment in segments for point in segment['points']]+[point for label in labels for point in [label['point']]]
    if not segments or not points:raise ValueError('No supported LINE or LWPOLYLINE geometry found. Export the dieline as ASCII DXF with those entities.')
    if any(not all(abs(value)<1e12 for value in point) for point in points):raise ValueError('DXF coordinates are outside the supported range.')
    min_x=min(point[0] for point in points);max_x=max(point[0] for point in points);min_y=min(point[1] for point in points);max_y=max(point[1] for point in points)
    span_x=max_x-min_x;span_y=max_y-min_y
    if span_x<=0:span_x=max(span_y*.01,1);min_x-=span_x/2;max_x+=span_x/2
    if span_y<=0:span_y=max(span_x*.01,1);min_y-=span_y/2;max_y+=span_y/2
    scale=1200/max(span_x,span_y);svg_width=round(span_x*scale+60);svg_height=round(span_y*scale+60)
    def norm(point):return [(point[0]-min_x)/span_x,1-(point[1]-min_y)/span_y]
    def svgpoint(point):
        x,y=norm(point);return [round(30+x*span_x*scale,2),round(30+y*span_y*scale,2)]
    colors={'cut':'#d94f3d','crease':'#367aa1','glue':'#c28b20','perforation':'#8b62a5','unclassified':'#313d36'}
    dash={'crease':' stroke-dasharray="10 7"','glue':' stroke-dasharray="4 5"','perforation':' stroke-dasharray="12 4 2 4"'}
    svg=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{svg_width}" height="{svg_height}" viewBox="0 0 {svg_width} {svg_height}"><rect width="100%" height="100%" fill="#fff"/>']
    for segment in segments:
        points_svg=[svgpoint(point) for point in segment['points']]
        point_text=' '.join(f'{x},{y}' for x,y in points_svg);kind=segment['kind']
        svg.append(f'<polyline points="{point_text}" fill="none" stroke="{colors[kind]}" stroke-width="2"{dash.get(kind,"")}/>')
    for label in labels:
        x,y=svgpoint(label['point']);text=escape(label['text'])
        svg.append(f'<text x="{x}" y="{y}" font-family="Arial,sans-serif" font-size="14" fill="#26342d">{text}</text>')
    svg.append('</svg>')
    out=Path(outdir);out.mkdir(parents=True,exist_ok=True);image_name=f'{artifact_id}-p1.svg';(out/image_name).write_text(''.join(svg),encoding='utf-8')
    def face_from_label(value):
        text=' '+re.sub(r'[^a-z]+',' ',value.lower()).strip()+' '
        for aliases,face in [(('front',),'front'),(('back','rear'),'back'),(('left',),'left'),(('right',),'right'),(('top',),'top'),(('bottom',),'bottom')]:
            if any(f' {word} ' in text for word in aliases):return face
        return None
    def inside(point,polygon):
        x,y=point;hit=False
        for first,last in zip(polygon,polygon[1:]+polygon[:1]):
            x0,y0=first;x1,y1=last
            if ((y0>y)!=(y1>y)) and x<(x1-x0)*(y-y0)/(y1-y0+1e-30)+x0:hit=not hit
        return hit
    region_candidates=[]
    for polyline in polylines:
        if not polyline['closed'] or len(polyline['points'])<3:continue
        polygon=polyline['points'];xs=[point[0] for point in polygon];ys=[point[1] for point in polygon]
        box=[(min(xs)-min_x)/span_x,1-(max(ys)-min_y)/span_y,(max(xs)-min_x)/span_x,1-(min(ys)-min_y)/span_y]
        area=abs(sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(polygon,polygon[1:]+polygon[:1])))/2/(span_x*span_y)
        if area<.006:continue
        region_candidates.append(dict(page=1,box=[max(0,min(1,value)) for value in box],points=[norm(point) for point in polygon],layer=polyline['layer'],sourceLabel='',face=None,area=area,_polygon=polygon))
    assignments={}
    for label in labels:
        containing=[(index,region) for index,region in enumerate(region_candidates) if inside(label['point'],region['_polygon'])]
        if containing:
            index,region=min(containing,key=lambda item:item[1]['area'])
            face=face_from_label(label['text'])
            if face:assignments.setdefault(index,[]).append((label,face))
    regions=[]
    for index,region in enumerate(region_candidates):
        region.pop('_polygon')
        matching=assignments.get(index,[])
        if matching:region['sourceLabel']=matching[0][0]['text'];region['face']=matching[0][1]
        regions.append(region)
    panel_labels=[]
    for label in labels:
        x,y=norm(label['point']);face=face_from_label(label['text']);label_width=min(.16,max(.015,len(label['text'])*.004));label_height=.018
        panel_labels.append(dict(text=label['text'],page=1,box=[max(0,x-label_width/2),max(0,y-label_height/2),min(1,x+label_width/2),min(1,y+label_height/2)],face=face))
    counts={kind:sum(segment['kind']==kind for segment in segments) for kind in colors}
    doc=dict(id=artifact_id,name=name,role='dieline',sha256=hashlib.sha256(raw).hexdigest(),bytes=len(raw),pages=[dict(number=1,width=span_x,height=span_y,unit=units.get(units_code,'drawing units'),image=image_name,text='',codes=[],method='dxf_vector_geometry')],cells=[],lines=[],panelLabels=panel_labels,structuralEdges=[],vectorLines=[dict(page=1,points=[norm(point) for point in segment['points']],layer=segment['layer'],kind=segment['kind']) for segment in segments],vectorRegions=regions,vectorGeometry=dict(format='DXF',units=units.get(units_code,'drawing units'),entityCount=len(records),lineCount=len(segments),regionCount=len(regions),lineKinds=counts,unsupportedEntities=sorted(unsupported)),warnings=[],text='',data=None)
    if unsupported:doc['warnings'].append('DXF preview preserves LINE and LWPOLYLINE entities; unsupported entities were omitted: '+', '.join(sorted(unsupported)[:12])+'. Inspect the original CAD file for blocks, splines, arcs, hatches, and paper-space geometry.')
    if not labels:doc['warnings'].append('No positioned face text was found in the supported DXF entities. Exact linework is shown; map artwork faces manually.')
    return doc

def extract(path, role, outdir, artifact_id, name):
    from PIL import Image, ImageOps
    p = Path(path); out = Path(outdir); out.mkdir(parents=True, exist_ok=True)
    doc = dict(id=artifact_id, name=name, role=role, sha256=hashlib.sha256(p.read_bytes()).hexdigest(),
               bytes=p.stat().st_size, pages=[], cells=[], lines=[], panelLabels=[], structuralEdges=[],
               sourcePieces=[], ignoredSourcePieces=[], extractionDiagnostics={}, warnings=[], text='', data=None)
    ext = p.suffix.lower()
    if ext=='.dxf':
        if role!='dieline':raise ValueError('DXF files are supported only as a dieline / structural reference.')
        return extract_dxf(p,outdir,artifact_id,name)
    if ext in ('.xlsx', '.docx'):
        with zipfile.ZipFile(p) as archive:
            if len(archive.infolist()) > 2000 or sum(x.file_size for x in archive.infolist()) > 80_000_000:
                raise ValueError('Expanded Office document exceeds the safe parsing limit.')
    if ext == '.pdf':
        import pypdfium2 as pdfium
        if not p.read_bytes()[:1024].lstrip().startswith(b'%PDF-'):
            raise ValueError('File does not have a PDF signature.')
        pdf = pdfium.PdfDocument(str(p))
        if len(pdf) > MAX_PAGES: raise ValueError('Limit: 12 PDF pages per file. Split the document into relevant sections.')
        vis_report = None
        try:
            from pdf_visibility import analyze_pdf_visibility
            vis_report = analyze_pdf_visibility(str(p), max_pages=MAX_PAGES)
        except Exception:
            vis_report = None

        for n in range(len(pdf)):
            page = pdf[n]; width, height = page.get_size(); left, bottom, right, top = page.get_bbox()
            if width <= 0 or height <= 0: raise ValueError('Invalid PDF page dimensions.')
            image_name = f'{artifact_id}-p{n+1}.png'
            rendered=page.render(scale=min(2, 1800/max(width,height))).to_pil().convert('RGB')
            rendered.save(out/image_name)
            if role=='dieline':doc['structuralEdges'] += [dict(page=n+1,**edge) for edge in detect_structural_edges(rendered)]
            codes, scan_warning=scan_codes(rendered)
            tp = page.get_textpage(); text = tp.get_text_range().replace('\x00','')
            if len(text) > 100_000: raise ValueError('Too much text in one PDF page.')
            lines=[]
            panel_label=re.compile(r'\b(?:front|back|rear|left|right|top|bottom)\s+(?:(?:carton|label|side)\s+)?(?:panel|side|face|gusset|label)\b|\b(?:panel|side|face|gusset)\s+(?:of\s+)?(?:front|back|rear|left|right|top|bottom)\b|\blabel\s+[ab]\b',re.I)
            def text_rect(start,end):
                boxes=[]
                for ix in range(start,min(end,tp.count_chars())):
                    try:
                        b=tp.get_charbox(ix)
                        if b[2]>b[0] and b[3]>b[1]: boxes.append(b)
                    except Exception: pass
                if not boxes or page.get_rotation()!=0:return None
                x0=min(b[0] for b in boxes);y0=min(b[1] for b in boxes)
                x1=max(b[2] for b in boxes);y1=max(b[3] for b in boxes)
                return [max(0,min(1,(x0-left)/width)),max(0,min(1,(top-y1)/height)),
                        max(0,min(1,(x1-left)/width)),max(0,min(1,(top-y0)/height))]
            for m in re.finditer(r'[^\r\n]+', text):
                raw=m.group();leading=len(raw)-len(raw.lstrip());value=raw.strip()
                if not value: continue
                text_start=m.start()+leading
                rect=text_rect(text_start,text_start+len(value))
                lines.append(dict(text=value,page=n+1,box=rect))
                # PDF text extraction can merge horizontally aligned dieline
                # headings into one line. Keep their precise text-span boxes
                # separately so the 3D preview can locate each named face.
                for label_match in panel_label.finditer(value):
                    label_box=text_rect(text_start+label_match.start(),text_start+label_match.end())
                    if label_box:doc['panelLabels'].append(dict(text=label_match.group(),page=n+1,box=label_box))
            method='pdf_text' if len(text.strip())>40 else 'vision_needed'
            if role=='artwork' and method=='vision_needed':
                ocr_lines,ocr_warning=read_artwork(out/image_name,*rendered.size,n+1)
                if ocr_lines:
                    lines=ocr_lines;text='\n'.join(line['text'] for line in lines);method='ocr_transcription'
                elif ocr_warning:doc['warnings'].append(ocr_warning)

            # Correlate extracted lines with paint-order visibility analysis
            page_vis = vis_report['pages'][n] if vis_report and n < len(vis_report.get('pages', [])) else None
            vis_spans = page_vis.get('spans', []) if page_vis else []
            hidden_spans = [s for s in vis_spans if s.get('kind') == 'hidden']

            for line in lines:
                l_box = line.get('box')
                l_text = line.get('text', '').strip()
                if not l_box or len(l_box) != 4 or None in l_box:
                    line['kind'] = 'visible'
                    continue

                matched_hidden = None
                for hs in hidden_spans:
                    hs_box = hs.get('box')
                    hs_text = hs.get('text', '').strip()
                    if not hs_box or len(hs_box) != 4 or None in hs_box:
                        continue
                    if not (l_box[2] < hs_box[0] or l_box[0] > hs_box[2] or l_box[3] < hs_box[1] or l_box[1] > hs_box[3]):
                        if hs_text in l_text or l_text in hs_text:
                            matched_hidden = hs
                            break
                        ix0 = max(l_box[0], hs_box[0])
                        iy0 = max(l_box[1], hs_box[1])
                        ix1 = min(l_box[2], hs_box[2])
                        iy1 = min(l_box[3], hs_box[3])
                        inter_a = (ix1 - ix0) * (iy1 - iy0)
                        line_a = max(1e-6, (l_box[2] - l_box[0]) * (l_box[3] - l_box[1]))
                        if inter_a / line_a > 0.40:
                            matched_hidden = hs
                            break

                if matched_hidden:
                    line['kind'] = 'hidden'
                    line['visibility'] = matched_hidden.get('visibility', {})
                    if 'occluder' in matched_hidden:
                        line['occluder'] = matched_hidden['occluder']
                else:
                    line['kind'] = 'visible'

            visible_lines = [l for l in lines if l.get('kind') != 'hidden']
            page_visible_text = '\n'.join(l['text'] for l in visible_lines)
            page_full_text = text

            doc['lines'] += lines
            doc['pages'].append(dict(number=n+1,width=width,height=height,unit='pt',image=image_name,
                                      text=page_visible_text,
                                      visibleText=page_visible_text,
                                      fullText=page_full_text,
                                      codes=codes,
                                      method=method,
                                      hiddenLines=[l for l in lines if l.get('kind') == 'hidden']))
            if scan_warning and scan_warning not in doc['warnings']: doc['warnings'].append(scan_warning)
            if method=='vision_needed':
                doc['warnings'].append(f'Dieline page {n+1} has little extractable face-label text; inspect the line candidates and map faces manually.' if role=='dieline' else f'Page {n+1} has little extractable text. Vision or manual review is needed.')
            tp.close(); page.close()
        pdf.close()
        doc['text']='\n\n'.join(x['text'] for x in doc['pages'])
        doc['fullText']='\n\n'.join(x.get('fullText', x['text']) for x in doc['pages'])
        doc['hiddenLines'] = [l for l in doc['lines'] if l.get('kind') == 'hidden']
        if vis_report:
            doc['visibilityReport'] = vis_report

        recon_report = None
        try:
            from pdf_text_reconstruction import reconstruct_pdf_text
            recon_report = reconstruct_pdf_text(str(p), max_pages=MAX_PAGES, vis_report=vis_report)
            if recon_report:
                doc['textReconstruction'] = recon_report
                doc['reconstructedSegments'] = recon_report.get('reconstructedSegments', [])
                for seg in doc['reconstructedSegments']:
                    p_num = seg.get('page', 1)
                    if 0 < p_num <= len(doc['pages']):
                        doc['pages'][p_num - 1].setdefault('reconstructedSegments', []).append(seg)
                    for l in doc['lines']:
                        if l.get('page') == p_num:
                            raw_l = l.get('text', '').strip()
                            raw_s = seg.get('rawText', '').strip()
                            if raw_s and (raw_s in raw_l or raw_l in raw_s):
                                l['reconstructedText'] = seg.get('reconstructedText')
                                l['reconstructionSegmentId'] = seg.get('segmentId')
                                l['reconstructionKind'] = seg.get('kind')
                                l['reconstructionAuthority'] = seg.get('authority')
                                break
        except Exception:
            recon_report = None
        if role=='artwork':
            try:
                import importlib
                preflight_mod=importlib.import_module('preflight')
                doc['preflight']=preflight_mod.run_preflight_pipeline(str(p),dict(codes=[c for page in doc['pages'] for c in page.get('codes',[])]))
            except Exception:
                pass
            try:
                from pdf_typography import inspect_pdf_typography
                typo_res = inspect_pdf_typography(str(p), dict(documentId=artifact_id))
                if typo_res and typo_res.get('status') == 'ok':
                    doc['nativeTypography'] = typo_res
                    doc['vectorTypography'] = typo_res
            except Exception:
                pass
        try:
            from source_piece import parse_pdf_file
            sp_res = parse_pdf_file(str(p), check_render=True)
            doc['sourcePieces'] = sp_res.get('pieces', [])
            doc['ignoredSourcePieces'] = sp_res.get('ignoredList', [])
            doc['extractionDiagnostics'] = sp_res.get('extractionDiagnostics', sp_res.get('summary', {}))
        except Exception:
            pass
    elif ext in ('.png','.jpg','.jpeg','.webp'):
        Image.MAX_IMAGE_PIXELS=40_000_000
        im=Image.open(p); im=ImageOps.exif_transpose(im).convert('RGB')
        width,height=im.size
        if width*height>40_000_000: raise ValueError('Image exceeds 40 megapixels.')
        im.thumbnail((1800,1800)); image_name=f'{artifact_id}-p1.png'; im.save(out/image_name)
        codes, scan_warning=scan_codes(im)
        doc['pages']=[dict(number=1,width=width,height=height,unit='px',image=image_name,text='',codes=codes,method='vision_needed')]
        if scan_warning: doc['warnings'].append(scan_warning)
        if role=='dieline':
            doc['structuralEdges']=[dict(page=1,**edge) for edge in detect_structural_edges(im)]
            doc['warnings'].append('Dieline image has no locally extracted face labels. Inspect the rendered line candidates and assign artwork faces manually; no OCR text was inferred.')
        elif role=='artwork':
            ocr_lines,ocr_warning=read_artwork(out/image_name,*im.size,1)
            if ocr_lines:
                doc['lines']=ocr_lines;doc['text']='\n'.join(line['text'] for line in ocr_lines)
                doc['pages'][0].update(text=doc['text'],method='ocr_transcription')
            if ocr_warning:doc['warnings'].append(ocr_warning)
    elif ext=='.xlsx':
        from openpyxl import load_workbook
        wb=load_workbook(p,read_only=True,data_only=True,keep_links=False)
        for sheet in wb:
            max_r = sheet.max_row or 0
            max_c = sheet.max_column or 0
            if max_r > 2000 or max_c > 80: raise ValueError('Spreadsheet limit: 2,000 rows and 80 columns per sheet.')
            for row in sheet.iter_rows():
                for cell in row:
                    if cell.value is not None:
                        value=str(cell.value)
                        doc['cells'].append(dict(sheet=sheet.title,cell=cell.coordinate,row=cell.row or 1,col=cell.column or 1,value=value,numberFormat=cell.number_format))
        wb.close()
        doc['text']='\n'.join(f"{c['sheet']}!{c['cell']}: {c['value']}" for c in doc['cells'])
        doc['warnings'].append('Spreadsheet formulas use their saved values; formulas, macros, and external links are not executed.')
        try:
            from source_piece import parse_excel_file
            sp_res = parse_excel_file(str(p))
            doc['sourcePieces'] = sp_res.get('pieces', [])
            doc['ignoredSourcePieces'] = sp_res.get('ignoredList', [])
            doc['metadataPieces'] = sp_res.get('metadataPieces', [])
            doc['extractionDiagnostics'] = sp_res.get('extractionDiagnostics', sp_res.get('summary', {}))
        except Exception:
            pass
    elif ext=='.docx':
        from docx import Document
        d=Document(p)
        doc['lines']=[dict(text=x.text,paragraph=i+1) for i,x in enumerate(d.paragraphs) if x.text.strip()]
        for ti,table in enumerate(d.tables):
            for ri,row in enumerate(table.rows):
                for ci,cell in enumerate(row.cells):
                    if cell.text.strip(): doc['cells'].append(dict(sheet=f'Table {ti+1}',cell=f'R{ri+1}C{ci+1}',row=ri+1,col=ci+1,value=cell.text))
        doc['text']='\n'.join(x['text'] for x in doc['lines'])+'\n'+'\n'.join(f"{x['sheet']}!{x['cell']}: {x['value']}" for x in doc['cells'])
        doc['warnings'].append('Embedded images in Word files are not analyzed. Export image-heavy documents as PDF.')
    elif ext in ('.json','.csv','.txt','.md'):
        raw=p.read_text(encoding='utf-8-sig')
        if len(raw)>150_000: raise ValueError('Text input exceeds 150,000 characters.')
        doc['text']=raw
        doc['lines']=[dict(text=line,line=i+1) for i,line in enumerate(raw.splitlines()) if line.strip()]
        if ext=='.json': doc['data']=json.loads(raw)
        if ext=='.csv':
            rows=list(csv.reader(io.StringIO(raw)))
            if len(rows)>2000: raise ValueError('CSV limit is 2,000 rows.')
            doc['rows']=rows
    else: raise ValueError('Supported formats: PDF, PNG, JPEG, WebP, XLSX, DOCX, CSV, JSON, TXT and MD.')
    if len(doc['text'])>200_000: raise ValueError('Document text exceeds 200,000 characters; upload relevant sections only.')
    return doc

def report(review_path, output):
    import importlib.util
    pdf_module_path = Path(__file__).parent / 'report-pdf.py'
    if pdf_module_path.exists():
        spec = importlib.util.spec_from_file_location('report_pdf', pdf_module_path)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        return mod.generate_pdf_report(review_path, output)
    raise RuntimeError('report-pdf.py generator not found.')


if __name__=='__main__':
    try:
        args=json.load(sys.stdin)
        result=report(args['review'],args['output']) if args.get('action')=='report' else extract(args['path'],args['role'],args['outdir'],args['id'],args['name'])
        print(json.dumps(result,ensure_ascii=False))
    except Exception as e:
        print(json.dumps({'error':str(e)[:500]}));sys.exit(1)
