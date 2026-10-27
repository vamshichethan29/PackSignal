import os
import json
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from docx import Document
from docx.shared import Inches, Pt, RGBColor

out_dir = os.path.join(os.getcwd(), 'samples', 'campus-product-2')
os.makedirs(out_dir, exist_ok=True)

# 1. Generate AmritChai_Masala_IN_Carton.pdf (Artwork Dieline PDF)
pdf_path = os.path.join(out_dir, 'AmritChai_Masala_IN_Carton.pdf')
c = canvas.Canvas(pdf_path, pagesize=(800, 600))

# Background / Panel layout
c.setFillColor(colors.HexColor('#1b120c')) # Rich tea brown
c.rect(0, 0, 800, 600, fill=1, stroke=0)

# Dieline guides (cut / crease simulation)
c.setStrokeColor(colors.HexColor('#00e5ff'))
c.setLineWidth(1)
c.rect(50, 50, 700, 500, stroke=1, fill=0)
c.line(225, 50, 225, 550) # Left fold
c.line(400, 50, 400, 550) # Center fold
c.line(575, 50, 575, 550) # Right fold

# Front Panel (PDP) - X: 225 to 400
c.setFillColor(colors.HexColor('#ffffff'))
c.setFont("Helvetica-Bold", 24)
c.drawString(245, 500, "AMRIT CHAI")
c.setFont("Helvetica", 14)
c.drawString(245, 475, "Premium Masala Tea")
c.setFont("Helvetica-Oblique", 11)
c.drawString(245, 455, "Assam Single Estate Blend")

# Claims on Front
c.setFont("Helvetica-Bold", 10)
c.setFillColor(colors.HexColor('#e6b800'))
c.drawString(245, 415, "• 100% PURE ASSAM TEA")
c.drawString(245, 395, "• NO ADDED FLAVOUR")
c.drawString(245, 375, "• RICH IN NATURAL ANTIOXIDANTS")

# Net Quantity declaration (India & US dual declaration)
c.setFillColor(colors.HexColor('#ffffff'))
c.setFont("Helvetica-Bold", 12)
c.drawString(245, 120, "Net Quantity: 250 g (8.8 oz)")
c.setFont("Helvetica", 9)
c.drawString(245, 100, "वजन: २५० ग्राम (शुद्ध मात्रा)")

# FSSAI Veg Logo (Green dot in green square)
c.setStrokeColor(colors.HexColor('#008000'))
c.setLineWidth(1.5)
c.rect(355, 110, 24, 24, stroke=1, fill=0)
c.setFillColor(colors.HexColor('#008000'))
c.circle(367, 122, 6, fill=1, stroke=0)

# Back Panel (Ingredients & Manufacturer) - X: 50 to 225
c.setFillColor(colors.HexColor('#ffffff'))
c.setFont("Helvetica-Bold", 14)
c.drawString(65, 500, "INGREDIENTS")
c.setFont("Helvetica", 9)
c.drawString(65, 480, "Assam Black Tea (85%), Spices (15%):")
c.drawString(65, 465, "Cardamom, Dried Ginger, Cinnamon,")
c.drawString(65, 450, "Clove, Black Pepper.")

c.setFont("Helvetica-Bold", 10)
c.drawString(65, 410, "ALLERGEN DECLARATION:")
c.setFont("Helvetica", 9)
c.drawString(65, 395, "Free from common allergens.")
c.drawString(65, 380, "No Nuts, Milk, Soy, or Gluten.")

c.setFont("Helvetica-Bold", 10)
c.drawString(65, 340, "FSSAI LICENCE NO:")
c.setFont("Helvetica", 10)
c.drawString(65, 325, "10014011000185")

c.setFont("Helvetica-Bold", 10)
c.drawString(65, 280, "RETAIL SALE PRICE:")
c.setFont("Helvetica", 9)
c.drawString(65, 265, "MRP Rs. 275.00 (Incl. of all taxes)")
c.drawString(65, 250, "अधिकतम खुदरा मूल्य ₹ २७५.००")

c.setFont("Helvetica-Bold", 10)
c.drawString(65, 210, "CONSUMER CARE:")
c.setFont("Helvetica", 8)
c.drawString(65, 195, "Email: support@amritchai.in")
c.drawString(65, 180, "Toll Free: 1800-11-2233")

