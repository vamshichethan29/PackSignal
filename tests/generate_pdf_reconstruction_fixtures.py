#!/usr/bin/env python3
"""
Generates real PDF test fixtures A through T for Advanced PDF Text Reconstruction.
"""

import math
import os
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter

OUT_DIR = Path(__file__).resolve().parent / "fixtures" / "reconstruction"
OUT_DIR.mkdir(parents=True, exist_ok=True)


def create_fixture_a():
    """A. Standard horizontal text -> Unchanged."""
    c = canvas.Canvas(str(OUT_DIR / "fixture_a_standard.pdf"), pagesize=(600, 400))
    c.setFont("Helvetica", 14)
    c.drawString(100, 300, "Organic Wild Berry Granola")
    c.drawString(100, 270, "100% Whole Grain Rolled Oats")
    c.save()


def create_fixture_b():
    """B. Letter-spaced phrase -> 'P A C K E D' -> 'PACKED'."""
    c = canvas.Canvas(str(OUT_DIR / "fixture_b_spaced_word.pdf"), pagesize=(600, 400))
    c.setFont("Helvetica-Bold", 18)
    c.drawString(150, 250, "P A C K E D")
    c.save()


def create_fixture_c():
    """C. Multiple widely tracked words -> 'P A C K E D   W I T H   G O O D N E S S' -> 'PACKED WITH GOODNESS'."""
    c = canvas.Canvas(str(OUT_DIR / "fixture_c_tracked_words.pdf"), pagesize=(600, 400))
    c.setFont("Helvetica-Bold", 16)
    c.drawString(100, 250, "P A C K E D   W I T H   G O O D N E S S")
    c.save()


def create_fixture_d():
    """D. Spaced numeric value -> '1 5 g' -> '15 g'."""
    c = canvas.Canvas(str(OUT_DIR / "fixture_d_spaced_number.pdf"), pagesize=(600, 400))
    c.setFont("Helvetica", 14)
    c.drawString(100, 250, "Total Fat 1 5 g")
    c.save()


def create_fixture_e():
    """E. Spaced decimal -> '2 . 2 g' -> '2.2 g'."""
    c = canvas.Canvas(str(OUT_DIR / "fixture_e_spaced_decimal.pdf"), pagesize=(600, 400))
    c.setFont("Helvetica", 14)
    c.drawString(100, 250, "Saturated Fat 2 . 2 g")
    c.save()


def create_fixture_f():
    """F. Two separate table columns -> Col 1: '1', Col 2: '5 g' -> NOT merged."""
    c = canvas.Canvas(str(OUT_DIR / "fixture_f_table_columns.pdf"), pagesize=(600, 400))
    c.setFont("Helvetica", 12)
    c.drawString(100, 300, "Serving")
    c.drawString(280, 300, "Fat")

    c.drawString(100, 260, "1")
    c.drawString(280, 260, "5 g")

    c.drawString(100, 230, "2")
    c.drawString(280, 230, "10 g")
    c.save()


def create_fixture_g():
    """G. Top circular arc slogan -> 'PACKED WITH GOODNESS' along top half of circle."""
    c = canvas.Canvas(str(OUT_DIR / "fixture_g_top_arc.pdf"), pagesize=(600, 500))
    cx, cy, r = 300.0, 220.0, 100.0
    text = "PACKED WITH GOODNESS"
    c.setFont("Helvetica-Bold", 14)

    start_ang = 150.0  # degrees
    end_ang = 30.0    # degrees
    span = end_ang - start_ang  # -120 deg
    n = len(text)

    for i, ch in enumerate(text):
        ang_deg = start_ang + span * (i / float(max(1, n - 1)))
        ang_rad = math.radians(ang_deg)
        x = cx + r * math.cos(ang_rad)
        y = cy + r * math.sin(ang_rad)

        c.saveState()
        c.translate(x, y)
        c.rotate(ang_deg - 90.0)
        c.drawString(-4, -4, ch)
        c.restoreState()

    c.save()


def create_fixture_h():
    """H. Bottom circular arc slogan -> 'ALL NATURAL INGREDIENTS' along bottom half of circle."""
    c = canvas.Canvas(str(OUT_DIR / "fixture_h_bottom_arc.pdf"), pagesize=(600, 500))
    cx, cy, r = 300.0, 280.0, 100.0
    text = "ALL NATURAL INGREDIENTS"
    c.setFont("Helvetica-Bold", 12)

    start_ang = 210.0
    end_ang = 330.0
    span = end_ang - start_ang
    n = len(text)

    for i, ch in enumerate(text):
        ang_deg = start_ang + span * (i / float(max(1, n - 1)))
        ang_rad = math.radians(ang_deg)
        x = cx + r * math.cos(ang_rad)
        y = cy + r * math.sin(ang_rad)

        c.saveState()
        c.translate(x, y)
        c.rotate(ang_deg + 90.0)
        c.drawString(-3, -3, ch)
        c.restoreState()

    c.save()


def create_fixture_i():
    """I. Counterclockwise curved text."""
    c = canvas.Canvas(str(OUT_DIR / "fixture_i_counterclockwise.pdf"), pagesize=(600, 500))
    cx, cy, r = 300.0, 250.0, 110.0
    text = "GOLDEN HARVEST BRAND"
    c.setFont("Helvetica-Bold", 13)

    start_ang = 20.0
    end_ang = 160.0
    span = end_ang - start_ang
    n = len(text)

    for i, ch in enumerate(text):
        ang_deg = start_ang + span * (i / float(max(1, n - 1)))
        ang_rad = math.radians(ang_deg)
        x = cx + r * math.cos(ang_rad)
        y = cy + r * math.sin(ang_rad)

        c.saveState()
        c.translate(x, y)
        c.rotate(ang_deg + 90.0)
        c.drawString(-4, -4, ch)
        c.restoreState()

    c.save()


