import urllib.request
import urllib.parse
import json
import ssl
import sys
import re
import uuid
import os

def slugify(s):
    s = s.strip().lower()
    s = re.sub(r'[^a-z0-9+]+', '_', s)
    s = re.sub(r'^_+|_+$', '', s)
    return s

def fetch_search_results(query, page=1, warehouse_id="1"):
    fixture_dir = os.environ.get("MOCK_FIXTURE_DIR")
    if fixture_dir:
        repo_root = os.getcwd()
        sub = slugify(query)
        candidates = [
            os.path.join(repo_root, "src", "tests", "fixtures", "api", fixture_dir, sub, f"page-{page}.json"),
            os.path.join(repo_root, "src", "tests", "fixtures", "api", fixture_dir, f"page-{page}.json"),
            os.path.join(repo_root, "src", "tests", "fixtures", "api", sub, f"page-{page}.json")
        ]
        
        for p in candidates:
            if os.path.exists(p):
                with open(p, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    result_list = (data.get("responseData", {}).get("elasticProductDetails") or
                                   data.get("response", {}).get("resultList") or
                                   [])
                    return result_list
        if page > 1:
            return []
        raise FileNotFoundError(f"Mock file not found for query={query}, page={page} in candidates: {candidates}")

    url = "https://nal.tmmumbai.in/SearchService/getSearchResult"
    params = {
        "searchString": query,
        "warehouseId": warehouse_id,
        "isMultiSearch": "true",
        "platform": "web",
        "page": str(page)
    }
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Origin": "https://www.truemeds.in",
        "Referer": "https://www.truemeds.in/"
    }
    
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    
    query_string = urllib.parse.urlencode(params)
    full_url = f"{url}?{query_string}"
    req = urllib.request.Request(full_url, headers=headers)
    
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=10) as response:
            if response.getcode() == 200:
                body = response.read().decode('utf-8')
                data = json.loads(body)
                return data.get("responseData", {}).get("elasticProductDetails", [])
    except Exception as e:
        # Ignore silent probe failures or logging noise
        pass
    return []

def parse_medicine_info(prod_dict):
    if not prod_dict:
        return None
    try:
        pack_size = float(prod_dict.get("packSize", 1))
        if pack_size <= 0:
            pack_size = 1.0
    except ValueError:
        pack_size = 1.0
        
    selling_price = float(prod_dict.get("sellingPrice", 0))
    mrp = float(prod_dict.get("mrp", 0))
    
    # Parse saltComposition
    salts = {}
    salt_list = prod_dict.get("saltComposition")
    if isinstance(salt_list, list):
        for salt in salt_list:
            if isinstance(salt, dict):
                name = salt.get("saltName")
                qty = salt.get("quantity")
                if name and qty:
                    salts[name.strip()] = qty.strip()
    elif isinstance(salt_list, dict):
        for k, v in salt_list.items():
            salts[k.strip()] = str(v).strip()
    elif isinstance(salt_list, str) and salt_list:
        parts = re.split(r'[+,]', salt_list)
        for part in parts:
            match = re.search(r'([a-zA-Z0-9\s\.\-\&]+)\s*\(([^)]+)\)', part)
            if match:
                salts[match.group(1).strip()] = match.group(2).strip()
            elif part.strip():
                salts[part.strip()] = ""
            
    # Fallback to parsing composition string if salts is empty or has empty values
    if not salts or any(not q for q in salts.values()):
        comp_str = prod_dict.get("composition")
        if comp_str:
            salts = {}
            parts = comp_str.split("+")
            for part in parts:
                # Matches: Name (Strength)
                match = re.search(r'([a-zA-Z0-9\s\.\-\&]+)\s*\(([^)]+)\)', part)
                if match:
                    salts[match.group(1).strip()] = match.group(2).strip()
                else:
                    # If no parentheses, treat whole part as salt name with empty strength
                    salts[part.strip()] = ""
                
    name_val = prod_dict.get("skuName") or prod_dict.get("brandName")
    code_val = prod_dict.get("productCode")
    is_available = prod_dict.get("available", False) and bool(name_val) and code_val != "unknown"

    return {
        "code": code_val,
        "name": name_val,
        "mrp": mrp,
        "selling_price": selling_price,
        "pack_size": pack_size,
        "unit": prod_dict.get("unit", "Units"),
        "pack_form": prod_dict.get("packForm"),
        "price_per_unit": selling_price / pack_size,
        "mrp_per_unit": mrp / pack_size,
        "manufacturer": prod_dict.get("manufacturerName"),
        "composition": prod_dict.get("composition"),
        "salts": salts,
        "product_url": prod_dict.get("productUrlSuffix"),
        "available": is_available,
        "customerAlsoBoughtMsg": prod_dict.get("customerAlsoBoughtMsg")
    }

