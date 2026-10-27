#!/usr/bin/env python3
"""
Generate authentic, real packaging artwork PDFs and spreadsheet specifications
for the three unseen independent evaluation packages:
- CASE-01: SunRidge Mountain Trail Mix (Mismatch Case: Net Quantity, Sodium, Calories)
- CASE-02: Verdant Grove Orange Juice (Clean Case: Perfect agreement on all supported checks)
- CASE-03: Harvest Hearth Rolled Oats (Ambiguous Case: Conflicting nutrition columns / draft status)
"""

import sys
import hashlib
from pathlib import Path
import fitz
from openpyxl import Workbook

cases_dir = Path(__file__).resolve().parent.parent / "evaluation" / "independent" / "cases"
cases_dir.mkdir(parents=True, exist_ok=True)

def create_case_01():
    """CASE-01: SunRidge Mountain Trail Mix (Mismatch Case)"""
    case_dir = cases_dir / "CASE-01"
    case_dir.mkdir(parents=True, exist_ok=True)
    pdf_path = case_dir / "SunRidge_Mountain_Trail_Mix_Artwork.pdf"
    xlsx_path = case_dir / "SunRidge_Mountain_Trail_Mix_Approved_Spec.xlsx"

    # 1. Create Vector PDF Artwork
    doc = fitz.open()
    # Pouch panel: 400 x 600 pt
    page = doc.new_page(width=400, height=600)
    
    # Title & Branding
    page.insert_text((50, 50), "SunRidge Farms", fontsize=14, fontname="helv", color=(0.1, 0.3, 0.1))
    page.insert_text((50, 80), "Mountain Trail Mix", fontsize=22, fontname="helv", color=(0.1, 0.2, 0.1))
    page.insert_text((50, 105), "With Raisins, Almonds, Peanuts & Chocolate Drops", fontsize=10, fontname="helv", color=(0.3, 0.3, 0.3))
    
    # Net Quantity: Artwork prints "10 OZ (283 g)"
    page.insert_text((50, 150), "NET WT 10 OZ (283 g)", fontsize=13, fontname="helv", color=(0, 0, 0))
    
    # Nutrition Facts Panel
    page.draw_rect(fitz.Rect(45, 180, 250, 430), color=(0, 0, 0), width=1.5)
    page.insert_text((50, 200), "Nutrition Facts", fontsize=18, fontname="helv", color=(0, 0, 0))
    page.insert_text((50, 218), "About 9 servings per container", fontsize=8, fontname="helv", color=(0.2, 0.2, 0.2))
    page.insert_text((50, 230), "Serving size              30g", fontsize=9, fontname="helv", color=(0, 0, 0))
    page.draw_line(fitz.Point(45, 236), fitz.Point(250, 236), color=(0, 0, 0), width=5)
    page.insert_text((50, 252), "Amount Per Serving", fontsize=8, fontname="helv", color=(0.2, 0.2, 0.2))
    # Calories: Artwork prints 160
    page.insert_text((50, 270), "Calories                     160", fontsize=14, fontname="helv", color=(0, 0, 0))
    page.draw_line(fitz.Point(45, 276), fitz.Point(250, 276), color=(0, 0, 0), width=3)
    page.insert_text((180, 288), "% Daily Value*", fontsize=8, fontname="helv", color=(0, 0, 0))
    page.insert_text((50, 302), "Total Fat 9g                                  12%", fontsize=8, fontname="helv", color=(0, 0, 0))
    page.insert_text((60, 316), "Saturated Fat 2.5g                         13%", fontsize=8, fontname="helv", color=(0, 0, 0))
    page.insert_text((50, 330), "Cholesterol 0mg                              0%", fontsize=8, fontname="helv", color=(0, 0, 0))
    # Sodium: Artwork prints 180mg (8% DV)
    page.insert_text((50, 344), "Sodium 180mg                                 8%", fontsize=8, fontname="helv", color=(0, 0, 0))
    page.insert_text((50, 358), "Total Carbohydrate 17g                   6%", fontsize=8, fontname="helv", color=(0, 0, 0))
    page.insert_text((60, 372), "Dietary Fiber 2g                              7%", fontsize=8, fontname="helv", color=(0, 0, 0))
    page.insert_text((60, 386), "Total Sugars 12g", fontsize=8, fontname="helv", color=(0, 0, 0))
    page.insert_text((70, 400), "Includes 8g Added Sugars            16%", fontsize=8, fontname="helv", color=(0, 0, 0))
    page.insert_text((50, 414), "Protein 4g                                      8%", fontsize=8, fontname="helv", color=(0, 0, 0))
    
    # Ingredients & Allergens
    page.insert_text((50, 460), "INGREDIENTS: Raisins, Peanuts, Almonds, Dark Chocolate Drops (sugar,", fontsize=8, fontname="helv", color=(0, 0, 0))
    page.insert_text((50, 472), "chocolate liquor, cocoa butter, soy lecithin, vanilla), Sunflower Oil, Sea Salt.", fontsize=8, fontname="helv", color=(0, 0, 0))
    page.insert_text((50, 492), "ALLERGEN INFORMATION: CONTAINS: PEANUTS, ALMONDS, SOY.", fontsize=8, fontname="helv", color=(0, 0, 0))
    
    # Manufacturer / Business Address
    page.insert_text((50, 530), "Distributed by: SunRidge Foods Inc.", fontsize=8, fontname="helv", color=(0.2, 0.2, 0.2))
    page.insert_text((50, 542), "1055 Spine Road, Boulder, CO 80301 USA", fontsize=8, fontname="helv", color=(0.2, 0.2, 0.2))
    
    doc.save(str(pdf_path))
    doc.close()

    # 2. Create Approved Specification Spreadsheet
    wb = Workbook()
    ws = wb.active
    ws.title = "Approved Product Spec"
    
    ws.append(["Field", "Approved Reference Value", "Notes"])
    ws.append(["Product Name", "Mountain Trail Mix", "SunRidge Brand"])
    # Discrepancy: Spec states 12 OZ (340 g), whereas artwork prints 10 OZ (283 g)
    ws.append(["Net Quantity", "12 OZ (340 g)", "Production size 12 oz pouch"])
    ws.append(["Serving Size", "30g", "1/4 cup"])
    # Discrepancy: Spec states 150 calories, whereas artwork prints 160 calories
    ws.append(["Calories", "150", "Calculated formulation"])
    ws.append(["Total Fat", "9g", "9.0 g"])
    # Discrepancy: Spec states Sodium 110mg, whereas artwork prints 180mg
    ws.append(["Sodium", "110mg", "Reformulation reduced sodium"])
    ws.append(["Total Carbohydrate", "17g", "17 g"])
    ws.append(["Protein", "4g", "4 g"])
    ws.append(["Ingredients", "INGREDIENTS: Raisins, Peanuts, Almonds, Dark Chocolate Drops (sugar, chocolate liquor, cocoa butter, soy lecithin, vanilla), Sunflower Oil, Sea Salt.", "Approved formulation"])
    ws.append(["Allergens", "CONTAINS: PEANUTS, ALMONDS, SOY.", "FALCPA compliant"])
    ws.append(["Manufacturer", "Distributed by: SunRidge Foods Inc. 1055 Spine Road, Boulder, CO 80301 USA", "Authorized distributor"])
    ws.append(["Approval Status", "APPROVED", "Signed by QA on 2026-09-15"])
    
    wb.save(str(xlsx_path))
    print(f"[CASE-01] Created {pdf_path.name} and {xlsx_path.name}")


