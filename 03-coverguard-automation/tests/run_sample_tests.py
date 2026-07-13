"""
CoverGuard AI -- Full Validation Test Suite
============================================
Tests all 8 sample images against known ground truth.
Outputs confusion matrix, per-image results, and JSON report.

Usage:
    python tests/run_sample_tests.py

Requirements:
    - All 8 sample images in ./img/ directory
    - Core modules installed (see requirements.txt)
"""
import sys
import os
import json
import time
from datetime import datetime
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))
os.environ['ENVIRONMENT'] = 'demo'

from main import run_full_pipeline

# ── Ground Truth ───────────────────────────────────────────────────────────
# Each entry maps to a sample image with known correct classification.
# These are the 8 images provided by BookLeaf Publishing for the assignment.
GROUND_TRUTH = [
    {
        "file": "img/image (28) (2).png",
        "isbn": "9789373147499",
        "name": "Shabd BAD",
        "book_title": "Shabd",
        "expected": "REVIEW NEEDED",
        "reason": "Author name 'Parisha Shodhan' in gold calligraphy overlaps badge text area",
    },
    {
        "file": "img/image (29) (2).png",
        "isbn": "9789898652616",
        "name": "Shabd GOOD",
        "book_title": "Shabd",
        "expected": "PASS",
        "reason": "Author name properly positioned with horizontal separator above badge",
    },
    {
        "file": "img/image (31) (2).png",
        "isbn": "9789351234567",
        "name": "Offline GOOD",
        "book_title": "Offline",
        "expected": "PASS",
        "reason": "Clean layout with sufficient clearance from badge zone",
    },
    {
        "file": "img/image (32) (2).png",
        "isbn": "9789373147994",
        "name": "Echoes BAD",
        "book_title": "Echoes of Memory, Meaning and Mercy",
        "expected": "REVIEW NEEDED",
        "reason": "Subtitle text near badge zone boundary",
    },
    {
        "file": "img/image (33) (2).png",
        "isbn": "9789373148000",
        "name": "Echoes GOOD",
        "book_title": "Echoes of Memory, Meaning and Mercy",
        "expected": "PASS",
        "reason": "Subtitle moved up, clear badge zone",
    },
    {
        "file": "img/image (34) (2).png",
        "isbn": "9789373148017",
        "name": "Mirror BAD",
        "book_title": "Inner Mirror",
        "expected": "REVIEW NEEDED",
        "reason": "Author 'PRATIK KOLEKAR' too close to badge text (5.4mm gap)",
    },
    {
        "file": "img/image (35) (2).png",
        "isbn": "9789373148024",
        "name": "Mirror GOOD",
        "book_title": "Inner Mirror",
        "expected": "PASS",
        "reason": "Author positioned with 11.5mm clearance from badge text",
    },
    {
        "file": "img/image (36) (2).png",
        "isbn": "9789373148031",
        "name": "Tainted BAD",
        "book_title": "Tainted Verses",
        "expected": "REVIEW NEEDED",
        "reason": "Tagline 'For those who feel more than they can express' overlaps badge",
    },
]


