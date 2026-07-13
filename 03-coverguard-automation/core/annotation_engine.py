"""
CoverGuard AI — Annotation Engine
=====================================
Draws visual overlays on book cover images to make violations
immediately obvious to authors and reviewers without reading descriptions.

Annotation design:
- Gold dashed border: Badge zone boundary (always shown)
- Red semi-transparent fill: Badge overlap violations (CRITICAL)
- Orange semi-transparent fill: Near-miss violations (MAJOR)
- Purple semi-transparent fill: Margin violations (MINOR)
- Green bottom bar: PASS status
- Red bottom bar: REVIEW NEEDED status
- White labels: Violation type + measurement in mm
"""

import os
import logging

import cv2
import numpy as np

from core.models import Violation, SafeZones

logger = logging.getLogger("coverguard.annotation")

# ── Color palette (BGR for OpenCV) ─────────────────────────────────────────
COLOR_BADGE_ZONE_BORDER = (0, 215, 255)    # Gold/Yellow — badge zone boundary
COLOR_BADGE_OVERLAP     = (50, 50, 255)    # Red — critical badge overlap
COLOR_NEAR_MISS         = (0, 140, 255)    # Orange — near miss
COLOR_MARGIN_VIOLATION  = (200, 0, 150)    # Purple — margin violation
COLOR_PASS              = (80, 200, 80)    # Green — PASS status
COLOR_REVIEW            = (50, 50, 255)    # Red — REVIEW NEEDED status
COLOR_TEXT_WHITE        = (255, 255, 255)  # White text
COLOR_TEXT_BLACK        = (0, 0, 0)        # Black text


def _rgb_to_bgr(image: np.ndarray) -> np.ndarray:
    """Convert RGB numpy array to BGR for OpenCV operations."""
    return cv2.cvtColor(image, cv2.COLOR_RGB2BGR)


def _bgr_to_rgb(image: np.ndarray) -> np.ndarray:
    """Convert BGR numpy array back to RGB."""
    return cv2.cvtColor(image, cv2.COLOR_BGR2RGB)


def _put_text_with_background(
    image: np.ndarray,
    text: str,
    x: int,
    y: int,
    font_scale: float = 0.4,
    thickness: int = 1,
    text_color: tuple = COLOR_TEXT_WHITE,
    bg_color: tuple = (0, 0, 0),
) -> None:
    """
    Draw text with a solid background rectangle for readability.
    Works directly on the image in-place (BGR).
    """
    font = cv2.FONT_HERSHEY_SIMPLEX
    (text_w, text_h), baseline = cv2.getTextSize(text, font, font_scale, thickness)

    # Background rectangle
    pad = 2
    cv2.rectangle(
        image,
        (x - pad, y - text_h - pad),
        (x + text_w + pad, y + baseline + pad),
        bg_color,
        -1,  # Filled
    )
    # Text
    cv2.putText(image, text, (x, y), font, font_scale, text_color, thickness, cv2.LINE_AA)


def draw_badge_zone(image: np.ndarray, zones: SafeZones) -> np.ndarray:
    """
    Draw the badge zone boundary on the image.

    Draws a gold dashed rectangle around the protected 9mm badge area at the
    bottom of the cover. This is always shown — even on PASS covers —
    so the reviewer can verify the zone is clear.

    Args:
        image: BGR numpy array (already converted from RGB)
        zones: SafeZones with pixel boundaries

    Returns:
        Modified BGR image (in-place modification)
    """
    h, w = image.shape[:2]
    badge_top = h - zones.badge_zone_px

    # Main badge zone border (solid gold line)
    cv2.rectangle(
        image,
        (0, badge_top),
        (w - 1, h - 1),
        COLOR_BADGE_ZONE_BORDER,
        2,
    )

    # Dashed top line of badge zone (simulate dashes manually)
    dash_length = 10
    gap_length = 6
    x = 0
    while x < w:
        x_end = min(x + dash_length, w)
        cv2.line(image, (x, badge_top), (x_end, badge_top), COLOR_BADGE_ZONE_BORDER, 2)
        x += dash_length + gap_length

    # Label above badge zone
    label = f"BADGE ZONE (9mm reserved)"
    _put_text_with_background(
        image, label,
        x=4, y=badge_top - 4,
        font_scale=0.38,
        text_color=COLOR_BADGE_ZONE_BORDER,
        bg_color=(0, 0, 0),
    )

    return image