# Side Panel (Nutrition Facts) - X: 400 to 575
c.setFont("Helvetica-Bold", 14)
c.drawString(415, 500, "NUTRITION FACTS")
c.setFont("Helvetica", 9)
c.drawString(415, 480, "Serving Size: 2g (Makes 1 cup)")
c.drawString(415, 465, "Servings Per Container: 125")
c.line(415, 455, 560, 455)

c.setFont("Helvetica-Bold", 9)
c.drawString(415, 440, "Amount Per Serving:")
c.setFont("Helvetica", 8)
c.drawString(415, 425, "Energy: 0 kcal")
c.drawString(415, 410, "Protein: 0 g")
c.drawString(415, 395, "Total Carbohydrate: 0 g")
c.drawString(415, 380, "  Total Sugars: 0 g")
c.drawString(415, 365, "  Added Sugars: 0 g (0% DV)")
c.drawString(415, 350, "Total Fat: 0 g (0% DV)")
c.drawString(415, 335, "Sodium: 0 mg (0% DV)")
c.drawString(415, 320, "Potassium: 25 mg (<1% DV)")

# End panel (Barcode & Certification) - X: 575 to 750
c.setFont("Helvetica-Bold", 12)
c.drawString(590, 500, "BATCH & PACKING")
c.setFont("Helvetica", 9)
c.drawString(590, 480, "Batch: AC-2026-M04")
c.drawString(590, 465, "Mfg Date: 15/04/2026")
c.drawString(590, 450, "Best Before: 12 Months from Mfg")
c.drawString(590, 420, "Origin: Assam, India")
c.drawString(590, 400, "GTIN: 8901234567890")

c.save()
print(f"Generated artwork PDF: {pdf_path}")

# 2. Generate AmritChai_Content_Sheet.xlsx (Excel Content Sheet)
xlsx_path = os.path.join(out_dir, 'AmritChai_Content_Sheet.xlsx')
wb = openpyxl.Workbook()

# Sheet 1: Product Copy
ws1 = wb.active
ws1.title = "Approved Copy"
ws1.append(["Field Name", "Approved English Copy", "Approved Hindi (Devanagari)", "Mandatory Regulations", "Authority"])
ws1.append(["Brand Name", "Amrit Chai", "अमृत चाय", "Brand SOP", "HIGH"])
ws1.append(["Product Descriptor", "Premium Masala Tea", "प्रीमियम मसाला चाय", "FSSAI Category 14.1.4", "HIGH"])
ws1.append(["Net Quantity", "250 g", "२५० ग्राम", "Legal Metrology Act § 18", "CRITICAL"])
ws1.append(["MRP", "Rs. 275.00 (Incl. of all taxes)", "₹ २७५.०० (सभी कर सहित)", "Legal Metrology (Packaged Commodities)", "CRITICAL"])
ws1.append(["FSSAI Licence", "10014011000185", "एफएसएसएआई लाइसेंस १०१४०११०००१८५", "FSSAI FSS (Packaging & Labelling)", "CRITICAL"])
ws1.append(["Veg Logo", "Green Symbol", "शाकाहारी प्रतीक", "FSSAI Reg 2.2.2(4)", "CRITICAL"])
ws1.append(["Claim 1", "100% Pure Assam Tea", "१००% शुद्ध असम चाय", "FSSAI (Advertising & Claims)", "MEDIUM"])
ws1.append(["Claim 2", "No Added Flavour", "कोई अतिरिक्त स्वाद नहीं", "FSSAI (Advertising & Claims)", "HIGH"])
ws1.append(["Ingredients", "Assam Black Tea (85%), Spices (15%): Cardamom, Dried Ginger, Cinnamon, Clove, Black Pepper.", "असम काली चाय (८५%), मसाले (१५%): इलायची, सोंठ, दालचीनी, लौंग, काली मिर्च।", "FSSAI Ingredients Labelling", "CRITICAL"])

# Sheet 2: Nutrition
ws2 = wb.create_sheet(title="Nutrition Information")
ws2.append(["Nutrient", "Per 100g", "Per Serving (2g)", "% Daily Value (US/IN)"])
ws2.append(["Energy (kcal)", "0", "0", "0%"])
ws2.append(["Protein (g)", "0", "0", "0%"])
ws2.append(["Carbohydrate (g)", "0", "0", "0%"])
ws2.append(["Total Sugars (g)", "0", "0", "N/A"])
ws2.append(["Added Sugars (g)", "0", "0", "0%"])
ws2.append(["Total Fat (g)", "0", "0", "0%"])
ws2.append(["Sodium (mg)", "0", "0", "0%"])
ws2.append(["Potassium (mg)", "1250", "25", "<1%"])