def create_fixture_j():
    """J. Rotated individual characters with tangent-aware alignment."""
    c = canvas.Canvas(str(OUT_DIR / "fixture_j_rotated_chars.pdf"), pagesize=(600, 500))
    cx, cy, r = 300.0, 250.0, 90.0
    text = "CERTIFIED ORGANIC"
    c.setFont("Helvetica", 14)

    start_ang = 140.0
    end_ang = 40.0
    span = end_ang - start_ang
    n = len(text)

    for i, ch in enumerate(text):
        ang_deg = start_ang + span * (i / float(max(1, n - 1)))
        ang_rad = math.radians(ang_deg)
        x = cx + r * math.cos(ang_rad)
        y = cy + r * math.sin(ang_rad)

        c.saveState()
        c.translate(x, y)
        c.rotate(ang_deg - 90.0)
        c.drawString(-3, -3, ch)
        c.restoreState()

    c.save()


def create_fixture_k():
    """K. Elliptical curved text (semi-major a=130, semi-minor b=70)."""
    c = canvas.Canvas(str(OUT_DIR / "fixture_k_elliptical.pdf"), pagesize=(600, 500))
    cx, cy = 300.0, 250.0
    a, b = 130.0, 70.0
    text = "PREMIUM QUALITY"
    c.setFont("Helvetica-Bold", 14)

    start_ang = 150.0
    end_ang = 30.0
    span = end_ang - start_ang
    n = len(text)

    for i, ch in enumerate(text):
        ang_deg = start_ang + span * (i / float(max(1, n - 1)))
        ang_rad = math.radians(ang_deg)
        x = cx + a * math.cos(ang_rad)
        y = cy + b * math.sin(ang_rad)

        c.saveState()
        c.translate(x, y)
        c.rotate(ang_deg - 90.0)
        c.drawString(-3, -3, ch)
        c.restoreState()

    c.save()


def create_fixture_l():
    """L. Random scattered letters -> No fabricated phrase."""
    c = canvas.Canvas(str(OUT_DIR / "fixture_l_scattered.pdf"), pagesize=(600, 500))
    c.setFont("Helvetica", 12)
    coords = [
        (45, 80, "X"), (230, 410, "B"), (500, 120, "Q"),
        (120, 340, "Z"), (410, 290, "M"), (70, 450, "P")
    ]
    for x, y, ch in coords:
        c.drawString(x, y, ch)
    c.save()


def create_fixture_m():
    """M. Curved vector-outlined text (vector paths only, no native Unicode text)."""
    c = canvas.Canvas(str(OUT_DIR / "fixture_m_outlined_vector.pdf"), pagesize=(600, 500))
    c.setFillColorRGB(0.1, 0.2, 0.4)
    # Draw 10 small closed vector letter shapes along an arc
    cx, cy, r = 300.0, 250.0, 100.0
    for i in range(10):
        ang = math.radians(140.0 - i * 11.0)
        x = cx + r * math.cos(ang)
        y = cy + r * math.sin(ang)
        p = c.beginPath()
        p.rect(x - 5, y - 6, 10, 12)
        c.drawPath(p, fill=1, stroke=0)
    c.save()


def create_fixture_o():
    """O. Hidden native text under opaque white box -> Excluded from visible verification."""
    c = canvas.Canvas(str(OUT_DIR / "fixture_o_hidden_overlay.pdf"), pagesize=(600, 400))
    # 1. Native text drawn first (e.g. obsolete EU table: "1 5 g")
    c.setFont("Helvetica", 14)
    c.setFillColorRGB(0.1, 0.1, 0.1)
    c.drawString(150, 250, "Total Fat 1 5 g")

    # 2. Opaque white box painted directly over the text
    c.setFillColorRGB(1.0, 1.0, 1.0)
    c.rect(130, 230, 220, 50, fill=1, stroke=0)

    # 3. New visible replacement text painted on top
    c.setFillColorRGB(0.1, 0.1, 0.1)
    c.drawString(150, 180, "Total Fat 10g")
    c.save()


def create_fixture_q():
    """Q. Rotated PDF page."""
    c = canvas.Canvas(str(OUT_DIR / "fixture_q_rotated_page.pdf"), pagesize=(400, 600))
    c.setFont("Helvetica-Bold", 16)
    c.drawString(100, 300, "P A C K E D   W I T H   G O O D N E S S")
    c.save()


def create_fixture_r():
    """R. Multiple nutrition columns -> Isolated."""
    c = canvas.Canvas(str(OUT_DIR / "fixture_r_nutrition_columns.pdf"), pagesize=(600, 500))
    c.setFont("Helvetica", 12)
    c.drawString(80, 400, "Nutrient")
    c.drawString(220, 400, "Per 100g")
    c.drawString(380, 400, "Per Serving")

    c.drawString(80, 360, "Fat")
    c.drawString(220, 360, "1 5 g")
    c.drawString(380, 360, "5 g")

    c.drawString(80, 320, "Carbohydrate")
    c.drawString(220, 320, "6 0 g")
    c.drawString(380, 320, "2 0 g")
    c.save()


def generate_all():
    create_fixture_a()
    create_fixture_b()
    create_fixture_c()
    create_fixture_d()
    create_fixture_e()
    create_fixture_f()
    create_fixture_g()
    create_fixture_h()
    create_fixture_i()
    create_fixture_j()
    create_fixture_k()
    create_fixture_l()
    create_fixture_m()
    create_fixture_o()
    create_fixture_q()
    create_fixture_r()
    print("Generated all PDF reconstruction test fixtures in:", OUT_DIR)


if __name__ == "__main__":
    generate_all()