def draw_violation_box(
    image: np.ndarray,
    overlay: np.ndarray,
    violation: Violation,
) -> None:
    """
    Draw a colored violation box on the overlay image.

    Uses a two-layer approach:
    1. Filled rectangle on overlay (will be alpha-blended = semi-transparent)
    2. Solid border rectangle on main image (always visible)
    3. Text label with violation type and measurement

    Args:
        image: Main BGR image (for borders and text)
        overlay: BGR overlay image (for semi-transparent fill, same shape)
        violation: Violation object to draw
    """
    x1, y1, x2, y2 = violation.bbox

    # Select color by violation type
    if violation.type == "badge_overlap":
        color = COLOR_BADGE_OVERLAP
    elif violation.type == "near_miss":
        color = COLOR_NEAR_MISS
    elif violation.type in ["margin_violation", "text_alignment"]:
        color = COLOR_MARGIN_VIOLATION
    else:
        color = (128, 128, 128)  # Gray for unknown

    # Solid thick border on main image (hollow box)
    cv2.rectangle(image, (x1, y1), (x2, y2), color, 3)

    # Build label text
    type_label = violation.type.replace("_", " ").upper()
    if violation.type == "badge_overlap" and violation.overlap_mm > 0:
        label = f"{type_label} ({violation.overlap_mm}mm)"
    elif violation.type == "near_miss" and violation.distance_mm > 0:
        label = f"{type_label} ({violation.distance_mm}mm clearance)"
    elif violation.type == "margin_violation" and violation.side:
        label = f"{type_label} ({violation.side})"
    else:
        label = type_label

    # Position label above the box (or below if near top)
    label_y = max(y1 - 4, 14)
    _put_text_with_background(
        image, label,
        x=x1, y=label_y,
        font_scale=0.38,
        text_color=COLOR_TEXT_WHITE,
        bg_color=color,
    )


def draw_status_badge(image: np.ndarray, status: str, confidence: int) -> np.ndarray:
    """
    Draw a status indicator in the bottom-right corner of the image.

    PASS: Green rectangle with white text
    REVIEW NEEDED: Red rectangle with white text + confidence %

    Args:
        image: BGR numpy array
        status: 'PASS' or 'REVIEW NEEDED'
        confidence: Confidence percentage 0-100

    Returns:
        Modified BGR image
    """
    h, w = image.shape[:2]

    if status == "PASS":
        color = COLOR_PASS
        text1 = "PASS"
        text2 = f"Confidence: {confidence}%"
    else:
        color = COLOR_REVIEW
        text1 = "REVIEW NEEDED"
        text2 = f"See violations highlighted"

    # Draw status box in bottom-right corner
    box_w, box_h = 220, 50
    x1 = w - box_w - 5
    y1 = h - box_h - 5
    x2 = w - 5
    y2 = h - 5

    # Clamp to image bounds
    x1, y1 = max(0, x1), max(0, y1)

    cv2.rectangle(image, (x1, y1), (x2, y2), color, -1)
    cv2.rectangle(image, (x1, y1), (x2, y2), COLOR_TEXT_WHITE, 1)

    font = cv2.FONT_HERSHEY_SIMPLEX
    cv2.putText(image, text1, (x1 + 5, y1 + 20), font, 0.5, COLOR_TEXT_WHITE, 1, cv2.LINE_AA)
    cv2.putText(image, text2, (x1 + 5, y1 + 38), font, 0.33, COLOR_TEXT_WHITE, 1, cv2.LINE_AA)

    return image


def annotate_image(
    image: np.ndarray,
    violations: list[Violation],
    zones: SafeZones,
    status: str,
) -> np.ndarray:
    """
    Draw all visual annotations on the front cover image.

    This is the main annotation function called by the pipeline.
    Always draws:
    - Badge zone boundary (gold dashed border)
    - Status indicator (green PASS or red REVIEW NEEDED)

    For each violation:
    - Semi-transparent colored fill over the offending text
    - Solid colored border
    - Text label with violation type and measurement

    Args:
        image: Front cover as numpy RGB array
        violations: List of detected violations
        zones: SafeZones for badge zone boundary
        status: 'PASS' or 'REVIEW NEEDED'

    Returns:
        Annotated image as numpy RGB array
    """
    # Work in BGR (OpenCV native)
    annotated_bgr = _rgb_to_bgr(image.copy())
    overlay_bgr = annotated_bgr.copy()

    # 1. Always draw badge zone boundary
    draw_badge_zone(annotated_bgr, zones)

    # 2. Draw each violation
    for violation in violations:
        draw_violation_box(annotated_bgr, overlay_bgr, violation)

    # 3. (Skipped blending since boxes are now hollow)

    # 4. Draw status badge
    draw_status_badge(annotated_bgr, status, confidence=0)

    # Convert back to RGB
    annotated_rgb = _bgr_to_rgb(annotated_bgr)

    logger.info(
        f"Annotation complete: {len(violations)} violation(s) drawn "
        f"| status={status}"
    )

    return annotated_rgb


def save_annotated_image(
    annotated: np.ndarray,
    output_dir: str,
    isbn: str,
) -> str:
    """
    Save the annotated image to disk as PNG.

    Creates the output directory if it doesn't exist.
    OpenCV requires BGR format for imwrite — converts from RGB before saving.

    Args:
        annotated: Annotated image as numpy RGB array
        output_dir: Directory to save the annotated image
        isbn: ISBN for the filename

    Returns:
        Absolute path to the saved file

    Raises:
        RuntimeError: If save fails
    """
    os.makedirs(output_dir, exist_ok=True)

    filename = f"{isbn}_annotated.png"
    output_path = os.path.join(output_dir, filename)

    # Convert RGB → BGR for OpenCV imwrite
    bgr = cv2.cvtColor(annotated, cv2.COLOR_RGB2BGR)

    success = cv2.imwrite(output_path, bgr)
    if not success:
        raise RuntimeError(f"cv2.imwrite failed — could not save annotated image to: {output_path}")

    abs_path = os.path.abspath(output_path)
    logger.info(f"Annotated image saved: {abs_path}")
    return abs_path
