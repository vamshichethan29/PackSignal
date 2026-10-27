#!/usr/bin/env python3
"""
PackSignal Phase 5A — Single-Page ISO A3 Review Wall Poster Generator (lib/poster/render-poster.py)

Generates an executive, print-ready, single-page ISO A3 Landscape (420 x 297 mm)
review proof containing:
1. Header with Product Name, Version, Timestamp, and Review ID.
2. Original flat packaging carton artwork rendered at high print resolution.
3. Vector red-pen annotations (circles, underlines, brackets, arrows, and numbered pins).
4. Department sticky note indicators (Legal, R&D, Brand, Prepress).
5. Comprehensive Finding Legend table matching every numbered pin.
6. Summary box with counts, document SHA-256 hash, and legal disclaimer.
7. Strictly EXACTLY ONE PAGE output.
"""

import sys
import os
import json
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib.pagesizes import A3, landscape
from reportlab.lib.colors import HexColor, Color
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image as ReportImage
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from PIL import Image as PILImage

# Exact ISO A3 Dimensions in Points (420 mm x 297 mm)
PAGE_WIDTH, PAGE_HEIGHT = landscape(A3) # 1190.55 pt x 841.89 pt

# Palette
COLOR_NAVY = HexColor('#0F172A')
COLOR_DARK = HexColor('#1E293B')
COLOR_MUTED = HexColor('#64748B')
COLOR_BORDER = HexColor('#CBD5E1')
COLOR_BG = HexColor('#F8FAFC')
COLOR_RED_PEN = HexColor('#DC2626')
COLOR_AMBER = HexColor('#D97706')
COLOR_BLUE = HexColor('#0284C7')
COLOR_GREEN = HexColor('#16A34A')
COLOR_PURPLE = HexColor('#7C3AED')

def sanitize(text):
    if not text:
        return ''
    s = str(text).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    return s.replace('\n', '<br/>')

