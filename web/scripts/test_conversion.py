import os
import json

def test_json_files():
    data_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
    expected_files = [
        "aptamil_premium_stage_1_from_birth_to_6_month_infant_formula_refill_powder_400gm_substitutes.json",
        "ecoflora_capsule_30_substitutes.json",
        "ecosprin_75_tablet_14_substitutes.json",
        "pan_40_tablet_15_substitutes.json",
        "pantomore_dsr_capsule_10_substitutes.json"
    ]
    
    for filename in expected_files:
        path = os.path.join(data_dir, filename)
        assert os.path.exists(path), f"{filename} does not exist"
        
        print(f"Verifying {filename}...")
        with open(path, 'r', encoding='utf-8') as f:
            try:
                data = json.load(f)
            except Exception as e:
                raise AssertionError(f"{filename} is not valid JSON: {str(e)}")
                
        # Validate queried_medicine structure
        assert "queried_medicine" in data, f"{filename} missing queried_medicine"
        qm = data["queried_medicine"]
        for key in ["name", "price", "mrp", "unit_price", "units", "ingredients"]:
            assert key in qm, f"{filename} queried_medicine missing key: {key}"
        assert isinstance(qm["name"], str) and len(qm["name"]) > 0
        assert isinstance(qm["price"], float)
        assert isinstance(qm["mrp"], float)
        assert isinstance(qm["unit_price"], float)
        assert isinstance(qm["units"], float)
        assert isinstance(qm["ingredients"], list)
        
        # Validate recommendations structure
        assert "recommendations" in data, f"{filename} missing recommendations"
        recs = data["recommendations"]
        assert isinstance(recs, list)
        for r in recs:
            for key in ["category", "brand", "mrp", "price", "unit_price", "savings_percent", "link", "details"]:
                assert key in r, f"{filename} recommendation missing key: {key}"
            assert isinstance(r["category"], str)
            assert isinstance(r["brand"], str)
            assert isinstance(r["mrp"], float)
            assert isinstance(r["price"], float)
            assert isinstance(r["unit_price"], float)
            assert isinstance(r["savings_percent"], float)
            assert isinstance(r["link"], str)
            assert isinstance(r["details"], str)
            
        # Validate alternatives structure
        assert "alternatives" in data, f"{filename} missing alternatives"
        alts = data["alternatives"]
        for category in ["exact", "different_strength", "partial"]:
            assert category in alts, f"{filename} alternatives missing category: {category}"
            alt_list = alts[category]
            assert isinstance(alt_list, list)
            for item in alt_list:
                for key in ["brand", "manufacturer", "pack_form", "mrp", "price", "unit_price", "savings_percent", "link", "status", "details"]:
                    assert key in item, f"{filename} alternative item in {category} missing key: {key}"
                assert isinstance(item["brand"], str)
                assert isinstance(item["manufacturer"], str)
                assert isinstance(item["pack_form"], str)
                assert isinstance(item["mrp"], float)
                assert isinstance(item["price"], float)
                assert isinstance(item["unit_price"], float)
                assert isinstance(item["savings_percent"], float)
                assert isinstance(item["link"], str)
                assert isinstance(item["status"], str)
                assert isinstance(item["details"], str)
                
        print(f"-> {filename} is 100% VALID.")

if __name__ == '__main__':
    try:
        test_json_files()
        print("\nAll JSON files verified successfully against schema!")
    except AssertionError as e:
        print(f"\nVerification FAILED: {str(e)}")
        exit(1)
