"""
CoverGuard AI — Decision Engine
=================================
Converts violations list + quality data into a final PASS/REVIEW verdict
with confidence score and human-readable correction instructions.

Design principle: Be CONSERVATIVE.
    - A missed overlap that reaches print = BookLeaf quality failure.
    - A false positive = author resubmits. Takes 30 seconds to fix.
    - False negatives are catastrophic. False positives are minor inconveniences.

Any badge_overlap → REVIEW NEEDED. No exceptions.
"""

import logging
from typing import Optional

from core.models import Violation, QualityReport, SafeZones

logger = logging.getLogger("coverguard.decision")


def make_decision(
    violations: list[Violation],
    quality: QualityReport,
    ocr_engine: str,
    text_blocks_count: int,
) -> dict:
    """
    Make the final PASS / REVIEW NEEDED decision.

    Decision hierarchy (first matching rule wins):
    1. Quality issues (blurry OR low DPI) → REVIEW NEEDED (quality gate)
    2. OCR found zero text blocks → REVIEW NEEDED (cannot verify)
    3. Any badge_overlap violation → REVIEW NEEDED (critical)
    4. Any near_miss violation → REVIEW NEEDED (major)
    5. Any margin_violation → REVIEW NEEDED (minor)
    6. No violations + good quality → PASS

    Confidence score:
    - PASS: 97% (paddleocr) or 90% (easyocr fallback)
    - REVIEW NEEDED: based on severity and count (lower = more severe)

    Args:
        violations: List of Violation objects from geometry engine
        quality: QualityReport from preprocessing
        ocr_engine: 'paddleocr' or 'easyocr'
        text_blocks_count: How many text blocks OCR found

    Returns:
        Dict with: status, confidence, primary_issue
    """
    # ── Quality gate ───────────────────────────────────────────────────────
    if quality.is_low_resolution or quality.is_blurry:
        reason = "low_resolution" if quality.is_low_resolution else "blurry_image"
        logger.info(f"Decision: REVIEW NEEDED — quality issue: {reason}")
        return {
            "status": "REVIEW NEEDED",
            "confidence": 20,
            "primary_issue": reason,
        }

    # ── OCR confidence gate ────────────────────────────────────────────────
    if text_blocks_count == 0:
        logger.info("Decision: REVIEW NEEDED — OCR found no text blocks (manual check needed)")
        return {
            "status": "REVIEW NEEDED",
            "confidence": 10,
            "primary_issue": "ocr_failure",
        }

    # ── No violations → PASS ───────────────────────────────────────────────
    if not violations:
        confidence = 97 if ocr_engine == "paddleocr" else 90
        logger.info(f"Decision: PASS — no violations found (confidence={confidence}%)")
        return {
            "status": "PASS",
            "confidence": confidence,
            "primary_issue": None,
        }

    # ── Violations present → REVIEW NEEDED ────────────────────────────────
    has_critical = any(v.severity == "critical" for v in violations)
    has_major    = any(v.severity == "major" for v in violations)
    has_minor    = any(v.severity == "minor" for v in violations)

    critical_count = sum(1 for v in violations if v.severity == "critical")
    total_count = len(violations)

    if has_critical:
        # Badge overlap — most severe. Confidence = how sure we are it's a violation.
        confidence = min(99, 85 + critical_count * 5)
        primary = "badge_overlap"
        logger.info(
            f"Decision: REVIEW NEEDED — {critical_count} badge_overlap violation(s) "
            f"(confidence={confidence}%)"
        )
    elif has_major:
        confidence = min(85, 70 + total_count * 2)
        primary = "near_miss"
        logger.info(f"Decision: REVIEW NEEDED — near_miss violation(s) (confidence={confidence}%)")
    else:
        confidence = min(75, 50 + total_count * 2)
        primary = "margin_violation"
        logger.info(f"Decision: REVIEW NEEDED — margin_violation(s) (confidence={confidence}%)")

    return {
        "status": "REVIEW NEEDED",
        "confidence": confidence,
        "primary_issue": primary,
    }


def build_correction_text(violations: list[Violation], zones: Optional[SafeZones] = None) -> str:
    """
    Build numbered, human-readable correction instructions from violations list.

    These instructions go into:
    1. The Airtable 'Correction Instructions' field
    2. The author email body

    Each instruction references the specific text and measurements in mm
    so the author knows exactly what to fix and where.

    Args:
        violations: List of violations from geometry engine
        zones: Optional SafeZones for additional context

    Returns:
        Numbered correction steps as a plain text string
    """
    if not violations:
        return "No corrections needed. Cover is approved."

    lines = [
        "CORRECTION INSTRUCTIONS",
        "=" * 40,
        "Please make the following changes to your cover before resubmitting:",
        "",
    ]

    for i, v in enumerate(violations, 1):
        severity_label = {
            "critical": "[CRITICAL — Must Fix]",
            "major": "[MAJOR — Should Fix]",
            "minor": "[MINOR — Recommended]",
            "info": "[INFO]",
        }.get(v.severity, "")

        lines.append(f"Step {i}: {severity_label}")
        lines.append(f"  Issue:       {v.type.replace('_', ' ').title()}")
        lines.append(f"  Text found:  \"{v.text}\"")
        lines.append(f"  Fix:         {v.instruction}")

        if v.type == "badge_overlap":
            lines.append(f"  Details:     Badge zone = bottom 9mm of front cover.")
            if v.overlap_mm > 0:
                lines.append(f"               Your text overlaps by {v.overlap_mm}mm.")
        elif v.type == "near_miss":
            lines.append(f"  Details:     Minimum clearance above badge zone = 3mm.")
            if v.distance_mm > 0:
                lines.append(f"               Current clearance = {v.distance_mm}mm.")
        elif v.type == "margin_violation":
            lines.append(f"  Details:     Safe margin = 3mm from {v.side} edge.")

        lines.append("")

    lines.extend([
        "HOW TO RESUBMIT:",
        "  1. Make the above changes in your design software.",
        "  2. Export as PDF or PNG.",
        "  3. Rename the file to: ISBN_bookname.pdf (or .png).",
        "  4. Upload to the designated Google Drive folder.",
        "",
        "Need help? Contact: support@bookleafpub.com",
    ])

    return "\n".join(lines)


def compute_severity_score(violations: list[Violation]) -> int:
    """
    Compute an overall severity score from the violations list.

    Used for sorting Airtable records — highest severity at top.

    Score:
    - Each critical = 100 points
    - Each major = 50 points
    - Each minor = 10 points

    Returns integer 0–1000 (clamped)

    Args:
        violations: List of Violation objects

    Returns:
        Integer severity score
    """
    score = 0
    for v in violations:
        if v.severity == "critical":
            score += 100
        elif v.severity == "major":
            score += 50
        elif v.severity == "minor":
            score += 10

    return min(score, 1000)