wb.save(xlsx_path)
print(f"Generated spreadsheet: {xlsx_path}")

# 3. Generate AmritChai_Product_Spec.docx (Product Specification)
docx_path = os.path.join(out_dir, 'AmritChai_Product_Spec.docx')
doc = Document()
doc.add_heading('AMRIT CHAI — PACKAGING TECHNICAL SPECIFICATION', 0)

doc.add_paragraph('Document Code: SPEC-AC-2026-IN | Revision: 3.0 | Status: APPROVED FOR LAUNCH')

doc.add_heading('1. Product Identity', level=1)
p1 = doc.add_paragraph('Product Name: Amrit Chai Masala Blend\nSKU Code: AC-MB-250\nTarget Market: India (Primary) / International Export')

doc.add_heading('2. Physical Packaging Geometry', level=1)
table_geom = doc.add_table(rows=1, cols=3)
hdr_cells = table_geom.rows[0].cells
hdr_cells[0].text = 'Dimension'
hdr_cells[1].text = 'Target'
hdr_cells[2].text = 'Tolerance'
for dim, val, tol in [('Width', '175 mm', '+/- 0.5 mm'), ('Height', '225 mm', '+/- 0.5 mm'), ('Depth', '50 mm', '+/- 0.5 mm'), ('Net Weight', '250 g', 'Tolerable deficiency: 9 g (Legal Metrology)')]:
    row_cells = table_geom.add_row().cells
    row_cells[0].text = dim
    row_cells[1].text = val
    row_cells[2].text = tol

doc.add_heading('3. Mandatory Regulatory Declarations', level=1)
doc.add_paragraph('• Vegetarian Symbol: Mandatory Green dot inside green square on Front PDP.\n• Retail Sale Price (MRP): "MRP Rs. 275.00 (Incl. of all taxes)" mandatory.\n• FSSAI Logo with 14-digit licence number 10014011000185.\n• Bilingual support: English and Hindi Devanagari declarations allowed and approved.')

doc.save(docx_path)
print(f"Generated Word spec: {docx_path}")

# 4. Generate manifest.json
manifest = {
  "sampleId": "campus-product-2",
  "productName": "Amrit Chai · Masala Blend",
  "brand": "Amrit Chai",
  "category": "beverage/tea",
  "market": "India / FSSAI & Legal Metrology",
  "files": [
    { "name": "AmritChai_Masala_IN_Carton.pdf", "role": "artwork" },
    { "name": "AmritChai_Content_Sheet.xlsx", "role": "spec" },
    { "name": "AmritChai_Product_Spec.docx", "role": "spec" }
  ],
  "expectedFindings": {
    "matches": [
      "Brand Name: Amrit Chai",
      "Net Quantity: 250 g",
      "MRP: Rs. 275.00 (Incl. of all taxes)",
      "FSSAI Licence: 10014011000185",
      "Veg Logo: Present on PDP"
    ]
  }
}
manifest_path = os.path.join(out_dir, 'manifest.json')
with open(manifest_path, 'w', encoding='utf-8') as f:
    json.dump(manifest, f, indent=2)

# 5. Generate README.md
readme_content = """# Campus Product 2: Amrit Chai Masala Tea

This sample proves PackSignal is not hardcoded to Dancing Fish or Granola.

## Product Profile
- **Category**: Spiced Black Tea (Assam Estate Blend)
- **Format**: Pouch / Carton (250 g)
- **Jurisdiction**: India (FSSAI Food Safety and Standards Regulations 2020 & Legal Metrology Act)
- **Bilingual Content**: English and Devanagari Hindi (`अमृत चाय`, `२५० ग्राम`, `₹ २७५.००`)
- **Key Validations**:
  - FSSAI Green Vegetarian Logo
  - MRP declaration formatting with tax disclosures
  - FSSAI 14-digit Licence number validation
  - Devanagari numeral conversion and quote verification
  - Zero allergen profile (distinct from Dancing Fish nuts)
"""
readme_path = os.path.join(out_dir, 'README.md')
with open(readme_path, 'w', encoding='utf-8') as f:
    f.write(readme_content)

print("Generated samples/campus-product-2 manifest and README successfully.")