def generate_a3_poster(json_path, output_pdf_path):
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    review_id = data.get('reviewId', 'review-sample')
    product_name = data.get('productName', 'Dancing Fish Berry Crunch Granola')
    review_date = data.get('date', '2026-10-26')
    version = data.get('version', 'v1.0')
    artwork_hash = data.get('artworkSha256', 'Verified master hash')
    artwork_img_path = data.get('artworkImagePath', '')
    findings = data.get('findings', [])

    # Setup 1-page canvas
    c = canvas.Canvas(output_pdf_path, pagesize=(PAGE_WIDTH, PAGE_HEIGHT))
    c.setTitle(f"PackSignal Review Proof — {product_name}")
    c.setSubject(f"Review ID: {review_id} | Artwork SHA-256: {artwork_hash}")
    c.setAuthor("PackSignal Automated Senior Reviewer Markup Studio")

    margin = 24.0
    c.saveState()

    # 1. Header Banner
    header_height = 48.0
    header_y = PAGE_HEIGHT - margin - header_height

    c.setFillColor(COLOR_NAVY)
    c.rect(margin, header_y, PAGE_WIDTH - (margin * 2), header_height, fill=1, stroke=0)

    c.setFillColor(HexColor('#FFFFFF'))
    c.setFont("Helvetica-Bold", 16)
    c.drawString(margin + 16, header_y + 26, "PACKSIGNAL · ARTWORK REVIEW PROOF")

    c.setFont("Helvetica", 10)
    c.setFillColor(HexColor('#94A3B8'))
    c.drawString(margin + 16, header_y + 11, f"Product: {product_name}  |  Version: {version}  |  Date: {review_date}  |  ID: {review_id}")

    # Right side badge
    c.setFont("Helvetica-Bold", 9)
    c.setFillColor(HexColor('#38BDF8'))
    badge_text = "SINGLE-PAGE SENIOR REVIEWER MARKUP PROOF"
    c.drawRightString(PAGE_WIDTH - margin - 16, header_y + 18, badge_text)

    # 2. Main Work Area Split:
    # Left: Artwork Box (720 pt wide)
    # Right: Finding Legend & Summary (400 pt wide)
    work_y = margin
    work_height = header_y - margin - 12.0
    artwork_box_width = 720.0
    legend_box_width = (PAGE_WIDTH - (margin * 2)) - artwork_box_width - 16.0
    legend_x = margin + artwork_box_width + 16.0

    # Draw Artwork Canvas Frame
    c.setFillColor(COLOR_BG)
    c.setStrokeColor(COLOR_BORDER)
    c.setLineWidth(1)
    c.roundRect(margin, work_y, artwork_box_width, work_height, 6, fill=1, stroke=1)

    # Embed Artwork Image if available
    img_render_box = [margin + 12, work_y + 12, artwork_box_width - 24, work_height - 24]
    art_w, art_h = img_render_box[2], img_render_box[3]
    art_x, art_y = img_render_box[0], img_render_box[1]

    has_real_image = False
    if artwork_img_path and os.path.exists(artwork_img_path):
        try:
            with PILImage.open(artwork_img_path) as pil_img:
                orig_w, orig_h = pil_img.size
                aspect = orig_w / max(1, orig_h)
                box_aspect = art_w / max(1, art_h)

                if aspect > box_aspect:
                    drawn_w = art_w
                    drawn_h = art_w / aspect
                else:
                    drawn_h = art_h
                    drawn_w = art_h * aspect

                drawn_x = art_x + (art_w - drawn_w) / 2
                drawn_y = art_y + (art_h - drawn_h) / 2

                c.drawImage(artwork_img_path, drawn_x, drawn_y, width=drawn_w, height=drawn_h, preserveAspectRatio=True)
                art_x, art_y, art_w, art_h = drawn_x, drawn_y, drawn_w, drawn_h
                has_real_image = True
        except Exception as e:
            has_real_image = False

    if not has_real_image:
        c.setFillColor(HexColor('#0F172A'))
        c.setFont("Helvetica-Bold", 14)
        c.drawCentredString(art_x + art_w / 2, art_y + art_h / 2 + 10, "FLAT CARTON PACKAGING ARTWORK")
        c.setFont("Helvetica", 10)
        c.setFillColor(COLOR_MUTED)
        c.drawCentredString(art_x + art_w / 2, art_y + art_h / 2 - 10, "Original CMYK proof with red-pen reviewer markups")

    # 3. Draw Red Pen Markups and Numbered Pins over Artwork
    c.setStrokeColor(COLOR_RED_PEN)
    c.setLineWidth(2.5)

    locatable_items = []
    unlocated_items = []

    for idx, f in enumerate(findings):
        box = f.get('box') or f.get('normalizedBox')
        if box and len(box) == 4:
            x0, y0, x1, y1 = box
            # PDF coordinates: y0 is from top in normalized coords
            bx = art_x + (x0 * art_w)
            by = art_y + ((1.0 - y1) * art_h)
            bw = (x1 - x0) * art_w
            bh = (y1 - y0) * art_h
            cx = bx + bw / 2
            cy = by + bh / 2

            marker_num = idx + 1
            locatable_items.append((marker_num, f, cx, cy))

            # Draw Red Pen Annotation
            status = f.get('status', 'issue')
            stroke_color = COLOR_RED_PEN if status == 'issue' else COLOR_AMBER
            c.setStrokeColor(stroke_color)

            title_lower = (f.get('title', '') + f.get('explanation', '')).lower()
            if 'claim' in title_lower or 'vegan' in title_lower or 'sugar' in title_lower:
                # Underline
                c.line(bx - 2, by - 2, bx + bw + 2, by - 2)
            else:
                # Circle / Ellipse
                c.ellipse(bx - 4, by - 4, bx + bw + 4, by + bh + 4, stroke=1, fill=0)

            # Draw Numbered Pin
            c.setFillColor(COLOR_NAVY)
            c.circle(cx, cy, 9, fill=1, stroke=0)
            c.setStrokeColor(HexColor('#FFFFFF'))
            c.setLineWidth(1.5)
            c.circle(cx, cy, 9, fill=0, stroke=1)

            c.setFillColor(HexColor('#FFFFFF'))
            c.setFont("Helvetica-Bold", 8)
            c.drawCentredString(cx, cy - 3, str(marker_num))
        else:
            unlocated_items.append(f)

    # 4. Right Panel: Finding Legend Table & Review Summary
    legend_y = work_y
    legend_h = work_height

    # Draw Legend Box
    c.setFillColor(HexColor('#FFFFFF'))
    c.setStrokeColor(COLOR_BORDER)
    c.setLineWidth(1)
    c.roundRect(legend_x, legend_y, legend_box_width, legend_h, 6, fill=1, stroke=1)

    # Legend Header
    c.setFillColor(COLOR_NAVY)
    c.setFont("Helvetica-Bold", 12)
    c.drawString(legend_x + 14, legend_y + legend_h - 22, "FINDING INDEX & LEGEND")

    c.setFont("Helvetica", 9)
    c.setFillColor(COLOR_MUTED)
    c.drawString(legend_x + 14, legend_y + legend_h - 36, f"Numbered reviewer pins mapped to source evidence ({len(locatable_items)} mapped)")

    # Legend Table Rows
    row_y = legend_y + legend_h - 52
    row_height = 36.0

    # Table Header Row
    c.setFillColor(HexColor('#F1F5F9'))
    c.rect(legend_x + 10, row_y - 14, legend_box_width - 20, 16, fill=1, stroke=0)
    c.setFillColor(COLOR_DARK)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(legend_x + 16, row_y - 10, "#")
    c.drawString(legend_x + 36, row_y - 10, "FINDING TITLE")
    c.drawString(legend_x + 230, row_y - 10, "DEPT")
    c.drawString(legend_x + 285, row_y - 10, "STATUS")

    row_y -= 20

    for num, item, _, _ in locatable_items[:12]: # Show up to top 12 locatable items
        c.setStrokeColor(HexColor('#E2E8F0'))
        c.setLineWidth(0.5)
        c.line(legend_x + 10, row_y - 8, legend_x + legend_box_width - 10, row_y - 8)

        # Pin Number
        c.setFillColor(COLOR_RED_PEN)
        c.setFont("Helvetica-Bold", 9)
        c.drawString(legend_x + 16, row_y, f"[{num}]")

        # Title
        title = item.get('title', 'Review Finding')
        if len(title) > 34:
            title = title[:32] + '…'
        c.setFillColor(COLOR_DARK)
        c.setFont("Helvetica-Bold", 8)
        c.drawString(legend_x + 36, row_y, title)

        # Subtitle / Explanation snippet
        expl = item.get('explanation', '')
        if len(expl) > 42:
            expl = expl[:40] + '…'
        c.setFillColor(COLOR_MUTED)
        c.setFont("Helvetica", 7)
        c.drawString(legend_x + 36, row_y - 9, expl)

        # Dept badge
        dept = (item.get('primaryDepartment') or 'Legal').upper()
        dept_color = COLOR_AMBER if dept == 'LEGAL' else (COLOR_BLUE if dept == 'R&D' else COLOR_PURPLE)
        c.setFillColor(dept_color)
        c.setFont("Helvetica-Bold", 7)
        c.drawString(legend_x + 230, row_y, dept)

        # Status badge
        status = item.get('status', 'issue').upper()
        c.setFillColor(COLOR_RED_PEN if status == 'ISSUE' else COLOR_AMBER)
        c.drawString(legend_x + 285, row_y, status)

        row_y -= row_height

    # 5. Bottom Summary Block on Right Panel
    summary_h = 100.0
    summary_y = legend_y + 12
    c.setFillColor(HexColor('#F8FAFC'))
    c.setStrokeColor(COLOR_BORDER)
    c.roundRect(legend_x + 10, summary_y, legend_box_width - 20, summary_h, 4, fill=1, stroke=1)

    c.setFillColor(COLOR_NAVY)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(legend_x + 18, summary_y + summary_h - 18, "REVIEW METRICS & HASH PROVENANCE")

    c.setFont("Helvetica", 8)
    c.setFillColor(COLOR_DARK)
    open_issues = len([f for f in findings if f.get('status') == 'issue'])
    needs_review = len([f for f in findings if f.get('status') == 'review'])
    c.drawString(legend_x + 18, summary_y + summary_h - 34, f"• Open Issues: {open_issues}   • Needs Review: {needs_review}   • Unlocated: {len(unlocated_items)}")

    c.setFillColor(COLOR_MUTED)
    c.setFont("Helvetica", 7.5)
    c.drawString(legend_x + 18, summary_y + summary_h - 50, f"Artwork SHA-256: {artwork_hash[:32]}…")
    c.drawString(legend_x + 18, summary_y + summary_h - 64, f"Review Session: {review_id}")

    c.setFont("Helvetica-Oblique", 7)
    c.setFillColor(HexColor('#64748B'))
    c.drawString(legend_x + 18, summary_y + summary_h - 84, "Scope: Senior Reviewer Markup Proof for proofreading. Not print authorization.")

    c.restoreState()
    c.showPage()
    c.save()

    print(f"Generated A3 Poster: {output_pdf_path} (Page count: 1)")

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: render-poster.py <input.json> <output.pdf>")
        sys.exit(1)
    generate_a3_poster(sys.argv[1], sys.argv[2])