def create_case_02():
    """CASE-02: Verdant Grove Orange Juice (Clean Case)"""
    case_dir = cases_dir / "CASE-02"
    case_dir.mkdir(parents=True, exist_ok=True)
    pdf_path = case_dir / "Verdant_Grove_Orange_Juice_Artwork.pdf"
    xlsx_path = case_dir / "Verdant_Grove_Orange_Juice_Approved_Spec.xlsx"

    # 1. Create Vector PDF Artwork
    doc = fitz.open()
    page = doc.new_page(width=380, height=550)
    
    # Title & Branding
    page.insert_text((40, 50), "Verdant Grove", fontsize=16, fontname="helv", color=(0.9, 0.4, 0.0))
    page.insert_text((40, 80), "100% Pure Orange Juice", fontsize=20, fontname="helv", color=(0.1, 0.2, 0.1))
    page.insert_text((40, 105), "Cold-Pressed · Never From Concentrate · Pulp Free", fontsize=9, fontname="helv", color=(0.3, 0.3, 0.3))
    
    # Net Quantity: Artwork prints "NET WT 16 FL OZ (1 PT) 473 mL"
    page.insert_text((40, 145), "NET WT 16 FL OZ (1 PT) 473 mL", fontsize=14, fontname="helv", color=(0, 0, 0))
    
    # Nutrition Facts Panel
    page.draw_rect(fitz.Rect(35, 175, 230, 400), color=(0, 0, 0), width=1.5)
    page.insert_text((40, 195), "Nutrition Facts", fontsize=17, fontname="helv", color=(0, 0, 0))
    page.insert_text((40, 212), "2 servings per container", fontsize=8, fontname="helv", color=(0.2, 0.2, 0.2))
    page.insert_text((40, 224), "Serving size              8 fl oz (240mL)", fontsize=8, fontname="helv", color=(0, 0, 0))
    page.draw_line(fitz.Point(35, 230), fitz.Point(230, 230), color=(0, 0, 0), width=5)
    page.insert_text((40, 246), "Amount Per Serving", fontsize=8, fontname="helv", color=(0.2, 0.2, 0.2))
    page.insert_text((40, 264), "Calories                     110", fontsize=14, fontname="helv", color=(0, 0, 0))
    page.draw_line(fitz.Point(35, 270), fitz.Point(230, 270), color=(0, 0, 0), width=3)
    page.insert_text((165, 282), "% Daily Value*", fontsize=8, fontname="helv", color=(0, 0, 0))
    page.insert_text((40, 296), "Total Fat 0g                                    0%", fontsize=8, fontname="helv", color=(0, 0, 0))
    page.insert_text((40, 310), "Sodium 0mg                                     0%", fontsize=8, fontname="helv", color=(0, 0, 0))
    page.insert_text((40, 324), "Total Carbohydrate 26g                   9%", fontsize=8, fontname="helv", color=(0, 0, 0))
    page.insert_text((50, 338), "Total Sugars 22g", fontsize=8, fontname="helv", color=(0, 0, 0))
    page.insert_text((60, 352), "Includes 0g Added Sugars              0%", fontsize=8, fontname="helv", color=(0, 0, 0))
    page.insert_text((40, 366), "Protein 2g", fontsize=8, fontname="helv", color=(0, 0, 0))
    page.insert_text((40, 380), "Vitamin C 72mg                              80%", fontsize=8, fontname="helv", color=(0, 0, 0))
    page.insert_text((40, 394), "Potassium 450mg                            10%", fontsize=8, fontname="helv", color=(0, 0, 0))

    # Ingredients & Storage
    page.insert_text((40, 425), "INGREDIENTS: 100% PURE PASTEURIZED ORANGE JUICE.", fontsize=8, fontname="helv", color=(0, 0, 0))
    page.insert_text((40, 442), "STORAGE: KEEP REFRIGERATED · SHAKE WELL", fontsize=9, fontname="helv", color=(0.1, 0.3, 0.1))

    # Manufacturer / Business Address
    page.insert_text((40, 470), "Bottled by: Verdant Grove Citrus Co.", fontsize=8, fontname="helv", color=(0.2, 0.2, 0.2))
    page.insert_text((40, 482), "2400 Citrus Grove Blvd, Winter Haven, FL 33880 USA", fontsize=8, fontname="helv", color=(0.2, 0.2, 0.2))
    
    doc.save(str(pdf_path))
    doc.close()

    # 2. Create Approved Specification Spreadsheet (Matching 100%)
    wb = Workbook()
    ws = wb.active
    ws.title = "Approved Product Spec"
    
    ws.append(["Field", "Approved Reference Value", "Notes"])
    ws.append(["Product Name", "100% Pure Orange Juice", "Verdant Grove Brand"])
    ws.append(["Net Quantity", "16 FL OZ (1 PT) 473 mL", "Matches artwork exactly"])
    ws.append(["Serving Size", "8 fl oz (240mL)", "FDA RACI 240 mL"])
    ws.append(["Calories", "110", "Matches artwork exactly"])
    ws.append(["Total Fat", "0g", "Zero fat"])
    ws.append(["Sodium", "0mg", "Zero sodium"])
    ws.append(["Total Carbohydrate", "26g", "Matches artwork exactly"])
    ws.append(["Total Sugars", "22g", "Naturally occurring"])
    ws.append(["Protein", "2g", "Matches artwork exactly"])
    ws.append(["Ingredients", "100% PURE PASTEURIZED ORANGE JUICE.", "Matches artwork exactly"])
    ws.append(["Storage Statement", "KEEP REFRIGERATED · SHAKE WELL", "Perishable product"])
    ws.append(["Manufacturer", "Bottled by: Verdant Grove Citrus Co. 2400 Citrus Grove Blvd, Winter Haven, FL 33880 USA", "Matches artwork exactly"])
    ws.append(["Approval Status", "APPROVED", "Signed off by QA Lead 2026-10-01"])

    wb.save(str(xlsx_path))
    print(f"[CASE-02] Created {pdf_path.name} and {xlsx_path.name}")


