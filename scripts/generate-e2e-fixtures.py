#!/usr/bin/env python3
import os
import zipfile
import fitz  # PyMuPDF
import openpyxl

os.makedirs('e2e/fixtures', exist_ok=True)

# 1. Artwork Rev A PDF (Net Qty 750 mL - mismatch against 1000 mL spec)
docA = fitz.open()
pageA = docA.new_page(width=612, height=792)
pageA.insert_text((72, 100), "Fieldday Organic Oat Milk", fontsize=24)
pageA.insert_text((72, 160), "NET WT 750 mL", fontsize=16)
pageA.insert_text((72, 200), "Store in a cool, dry place.", fontsize=12)
pageA.insert_text((72, 240), "Distributed by: Fieldday Brands Inc, San Francisco, CA 94107", fontsize=11)
pageA.insert_text((72, 300), "UPC: 012345678905", fontsize=14)
docA.save('e2e/fixtures/artwork-revA.pdf')
docA.close()

# 2. Artwork Rev B PDF (Corrected Net Qty 1000 mL - match against 1000 mL spec)
docB = fitz.open()
pageB = docB.new_page(width=612, height=792)
pageB.insert_text((72, 100), "Fieldday Organic Oat Milk", fontsize=24)
pageB.insert_text((72, 160), "NET WT 1000 mL", fontsize=16)
pageB.insert_text((72, 200), "Store in a cool, dry place.", fontsize=12)
pageB.insert_text((72, 240), "Distributed by: Fieldday Brands Inc, San Francisco, CA 94107", fontsize=11)
pageB.insert_text((72, 300), "UPC: 012345678905", fontsize=14)
docB.save('e2e/fixtures/artwork-revB.pdf')
docB.close()

# 3. Approved Specification XLSX
wb_app = openpyxl.Workbook()
ws_app = wb_app.active
ws_app.title = "ApprovedSpec"
ws_app.append(["Field", "Specification Value", "Approval Status", "Authority"])
ws_app.append(["product_name", "Fieldday Organic Oat Milk", "APPROVED", "Brand Management"])
ws_app.append(["sku", "OAT-1000", "APPROVED", "Master Data"])
ws_app.append(["net_quantity", "1000 mL", "APPROVED", "Legal & Regulatory"])
ws_app.append(["storage_instructions", "Store in a cool, dry place.", "APPROVED", "Quality Assurance"])
ws_app.append(["manufacturer_address", "Fieldday Brands Inc, San Francisco, CA 94107", "APPROVED", "Compliance"])
ws_app.append(["gtin_barcode", "012345678905", "APPROVED", "Supply Chain"])
wb_app.save('e2e/fixtures/spec-approved.xlsx')

# 4. Draft / Conflicting Specification XLSX
wb_draft = openpyxl.Workbook()
ws_draft = wb_draft.active
ws_draft.title = "DraftSpec"
ws_draft.append(["Field", "Variant A (Retail)", "Variant B (Foodservice)", "Status"])
ws_draft.append(["product_name", "Fieldday Organic Oat Milk", "Fieldday Organic Oat Milk", "DRAFT"])
ws_draft.append(["net_quantity", "750 mL", "1000 mL", "UNCONFIRMED"])
ws_draft.append(["storage_instructions", "Keep refrigerated.", "Store in a cool, dry place.", "DRAFT"])
wb_draft.save('e2e/fixtures/spec-draft.xlsx')

# 5. Rulebook JSON
rulebook_json = """{
  "rulebookId": "RB-FIELD-2026",
  "version": "1.2.0",
  "title": "Fieldday Brand & Packaging Regulatory Guidelines",
  "rules": [
    {
      "id": "RULE-QTY-01",
      "field": "net_quantity",
      "title": "Net Quantity Compliance",
      "text": "The declared net quantity must accurately match the approved product specification.",
      "citation": "21 CFR 101.7",
      "authority": "US FDA",
      "provision": "Declaration of net quantity of contents",
      "comparison": "exact_or_equivalent",
      "severity": "issue"
    },
    {
      "id": "RULE-STORAGE-01",
      "field": "storage_instructions",
      "title": "Storage Instruction Integrity",
      "text": "Store in a cool, dry place.",
      "citation": "Brand Standard S-401",
      "authority": "QA Standard",
      "comparison": "phrase_match",
      "severity": "issue"
    }
  ]
}"""
with open('e2e/fixtures/rulebook.json', 'w') as f:
    f.write(rulebook_json)

# 6. Rulebook TXT
rulebook_txt = """# FIELDDAY PACKAGING MANDATE 2026
SECTION 1: NET QUANTITY
The retail container must clearly declare the net quantity of contents in metric and customary units (21 CFR 101.7).

SECTION 2: STORAGE STATEMENTS
Products shelf-stable prior to opening must state: "Store in a cool, dry place."

SECTION 3: TRACEABILITY BARCODE
All consumer units must carry a verified GS1 GTIN barcode with valid check digit.
"""
with open('e2e/fixtures/rulebook.txt', 'w') as f:
    f.write(rulebook_txt)

# 7. Rulebook DOCX (Valid OpenXML archive)
docx_path = 'e2e/fixtures/rulebook.docx'
with zipfile.ZipFile(docx_path, 'w', zipfile.ZIP_DEFLATED) as z:
    z.writestr('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
    z.writestr('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
    z.writestr('word/document.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Fieldday Packaging Compliance Specification Docx. Net quantity must equal 1000 mL.</w:t></w:r></w:p></w:body></w:document>')

# 8. Malformed Rulebook JSON
with open('e2e/fixtures/malformed-rulebook.json', 'w') as f:
    f.write('{"rulebookId": "BROKEN", "rules": [ { "id": "UNCLOSED" ')

# 9. Invalid Files
# 0-byte file
with open('e2e/fixtures/empty.pdf', 'wb') as f:
    pass

# Corrupt PDF
with open('e2e/fixtures/corrupt.pdf', 'wb') as f:
    f.write(b"%PDF-1.4\n%CORRUPTED_BINARY_DATA_NOT_A_REAL_PDF_STREAM_0123456789\n%%EOF")

# Corrupt XLSX
with open('e2e/fixtures/corrupt.xlsx', 'wb') as f:
    f.write(b"PK\x03\x04CORRUPTED_NOT_A_VALID_ZIP_FILE_STREAM")

# Unsupported extension
with open('e2e/fixtures/unsupported.xyz', 'w') as f:
    f.write("This is an unsupported file format test.")

# 10. Dieline DXF
dxf_content = """0
SECTION
2
HEADER
0
ENDSEC
0
SECTION
2
TABLES
0
TABLE
2
LAYER
0
LAYER
2
CUT
70
0
62
1
0
LAYER
2
CREASE
70
0
62
3
0
ENDTAB
0
ENDSEC
0
SECTION
2
ENTITIES
0
LINE
8
CUT
10
0.0
20
0.0
11
100.0
21
0.0
0
LINE
8
CUT
10
100.0
20
0.0
11
100.0
21
150.0
0
LINE
8
CUT
10
100.0
20
150.0
11
0.0
21
150.0
0
LINE
8
CUT
10
0.0
20
150.0
11
0.0
21
0.0
0
LINE
8
CREASE
10
50.0
20
0.0
11
50.0
21
150.0
0
ENDSEC
0
EOF
"""
with open('e2e/fixtures/carton-dieline.dxf', 'w') as f:
    f.write(dxf_content)

print("E2E Fixtures generated successfully in e2e/fixtures/")
