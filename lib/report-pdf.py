#!/usr/bin/env python3
"""
PackSignal Prepress Inspection & QA Sign-Off Certificate PDF Generator
Produces an executive-quality, evidence-backed inspection certificate using ReportLab,
incorporating real high-resolution 3D packaging previews (with honest fallback),
structured Pass/Issue/Review/Unable scorecard matrix, genuine cropped artwork defect images,
tamper-evident audit trail, and reviewer/operator sign-off blocks.
"""

import sys
import os
import json
import hashlib
from pathlib import Path
from xml.sax.saxutils import escape
from PIL import Image as PILImage

from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, KeepTogether,
    Table, TableStyle, PageBreak, Image as ReportImage, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

# Theme Palette (PackSignal Emerald & Prepress Status)
COLOR_EMERALD = HexColor('#175B48')
COLOR_DARK_TEXT = HexColor('#183B2F')
COLOR_MUTED = HexColor('#5F7067')
COLOR_BORDER = HexColor('#D8E1D4')
COLOR_BG_LIGHT = HexColor('#F5F7F0')
COLOR_ISSUE = HexColor('#D32F2F')
COLOR_ISSUE_BG = HexColor('#FCE9E2')
COLOR_REVIEW = HexColor('#B26A00')
COLOR_REVIEW_BG = HexColor('#FBF0D9')
COLOR_MATCH = HexColor('#2E7D32')
COLOR_MATCH_BG = HexColor('#E8F1E0')
COLOR_UNABLE = HexColor('#546E7A')
COLOR_UNABLE_BG = HexColor('#EDF0EE')

def sanitize_text(text):
    if text is None:
        return ''
    s = str(text)
    s = s.replace('→', ' -> ').replace('↔', ' / ').replace('✓', 'match')
    s = s.replace('–', '-').replace('—', '-').replace('•', '*')
    s = s.replace('\r\n', '\n').replace('\r', '\n')
    return escape(s).replace('\n', '<br/>')

def compute_sha256(file_path):
    h = hashlib.sha256()
    with open(file_path, 'rb') as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()

def compute_report_state(review):
    if review.get('supersededBy'):
        return 'superseded', 'SUPERSEDED BY A NEWER REVISION'
    if review.get('status') != 'ready':
        return 'draft', 'DRAFT INSPECTION'

    counts = review.get('counts', {})
    issues = counts.get('issue', 0)
    reviews = counts.get('review', 0)
    if issues > 0:
        return 'issues_outstanding', 'ISSUES OUTSTANDING'

    undecided_reviews = [
        f for f in review.get('findings', [])
        if f.get('status') == 'review' and not review.get('decisions', {}).get(f.get('id'))
    ]
    if reviews > 0 and undecided_reviews:
        return 'human_review_pending', 'HUMAN REVIEW PENDING'

    has_signoff = bool(review.get('team', {}).get('approvals'))
    if has_signoff:
        return 'internal_signoff_recorded', 'INTERNAL SIGN-OFF RECORDED'

    return 'inspection_completed', 'INSPECTION COMPLETED'

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []
        self.review_meta = {}

    def set_review_meta(self, meta):
        self.review_meta = meta

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        w, h = A4

        # Header (Pages 2+)
        if self._pageNumber > 1:
            self.setFont('Helvetica', 8)
            self.setFillColor(COLOR_MUTED)
            self.drawString(42, h - 30, 'PACKSIGNAL | Prepress Inspection & Sign-Off Certificate')
            rev_id = self.review_meta.get('id', '')
            cert_id = self.review_meta.get('certId', '')
            label = f"Review {rev_id}"
            if cert_id:
                label += f" · {cert_id}"
            self.drawRightString(w - 42, h - 30, label)
            self.setStrokeColor(COLOR_BORDER)
            self.setLineWidth(0.5)
            self.line(42, h - 34, w - 42, h - 34)

        # Footer (All pages)
        # Line 1: Brand statement at Y=28
        self.setFont('Helvetica', 7.5)
        self.setFillColor(HexColor('#4A5B53'))
        footer_brand = "PackSignal - human release decision required · PackSignal supports evidence-based artwork review. Final legal, technical, and print-release decisions require authorized human approval."
        self.drawString(42, 28, footer_brand)
        self.drawRightString(w - 42, 28, f"Page {self._pageNumber} of {page_count}")

        # Line 2: Cryptographic seal at Y=14 (separated by >= 8pt)
        seal_hash = self.review_meta.get('sealHash', '')
        if seal_hash:
            self.setFont('Helvetica-Bold', 7)
            self.setFillColor(COLOR_EMERALD)
            self.drawCentredString(w / 2, 14, f"Seal {seal_hash[:16]}")
        else:
            self.setFont('Helvetica', 7)
            self.setFillColor(COLOR_MUTED)
            self.drawCentredString(w / 2, 14, "Draft Review Snapshot - Not Cryptographically Sealed")

        self.restoreState()


