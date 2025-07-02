import fitz  # PyMuPDF
import json

def extract_hotspots(pdf_path, sku_list):
    """
    Scans each page of the PDF for occurrences of each SKU (exact text match),
    and returns a list of hotspots with page number and bounding box coordinates.
    """
    doc = fitz.open(pdf_path)
    hotspots = []
    for page_num in range(len(doc)):
        page = doc[page_num]
        for sku in sku_list:
            # search_for returns a list of rectangles where the text occurs
            text_instances = page.search_for(sku)
            for inst in text_instances:
                x0, y0, x1, y1 = inst
                hotspots.append({
                    "sku": sku,
                    "page": page_num + 1,
                    "x": x0,
                    "y": y0,
                    "width": x1 - x0,
                    "height": y1 - y0
                })
    return hotspots

if __name__ == "__main__":
    # === Configuration ===
    pdf_file = "catalogue.pdf"             # Path to your PDF
    sku_list = ["9479", "17468", "51274"]  # List your SKUs here

    # === Extraction ===
    hotspots = extract_hotspots(pdf_file, sku_list)

    # === Output to JSON ===
    with open("hotspots.json", "w") as f:
        json.dump(hotspots, f, indent=2)
    print(f"Extracted {len(hotspots)} hotspots; saved to hotspots.json")