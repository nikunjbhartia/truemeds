import os
import re
import json

def clean_brand_name(cell_val):
    # Extract brand name inside **...**
    bold_match = re.search(r'\*\*([^*]+)\*\*', cell_val)
    if bold_match:
        brand_name = bold_match.group(1).strip()
    else:
        brand_name = cell_val.strip()
    
    # Anything outside **...** that is in parentheses
    details = None
    idx = cell_val.find('**')
    if idx != -1:
        second_idx = cell_val.find('**', idx + 2)
        if second_idx != -1:
            rest = cell_val[second_idx + 2:].strip()
            if rest.startswith('(') and rest.endswith(')'):
                details = rest[1:-1].strip()
    return brand_name, details

def clean_status(status_val):
    # Remove checkbox e.g. [x] or [ ]
    val = re.sub(r'^\[[ x]\]\s*', '', status_val.strip())
    # Remove stars or underscores
    val = re.sub(r'[*_]', '', val).strip()
    # Extract details in parentheses if any
    match = re.match(r'^([^(]+)(?:\s*\((.+)\))?$', val)
    if match:
        status = match.group(1).strip()
        details = match.group(2).strip() if match.group(2) else None
    else:
        status = val
        details = None
    return status, details

def parse_float(val):
    if not val:
        return 0.0
    # Strip Rs., % and spaces, keeping the dot!
    cleaned = val.replace("Rs.", "").replace("%", "").strip()
    try:
        return float(cleaned)
    except ValueError:
        return 0.0

def parse_link(cell_val):
    # Print for debugging
    # print(f"DEBUG link cell: {cell_val}")
    match = re.search(r'\[[^\]]+\]\((https?://[^)]+)\)', cell_val)
    if match:
        return match.group(1).strip()
    return ""

def parse_markdown_table(lines):
    if len(lines) < 3:
        return []
    
    # Clean and split header
    headers = [h.strip() for h in lines[0].split('|')[1:-1]]
    
    # Detect column indices
    col_map = {}
    for i, h in enumerate(headers):
        h_lower = h.lower().strip()
        if "brand" in h_lower:
            col_map["brand"] = i
        elif "category" in h_lower:
            col_map["category"] = i
        elif "manufacturer" in h_lower:
            col_map["manufacturer"] = i
        elif "form" in h_lower:
            col_map["pack_form"] = i
        elif "status" in h_lower:
            col_map["status"] = i
        elif "saving" in h_lower:
            col_map["savings_percent"] = i
        elif "instruction" in h_lower or "link" in h_lower:
            col_map["link"] = i
        elif "price / unit" in h_lower or "price/unit" in h_lower or "price per unit" in h_lower:
            col_map["unit_price"] = i
        elif "mrp" in h_lower:
            col_map["mrp"] = i
        elif "price" in h_lower:
            col_map["price"] = i
            
    rows = []
    # Skip header and separator
    for line in lines[2:]:
        if not line.strip() or not line.startswith('|'):
            continue
        cells = [c.strip() for c in line.split('|')[1:-1]]
        if len(cells) < len(headers):
            continue
        
        row_data = {}
        for col_name, idx in col_map.items():
            if idx < len(cells):
                row_data[col_name] = cells[idx]
        rows.append(row_data)
    return rows