def create_case_03():
    """CASE-03: Harvest Hearth Rolled Oats (Ambiguous Case: Conflicting Bases / Draft Status)"""
    case_dir = cases_dir / "CASE-03"
    case_dir.mkdir(parents=True, exist_ok=True)
    pdf_path = case_dir / "Harvest_Hearth_Rolled_Oats_Artwork.pdf"
    xlsx_path = case_dir / "Harvest_Hearth_Rolled_Oats_Draft_Spec.xlsx"

    # 1. Create Vector PDF Artwork
    doc = fitz.open()
    page = doc.new_page(width=420, height=580)
    
    # Title & Branding
    page.insert_text((45, 50), "Harvest Hearth", fontsize=15, fontname="helv", color=(0.4, 0.2, 0.1))
    page.insert_text((45, 80), "Old Fashioned Rolled Oats", fontsize=22, fontname="helv", color=(0.1, 0.1, 0.1))
    page.insert_text((45, 105), "100% Whole Grain · Non-GMO Project Verified", fontsize=9, fontname="helv", color=(0.3, 0.3, 0.3))
    
    # Net Quantity: Artwork prints "18 OZ (1 LB 2 OZ) 510 g"
    page.insert_text((45, 145), "NET WT 18 OZ (1 LB 2 OZ) 510 g", fontsize=14, fontname="helv", color=(0, 0, 0))
    
    # Nutrition Facts Panel (Prints Per 1/2 cup (40g) dry serving)
    page.draw_rect(fitz.Rect(40, 175, 240, 410), color=(0, 0, 0), width=1.5)
    page.insert_text((45, 195), "Nutrition Facts", fontsize=17, fontname="helv", color=(0, 0, 0))
    page.insert_text((45, 212), "About 13 servings per container", fontsize=8, fontname="helv", color=(0.2, 0.2, 0.2))
    page.insert_text((45, 224), "Serving size              1/2 cup dry (40g)", fontsize=8, fontname="helv", color=(0, 0, 0))
    page.draw_line(fitz.Point(40, 230), fitz.Point(240, 230), color=(0, 0, 0), width=5)
    page.insert_text((45, 246), "Amount Per Serving", fontsize=8, fontname="helv", color=(0.2, 0.2, 0.2))
    page.insert_text((45, 264), "Calories                     150", fontsize=14, fontname="helv", color=(0, 0, 0))
    page.draw_line(fitz.Point(40, 270), fitz.Point(240, 270), color=(0, 0, 0), width=3)
    page.insert_text((175, 282), "% Daily Value*", fontsize=8, fontname="helv", color=(0, 0, 0))
    page.insert_text((45, 296), "Total Fat 3g                                    4%", fontsize=8, fontname="helv", color=(0, 0, 0))
    page.insert_text((45, 310), "Sodium 0mg                                     0%", fontsize=8, fontname="helv", color=(0, 0, 0))
    page.insert_text((45, 324), "Total Carbohydrate 27g                 10%", fontsize=8, fontname="helv", color=(0, 0, 0))
    page.insert_text((55, 338), "Dietary Fiber 4g                           14%", fontsize=8, fontname="helv", color=(0, 0, 0))
    page.insert_text((55, 352), "Total Sugars 1g", fontsize=8, fontname="helv", color=(0, 0, 0))
    page.insert_text((45, 366), "Protein 5g", fontsize=8, fontname="helv", color=(0, 0, 0))
    page.insert_text((45, 380), "Iron 1.8mg                                     10%", fontsize=8, fontname="helv", color=(0, 0, 0))
    page.insert_text((45, 394), "Potassium 150mg                              4%", fontsize=8, fontname="helv", color=(0, 0, 0))

    # Ingredients & Storage
    page.insert_text((45, 435), "INGREDIENTS: 100% WHOLE GRAIN ROLLED OATS.", fontsize=8, fontname="helv", color=(0, 0, 0))
    page.insert_text((45, 452), "Store in a cool, dry place.", fontsize=8, fontname="helv", color=(0.2, 0.2, 0.2))

    # Manufacturer / Business Address
    page.insert_text((45, 480), "Manufactured by: Harvest Hearth Millers LLC", fontsize=8, fontname="helv", color=(0.2, 0.2, 0.2))
    page.insert_text((45, 492), "500 Prairie Mill Way, Cedar Rapids, IA 52404 USA", fontsize=8, fontname="helv", color=(0.2, 0.2, 0.2))

    doc.save(str(pdf_path))
    doc.close()

    # 2. Create Draft Specification with Ambiguous / Conflicting Nutrition Columns
    wb = Workbook()
    ws = wb.active
    ws.title = "Draft Specification"

    ws.append(["Product Specification", "STATUS: DRAFT / UNCONFIRMED", "Pending R&D Sign-off"])
    ws.append(["Product Name", "Old Fashioned Rolled Oats", "Brand: Harvest Hearth"])
    ws.append(["Net Quantity", "18 OZ (1 LB 2 OZ) 510 g", "Target packaging size"])
    ws.append([])
    
    # Conflicting nutrient composition columns!
    ws.append(["Nutrient Composition", "Formulation A (Per 40g Dry)", "Formulation B (Per 100g Prepared)"])
    ws.append(["Serving Size", "40g", "100g"])
    ws.append(["Calories", "150", "375"])
    ws.append(["Total Fat", "3g", "7.5g"])
    ws.append(["Sodium", "0mg", "0mg"])
    ws.append(["Total Carbohydrate", "27g", "67.5g"])
    ws.append(["Dietary Fiber", "4g", "10g"])
    ws.append(["Protein", "5g", "12.5g"])
    ws.append([])
    ws.append(["Ingredients", "INGREDIENTS: 100% WHOLE GRAIN ROLLED OATS.", "Approved"])
    ws.append(["Manufacturer", "Manufactured by: Harvest Hearth Millers LLC 500 Prairie Mill Way, Cedar Rapids, IA 52404 USA", "Approved"])
    ws.append(["Review Note", "Two nutrition basis columns exist. Brand has not designated primary SKU serving basis.", "Requires Human Review"])

    wb.save(str(xlsx_path))
    print(f"[CASE-03] Created {pdf_path.name} and {xlsx_path.name}")


if __name__ == "__main__":
    create_case_01()
    create_case_02()
    create_case_03()
    print("All three unseen evaluation case packages generated successfully.")
