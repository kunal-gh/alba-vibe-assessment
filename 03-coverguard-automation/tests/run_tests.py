#!/usr/bin/env python3
"""
CoverGuard AI — Comprehensive Test Suite
==========================================
Runs all provided sample images through the full pipeline and generates
a detailed accuracy/performance report.

Usage:
    python tests/run_tests.py

Output:
    tests/test_report.json  — full machine-readable results
    Console output          — human-readable summary table
"""
import sys, os, json, time, datetime
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import shutil, requests

# ── Test Case Definitions ──────────────────────────────────────────────────
# Ground truth based on manual inspection + assignment sample description
TEST_CASES = [
    {
        "file": "img/9789373147499_shabd.png",
        "isbn": "9789373147499",
        "description": "Shabd — 'Parisha Shodhan' overlaps award badge text at bottom",
        "expected_status": "REVIEW NEEDED",
        "expected_violations_min": 1,
        "category": "confirmed_overlap",
        "notes": "Author name 'Parisha Shodhan' is directly over the award badge text area"
    },
    {
        "file": "img/image (28) (2).png",
        "isbn": "9789373147499",
        "description": "Shabd variant 28 — same as above, Parisha Shodhan overlaps badge",
        "expected_status": "REVIEW NEEDED",
        "expected_violations_min": 1,
        "category": "confirmed_overlap",
        "notes": "Same cover with badge overlap confirmed"
    },
    {
        "file": "img/image (29) (2).png",
        "isbn": "9789898652616",
        "description": "Shabd variant 29 — Parisha Shodhan above badge zone (separated by rule line)",
        "expected_status": "PASS",
        "expected_violations": 0,
        "category": "clean_cover",
        "notes": "Author name is 15mm above bottom — clear of badge zone. Horizontal rule separates."
    },
    {
        "file": "img/image (31) (2).png",
        "isbn": "9789898652753",
        "description": "Cover 31 — badge zone clean",
        "expected_status": "PASS",
        "expected_violations": 0,
        "category": "clean_cover",
        "notes": "Badge zone is clean"
    },
    {
        "file": "img/image (32) (2).png",
        "isbn": "9789373147994",
        "description": "Echoes — 'and Mercy' text near badge zone",
        "expected_status": "REVIEW NEEDED",
        "expected_violations_min": 1,
        "category": "confirmed_near_miss",
        "notes": "Subtitle text encroaches badge clearance zone"
    },
    {
        "file": "img/image (33) (2).png",
        "isbn": "9789898652364",
        "description": "Echoes variant 33 — 'Winner of...' badge text cleanly placed, no overlap",
        "expected_status": "PASS",
        "expected_violations": 0,
        "category": "clean_cover",
        "notes": "Front cover is clean — badge zone has winner text only, no user content overlapping"
    },
    {
        "file": "img/image (34) (2).png",
        "isbn": "9789373147765",
        "description": "Inner Mirror candidate — badge zone clean",
        "expected_status": "PASS",
        "expected_violations": 0,
        "category": "clean_cover",
        "notes": "Author name is above the line and clear of badge zone"
    },
    {
        "file": "img/image (35) (2).png",
        "isbn": "9789373145068",
        "description": "Inner Mirror — PRATIK KOLEKAR is 15mm above badge zone (PASS)",
        "expected_status": "PASS",
        "expected_violations": 0,
        "category": "clean_cover",
        "notes": "Author name at y=657 on 780px cover, badge_top=746 — 89px clear = 23mm clearance"
    },
    {
        "file": "img/image (36) (2).png",
        "isbn": "9789373147994",
        "description": "Echoes Along the Way — near-miss confirmed",
        "expected_status": "REVIEW NEEDED",
        "expected_violations_min": 1,
        "category": "confirmed_near_miss",
        "notes": "'andMMercy' text near badge zone boundary"
    },
]

# ── Edge Case Tests ────────────────────────────────────────────────────────
EDGE_CASE_TESTS = [
    {
        "id": "edge_bad_filename",
        "description": "Upload with bad filename (no ISBN prefix)",
        "action": "upload_bad_filename",
        "expected": "API must handle gracefully or auto-format"
    },
    {
        "id": "edge_health_check",
        "description": "Health endpoint returns 200",
        "action": "health_check",
        "expected": "status: healthy"
    },
    {
        "id": "edge_root_endpoint",
        "description": "Root / endpoint returns service info",
        "action": "root_check",
        "expected": "service info JSON"
    },
]

BASE_URL = "http://127.0.0.1:8000"