def run_tests():
    """Run the full test suite and return results."""
    print("=" * 80)
    print("  COVERGUARD AI -- FULL VALIDATION TEST SUITE")
    print(f"  Timestamp: {datetime.now().isoformat()}")
    print("=" * 80)

    results = []
    correct = 0
    total = len(GROUND_TRUTH)
    total_time = 0

    for i, gt in enumerate(GROUND_TRUTH):
        print(f"\n{'-' * 60}")
        print(f"  [{i+1}/{total}] {gt['name']} - {gt['book_title']}")
        print(f"  Expected: {gt['expected']}")
        print(f"  Reason: {gt['reason']}")
        print(f"{'-' * 60}")

        with open(gt['file'], 'rb') as f:
            file_bytes = f.read()

        fname = f"{gt['isbn']}_{gt['book_title'].replace(' ', '_')}.png"
        t0 = time.time()
        r = run_full_pipeline(file_bytes, fname, gt['isbn'])
        elapsed = time.time() - t0
        total_time += elapsed

        actual = r['status']
        expected = gt['expected']
        match = actual == expected
        if match:
            correct += 1

        symbol = "[OK] CORRECT" if match else "[X] WRONG"

        result_entry = {
            "name": gt['name'],
            "book_title": gt['book_title'],
            "isbn": gt['isbn'],
            "expected": expected,
            "actual": actual,
            "match": match,
            "confidence": r['confidence'],
            "violations": len(r['violations']),
            "violation_details": [
                {
                    "type": v['type'],
                    "severity": v['severity'],
                    "text": v['text'][:80],
                }
                for v in r['violations']
            ],
            "time_ms": int(elapsed * 1000),
            "primary_issue": r.get('primary_issue'),
            "ocr_engine": r.get('ocr_engine'),
        }
        results.append(result_entry)

        print(f"  Result:     {symbol}")
        print(f"  Actual:     {actual}")
        print(f"  Confidence: {r['confidence']}%")
        print(f"  Violations: {len(r['violations'])}")
        print(f"  Time:       {int(elapsed*1000)}ms")
        if r['violations']:
            for v in r['violations']:
                print(f"    [{v['severity']}] {v['type']}: {v['text'][:60]}")

    # ── Confusion Matrix ──────────────────────────────────────────────────
    print("\n" + "=" * 80)
    print("  CONFUSION MATRIX")
    print("=" * 80)

    tp = sum(1 for r in results if r['expected'] == 'REVIEW NEEDED' and r['actual'] == 'REVIEW NEEDED')
    tn = sum(1 for r in results if r['expected'] == 'PASS' and r['actual'] == 'PASS')
    fp = sum(1 for r in results if r['expected'] == 'PASS' and r['actual'] == 'REVIEW NEEDED')
    fn = sum(1 for r in results if r['expected'] == 'REVIEW NEEDED' and r['actual'] == 'PASS')

    accuracy = correct / total * 100 if total > 0 else 0
    precision = tp / (tp + fp) * 100 if tp + fp > 0 else 0
    recall = tp / (tp + fn) * 100 if tp + fn > 0 else 0
    f1 = 2 * tp / (2 * tp + fp + fn) * 100 if 2 * tp + fp + fn > 0 else 0

    print(f"\n                       Predicted REVIEW  Predicted PASS")
    print(f"  Actual REVIEW            {tp} (TP)           {fn} (FN)")
    print(f"  Actual PASS              {fp} (FP)           {tn} (TN)")
    print(f"\n  Accuracy:    {correct}/{total} = {accuracy:.1f}%")
    print(f"  Precision:   {tp}/{tp+fp} = {precision:.1f}%")
    print(f"  Recall:      {tp}/{tp+fn} = {recall:.1f}%")
    print(f"  F1 Score:    {f1:.1f}%")
    print(f"  Avg Time:    {total_time/total*1000:.0f}ms per image")
    print(f"  Total Time:  {total_time:.1f}s")

    print(f"\n  Per-Image Results:")
    for r in results:
        mark = "  OK " if r['match'] else "  X  "
        print(f"  {mark} {r['name']:20s} expected={r['expected']:15s} "
              f"actual={r['actual']:15s} conf={r['confidence']:3d}% v={r['violations']}")

    wrong = [r for r in results if not r['match']]
    if wrong:
        print(f"\n  FAILED PREDICTIONS ({len(wrong)}):")
        for r in wrong:
            print(f"    {r['name']}: expected {r['expected']}, got {r['actual']} (conf={r['confidence']}%)")
    else:
        print("\n  [OK] ALL PREDICTIONS CORRECT!")

    # ── Save JSON report ──────────────────────────────────────────────────
    report = {
        "timestamp": datetime.now().isoformat(),
        "total_images": total,
        "correct": correct,
        "accuracy": accuracy,
        "precision": precision,
        "recall": recall,
        "f1_score": f1,
        "confusion_matrix": {"TP": tp, "TN": tn, "FP": fp, "FN": fn},
        "avg_time_ms": int(total_time / total * 1000),
        "results": results,
    }

    report_path = "tests/test_results.json"
    os.makedirs("tests", exist_ok=True)
    with open(report_path, 'w') as f:
        json.dump(report, f, indent=2)
    print(f"\n  Report saved: {report_path}")

    return accuracy


if __name__ == "__main__":
    accuracy = run_tests()
    sys.exit(0 if accuracy >= 96.0 else 1)