def normalize_salt_name(name):
    return name.lower().strip()

def normalize_strength(strength):
    s = strength.lower().strip()
    s = s.replace(" ", "")
    match = re.match(r'(\d+(?:\.\d+)?)([a-z]+)', s)
    if match:
        return f"{match.group(1)} {match.group(2)}"
    return s

def compare_compositions(ref_salts, cand_salts):
    ref_norm = {normalize_salt_name(k): (k, normalize_strength(v)) for k, v in ref_salts.items()}
    cand_norm = {normalize_salt_name(k): (k, normalize_strength(v)) for k, v in cand_salts.items()}
    
    ref_keys = set(ref_norm.keys())
    cand_keys = set(cand_norm.keys())
    
    if ref_keys == cand_keys:
        # Check if strengths match
        strength_mismatch = []
        for k in ref_keys:
            ref_orig_name, ref_val = ref_norm[k]
            cand_orig_name, cand_val = cand_norm[k]
            if ref_val != cand_val:
                strength_mismatch.append(f"{ref_orig_name}: {cand_val} vs {ref_val}")
        if strength_mismatch:
            return "Different Strength", strength_mismatch
        else:
            return "Exact Match", None
            
    # Check if candidate has extra components
    if ref_keys.issubset(cand_keys):
        extra = cand_keys - ref_keys
        extra_details = []
        for k in sorted(extra):
            orig_name, val = cand_norm[k]
            extra_details.append(f"{orig_name} ({val})")
        return "Extra Ingredients", extra_details
        
    # Check for missing components
    missing = ref_keys - cand_keys
    missing_details = []
    for k in sorted(missing):
        orig_name, val = ref_norm[k]
        missing_details.append(f"{orig_name} ({val})")
    return "Missing Ingredients", missing_details