def run_image_test(tc: dict) -> dict:
    """Run a single image through the API and return result."""
    file_path = tc["file"]
    if not os.path.exists(file_path):
        return {"error": f"File not found: {file_path}", "skipped": True}

    fname = os.path.basename(file_path)
    # Prefix with ISBN if not already
    if not fname.startswith(tc["isbn"]):
        fname = f"{tc['isbn']}_{fname.replace('image ', 'img').replace('(', '').replace(')', '').replace(' ', '_')}"

    start = time.time()
    try:
        with open(file_path, "rb") as fh:
            resp = requests.post(
                f"{BASE_URL}/analyze/upload",
                files={"file": (fname, fh, "image/png")},
                timeout=120
            )
        elapsed_ms = int((time.time() - start) * 1000)

        if resp.status_code != 200:
            return {
                "error": f"HTTP {resp.status_code}: {resp.text[:300]}",
                "elapsed_ms": elapsed_ms,
                "skipped": False
            }

        data = resp.json()
        return {
            "status": data.get("status"),
            "confidence": data.get("confidence"),
            "isbn": data.get("isbn"),
            "violations_count": len(data.get("violations", [])),
            "violations": [{"type": v["type"], "severity": v["severity"], "text": v["text"]} for v in data.get("violations", [])],
            "ocr_engine": data.get("ocr_engine"),
            "dpi": data.get("quality", {}).get("dpi"),
            "is_blurry": data.get("quality", {}).get("is_blurry"),
            "processing_time_ms": data.get("processing_time_ms"),
            "elapsed_ms": elapsed_ms,
            "skipped": False,
            "error": None,
        }
    except requests.exceptions.ConnectionError:
        return {"error": "Cannot connect to API — is the server running?", "skipped": True}
    except Exception as e:
        return {"error": str(e), "skipped": False}

def evaluate_result(tc: dict, result: dict) -> dict:
    """Compare result against expected ground truth."""
    if result.get("skipped"):
        return {"pass": None, "reason": f"SKIPPED: {result.get('error', '')}"}

    if result.get("error"):
        return {"pass": False, "reason": f"API ERROR: {result['error']}"}

    got_status = result.get("status")
    expected_status = tc.get("expected_status")
    expected_min_v = tc.get("expected_violations_min", 0)
    expected_v = tc.get("expected_violations", None)

    reasons = []

    # Status check
    if expected_status is not None:
        if got_status == expected_status:
            reasons.append(f"✓ Status correct ({got_status})")
        else:
            reasons.append(f"✗ Status mismatch: expected {expected_status}, got {got_status}")
            return {"pass": False, "reason": " | ".join(reasons)}
    else:
        reasons.append(f"  Status: {got_status} (no ground truth)")

    # Violations check
    got_v = result.get("violations_count", 0)
    if expected_v is not None:
        if got_v == expected_v:
            reasons.append(f"✓ Violations count exact ({got_v})")
        else:
            reasons.append(f"~ Violations count: expected {expected_v}, got {got_v}")
    elif expected_min_v > 0:
        if got_v >= expected_min_v:
            reasons.append(f"✓ Violations detected ({got_v} >= {expected_min_v} min)")
        else:
            reasons.append(f"✗ Insufficient violations: expected ≥{expected_min_v}, got {got_v}")
            return {"pass": False, "reason": " | ".join(reasons)}

    return {"pass": True, "reason": " | ".join(reasons)}

def run_edge_cases() -> list:
    """Run edge case tests."""
    results = []

    # Health check
    try:
        r = requests.get(f"{BASE_URL}/health", timeout=10)
        results.append({
            "id": "edge_health_check",
            "pass": r.status_code == 200,
            "response": r.json(),
            "note": "Health endpoint"
        })
    except Exception as e:
        results.append({"id": "edge_health_check", "pass": False, "error": str(e)})

    # Root endpoint
    try:
        r = requests.get(f"{BASE_URL}/", timeout=10)
        results.append({
            "id": "edge_root_endpoint",
            "pass": r.status_code == 200 and "service" in r.json(),
            "response": r.json(),
            "note": "Root endpoint"
        })
    except Exception as e:
        results.append({"id": "edge_root_endpoint", "pass": False, "error": str(e)})

    # Bad filename (no underscore)
    img_path = "img/9789373147499_shabd.png"
    if os.path.exists(img_path):
        try:
            with open(img_path, "rb") as fh:
                r = requests.post(
                    f"{BASE_URL}/analyze/upload",
                    files={"file": ("bad_filename.png", fh, "image/png")},
                    timeout=60
                )
            d = r.json()
            # Should error gracefully with a clear message
            results.append({
                "id": "edge_bad_filename",
                "pass": r.status_code in [400, 422] or "error" in str(d).lower() or "invalid" in str(d).lower(),
                "response_code": r.status_code,
                "note": "Should reject or warn about bad filename"
            })
        except Exception as e:
            results.append({"id": "edge_bad_filename", "pass": False, "error": str(e)})

    return results