def parse_report_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    sections = {}
    current_section = "metadata"
    current_lines = []
    
    for line in content.splitlines():
        line_stripped = line.strip()
        if line_stripped.startswith("## "):
            sections[current_section] = current_lines
            header = line_stripped[3:].strip()
            if "Summary Recommendations" in header:
                current_section = "recommendations"
            elif "Exact Match Alternatives" in header:
                current_section = "exact"
            elif "Different Strength" in header:
                current_section = "different_strength"
            elif "Extra Component" in header:
                current_section = "extra"
            elif "Missing Component" in header:
                current_section = "missing"
            else:
                current_section = header
            current_lines = []
        else:
            current_lines.append(line)
    sections[current_section] = current_lines

    # 1. Parse Metadata
    metadata_lines = sections.get("metadata", [])
    queried_name = ""
    queried_price = 0.0
    queried_unit_price = 0.0
    queried_units = 0.0
    ingredients = []
    
    for line in metadata_lines:
        line_stripped = line.strip()
        if line_stripped.startswith("**Queried Reference Medicine**"):
            match = re.search(
                r'\*\*Queried Reference Medicine\*\*:\s*(.+?)\s*\(Pack Price:\s*Rs\.\s*([\d.]+)\s*for\s*([\d.]+)\s*units?\s*-\s*Rs\.\s*([\d.]+)/unit\)',
                line_stripped
            )
            if match:
                queried_name = match.group(1).strip()
                queried_price = parse_float(match.group(2))
                queried_units = parse_float(match.group(3))
                queried_unit_price = parse_float(match.group(4))
        elif line_stripped.startswith("**Composition Ingredients**"):
            match = re.search(r'\*\*Composition Ingredients\*\*:\s*(.+)$', line_stripped)
            if match:
                ingredients = [i.strip() for i in match.group(1).split(',')]

    # 2. Parse tables
    def extract_table_lines(lines):
        table_lines = []
        for line in lines:
            if line.strip().startswith('|'):
                table_lines.append(line)
        return table_lines

    # Recommendations
    recs = []
    rec_lines = extract_table_lines(sections.get("recommendations", []))
    if rec_lines:
        parsed_recs = parse_markdown_table(rec_lines)
        for r in parsed_recs:
            brand, details = clean_brand_name(r.get("brand", ""))
            recs.append({
                "category": r.get("category", ""),
                "brand": brand,
                "mrp": parse_float(r.get("mrp")),
                "price": parse_float(r.get("price")),
                "unit_price": parse_float(r.get("unit_price")),
                "savings_percent": parse_float(r.get("savings_percent")),
                "link": parse_link(r.get("link", "")),
                "details": details or ""
            })

    # Exact alternatives
    exact = []
    queried_mrp = 0.0
    exact_lines = extract_table_lines(sections.get("exact", []))
    if exact_lines:
        parsed_exact = parse_markdown_table(exact_lines)
        for r in parsed_exact:
            brand, details = clean_brand_name(r.get("brand", ""))
            status, status_details = clean_status(r.get("status", ""))
            
            # If this is the queried brand row, capture its MRP
            if "Queried Brand" in status:
                queried_mrp = parse_float(r.get("mrp"))
                
            exact.append({
                "brand": brand,
                "manufacturer": r.get("manufacturer", ""),
                "pack_form": r.get("pack_form", ""),
                "mrp": parse_float(r.get("mrp")),
                "price": parse_float(r.get("price")),
                "unit_price": parse_float(r.get("unit_price")),
                "savings_percent": parse_float(r.get("savings_percent")),
                "link": parse_link(r.get("link", "")),
                "status": status,
                "details": details or status_details or ""
            })

    # Different strength
    diff_strength = []
    diff_lines = extract_table_lines(sections.get("different_strength", []))
    if diff_lines:
        parsed_diff = parse_markdown_table(diff_lines)
        for r in parsed_diff:
            brand, details = clean_brand_name(r.get("brand", ""))
            status, status_details = clean_status(r.get("status", ""))
            diff_strength.append({
                "brand": brand,
                "manufacturer": r.get("manufacturer", ""),
                "pack_form": r.get("pack_form", ""),
                "mrp": parse_float(r.get("mrp")),
                "price": parse_float(r.get("price")),
                "unit_price": parse_float(r.get("unit_price")),
                "savings_percent": parse_float(r.get("savings_percent")),
                "link": parse_link(r.get("link", "")),
                "status": status,
                "details": details or status_details or ""
            })

    # Partial (Combine Extra and Missing)
    partial = []
    extra_lines = extract_table_lines(sections.get("extra", []))
    if extra_lines:
        parsed_extra = parse_markdown_table(extra_lines)
        for r in parsed_extra:
            brand, details = clean_brand_name(r.get("brand", ""))
            status, status_details = clean_status(r.get("status", ""))
            partial.append({
                "brand": brand,
                "manufacturer": r.get("manufacturer", ""),
                "pack_form": r.get("pack_form", ""),
                "mrp": parse_float(r.get("mrp")),
                "price": parse_float(r.get("price")),
                "unit_price": parse_float(r.get("unit_price")),
                "savings_percent": parse_float(r.get("savings_percent")),
                "link": parse_link(r.get("link", "")),
                "status": status,
                "details": details or status_details or ""
            })

    missing_lines = extract_table_lines(sections.get("missing", []))
    if missing_lines:
        parsed_missing = parse_markdown_table(missing_lines)
        for r in parsed_missing:
            brand, details = clean_brand_name(r.get("brand", ""))
            status, status_details = clean_status(r.get("status", ""))
            partial.append({
                "brand": brand,
                "manufacturer": r.get("manufacturer", ""),
                "pack_form": r.get("pack_form", ""),
                "mrp": parse_float(r.get("mrp")),
                "price": parse_float(r.get("price")),
                "unit_price": parse_float(r.get("unit_price")),
                "savings_percent": parse_float(r.get("savings_percent")),
                "link": parse_link(r.get("link", "")),
                "status": status,
                "details": details or status_details or ""
            })

    # Construct the final JSON payload
    payload = {
        "queried_medicine": {
            "name": queried_name,
            "price": queried_price,
            "mrp": queried_mrp if queried_mrp > 0 else queried_price,
            "unit_price": queried_unit_price,
            "units": queried_units,
            "ingredients": ingredients
        },
        "recommendations": recs,
        "alternatives": {
            "exact": exact,
            "different_strength": diff_strength,
            "partial": partial
        }
    }
    return payload

if __name__ == '__main__':
    import sys
    
    # Specified files to parse
    target_files = [
        "aptamil_premium_stage_1_from_birth_to_6_month_infant_formula_refill_powder_400gm_substitutes.md",
        "ecoflora_capsule_30_substitutes.md",
        "ecosprin_75_tablet_14_substitutes.md",
        "pan_40_tablet_15_substitutes.md",
        "pantomore_dsr_capsule_10_substitutes.md"
    ]
    
    # If a specific file is passed, just parse and print to stdout
    if len(sys.argv) > 1:
        file_to_parse = sys.argv[1]
        data = parse_report_file(file_to_parse)
        print(json.dumps(data, indent=2))
    else:
        # Batch convert the 5 files
        workspace_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        input_dir = os.path.join(workspace_dir, "python", "reports")
        output_dir = os.path.join(workspace_dir, "web", "data")
        
        os.makedirs(output_dir, exist_ok=True)
        
        print(f"Starting batch conversion from {input_dir} to {output_dir}...")
        for filename in target_files:
            input_path = os.path.join(input_dir, filename)
            output_filename = filename.rsplit('.', 1)[0] + '.json'
            output_path = os.path.join(output_dir, output_filename)
            
            if not os.path.exists(input_path):
                print(f"Error: Target file {input_path} does not exist. Skipping.")
                continue
                
            print(f"Converting {filename} -> {output_filename}...")
            try:
                data = parse_report_file(input_path)
                with open(output_path, 'w', encoding='utf-8') as out_f:
                    json.dump(data, out_f, indent=2)
                print(f"Successfully wrote {output_path}")
            except Exception as e:
                print(f"Failed to convert {filename}: {str(e)}")
        print("Batch conversion completed.")