def find_substitutes(medicine_query, warehouse_id="1"):
    print(f"Searching for reference medicine: '{medicine_query}'...")
    results = fetch_search_results(medicine_query, 1, warehouse_id)
    if not results:
        print(f"No results found for '{medicine_query}'.")
        return
    
    ref_item = None
    # 1. Try exact match
    for item in results:
        for key in ["suggestion", "product"]:
            med = item.get(key)
            if med:
                name = med.get("skuName") or med.get("brandName") or ""
                if name.strip().lower() == medicine_query.strip().lower():
                    ref_item = item
                    break
        if ref_item:
            break

    # 2. Try substring match
    if not ref_item:
        q_clean = medicine_query.strip().lower()
        for item in results:
            for key in ["suggestion", "product"]:
                med = item.get(key)
                if med:
                    name = med.get("skuName") or med.get("brandName") or ""
                    n_clean = name.strip().lower()
                    if q_clean in n_clean or n_clean in q_clean:
                        ref_item = item
                        break
            if ref_item:
                break

    # 3. Fallback
    if not ref_item:
        ref_item = results[0]

    ref_prod = ref_item.get("suggestion") or ref_item.get("product")
    if not ref_prod:
        print("Invalid response format.")
        return
        
    ref_info = parse_medicine_info(ref_prod)
    if (not ref_info.get("salts") or len(ref_info["salts"]) == 0) and ref_item.get("product"):
        parent_info = parse_medicine_info(ref_item["product"])
        ref_info["salts"] = parent_info["salts"]
        ref_info["composition"] = parent_info["composition"]
        
    ref_salts = ref_info["salts"]
    
    print("\n" + "="*60)
    print(f"REFERENCE MEDICINE DETAILS:")
    print(f"Brand Name: {ref_info['name']}")
    print(f"Manufacturer: {ref_info['manufacturer']}")
    print(f"Pack Size: {ref_info['pack_form']}")
    print(f"MRP: Rs. {ref_info['mrp']:.2f}")
    print(f"Selling Price: Rs. {ref_info['selling_price']:.2f} (Rs. {ref_info['price_per_unit']:.2f} per unit)")
    print("Composition Salts:")
    for salt, qty in ref_salts.items():
        print(f" - {salt}: {qty}")
    print("="*60 + "\n")
    
    if not ref_salts:
        print("No active ingredients/salts found. Cannot search for alternatives.")
        return
        
    candidates = {}
    
    # Search by each ingredient/salt
    for salt_name in ref_salts.keys():
        print(f"Searching for ingredient: '{salt_name}'...")
        page = 1
        salt_results = []
        while True:
            page_results = fetch_search_results(salt_name, page, warehouse_id)
            if not page_results:
                break
            salt_results.extend(page_results)
            if len(page_results) < 40:
                break
            page += 1
            if page > 5: # Guard limit to prevent excessive calls
                break
                
        print(f"  Fetched {len(salt_results)} items for '{salt_name}' across {page} page(s).")
        
        for item in salt_results:
            prod = item.get("product")
            sugg = item.get("suggestion")
            
            # If suggestion is available, parse suggestion details (Popup substitute)
            if sugg:
                s_info = parse_medicine_info(sugg)
                if prod:
                    # Suggestions in response don't have saltComposition populated,
                    # so we copy it from the parent product.
                    parent_info = parse_medicine_info(prod)
                    s_info["salts"] = parent_info["salts"]
                    s_info["composition"] = parent_info["composition"]
                    s_info["parent_name"] = parent_info["name"]
                    s_info["parent_url"] = parent_info["product_url"]
                    s_info["is_suggestion"] = True
                else:
                    s_info["is_suggestion"] = False
                if s_info["available"]:
                    key = f"{s_info['code']}-{s_info['name'].lower().strip()}"
                    existing = candidates.get(key)
                    if not existing or s_info["price_per_unit"] < existing["price_per_unit"]:
                        candidates[key] = s_info
            
            # Also capture parent product details if available
            if prod:
                p_info = parse_medicine_info(prod)
                p_info["is_suggestion"] = False
                if p_info["available"]:
                    key = f"{p_info['code']}-{p_info['name'].lower().strip()}"
                    existing = candidates.get(key)
                    if not existing or p_info["price_per_unit"] < existing["price_per_unit"]:
                        candidates[key] = p_info

    # Perform comparison analysis and filter candidates into distinct groups
    exact_matches = []
    diff_strength = []
    extra_ingredients = []
    missing_ingredients = []
    
    for cand in candidates.values():
        status, details = compare_compositions(ref_salts, cand["salts"])
        cand["match_status"] = status
        cand["match_details"] = details
        
        # Don't duplicate the queried brand into alternatives lists if found
        if cand["code"] == ref_info["code"]:
            continue
            
        if status == "Exact Match":
            exact_matches.append(cand)
        elif status == "Different Strength":
            diff_strength.append(cand)
        elif status == "Extra Ingredients":
            extra_ingredients.append(cand)
        elif status == "Missing Ingredients":
            missing_ingredients.append(cand)
            
    # Sort each group by price per unit in ascending order
    exact_matches.sort(key=lambda x: x["price_per_unit"])
    diff_strength.sort(key=lambda x: x["price_per_unit"])
    extra_ingredients.sort(key=lambda x: (len(x.get("match_details") or []), x["price_per_unit"]))
    missing_ingredients.sort(key=lambda x: (len(x.get("match_details") or []), x["price_per_unit"]))
    
    # Prepend the queried brand itself at the very top of exact match alternatives
    ref_cand_item = ref_info.copy()
    ref_cand_item["match_status"] = "Queried Brand"
    ref_cand_item["match_details"] = None
    ref_cand_item["is_suggestion"] = False
    
    # If the queried brand itself has a cheaper swap price, use the swap details for the queried brand row
    ref_key = f"{ref_info['code']}-{ref_info['name'].lower().strip()}"
    ref_cand = candidates.get(ref_key)
    if ref_cand and ref_cand.get("is_suggestion") and ref_cand["selling_price"] < ref_info["selling_price"]:
        ref_cand_item = ref_cand.copy()
        ref_cand_item["match_status"] = "Queried Brand (via Swap)"
        ref_cand_item["match_details"] = None
        
    exact_matches.insert(0, ref_cand_item)
    
    # Generate Markdown Table Report
    markdown_lines = [
        f"# Medicine Alternatives Report",
        f"\n**Queried Reference Medicine**: {ref_info['name']} (Pack Price: Rs. {ref_info['selling_price']:.2f} for {ref_info['pack_size']} units - Rs. {ref_info['price_per_unit']:.2f}/unit)",
        f"\n**Composition Ingredients**: {', '.join(f'{k} ({v})' for k, v in ref_salts.items())}\n",
    ]
    
    # Calculate MRP per unit of reference medicine as the baseline for all savings
    ref_mrp_per_unit = ref_info["mrp"] / ref_info["pack_size"]
    
    # 2. Recommendations Summary Section (Table Form)
    summary_table = [
        "## Summary Recommendations",
        "\n| Category | Recommendation Brand | Pack MRP | Pack Price | Price / Unit | Saving % (vs Ref MRP) | Instructions to buy at this price |",
        "|:---|:---|---:|---:|---:|---:|:---|",
    ]
    
    # Queried Brand Standalone
    click_id = f"sc_{uuid.uuid4()}"
    session_id = f"ss_{uuid.uuid4()}"
    prod_link = f"https://www.truemeds.in/{ref_info['product_url']}?search_click_id={click_id}&search_session_id={session_id}&suggestion_rank=0&suggestion_source_type=manual_enter"
    saving_pct = 0.0
    if ref_mrp_per_unit > 0:
        saving_pct = ((ref_mrp_per_unit - ref_info["price_per_unit"]) / ref_mrp_per_unit) * 100
    summary_table.append(
        f"| Queried Brand (Standalone) | **{ref_info['name']}** | Rs. {ref_info['mrp']:.2f} | Rs. {ref_info['selling_price']:.2f} | Rs. {ref_info['price_per_unit']:.2f} | {saving_pct:.2f}% | [Buy Standalone]({prod_link}) |"
    )
    
    # Cheapest way to buy Queried Brand via swap
    if ref_cand and ref_cand.get("is_suggestion") and ref_cand["selling_price"] < ref_info["selling_price"]:
        click_id = f"sc_{uuid.uuid4()}"
        session_id = f"ss_{uuid.uuid4()}"
        parent_link = f"https://www.truemeds.in/{ref_cand['parent_url']}?search_click_id={click_id}&search_session_id={session_id}&suggestion_rank=0&suggestion_source_type=manual_enter"
        saving_pct = ((ref_mrp_per_unit - ref_cand["price_per_unit"]) / ref_mrp_per_unit) * 100
        summary_table.append(
            f"| Queried Brand (Cheapest Swap) | **{ref_info['name']}** | Rs. {ref_cand['mrp']:.2f} | Rs. {ref_cand['selling_price']:.2f} | Rs. {ref_cand['price_per_unit']:.2f} | {saving_pct:.2f}% | Buy parent [**{ref_cand['parent_name']}**]({parent_link}) & swap for **{ref_info['name']}** in cart |"
        )
        
    # Cheapest Exact Match Alternative (excluding index 0 which is the queried brand itself)
    exact_alts_only = exact_matches[1:]
    if exact_alts_only:
        cheapest_exact = exact_alts_only[0]
        click_id = f"sc_{uuid.uuid4()}"
        session_id = f"ss_{uuid.uuid4()}"
        saving_pct = ((ref_mrp_per_unit - cheapest_exact["price_per_unit"]) / ref_mrp_per_unit) * 100
        if cheapest_exact.get("is_suggestion") and cheapest_exact.get("parent_name") and cheapest_exact.get("parent_url"):
            parent_link = f"https://www.truemeds.in/{cheapest_exact['parent_url']}?search_click_id={click_id}&search_session_id={session_id}&suggestion_rank=0&suggestion_source_type=manual_enter"
            instruction = f"Buy parent [**{cheapest_exact['parent_name']}**]({parent_link}) & swap for **{cheapest_exact['name']}** in cart"
        else:
            prod_link = f"https://www.truemeds.in/{cheapest_exact['product_url']}?search_click_id={click_id}&search_session_id={session_id}&suggestion_rank=0&suggestion_source_type=manual_enter"
            instruction = f"[Buy Standalone]({prod_link})"
        summary_table.append(
            f"| Cheapest Exact Match Alternative | **{cheapest_exact['name']}** | Rs. {cheapest_exact['mrp']:.2f} | Rs. {cheapest_exact['selling_price']:.2f} | Rs. {cheapest_exact['price_per_unit']:.2f} | {saving_pct:.2f}% | {instruction} |"
        )
        
    # Cheapest Different Strength Match
    if diff_strength:
        cheapest_diff = diff_strength[0]
        click_id = f"sc_{uuid.uuid4()}"
        session_id = f"ss_{uuid.uuid4()}"
        saving_pct = ((ref_mrp_per_unit - cheapest_diff["price_per_unit"]) / ref_mrp_per_unit) * 100
        diff_desc = f" ({', '.join(cheapest_diff['match_details'])})"
        if cheapest_diff.get("is_suggestion") and cheapest_diff.get("parent_name") and cheapest_diff.get("parent_url"):
            parent_link = f"https://www.truemeds.in/{cheapest_diff['parent_url']}?search_click_id={click_id}&search_session_id={session_id}&suggestion_rank=0&suggestion_source_type=manual_enter"
            instruction = f"Buy parent [**{cheapest_diff['parent_name']}**]({parent_link}) & swap for **{cheapest_diff['name']}** in cart"
        else:
            prod_link = f"https://www.truemeds.in/{cheapest_diff['product_url']}?search_click_id={click_id}&search_session_id={session_id}&suggestion_rank=0&suggestion_source_type=manual_enter"
            instruction = f"[Buy Standalone]({prod_link})"
        summary_table.append(
            f"| Different Strength Match | **{cheapest_diff['name']}**{diff_desc} | Rs. {cheapest_diff['mrp']:.2f} | Rs. {cheapest_diff['selling_price']:.2f} | Rs. {cheapest_diff['price_per_unit']:.2f} | {saving_pct:.2f}% | {instruction} |"
        )
        
    # Cheapest Extra Component Match
    if extra_ingredients:
        cheapest_extra = extra_ingredients[0]
        click_id = f"sc_{uuid.uuid4()}"
        session_id = f"ss_{uuid.uuid4()}"
        saving_pct = ((ref_mrp_per_unit - cheapest_extra["price_per_unit"]) / ref_mrp_per_unit) * 100
        extra_desc = f" (Contains extra: {', '.join(cheapest_extra['match_details'])})"
        if cheapest_extra.get("is_suggestion") and cheapest_extra.get("parent_name") and cheapest_extra.get("parent_url"):
            parent_link = f"https://www.truemeds.in/{cheapest_extra['parent_url']}?search_click_id={click_id}&search_session_id={session_id}&suggestion_rank=0&suggestion_source_type=manual_enter"
            instruction = f"Buy parent [**{cheapest_extra['parent_name']}**]({parent_link}) & swap for **{cheapest_extra['name']}** in cart"
        else:
            prod_link = f"https://www.truemeds.in/{cheapest_extra['product_url']}?search_click_id={click_id}&search_session_id={session_id}&suggestion_rank=0&suggestion_source_type=manual_enter"
            instruction = f"[Buy Standalone]({prod_link})"
        summary_table.append(
            f"| Extra Component Match | **{cheapest_extra['name']}**{extra_desc} | Rs. {cheapest_extra['mrp']:.2f} | Rs. {cheapest_extra['selling_price']:.2f} | Rs. {cheapest_extra['price_per_unit']:.2f} | {saving_pct:.2f}% | {instruction} |"
        )
        
    # Cheapest Partial Match (Missing Ingredients)
    if missing_ingredients:
        # Filter for candidate with at least 50% ingredient match if reference has > 2 ingredients
        best_missing_cand = None
        if len(ref_salts) > 2:
            valid_cands = []
            for cand in missing_ingredients:
                missing_count = len(cand["match_details"])
                total_count = len(ref_salts)
                matched_ratio = (total_count - missing_count) / total_count
                if matched_ratio >= 0.5 and cand["price_per_unit"] < ref_mrp_per_unit:
                    valid_cands.append((matched_ratio, cand))
            
            if valid_cands:
                # Sort by matched_ratio descending, then by price_per_unit ascending
                valid_cands.sort(key=lambda x: (-x[0], x[1]["price_per_unit"]))
                best_missing_cand = valid_cands[0][1]
        
        # Fallback to absolute cheapest if no candidate passes threshold or ref_salts has <= 2 ingredients
        if not best_missing_cand:
            best_missing_cand = missing_ingredients[0]
            
        cheapest_missing = best_missing_cand
        click_id = f"sc_{uuid.uuid4()}"
        session_id = f"ss_{uuid.uuid4()}"
        saving_pct = ((ref_mrp_per_unit - cheapest_missing["price_per_unit"]) / ref_mrp_per_unit) * 100
        missing_desc = f" (Missing: {', '.join(cheapest_missing['match_details'])})"
        if cheapest_missing.get("is_suggestion") and cheapest_missing.get("parent_name") and cheapest_missing.get("parent_url"):
            parent_link = f"https://www.truemeds.in/{cheapest_missing['parent_url']}?search_click_id={click_id}&search_session_id={session_id}&suggestion_rank=0&suggestion_source_type=manual_enter"
            instruction = f"Buy parent [**{cheapest_missing['parent_name']}**]({parent_link}) & swap for **{cheapest_missing['name']}** in cart"
        else:
            prod_link = f"https://www.truemeds.in/{cheapest_missing['product_url']}?search_click_id={click_id}&search_session_id={session_id}&suggestion_rank=0&suggestion_source_type=manual_enter"
            instruction = f"[Buy Standalone]({prod_link})"
        summary_table.append(
            f"| Partial Match (Missing Ingredients) | **{cheapest_missing['name']}**{missing_desc} | Rs. {cheapest_missing['mrp']:.2f} | Rs. {cheapest_missing['selling_price']:.2f} | Rs. {cheapest_missing['price_per_unit']:.2f} | {saving_pct:.2f}% | {instruction} |"
        )
        
    summary_table.append("\n")
    markdown_lines.extend(summary_table)
    
    markdown_lines.append(
        "> [!NOTE]\n"
        "> **Pack Price** vs **Price / Unit**: The prices displayed on the Truemeds website are for the full pack (e.g. strip of 10 or 15 tablets). This report lists both the **Pack Price** and the calculated **Price / Unit** (Price per tablet/vial) to allow fair price comparison across different pack sizes.\n"
    )
    
    def generate_table_section(title, description, items, is_exact=False):
        section_lines = [
            f"## {title}",
            f"\n{description}\n",
            f"| No. | {'[x]' if is_exact else '[ ]'} Status | Brand Name | Manufacturer | Pack Form | Pack MRP | Pack Selling Price | Price / Unit | Saving % (vs Ref MRP) | Instructions to buy at this price |",
            f"|---:|:---|:---|:---|:---|---:|---:|---:|---:|:---|",
        ]
        if not items:
            section_lines.append("| | *No matches found under this category* | | | | | | | | |")
            return section_lines
            
        for i, cand in enumerate(items, 1):
            saving_pct = 0.0
            if ref_mrp_per_unit > 0:
                saving_pct = ((ref_mrp_per_unit - cand["price_per_unit"]) / ref_mrp_per_unit) * 100
            saving_str = f"{saving_pct:.2f}%" if saving_pct > 0 else "0.00%"
            
            # Format match status cell
            if cand["match_status"].startswith("Queried Brand"):
                status_cell = f"**{cand['match_status']}**"
            elif cand["match_status"] == "Exact Match":
                status_cell = "Exact Match"
            elif cand["match_status"] == "Different Strength":
                status_cell = f"Diff Strength ({', '.join(cand['match_details'])})"
            elif cand["match_status"] == "Extra Ingredients":
                status_cell = f"Extra Component ({', '.join(cand['match_details'])})"
            elif cand["match_status"] == "Missing Ingredients":
                status_cell = f"Missing: {', '.join(cand['match_details'])}"
            else:
                status_cell = cand["match_status"]
                
            click_id = f"sc_{uuid.uuid4()}"
            session_id = f"ss_{uuid.uuid4()}"
            
            if cand.get("is_suggestion") and cand.get("parent_name") and cand.get("parent_url"):
                parent_link = f"https://www.truemeds.in/{cand['parent_url']}?search_click_id={click_id}&search_session_id={session_id}&suggestion_rank=0&suggestion_source_type=manual_enter"
                instruction = f"Buy [**{cand['parent_name']}**]({parent_link}) & swap for **{cand['name']}** in cart"
            else:
                prod_link = f"https://www.truemeds.in/{cand['product_url']}?search_click_id={click_id}&search_session_id={session_id}&suggestion_rank=0&suggestion_source_type=manual_enter"
                instruction = f"[Buy Standalone]({prod_link})"
            
            section_lines.append(
                f"| {i} | {'[x] **' if is_exact else '[ ] *'}{status_cell}{'**' if is_exact else '*'} | **{cand['name']}** | {cand['manufacturer']} | {cand['pack_form']} | Rs. {cand['mrp']:.2f} | Rs. {cand['selling_price']:.2f} | Rs. {cand['price_per_unit']:.2f} | {saving_str} | {instruction} |"
            )
        return section_lines

    # Section 1: Exact Match Alternatives
    markdown_lines.extend(generate_table_section(
        "Exact Match Alternatives",
        "These alternative brands contain the exact same composition salts in the exact same strengths as your queried reference medicine.",
        exact_matches,
        is_exact=True
    ))
    
    # Section 2: Different Strength Matches
    markdown_lines.extend(generate_table_section(
        "Different Strength Matches",
        "These brands contain the same active ingredients but in different strengths/ratios.",
        diff_strength,
        is_exact=False
    ))
    
    # Section 3: Extra Component Matches
    markdown_lines.extend(generate_table_section(
        "Extra Component Matches (Combination Brands)",
        "These brands contain all the ingredients of your reference medicine, plus additional active components.",
        extra_ingredients,
        is_exact=False
    ))
    
    # Section 4: Missing Component Matches (Partial Matches)
    markdown_lines.extend(generate_table_section(
        "Missing Component Matches (Partial Alternatives)",
        "These brands contain only a subset of the ingredients in your reference medicine. You may use these if you want to purchase ingredients separately.",
        missing_ingredients,
        is_exact=False
    ))

    slug = re.sub(r'[^a-z0-9]+', '_', ref_info['name'].lower()).strip('_')
    script_dir = os.path.dirname(os.path.abspath(__file__))
    reports_dir = os.path.join(script_dir, "reports")
    os.makedirs(reports_dir, exist_ok=True)
    report_file = os.path.join(reports_dir, f"{slug}_substitutes.md")
    try:
        with open(report_file, "w", encoding="utf-8") as rf:
            rf.write("\n".join(markdown_lines))
        print(f"\nDeduplicated and found {len(exact_matches) + len(diff_strength) + len(extra_ingredients) + len(missing_ingredients)} total alternatives.")
        print(f"Successfully wrote partitioned report to: {report_file}")
    except Exception as e:
        print(f"Error saving report: {e}", file=sys.stderr)

if __name__ == "__main__":
    query = "Pan 40"
    if len(sys.argv) > 1:
        query = " ".join(sys.argv[1:])
    find_substitutes(query)