def main():
    print("\n" + "="*72)
    print("  CoverGuard AI — Comprehensive Test Suite")
    print("  BookLeaf Publishing Automated Book Cover Validation")
    print(f"  Run at: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*72)

    # Check server is up
    try:
        requests.get(f"{BASE_URL}/health", timeout=5)
    except:
        print("\n❌ ERROR: Cannot connect to API server at", BASE_URL)
        print("   Please start: python -m uvicorn main:app --port 8000")
        sys.exit(1)

    all_results = []
    passed = 0
    failed = 0
    skipped = 0
    unknown_gt = 0
    total_time = 0

    print(f"\n{'─'*72}")
    print(f"{'#':<3} {'File':<30} {'Expected':<14} {'Got':<14} {'Conf':<6} {'Viol':<5} {'ms':<7} {'Result'}")
    print(f"{'─'*72}")

    for i, tc in enumerate(TEST_CASES):
        fname = os.path.basename(tc["file"])[:28]
        result = run_image_test(tc)
        eval_r = evaluate_result(tc, result)

        if result.get("skipped"):
            skipped += 1
            status_str = "SKIP"
        elif result.get("error"):
            failed += 1
            status_str = "FAIL"
        elif eval_r["pass"] is True:
            passed += 1
            status_str = "PASS ✓"
        elif eval_r["pass"] is False:
            failed += 1
            status_str = "FAIL ✗"
        else:
            unknown_gt += 1
            status_str = "INFO"

        exp = tc.get("expected_status", "?")
        got = result.get("status", "—")
        conf = result.get("confidence", "—")
        viol = result.get("violations_count", "—")
        ms   = result.get("processing_time_ms", "—")

        print(f"{i+1:<3} {fname:<30} {str(exp):<14} {str(got):<14} {str(conf)+'%':<6} {str(viol):<5} {str(ms):<7} {status_str}")

        total_time += result.get("processing_time_ms", 0) or 0
        all_results.append({
            "test": tc,
            "raw": result,
            "evaluation": eval_r,
        })

    # Edge cases
    print(f"\n{'─'*72}")
    print("Edge Case Tests:")
    edge_results = run_edge_cases()
    edge_pass = 0
    for er in edge_results:
        emoji = "✓" if er.get("pass") else "✗"
        print(f"  {emoji} {er['id']}: {er.get('note', '')} — {'PASS' if er.get('pass') else 'FAIL'}")
        if er.get("pass"): edge_pass += 1

    # ── Summary ──────────────────────────────────────────────────────────
    total_known = passed + failed
    accuracy = (passed / total_known * 100) if total_known > 0 else 0
    avg_time = total_time / len(TEST_CASES) if TEST_CASES else 0

    print(f"\n{'='*72}")
    print("  TEST SUMMARY")
    print(f"{'='*72}")
    print(f"  Total image tests   : {len(TEST_CASES)}")
    print(f"  Passed              : {passed}")
    print(f"  Failed              : {failed}")
    print(f"  Skipped             : {skipped}")
    print(f"  Unknown ground truth: {unknown_gt}")
    print(f"  Edge cases          : {edge_pass}/{len(edge_results)} passed")
    print(f"  Accuracy (known GT) : {accuracy:.1f}%  (target: 95%+)")
    print(f"  Avg processing time : {avg_time:.0f}ms")
    print(f"  Requirement met     : {'✓ YES' if accuracy >= 95 else '✗ NO — below 95%'}")
    print(f"{'='*72}\n")

    # ── Save JSON report ──────────────────────────────────────────────────
    report = {
        "generated_at": datetime.datetime.utcnow().isoformat() + "Z",
        "summary": {
            "total_tests": len(TEST_CASES),
            "passed": passed, "failed": failed,
            "skipped": skipped, "unknown_ground_truth": unknown_gt,
            "accuracy_pct": round(accuracy, 1),
            "avg_processing_ms": round(avg_time, 0),
            "edge_cases_passed": edge_pass,
            "edge_cases_total": len(edge_results),
            "requirement_met": accuracy >= 95
        },
        "image_tests": all_results,
        "edge_case_tests": edge_results,
    }
    out_path = os.path.join(os.path.dirname(__file__), "test_report.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False, default=str)
    print(f"  Full JSON report saved to: {out_path}")
    return accuracy

if __name__ == "__main__":
    main()
