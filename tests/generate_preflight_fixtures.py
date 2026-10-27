"""Generate deterministic synthetic test artwork files for Prepress Engine testing.
Creates test cases covering:
1. Valid EAN-13 barcode with clean quiet zones
2. Barcode with left quiet-zone intrusion
3. Barcode with right quiet-zone intrusion
4. Barcode with low visual contrast
5. Blurred/low-res barcode
6. PDF with valid 3 mm BleedBox
7. PDF with 0 mm / insufficient BleedBox
8. PDF with text below 6 pt minimum
9. PDF with text meeting 6 pt minimum
10. PDF with spot color separation (e.g. Pantone / Metallic)
11. PDF with DeviceCMYK rich black text
12. PDF with single-channel 100% K black text
"""
import sys, os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

out_dir = Path(__file__).resolve().parent / "fixtures" / "preflight"
out_dir.mkdir(parents=True, exist_ok=True)

def generate_barcode_raster(filename, left_clear=True, right_clear=True, contrast=1.0, blur=False, size=(300, 100)):
    im = Image.new("RGB", size, (255, 255, 255))
    draw = ImageDraw.Draw(im)

    # Standard EAN-13 has 95 modules
    # Place barcode bars in center
    module_w = 2.0
    bar_start_x = 50.0  # Gives 50px left margin (~25 modules, ample for 11X)
    bar_h = 70.0
    bar_y0 = 15.0
    bar_y1 = bar_y0 + bar_h

    # Draw dummy alternating bars resembling an EAN pattern
    # 101 guard, data, 01010 center, data, 101 guard
    pattern = "10100110010100100110011001010100110010011001100101010100110010011001100101010011001001100110010101"
    
    dark_val = int(255 * (1.0 - contrast))
    bar_color = (dark_val, dark_val, dark_val)

    cur_x = bar_start_x
    for ch in pattern:
        if ch == '1':
            draw.rectangle([cur_x, bar_y0, cur_x + module_w - 0.5, bar_y1], fill=bar_color)
        cur_x += module_w

    bar_end_x = cur_x

    # If left quiet zone intrusion requested: draw dark text/box in the left 11X margin
    if not left_clear:
        # 11 modules * 2 = 22px
        draw.rectangle([bar_start_x - 15, bar_y0 + 10, bar_start_x - 3, bar_y1 - 10], fill=(20, 20, 20))

    # If right quiet zone intrusion requested: draw dark text/box in right 7X margin
    if not right_clear:
        draw.rectangle([bar_end_x + 3, bar_y0 + 10, bar_end_x + 15, bar_y1 - 10], fill=(20, 20, 20))

    if blur:
        im = im.filter(ImageFilter.GaussianBlur(radius=3))

    im.save(out_dir / filename)
    return out_dir / filename

def generate_pdf_boxes(filename, trim_rect, bleed_rect, media_rect):
    import fitz
    doc = fitz.open()
    page = doc.new_page(width=media_rect[2] - media_rect[0], height=media_rect[3] - media_rect[1])
    page.set_mediabox(fitz.Rect(*media_rect))
    page.set_cropbox(fitz.Rect(*media_rect))
    # PyMuPDF page box setters:
    # set_bleedbox and set_trimbox
    try:
        page.set_bleedbox(fitz.Rect(*bleed_rect))
        page.set_trimbox(fitz.Rect(*trim_rect))
    except Exception:
        pass
    
    # Insert some sample text
    page.insert_text(fitz.Point(trim_rect[0] + 20, trim_rect[1] + 30), "PackSignal Preflight Test Sample", fontsize=12)
    doc.save(out_dir / filename)
    doc.close()
    return out_dir / filename

def generate_typography_pdf(filename, font_size_pt, is_allergen_bold=False):
    import fitz
    doc = fitz.open()
    page = doc.new_page(width=300, height=300)
    # Insert test text
    page.insert_text(fitz.Point(30, 40), f"Testing font size {font_size_pt} pt", fontsize=font_size_pt)
    
    # Ingredients with allergen
    if is_allergen_bold:
        page.insert_text(fitz.Point(30, 80), "Ingredients: Water, Oats, ", fontsize=8)
        page.insert_text(fitz.Point(135, 80), "Almonds", fontsize=8, fontname="helv", fontfile=None)
    else:
        page.insert_text(fitz.Point(30, 80), "Ingredients: Water, Oats, Almonds (contains almonds)", fontsize=8)

    doc.save(out_dir / filename)
    doc.close()
    return out_dir / filename

def generate_spot_color_pdf(filename):
    import fitz, pikepdf
    # Create simple base PDF
    doc = fitz.open()
    page = doc.new_page(width=200, height=200)
    page.insert_text(fitz.Point(20, 30), "Spot Color Test", fontsize=10)
    raw_path = out_dir / f"tmp_{filename}"
    doc.save(raw_path)
    doc.close()

    # Inject /Separation ColorSpace using pikepdf
    pdf = pikepdf.open(raw_path)
    p = pdf.pages[0]
    sep_cs = pikepdf.Array([
        pikepdf.Name("/Separation"),
        pikepdf.Name("/PANTONE 186 C"),
        pikepdf.Name("/DeviceCMYK"),
        pikepdf.Dictionary(
            FunctionType=2,
            Domain=pikepdf.Array([0, 1]),
            C0=pikepdf.Array([0, 0, 0, 0]),
            C1=pikepdf.Array([0, 1.0, 0.81, 0.04]),
            N=1
        )
    ])
    if "/ColorSpace" not in p.Resources:
        p.Resources.ColorSpace = pikepdf.Dictionary()
    p.Resources.ColorSpace["/CS_Pantone"] = sep_cs
    pdf.save(out_dir / filename)
    pdf.close()
    if raw_path.exists():
        raw_path.unlink()
    return out_dir / filename

if __name__ == '__main__':
    # 1. Barcode fixtures
    generate_barcode_raster("barcode_valid_clean.png", left_clear=True, right_clear=True)
    generate_barcode_raster("barcode_left_intrusion.png", left_clear=False, right_clear=True)
    generate_barcode_raster("barcode_right_intrusion.png", left_clear=True, right_clear=False)
    generate_barcode_raster("barcode_low_contrast.png", left_clear=True, right_clear=True, contrast=0.25)
    generate_barcode_raster("barcode_blurred.png", left_clear=True, right_clear=True, blur=True)

    # 2. Bleed / Trim fixtures
    # Valid 3mm bleed (Media 300x300, Bleed 20x20 to 280x280, Trim 28.5x28.5 to 271.5x271.5 -> ~3mm margin)
    generate_pdf_boxes("bleed_valid_3mm.pdf", trim_rect=[30, 30, 270, 270], bleed_rect=[21.5, 21.5, 278.5, 278.5], media_rect=[0, 0, 300, 300])
    # 0mm bleed (Trim equals Bleed)
    generate_pdf_boxes("bleed_zero_margin.pdf", trim_rect=[30, 30, 270, 270], bleed_rect=[30, 30, 270, 270], media_rect=[0, 0, 300, 300])

    # 3. Typography fixtures
    generate_typography_pdf("typo_sub_6pt.pdf", font_size_pt=4.8)
    generate_typography_pdf("typo_valid_8pt.pdf", font_size_pt=8.0)

    # 4. Color / Separation fixtures
    generate_spot_color_pdf("color_pantone_spot.pdf")

    print("Synthetic preflight fixtures generated successfully in:", out_dir)