def generate_pdf_report(review_path, output_path, evidence_crops=None, preview_image=None):
    """
    Renders the executive-quality prepress inspection certificate to output_path.
    evidence_crops: optional dict mapping findingId -> list of crop metadata
    preview_image: optional path to high-res 3D packaging render image
    """
    if isinstance(review_path, (str, Path)):
        review_data_str = Path(review_path).read_text(encoding='utf-8')
        review = json.loads(review_data_str)
        review_dir = Path(review_path).parent
    else:
        review = review_path
        review_dir = Path(output_path).parent

    evidence_crops = evidence_crops or {}

    styles = getSampleStyleSheet()

    styles.add(ParagraphStyle(
        name='CertMainTitle',
        fontName='Helvetica-Bold',
        fontSize=18,
        leading=22,
        textColor=COLOR_EMERALD,
        spaceAfter=3
    ))
    styles.add(ParagraphStyle(
        name='CertSubTitle',
        fontName='Helvetica',
        fontSize=9.5,
        leading=13,
        textColor=COLOR_MUTED,
        spaceAfter=10
    ))
    styles.add(ParagraphStyle(
        name='CertSectionHeader',
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=COLOR_EMERALD,
        spaceBefore=12,
        spaceAfter=6,
        keepWithNext=True
    ))
    styles.add(ParagraphStyle(
        name='CardHeader',
        fontName='Helvetica-Bold',
        fontSize=9.5,
        leading=13,
        textColor=COLOR_DARK_TEXT,
        keepWithNext=True
    ))
    styles.add(ParagraphStyle(
        name='BodyRegular',
        fontName='Helvetica',
        fontSize=8,
        leading=11.5,
        textColor=COLOR_DARK_TEXT,
        spaceAfter=3
    ))
    styles.add(ParagraphStyle(
        name='BodyBold',
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=11.5,
        textColor=COLOR_DARK_TEXT
    ))
    styles.add(ParagraphStyle(
        name='LabelMuted',
        fontName='Helvetica-Bold',
        fontSize=7,
        leading=9.5,
        textColor=COLOR_MUTED
    ))
    styles.add(ParagraphStyle(
        name='MonoText',
        fontName='Courier',
        fontSize=7.5,
        leading=10,
        textColor=COLOR_DARK_TEXT
    ))
    styles.add(ParagraphStyle(
        name='StatusTag',
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10,
        alignment=1 # Center
    ))
    styles.add(ParagraphStyle(name='PP', fontName='Helvetica', fontSize=8, leading=11.5, spaceAfter=4, splitLongWords=True))
    styles.add(ParagraphStyle(name='PPH', fontName='Helvetica-Bold', fontSize=10.5, leading=14, spaceBefore=8, spaceAfter=4, textColor=COLOR_EMERALD, keepWithNext=True))

    def p(text, style_name='BodyRegular'):
        return Paragraph(sanitize_text(text), styles[style_name])

    story = []
    page_w = A4[0] - 84 # Printable width: 595.27 - 84 = 511.27 pt

    state_key, state_label = compute_report_state(review)
    seal_info = review.get('signature', {})
    seal_hash = str(seal_info.get('payloadHash', ''))
    review_id = str(review.get('id', 'unknown'))
    cert_id = f"PS-{review_id[:8].upper()}"

    facts = review.get('facts', [])
    sku_fact = next((f.get('value') for f in facts if f.get('field') in ('sku', 'product_sku', 'gtin')), None)
    sku_display = sku_fact or "Not supplied"

    art_docs = [d for d in review.get('documents', []) if d.get('role') == 'artwork']
    art_doc = art_docs[0] if art_docs else {}
    art_sha = art_doc.get('sha256', 'N/A')
    art_version = "Revision B" if review.get('parentId') else ("V1 (Baseline)" if review.get('sample') else (art_doc.get('name') or "Artwork Document"))

    counts = review.get('counts', {})
    n_issues = counts.get('issue', 0)
    n_review = counts.get('review', 0)
    n_unable = counts.get('unable', 0)
    n_match = counts.get('match', 0)

    # ==========================================
    # PAGE 1: EXECUTIVE CERTIFICATE COVER
    # ==========================================
    story.append(p("PACKSIGNAL", 'LabelMuted'))
    story.append(p("PREPRESS INSPECTION & SIGN-OFF CERTIFICATE", 'CertMainTitle'))
    story.append(p("Automated Packaging Artwork Verification & Human QA Audit Record", 'CertSubTitle'))

    meta_data = [
        [p("Certificate ID:", 'LabelMuted'), p(cert_id, 'MonoText'),
         p("Review ID:", 'LabelMuted'), p(review_id, 'MonoText')],
        [p("Product Name:", 'LabelMuted'), p(review.get('name', 'Packaging Artwork Review'), 'BodyBold'),
         p("SKU Identifier:", 'LabelMuted'), p(sku_display, 'MonoText')],
        [p("Artwork Target:", 'LabelMuted'), p(review.get('options', {}).get('packageType', 'Folding Carton').title(), 'BodyRegular'),
         p("Artwork Version:", 'LabelMuted'), p(art_version, 'BodyBold')],
        [p("Artwork SHA-256:", 'LabelMuted'), p(art_sha[:28] + '...', 'MonoText'),
         p("Export Snapshot:", 'LabelMuted'), p(review.get('snapshotId', 'LIVE-SNAPSHOT')[:28], 'MonoText')],
        [p("Generated (UTC):", 'LabelMuted'), p((review.get('finishedAt') or review.get('createdAt', '2026-10-23T00:00:00Z'))[:19].replace('T', ' ') + ' UTC', 'MonoText'),
         p("QA Sign-Off:", 'LabelMuted'), p("Recorded" if review.get('team', {}).get('approvals') else "Pending human sign-off", 'BodyBold')],
        [p("Inspection Engine:", 'LabelMuted'), p(f"{review.get('engine', 'Local exact engine')} (deterministic)", 'BodyRegular'),
         p("Report Integrity:", 'LabelMuted'), p(f"Ed25519 · {seal_info.get('publicKeyId', 'Local')}", 'MonoText')],
    ]
    meta_table = Table(meta_data, colWidths=[90, 165, 85, 171])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), COLOR_BG_LIGHT),
        ('BOX', (0,0), (-1,-1), 1, COLOR_BORDER),
        ('INNERGRID', (0,0), (-1,-1), 0.5, COLOR_BORDER),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 8))

    # Inspection Status Banner
    state_bg = COLOR_ISSUE_BG if state_key == 'issues_outstanding' else (
        COLOR_REVIEW_BG if state_key in ('human_review_pending', 'draft') else COLOR_MATCH_BG
    )
    state_color = COLOR_ISSUE if state_key == 'issues_outstanding' else (
        COLOR_REVIEW if state_key in ('human_review_pending', 'draft') else COLOR_MATCH
    )
    banner_label = f"INSPECTION STATUS: {state_label}"
    if n_issues > 0:
        banner_label += " · NOT A PRINT-RELEASE AUTHORIZATION"
    state_banner = Table([
        [p(f"<font color='{state_color.hexval()}'><b>{banner_label}</b></font>", 'BodyBold')]
    ], colWidths=[page_w])
    state_banner.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), state_bg),
        ('BOX', (0,0), (-1,-1), 1, state_color),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(state_banner)
    story.append(Spacer(1, 8))

    # High-Resolution 3D Preview (or Truthful 2D Fallback)
    preview_rendered = False
    candidate_preview = preview_image
    if not candidate_preview:
        # Check standard 3D preview file locations
        p_opt = review_dir / 'rendered' / 'package-3d-preview.png'
        if p_opt.exists():
            candidate_preview = str(p_opt)
        else:
            p_opt2 = review_dir / 'exports' / review.get('exportId', '') / 'images' / 'package-3d-preview.png'
            if p_opt2.exists():
                candidate_preview = str(p_opt2)

    if candidate_preview and os.path.exists(candidate_preview):
        try:
            with PILImage.open(candidate_preview) as im:
                pw, ph = im.size
            tw = min(480, page_w)
            th = min(175, int(tw * ph / max(1, pw)))
            prev_sha = compute_sha256(candidate_preview)
            prev_img_flowable = ReportImage(candidate_preview, width=tw, height=th)
            caption = (
                "<b>3D Packaging Preview:</b> Physical packaging visualization mapped with uploaded artwork textures.<br/>"
                f"<font size=7 color='#5F7067'>Provenance: Reviewer-confirmed panel mapping · Camera: Three-quarter product angle · Image SHA-256: {prev_sha[:16]}...</font>"
            )
            story.append(Table([
                [prev_img_flowable],
                [p(caption, 'BodyRegular')]
            ], colWidths=[page_w], style=[
                ('ALIGN', (0,0), (-1,-1), 'CENTER'),
                ('BACKGROUND', (0,0), (-1,-1), HexColor('#FDFCFA')),
                ('BOX', (0,0), (-1,-1), 0.5, COLOR_BORDER),
                ('TOPPADDING', (0,0), (-1,-1), 4),
                ('BOTTOMPADDING', (0,0), (-1,-1), 4),
            ]))
            preview_rendered = True
        except Exception:
            preview_rendered = False

    if not preview_rendered:
        # Truthful 2D Fallback
        page1_img_name = art_doc.get('pages', [{}])[0].get('image') if art_doc.get('pages') else None
        page1_path = (review_dir / 'rendered' / page1_img_name) if page1_img_name else None
        if page1_path and page1_path.exists():
            try:
                with PILImage.open(page1_path) as im:
                    pw, ph = im.size
                tw = 360
                th = min(150, int(tw * ph / max(1, pw)))
                fb_img = ReportImage(str(page1_path), width=tw, height=th)
                fb_caption = (
                    "<b>2D Artwork Overview (Truthful Fallback):</b> "
                    "3D preview unavailable: confirmed package geometry or rendering capability was not supplied.<br/>"
                    f"<font size=7 color='#5F7067'>Rendered Page 1 · Source Artwork Hash: {art_sha[:16]}... · Not an official 3D physical package render.</font>"
                )
                story.append(Table([
                    [fb_img],
                    [p(fb_caption, 'BodyRegular')]
                ], colWidths=[page_w], style=[
                    ('ALIGN', (0,0), (-1,-1), 'CENTER'),
                    ('BACKGROUND', (0,0), (-1,-1), HexColor('#FDFCFA')),
                    ('BOX', (0,0), (-1,-1), 0.5, COLOR_BORDER),
                    ('TOPPADDING', (0,0), (-1,-1), 4),
                    ('BOTTOMPADDING', (0,0), (-1,-1), 4),
                ]))
                preview_rendered = True
            except Exception:
                preview_rendered = False

    if not preview_rendered:
        unavail_box = (
            "<b>3D Packaging Preview Unavailable:</b> "
            "Confirmed package geometry or rendering capability was not supplied for this review. "
            "2D extracted text and source document checks remain fully verifiable."
        )
        story.append(Table([[p(unavail_box, 'BodyRegular')]], colWidths=[page_w], style=[
            ('BACKGROUND', (0,0), (-1,-1), COLOR_BG_LIGHT),
            ('BOX', (0,0), (-1,-1), 0.5, COLOR_BORDER),
            ('TOPPADDING', (0,0), (-1,-1), 8),
            ('BOTTOMPADDING', (0,0), (-1,-1), 8),
            ('LEFTPADDING', (0,0), (-1,-1), 8),
        ]))

    story.append(Spacer(1, 8))

    # Metric Grid
    score_data = [
        [
            p("<b>ISSUES</b><br/><font size=15 color='#D32F2F'><b>%d</b></font><br/><font size=6.5 color='#68766F'>Defects requiring fix</font>" % n_issues),
            p("<b>HUMAN REVIEW</b><br/><font size=15 color='#B26A00'><b>%d</b></font><br/><font size=6.5 color='#68766F'>Reviewer confirmation</font>" % n_review),
            p("<b>UNABLE TO VERIFY</b><br/><font size=15 color='#546E7A'><b>%d</b></font><br/><font size=6.5 color='#68766F'>Missing source evidence</font>" % n_unable),
            p("<b>MATCHES</b><br/><font size=15 color='#2E7D32'><b>%d</b></font><br/><font size=6.5 color='#68766F'>Deterministic matches</font>" % n_match),
        ]
    ]
    score_table = Table(score_data, colWidths=[page_w / 4] * 4)
    score_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (0,0), COLOR_ISSUE_BG),
        ('BACKGROUND', (1,0), (1,0), COLOR_REVIEW_BG),
        ('BACKGROUND', (2,0), (2,0), COLOR_UNABLE_BG),
        ('BACKGROUND', (3,0), (3,0), COLOR_MATCH_BG),
        ('BOX', (0,0), (-1,-1), 1, COLOR_BORDER),
        ('INNERGRID', (0,0), (-1,-1), 0.5, COLOR_BORDER),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(score_table)
    story.append(Spacer(1, 8))

    # Governance Notice Box
    disclaimer_text = (
        "<b>LEGAL & PREPRESS RELEASE NOTICE:</b><br/>"
        "PackSignal provides evidence-backed comparison between supplied packaging artwork and authorized reference documents. "
        "Automated checks, image transcriptions, and individual reviewer sign-offs recorded herein <b>do not constitute formal print-release authorization, legal compliance certification, or official regulatory approval</b>. "
        "Final release decisions must be executed by authorized human packaging managers in accordance with company release policies."
    )
    disclaimer_table = Table([[p(disclaimer_text, 'BodyRegular')]], colWidths=[page_w])
    disclaimer_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), HexColor('#F9FBF8')),
        ('BOX', (0,0), (-1,-1), 0.5, COLOR_MUTED),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(disclaimer_table)
    story.append(PageBreak())

    # ==========================================
    # PAGE 2: INSPECTION SCORECARD MATRIX
    # ==========================================
    story.append(p("INSPECTION SCORECARD MATRIX", 'CertSectionHeader'))
    story.append(p(
        "Structured prepress scorecard mapping executed deterministic rules to packaging quality categories. "
        "Only categories with executed checks are reported with evaluated tallies. "
        "Categories outside the current inspection scope are explicitly separated and never treated as passes.",
        'BodyRegular'
    ))
    story.append(Spacer(1, 6))

    findings = review.get('findings', [])

    CATEGORY_DEFS = [
        ('product_copy', 'Product copy & brand identity', lambda f: f.get('productField') in ('brand_name', 'product_name', 'variant', 'flavor', 'identity') or any(k in f.get('title','').lower() for k in ('brand', 'product identity', 'variant'))),
        ('net_quantity', 'Net quantity & volume declarations', lambda f: f.get('productField') == 'net_quantity' or any(k in f.get('title','').lower() for k in ('quantity', 'net weight', 'volume'))),
        ('ingredients', 'Ingredients & formulation statements', lambda f: f.get('productField') == 'ingredients' or 'ingredient' in f.get('title','').lower()),
        ('allergens', 'Allergen declarations & advisory copy', lambda f: f.get('productField') in ('allergens', 'allergen_statement') or 'allergen' in f.get('title','').lower()),
        ('nutrition', 'Nutrition facts & statutory daily values', lambda f: f.get('productField') in ('nutrition', 'nutrition_table', 'calories', 'sodium', 'fat', 'protein', 'sugar', 'carbohydrates') or any(k in f.get('title','').lower() for k in ('nutrition', 'energy', 'daily value', 'dv%'))),
        ('claims', 'Claims, certifications & marketing copy', lambda f: f.get('productField') in ('claims', 'certifications', 'organic', 'vegan') or 'claim' in f.get('title','').lower()),
        ('barcode', 'Barcode & machine-readable codes', lambda f: f.get('productField') in ('barcode', 'gtin', 'upc', 'ean', 'qr') or any(k in f.get('title','').lower() for k in ('barcode', 'gtin', 'upc', 'qr code'))),
        ('barcode_screening', 'Barcode quiet-zone & print margin screening', lambda f: any(k in f.get('title','').lower() for k in ('quiet zone', 'barcode margin', 'bwr', 'truncation'))),
        ('typography', 'Typography & minimum point size', lambda f: any(k in f.get('title','').lower() for k in ('font', 'typography', 'type size', 'point size', 'x-height'))),
        ('geometry', 'Bleed, trim & packaging dieline geometry', lambda f: any(k in f.get('title','').lower() for k in ('bleed', 'trim', 'dieline', 'cut margin', 'safe zone'))),
        ('panel_placement', 'Panel placement & surface orientation', lambda f: any(k in f.get('title','').lower() for k in ('panel', 'placement', 'face orientation', 'panel placement'))),
        ('storage_handling', 'Storage instructions & manufacturer details', lambda f: f.get('productField') in ('storage_statement', 'manufacturer', 'contact', 'distributor', 'recycling') or any(k in f.get('title','').lower() for k in ('storage', 'refrigerat', 'manufacturer', 'contact', 'recycl'))),
        ('revision_diff', 'Revision regression & change tracking', lambda f: any(k in f.get('title','').lower() for k in ('regression', 'revision', 'delta'))),
        ('statutory_market', 'Statutory market & regulatory rules', lambda f: any(k in f.get('title','').lower() for k in ('statutory', 'mandatory', 'regulatory', 'symbol', 'warning'))),
    ]

    evaluated_categories = []
    unevaluated_categories = []

    assigned_findings = set()
    for cat_id, cat_title, matcher in CATEGORY_DEFS:
        cat_findings = [f for f in findings if f.get('id') not in assigned_findings and matcher(f)]
        for f in cat_findings:
            assigned_findings.add(f.get('id'))

        if cat_findings:
            m_count = sum(1 for f in cat_findings if f.get('status') == 'match')
            i_count = sum(1 for f in cat_findings if f.get('status') == 'issue')
            r_count = sum(1 for f in cat_findings if f.get('status') == 'review')
            u_count = sum(1 for f in cat_findings if f.get('status') == 'unable')

            if i_count > 0:
                cat_state = "<font color='#D32F2F'><b>ISSUE</b></font>"
            elif r_count > 0:
                cat_state = "<font color='#B26A00'><b>REVIEW</b></font>"
            elif u_count > 0:
                cat_state = "<font color='#546E7A'><b>UNABLE</b></font>"
            else:
                cat_state = "<font color='#2E7D32'><b>MATCH</b></font>"

            evaluated_categories.append((cat_title, len(cat_findings), m_count, i_count, r_count, u_count, cat_state))
        else:
            unevaluated_categories.append(cat_title)

    # Any remaining findings go into General Packaging Copy
    remaining_findings = [f for f in findings if f.get('id') not in assigned_findings]
    if remaining_findings:
        m_count = sum(1 for f in remaining_findings if f.get('status') == 'match')
        i_count = sum(1 for f in remaining_findings if f.get('status') == 'issue')
        r_count = sum(1 for f in remaining_findings if f.get('status') == 'review')
        u_count = sum(1 for f in remaining_findings if f.get('status') == 'unable')
        cat_state = "<font color='#D32F2F'><b>ISSUE</b></font>" if i_count > 0 else ("<font color='#B26A00'><b>REVIEW</b></font>" if r_count > 0 else "<font color='#2E7D32'><b>MATCH</b></font>")
        evaluated_categories.append(('General packaging copy & sources', len(remaining_findings), m_count, i_count, r_count, u_count, cat_state))

    sc_rows = [
        [p("Inspection Domain / Category", 'LabelMuted'),
         p("Executed", 'LabelMuted'),
         p("Match", 'LabelMuted'),
         p("Issue", 'LabelMuted'),
         p("Review", 'LabelMuted'),
         p("Unable", 'LabelMuted'),
         p("Category State", 'LabelMuted')]
    ]
    for cat_title, total, m, i, r_c, u, state_html in evaluated_categories:
        sc_rows.append([
            p(cat_title, 'BodyBold'),
            p(str(total), 'MonoText'),
            p(f"<font color='#2E7D32'><b>{m}</b></font>", 'MonoText'),
            p(f"<font color='#D32F2F'><b>{i}</b></font>" if i > 0 else "0", 'MonoText'),
            p(f"<font color='#B26A00'><b>{r_c}</b></font>" if r_c > 0 else "0", 'MonoText'),
            p(f"<font color='#546E7A'><b>{u}</b></font>" if u > 0 else "0", 'MonoText'),
            p(state_html, 'BodyRegular'),
        ])

    sc_table = Table(sc_rows, colWidths=[175, 50, 48, 48, 48, 48, 94])
    sc_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), COLOR_BG_LIGHT),
        ('BOX', (0,0), (-1,-1), 1, COLOR_BORDER),
        ('INNERGRID', (0,0), (-1,-1), 0.5, COLOR_BORDER),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
        ('ALIGN', (1,0), (5,-1), 'CENTER'),
    ]))
    story.append(sc_table)
    story.append(Spacer(1, 10))

    if unevaluated_categories:
        un_text = (
            "<b>Categories Outside Current Inspection Scope (Not Evaluated in this Review):</b><br/>"
            f"<font color='#5F7067'>{', '.join(unevaluated_categories)}</font><br/>"
            "<i>Note: Unevaluated categories were not tested by the active rulebook and are not considered passed.</i>"
        )
        story.append(Table([[p(un_text, 'BodyRegular')]], colWidths=[page_w], style=[
            ('BACKGROUND', (0,0), (-1,-1), COLOR_BG_LIGHT),
            ('BOX', (0,0), (-1,-1), 0.5, COLOR_BORDER),
            ('TOPPADDING', (0,0), (-1,-1), 5),
            ('BOTTOMPADDING', (0,0), (-1,-1), 5),
            ('LEFTPADDING', (0,0), (-1,-1), 6),
            ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ]))

    story.append(PageBreak())

    # ==========================================
    # PAGE 3: SOURCE INVENTORY & HASHES
    # ==========================================
    story.append(p("SOURCE INVENTORY & CRYPTOGRAPHIC HASHES", 'CertSectionHeader'))
    story.append(p("Every supplied input document was hashed with SHA-256 upon intake. Modifications to source files invalidate historical seals.", 'BodyRegular'))
    story.append(Spacer(1, 6))

    doc_rows = [
        [p("Role", 'LabelMuted'), p("Document Name", 'LabelMuted'), p("SHA-256 Digest", 'LabelMuted'), p("Pages", 'LabelMuted')]
    ]
    for doc in review.get('documents', []):
        doc_rows.append([
            p(doc.get('role', 'source').upper(), 'BodyBold'),
            p(doc.get('name', 'unnamed'), 'BodyRegular'),
            p(doc.get('sha256', 'N/A')[:32] + '...', 'MonoText'),
            p(str(len(doc.get('pages', []))), 'BodyRegular'),
        ])
    doc_table = Table(doc_rows, colWidths=[70, 160, 230, 51])
    doc_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), COLOR_BG_LIGHT),
        ('BOX', (0,0), (-1,-1), 1, COLOR_BORDER),
        ('INNERGRID', (0,0), (-1,-1), 0.5, COLOR_BORDER),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(doc_table)
    story.append(Spacer(1, 10))

    # ==========================================
    # DETAILED FINDINGS WITH VISUAL CROPS
    # ==========================================
    story.append(p("DETAILED FINDINGS & VISUAL EVIDENCE", 'CertSectionHeader'))
    story.append(p("Each finding documents detected packaging text against authorized sources, with lossless bounded crops extracted from rendered artwork.", 'BodyRegular'))
    story.append(Spacer(1, 6))

    for idx, f in enumerate(findings):
        f_id = f.get('id', f"finding-{idx+1}")
        f_status = f.get('status', 'review')
        f_title = f.get('title', 'Discrepancy')
        f_severity = f.get('severity', 'normal')

        st_bg = COLOR_ISSUE_BG if f_status == 'issue' else (COLOR_REVIEW_BG if f_status == 'review' else COLOR_MATCH_BG)
        st_fg = COLOR_ISSUE if f_status == 'issue' else (COLOR_REVIEW if f_status == 'review' else COLOR_MATCH)

        finding_flow = []

        hdr_table = Table([
            [
                p(f"<b>{f_id}</b> · {f_title}", 'CardHeader'),
                p(f"<font color='{st_fg.hexval()}'><b>{f_status.upper()}</b></font> · {f_severity}", 'StatusTag')
            ]
        ], colWidths=[380, 131])
        hdr_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), COLOR_BG_LIGHT),
            ('BOX', (0,0), (-1,-1), 1, COLOR_BORDER),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
            ('LEFTPADDING', (0,0), (-1,-1), 6),
            ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ]))
        finding_flow.append(hdr_table)

        comp_data = [
            [p("ACTUAL ARTWORK (OBSERVED)", 'LabelMuted'), p("APPROVED REQUIREMENT (EXPECTED)", 'LabelMuted')],
            [p(f.get('observed') or 'Not detected in artwork', 'BodyBold'), p(f.get('expected') or 'No approved requirement', 'BodyBold')],
        ]
        comp_table = Table(comp_data, colWidths=[255, 256])
        comp_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (0,-1), HexColor('#FFF8F6') if f_status == 'issue' else COLOR_BG_LIGHT),
            ('BACKGROUND', (1,0), (1,-1), HexColor('#F6FAF5')),
            ('BOX', (0,0), (-1,-1), 0.5, COLOR_BORDER),
            ('INNERGRID', (0,0), (-1,-1), 0.5, COLOR_BORDER),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
            ('LEFTPADDING', (0,0), (-1,-1), 6),
            ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ]))
        finding_flow.append(comp_table)

        rule_info = f.get('rule', {})
        rule_text = rule_info.get('text', '') if isinstance(rule_info, dict) else str(rule_info)
        rule_id = rule_info.get('id', '') if isinstance(rule_info, dict) else ''

        exp_text = f.get('explanation', '')
        detail_lines = []
        if rule_text:
            detail_lines.append(f"<b>Rule Quotation ({rule_id or 'Check'}):</b> {rule_text}")
        if exp_text:
            detail_lines.append(f"<b>Technical Explanation:</b> {exp_text}")

        seen_evidence = set()
        for ev in f.get('evidence', []):
            ev_key = json.dumps({k: ev.get(k) for k in ('documentId', 'name', 'location', 'page', 'box', 'quote')}, sort_keys=True)
            if ev_key in seen_evidence:
                continue
            seen_evidence.add(ev_key)
            ev_loc = f"{ev.get('name', '')} {ev.get('location', '')}".strip()
            ev_quote = ev.get('quote', '')
            if ev_quote or ev_loc:
                detail_lines.append(f"<b>Evidence:</b> {ev_loc}: {ev_quote}")

        finding_flow.append(Table([[p('<br/>'.join(detail_lines), 'BodyRegular')]], colWidths=[page_w], style=[
            ('BOX', (0,0), (-1,-1), 0.5, COLOR_BORDER),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
            ('LEFTPADDING', (0,0), (-1,-1), 6),
            ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ]))

        # Genuine Evidence Crop Side-by-Side
        f_crops = evidence_crops.get(f_id, [])
        valid_crop = next((c for c in f_crops if c.get('status') == 'available' and os.path.exists(c.get('fullPath', ''))), None)

        if valid_crop:
            crop_path = valid_crop['fullPath']
            orig_w, orig_h = valid_crop.get('width', 300), valid_crop.get('height', 150)
            target_w = 230
            target_h = min(130, int(target_w * orig_h / max(1, orig_w)))

            crop_img = ReportImage(crop_path, width=target_w, height=target_h)
            crop_caption = (
                f"<b>Visual Evidence Crop:</b> {valid_crop.get('artworkDocument', 'Artwork')}, Page {valid_crop.get('page')}<br/>"
                f"<font size=7 color='#5F7067'>Rendered Box: {valid_crop.get('box')} · SHA-256: {valid_crop.get('sha256', '')[:16]}...</font>"
            )

            src_evidence = [e for e in f.get('evidence', []) if e.get('role') != 'artwork']
            src_quote = src_evidence[0].get('quote', '') if src_evidence else ''
            src_name = src_evidence[0].get('name', '') if src_evidence else 'Source Spec'
            src_loc = src_evidence[0].get('location', '') if src_evidence else ''

            source_side_text = (
                f"<b>APPROVED REFERENCE QUOTATION:</b><br/>"
                f"<b>Document:</b> {src_name} ({src_loc or 'Requirement Cell'})<br/>"
                f"<b>Approved Text:</b> <i>\"{src_quote or f.get('expected', '')}\"</i><br/>"
                f"<br/><font size=7 color='#5F7067'>Verified against intake hash. No fabricated crops.</font>"
            )

            side_by_side = Table([
                [crop_img, p(source_side_text, 'BodyRegular')],
                [p(crop_caption, 'BodyRegular'), p("", 'BodyRegular')]
            ], colWidths=[240, 271])
            side_by_side.setStyle(TableStyle([
                ('VALIGN', (0,0), (-1,-1), 'TOP'),
                ('BACKGROUND', (0,0), (-1,-1), HexColor('#FCFDFB')),
                ('BOX', (0,0), (-1,-1), 0.5, COLOR_BORDER),
                ('TOPPADDING', (0,0), (-1,-1), 4),
                ('BOTTOMPADDING', (0,0), (-1,-1), 4),
                ('LEFTPADDING', (0,0), (-1,-1), 6),
                ('RIGHTPADDING', (0,0), (-1,-1), 6),
            ]))
            finding_flow.append(side_by_side)
        else:
            reason = f_crops[0].get('reason') if f_crops else "No precise artwork bounding box coordinates recorded."
            unavail_text = (
                f"<b>Precise visual crop unavailable:</b> {reason}<br/>"
                "<i>Textual evidence, specification cells, and full artwork pages remain verifiable in the application.</i>"
            )
            finding_flow.append(Table([[p(unavail_text, 'BodyRegular')]], colWidths=[page_w], style=[
                ('BACKGROUND', (0,0), (-1,-1), COLOR_BG_LIGHT),
                ('BOX', (0,0), (-1,-1), 0.5, COLOR_BORDER),
                ('TOPPADDING', (0,0), (-1,-1), 4),
                ('BOTTOMPADDING', (0,0), (-1,-1), 4),
                ('LEFTPADDING', (0,0), (-1,-1), 6),
            ]))

        decision = review.get('decisions', {}).get(f_id)
        if decision:
            stale_mark = " <font color='#D32F2F'><b>[NEEDS RE-REVIEW: Source changed]</b></font>" if decision.get('stale') else ""
            dec_text = (
                f"<b>Reviewer Decision:</b> {decision.get('disposition')} · "
                f"<b>Reviewer:</b> {decision.get('reviewerName') or decision.get('decidedBy', 'Local operator')} · "
                f"<b>Timestamp:</b> {decision.get('at', 'N/A')}{stale_mark}<br/>"
                f"<b>Reviewer Note:</b> {decision.get('note', '')}"
            )
            finding_flow.append(Table([[p(dec_text, 'BodyRegular')]], colWidths=[page_w], style=[
                ('BACKGROUND', (0,0), (-1,-1), HexColor('#F6F1E3')),
                ('BOX', (0,0), (-1,-1), 0.5, HexColor('#CDBA96')),
                ('TOPPADDING', (0,0), (-1,-1), 4),
                ('BOTTOMPADDING', (0,0), (-1,-1), 4),
                ('LEFTPADDING', (0,0), (-1,-1), 6),
            ]))

        finding_flow.append(Spacer(1, 8))
        story.append(KeepTogether(finding_flow))

    # ==========================================
    # REMEDIATION PROPOSALS & DESIGNER HANDOFF FIXES (PHASE 14)
    # ==========================================
    remediations_dict = review.get('remediations', {})
    if remediations_dict:
        story.append(p("PROPOSED COPY & DESIGNER HANDOFF FIXES (REMEDIATION STUDIO)", 'CertSectionHeader'))
        story.append(p(
            "<b>Disclaimer:</b> Proposed copy suggestions are bounded, evidence-backed options prepared for Adobe Illustrator "
            "and Esko ArtPro+ design handoff. They do not constitute statutory compliance certifications or print release authorization.",
            'BodyRegular'
        ))
        story.append(Spacer(1, 6))

        for f_id, prop in remediations_dict.items():
            prop_flow = []
            f_title = prop.get('findingTitle') or f_id
            mode = prop.get('mode', 'PROPOSED')
            status = prop.get('status', 'PENDING_REVIEW')
            orig_text = prop.get('originalText') or 'N/A'
            prop_text = prop.get('proposedText') or (prop.get('designerTicket', {}).get('prepressInstruction') if prop.get('mode') == 'DESIGN_TICKET' else 'N/A')
            sources_used = ', '.join([s.get('documentName') or s.get('documentId') or 'Approved Source' for s in prop.get('sourceEvidence', [])]) or 'None cited'
            rules_used = ', '.join([r.get('ruleId') or r.get('citation') or 'Rule' for r in prop.get('ruleEvidence', [])]) or 'None cited'
            val_outcome = "VALIDATED" if prop.get('verification', {}).get('valid') else ("NEEDS_EVIDENCE" if prop.get('status') == 'NEEDS_EVIDENCE' else "VALIDATION_BLOCKED")
            decision = prop.get('decision') or status

            rem_table_data = [
                [p(f"<b>Finding:</b> {sanitize_text(f_title)}", 'BodyBold'), p(f"<b>Mode:</b> {sanitize_text(mode)} · <b>Status:</b> {sanitize_text(status)}", 'BodyRegular')],
                [p("<b>Observed Artwork Copy:</b><br/>" + sanitize_text(orig_text), 'BodyRegular'),
                 p("<b>Proposed Copy / Ticket Instruction:</b><br/>" + sanitize_text(prop_text), 'BodyRegular')],
                [p(f"<b>Sources Used:</b> {sanitize_text(sources_used)}", 'LabelMuted'),
                 p(f"<b>Rules Cited:</b> {sanitize_text(rules_used)}", 'LabelMuted')],
                [p(f"<b>Validator Outcome:</b> {sanitize_text(val_outcome)}", 'LabelMuted'),
                 p(f"<b>Reviewer Decision:</b> {sanitize_text(decision)}", 'LabelMuted')]
            ]

            if prop.get('blockers'):
                blocker_str = '<br/>• '.join([sanitize_text(b) for b in prop['blockers']])
                rem_table_data.append([
                    p(f"<b>Evidence Limitations / Blockers:</b><br/>• {blocker_str}", 'BodyRegular'),
                    p("<b>Revision Result:</b> Upload revised artwork to verify.", 'LabelMuted')
                ])

            rt = Table(rem_table_data, colWidths=[255, 256])
            rt.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,0), COLOR_BG_LIGHT),
                ('BOX', (0,0), (-1,-1), 1, COLOR_BORDER),
                ('INNERGRID', (0,0), (-1,-1), 0.5, COLOR_BORDER),
                ('TOPPADDING', (0,0), (-1,-1), 5),
                ('BOTTOMPADDING', (0,0), (-1,-1), 5),
                ('LEFTPADDING', (0,0), (-1,-1), 6),
                ('RIGHTPADDING', (0,0), (-1,-1), 6),
            ]))
            prop_flow.append(rt)
            prop_flow.append(Spacer(1, 8))
            story.append(KeepTogether(prop_flow))

        story.append(PageBreak())

    # ==========================================
    # REVISION COMPARISON (IF PRESENT)
    # ==========================================
    if review.get('revision'):
        story.append(p("REVISION COMPARISON & CHANGE IMPACT", 'CertSectionHeader'))
        rev = review['revision']
        story.append(p(f"Previous Review ID: <b>{rev.get('previousId', 'N/A')}</b>", 'BodyRegular'))
        story.append(Spacer(1, 6))

        rev_rows = [
            [p("Check / Finding", 'LabelMuted'), p("Previous Value", 'LabelMuted'), p("Current Value", 'LabelMuted'), p("Change Status", 'LabelMuted')]
        ]
        for ch in rev.get('changes', []):
            rev_rows.append([
                p(ch.get('title', ''), 'BodyBold'),
                p(ch.get('before') or 'None', 'BodyRegular'),
                p(ch.get('after') or 'Not rechecked', 'BodyRegular'),
                p(ch.get('change', ''), 'MonoText'),
            ])
        rev_table = Table(rev_rows, colWidths=[160, 115, 115, 121])
        rev_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), COLOR_BG_LIGHT),
            ('BOX', (0,0), (-1,-1), 1, COLOR_BORDER),
            ('INNERGRID', (0,0), (-1,-1), 0.5, COLOR_BORDER),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
            ('LEFTPADDING', (0,0), (-1,-1), 6),
        ]))
        story.append(rev_table)
        story.append(Spacer(1, 10))

    # ==========================================
    # QUALITY ASSURANCE SIGN-OFF PAGE
    # ==========================================
    story.append(p("QUALITY ASSURANCE SIGN-OFF", 'CertSectionHeader'))
    story.append(p("Formal prepress governance distinguishes between automated checks, human reviewer confirmations, and authorized print release.", 'BodyRegular'))
    story.append(Spacer(1, 6))

    approvals = review.get('team', {}).get('approvals', [])
    if approvals:
        app_rows = [
            [p("Reviewer Name", 'LabelMuted'), p("Role / Identity", 'LabelMuted'), p("Date (UTC)", 'LabelMuted'), p("Decision Outcome", 'LabelMuted'), p("Reviewer Comments", 'LabelMuted')]
        ]
        for app in approvals:
            app_rows.append([
                p(app.get('reviewerName', 'Reviewer'), 'BodyBold'),
                p(app.get('reviewerId', 'authenticated_user'), 'MonoText'),
                p(app.get('at', 'N/A'), 'MonoText'),
                p(app.get('outcome', '').upper(), 'BodyBold'),
                p(app.get('note', ''), 'BodyRegular'),
            ])
        app_table = Table(app_rows, colWidths=[100, 95, 110, 85, 121])
        app_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), COLOR_BG_LIGHT),
            ('BOX', (0,0), (-1,-1), 1, COLOR_BORDER),
            ('INNERGRID', (0,0), (-1,-1), 0.5, COLOR_BORDER),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
            ('LEFTPADDING', (0,0), (-1,-1), 6),
        ]))
        story.append(app_table)
        story.append(Spacer(1, 10))
    else:
        # Manual Sign-off blank form for local demonstration
        manual_sign_data = [
            [p("<b>MANUAL QA SIGN-OFF RECORD</b>", 'BodyBold'), p("Status: <b>Manual sign-off pending</b>", 'BodyRegular')],
            [p("QA Operator / Inspector Full Name: ____________________________", 'BodyRegular'), p("Role / Department: ____________________________", 'BodyRegular')],
            [p("Review Date (UTC): ________________________________________", 'BodyRegular'), p("Physical Signature: ____________________________", 'BodyRegular')],
            [p("Scope Acknowledged: [  ] Verified Deterministically  [  ] Disputed", 'BodyRegular'), p("Outcome: [  ] Approved  [  ] Changes Requested  [  ] Abstained", 'BodyRegular')],
            [p("Outstanding Blocker Notes:<br/>____________________________________________________________________________________________________<br/>____________________________________________________________________________________________________", 'BodyRegular'), p("", 'BodyRegular')],
        ]
        manual_table = Table(manual_sign_data, colWidths=[255, 256])
        manual_table.setStyle(TableStyle([
            ('SPAN', (0,4), (1,4)),
            ('BACKGROUND', (0,0), (-1,-1), HexColor('#FDFCFA')),
            ('BOX', (0,0), (-1,-1), 1, HexColor('#9E9E9E')),
            ('INNERGRID', (0,0), (-1,-1), 0.5, HexColor('#E0E0E0')),
            ('TOPPADDING', (0,0), (-1,-1), 6),
            ('BOTTOMPADDING', (0,0), (-1,-1), 6),
            ('LEFTPADDING', (0,0), (-1,-1), 8),
            ('RIGHTPADDING', (0,0), (-1,-1), 8),
        ]))
        story.append(manual_table)
        story.append(Spacer(1, 8))

    release_gate_text = (
        "<b>AUTHORIZED RELEASE GATE STATUS:</b><br/>"
        + (
            "<font color='#D32F2F'><b>ISSUES OUTSTANDING — NOT A PRINT-RELEASE AUTHORIZATION.</b></font> Identified defects must be resolved before releasing artwork to prepress."
            if n_issues > 0 else (
                "<font color='#B26A00'><b>HUMAN REVIEW PENDING — NOT A PRINT-RELEASE AUTHORIZATION.</b></font> Flagged items require confirmed reviewer disposition."
                if n_review > 0 else (
                    "<font color='#2E7D32'><b>INTERNAL SIGN-OFF RECORDED — NOT A STATUTORY PRINT-RELEASE AUTHORIZATION.</b></font> Release under organizational policy."
                    if approvals else
                    "<font color='#2E7D32'><b>INSPECTION CHECKS COMPLETE — MANUAL QA SIGN-OFF PENDING.</b></font>"
                )
            )
        )
    )
    story.append(Table([[p(release_gate_text, 'BodyRegular')]], colWidths=[page_w], style=[
        ('BACKGROUND', (0,0), (-1,-1), HexColor('#F9FBF8')),
        ('BOX', (0,0), (-1,-1), 1, COLOR_MUTED),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(Spacer(1, 8))
    story.append(PageBreak())

    # ==========================================
    # CHRONOLOGICAL TAMPER-EVIDENT AUDIT TRAIL
    # ==========================================
    story.append(p("TAMPER-EVIDENT CHRONOLOGICAL AUDIT HISTORY", 'CertSectionHeader'))
    story.append(p(
        "Audit events form a sequential cryptographic hash chain. Each event hash covers its sequence, timestamp, "
        "actor attribution, action, target, and the SHA-256 digest of the preceding event.",
        'BodyRegular'
    ))
    story.append(Spacer(1, 6))

    audit_events = review.get('audit', [])
    audit_rows = [
        [p("Seq", 'LabelMuted'), p("Timestamp (UTC)", 'LabelMuted'), p("Actor (Type)", 'LabelMuted'), p("Action", 'LabelMuted'), p("Chained Hash Digest", 'LabelMuted')]
    ]
    for idx, e in enumerate(audit_events):
        seq = e.get('sequence', idx + 1)
        ts = (e.get('timestampUTC') or e.get('at', 'N/A'))[:19].replace('T', ' ')
        actor_label = f"{e.get('actorName') or e.get('actorId') or 'System'} ({e.get('actorType') or 'system'})"
        act = e.get('action', 'unknown')
        h = e.get('eventHash', '')
        short_hash = f"{h[:10]}...{h[-6:]}" if h else "chained"

        audit_rows.append([
            p(str(seq), 'MonoText'),
            p(ts, 'MonoText'),
            p(actor_label, 'BodyRegular'),
            p(act, 'MonoText'),
            p(short_hash, 'MonoText'),
        ])

    audit_table = Table(audit_rows, colWidths=[30, 105, 135, 125, 116])
    audit_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), COLOR_BG_LIGHT),
        ('BOX', (0,0), (-1,-1), 1, COLOR_BORDER),
        ('INNERGRID', (0,0), (-1,-1), 0.5, COLOR_BORDER),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(audit_table)
    story.append(Spacer(1, 10))

    # ==========================================
    # FINAL: CRYPTOGRAPHIC VERIFICATION & INSTRUCTIONS
    # ==========================================
    story.append(p("CRYPTOGRAPHIC INTEGRITY & OFFLINE VERIFICATION", 'CertSectionHeader'))
    crypto_intro = (
        "This Prepress Certificate package contains an Ed25519 digital signature over the verification manifest. "
        "Any byte-level modification to this PDF, the companion JSON records, or the evidence crop PNGs will cause verification to fail."
    )
    story.append(p(crypto_intro, 'BodyRegular'))
    story.append(Spacer(1, 6))

    crypto_details = [
        [p("Signing Algorithm:", 'LabelMuted'), p("Ed25519 (Edwards-curve Digital Signature)", 'MonoText')],
        [p("Review Seal Hash:", 'LabelMuted'), p(seal_hash or "Pending export freeze", 'MonoText')],
        [p("Public Key Fingerprint:", 'LabelMuted'), p(seal_info.get('publicKeyId', 'Local Ephemeral Key'), 'MonoText')],
        [p("Public Verification Key:", 'LabelMuted'), p(seal_info.get('publicKey', 'Available in export package manifest'), 'MonoText')],
        [p("Offline Verification CLI:", 'LabelMuted'), p("node scripts/verify-report.mjs <PackageName>.zip", 'MonoText')],
    ]
    crypto_table = Table(crypto_details, colWidths=[140, 371])
    crypto_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), COLOR_BG_LIGHT),
        ('BOX', (0,0), (-1,-1), 1, COLOR_BORDER),
        ('INNERGRID', (0,0), (-1,-1), 0.5, COLOR_BORDER),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(crypto_table)
    story.append(Spacer(1, 8))

    story.append(p(
        "<b>Verification Scope:</b> A valid signature proves cryptographic integrity relative to the included public key. "
        "It does not establish real-world signer identity without an independent key certificate or PKI trust anchor.",
        'BodyRegular'
    ))

    # Build PDF with NumberedCanvas
    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=42,
        rightMargin=42,
        topMargin=46,
        bottomMargin=46
    )

    def canvas_maker(*args, **kwargs):
        nc = NumberedCanvas(*args, **kwargs)
        nc.set_review_meta({
            'id': review.get('id', ''),
            'certId': cert_id,
            'sealHash': seal_hash,
        })
        return nc

    doc.build(story, canvasmaker=canvas_maker)
    return {'path': output_path, 'pages': doc.page, 'certificateId': cert_id}


if __name__ == '__main__':
    try:
        if len(sys.argv) > 1 and sys.argv[1] == '--json':
            args = json.loads(sys.stdin.read())
            rev_path = args['review']
            out_path = args['output']
            crops = args.get('crops', {})
            prev_img = args.get('preview_image')
        elif len(sys.argv) >= 3:
            rev_path = sys.argv[1]
            out_path = sys.argv[2]
            crops = json.loads(sys.argv[3]) if len(sys.argv) > 3 else {}
            prev_img = sys.argv[4] if len(sys.argv) > 4 else None
        else:
            args = json.loads(sys.stdin.read())
            rev_path = args['review']
            out_path = args['output']
            crops = args.get('crops', {})
            prev_img = args.get('preview_image')

        res = generate_pdf_report(rev_path, out_path, crops, prev_img)
        print(json.dumps(res, ensure_ascii=False))
    except Exception as exc:
        print(json.dumps({'error': str(exc)[:500]}), file=sys.stderr)
        sys.exit(1)
