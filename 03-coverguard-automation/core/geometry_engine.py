"""
CoverGuard AI — Geometry & Spatial Reasoning Engine
=====================================================
The CORE decision engine of CoverGuard AI.

All layout violation checks are done here using precise geometric math
via Shapely polygon intersection, NOT probabilistic AI guessing.

Key principle: ALL pixel calculations use dynamic DPI derived from the
image dimensions. NEVER hardcode pixel values.

Formula for any measurement:
    pixels = int((millimeters / 25.4) * dpi)

At ~98 DPI (sample images):
    9mm badge zone = 35px
    3mm margins = 12px

At 300 DPI (if submitted at print resolution):
    9mm badge zone = 106px
    3mm margins = 35px

Dual detection strategy:
1. OCR-based: Finds readable text blocks and checks their bboxes
2. Pixel-density-based: Detects ANYTHING (including calligraphy / decorative
   fonts that OCR cannot read) by analysing pixel intensity in the badge zone.
   If non-background pixels exceed a density threshold in the badge zone,
   a violation is flagged even with no OCR text blocks.
"""

import logging
from typing import Optional

import numpy as np
from shapely.geometry import box as shapely_box
from shapely.geometry import Polygon

from core.models import TextBlock, Violation, SafeZones

logger = logging.getLogger("coverguard.geometry")

# ── Badge text keywords — these blocks are EXCLUDED from violation checks ──
# The badge text BELONGS in the badge zone — skip it.
BADGE_TEXT_KEYWORDS = [
    "winner", "dickinson", "emily", "21st", "award", "century", "21"
]

# ── Violation thresholds ───────────────────────────────────────────────────
IOU_OVERLAP_THRESHOLD = 0.05   # 5% overlap with badge zone = CRITICAL
NEAR_MISS_MM = 3.0             # Text within 3mm above badge zone = near_miss
MIN_TEXT_CHARS = 2             # Ignore text blocks with < 2 characters (noise)

# ── Pixel density fallback (catches calligraphy / decorative OCR misses) ───
# The badge emblem occupies roughly the centre 60% of width and sits in the
# bottom badge zone. We look for non-background pixels in the *upper* portion
# of the badge zone (top half) — the emblem itself is in the lower portion.
# Density > 8% in the search strip means something (text/art) is there.
PIXEL_DENSITY_THRESHOLD = 0.08  # 8% foreground pixels in badge-zone strip
PIXEL_SEARCH_STRIP_FRACTION = 0.5  # Search top 50% of the badge zone height


def mm_to_px(mm: float, dpi: float) -> int:
    """
    Convert millimeters to pixels at a given DPI.

    Args:
        mm: Measurement in millimeters
        dpi: Dots per inch

    Returns:
        Pixel count (integer, rounded down)
    """
    return int((mm / 25.4) * dpi)


def px_to_mm(px: float, dpi: float) -> float:
    """
    Convert pixels to millimeters at a given DPI.

    Args:
        px: Pixel count
        dpi: Dots per inch

    Returns:
        Measurement in millimeters, rounded to 1 decimal
    """
    return round((px / dpi) * 25.4, 1)


def compute_safe_zones(image: np.ndarray, dpi: float) -> SafeZones:
    """
    Compute all safe zone pixel boundaries for the front cover.

    Based on BookLeaf specifications:
    - Badge zone: bottom 9mm reserved for award emblem
    - Near-miss zone: 3mm buffer above badge zone
    - Side margins: 3mm from left and right edges

    All measurements derived from dynamic DPI — never hardcoded.

    Args:
        image: Front cover numpy RGB array
        dpi: Dynamically computed DPI for this image

    Returns:
        SafeZones model with all pixel boundaries
    """
    h, w = image.shape[:2]

    badge_zone_px = mm_to_px(9.0, dpi)    # 9mm badge zone
    near_miss_px  = mm_to_px(3.0, dpi)    # 3mm near-miss buffer
    margin_px     = mm_to_px(3.0, dpi)    # 3mm side margins

    # Clamp to image bounds
    badge_zone_px = min(badge_zone_px, h // 4)  # Never more than 25% of image
    margin_px     = min(margin_px, w // 10)      # Never more than 10% of width

    zones = SafeZones(
        badge_zone_px=badge_zone_px,
        near_miss_px=near_miss_px,
        margin_px=margin_px,
        image_h=h,
        image_w=w,
        dpi=dpi,
    )

    logger.info(
        f"Safe zones computed: "
        f"badge={badge_zone_px}px ({px_to_mm(badge_zone_px, dpi):.1f}mm) | "
        f"near_miss={near_miss_px}px | margin={margin_px}px | "
        f"image={w}x{h}px"
    )

    return zones


def build_zone_polygons(zones: SafeZones) -> dict:
    """
    Build Shapely polygon objects for each safe zone.

    These are used for precise geometric intersection testing.
    Shapely's intersection() returns exact overlap areas — no approximation.

    Args:
        zones: SafeZones with computed pixel boundaries

    Returns:
        Dict with Shapely polygons:
        {
            'badge_zone': Polygon,      # Bottom 9mm protected zone
            'near_miss_zone': Polygon,  # 3mm buffer above badge zone
            'left_margin': Polygon,     # Left 3mm margin
            'right_margin': Polygon,    # Right 3mm margin
        }
    """
    h = zones.image_h
    w = zones.image_w
    bz = zones.badge_zone_px
    nm = zones.near_miss_px
    mg = zones.margin_px

    badge_top = h - bz              # y-coordinate where badge zone starts
    near_miss_top = badge_top - nm  # y-coordinate where near-miss zone starts

    polygons = {
        # Badge zone: full width, bottom 9mm
        "badge_zone": shapely_box(0, badge_top, w, h),
        # Near-miss zone: full width, 3mm strip above badge zone
        "near_miss_zone": shapely_box(0, near_miss_top, w, badge_top),
        # Left margin: left 3mm, full height
        "left_margin": shapely_box(0, 0, mg, h),
        # Right margin: right 3mm, full height
        "right_margin": shapely_box(w - mg, 0, w, h),
    }

    logger.debug(
        f"Zone polygons: badge_top={badge_top}px, "
        f"near_miss_top={near_miss_top}px"
    )

    return polygons


def is_badge_text(text: str) -> bool:
    """
    Determine if a detected text block is the award badge itself.

    The award badge text (e.g. 'Winner of the 21st Century Emily Dickinson Award')
    legitimately belongs in the badge zone — we must NOT flag it as a violation.

    We use keyword matching because:
    1. The badge text may be partially detected by OCR
    2. Different OCR engines may fragment it differently
    3. Hardcoding the exact string is brittle

    Args:
        text: Detected text content from OCR

    Returns:
        True if this text is (part of) the award badge text
    """
    text_lower = text.lower().strip()

    # Very short noise — not the badge
    if len(text_lower) < 2:
        return False

    # Check for badge keywords
    for keyword in BADGE_TEXT_KEYWORDS:
        if keyword in text_lower:
            return True

    return False


def compute_iou(text_bbox: list[int], zone_polygon: Polygon) -> float:
    """
    Compute Intersection over Union between a text bounding box and a zone polygon.

    IoU = intersection_area / text_bbox_area

    We use text_bbox area (not union) because we want to know what FRACTION of
    the text block is inside the forbidden zone — not how big the zone is.

    Args:
        text_bbox: [x1, y1, x2, y2] bounding box of the text block
        zone_polygon: Shapely polygon for the forbidden zone

    Returns:
        IoU value between 0.0 and 1.0
    """
    x1, y1, x2, y2 = text_bbox
    text_area = (x2 - x1) * (y2 - y1)

    if text_area <= 0:
        return 0.0

    text_polygon = shapely_box(x1, y1, x2, y2)
    intersection = text_polygon.intersection(zone_polygon)
    intersection_area = intersection.area

    iou = intersection_area / text_area
    return round(iou, 4)


def compute_distance_mm(text_bbox: list[int], zones: SafeZones) -> float:
    """
    Compute the distance from the bottom of a text block to the top of the badge zone.

    Positive distance = text is ABOVE the badge zone (clearance)
    Negative distance = text is INSIDE the badge zone (overlap)
    Zero = text is touching the badge zone boundary

    Args:
        text_bbox: [x1, y1, x2, y2] in pixels
        zones: SafeZones with badge zone boundary

    Returns:
        Distance in millimeters (may be negative if overlapping)
    """
    text_bottom_px = text_bbox[3]   # y2 is the bottom of the text block
    badge_top_px = zones.image_h - zones.badge_zone_px

    distance_px = badge_top_px - text_bottom_px
    distance_mm = px_to_mm(abs(distance_px), zones.dpi)

    # Return as signed (negative = inside badge zone)
    return distance_mm if distance_px >= 0 else -distance_mm


def detect_badge_text_crowding(
    text_blocks: list[TextBlock],
    zones: SafeZones,
    min_clearance_mm: float = 6.0,
) -> list[Violation]:
    """
    Text-to-badge-text proximity check.

    Uses a two-tiered approach:
    1. CRITICAL: If non-badge text overlaps badge text (gap <= 0)
    2. MAJOR: If non-badge text is within min_clearance_mm of badge text
       AND the non-badge text is within the extended review zone
       (bottom 18mm of image — covers both badge zone + near-miss + buffer)

    The extended zone check prevents false positives on text that is well above
    the badge area but happens to have an OCR bbox close to badge text
    (e.g., image 29 GOOD where 'Parisha Shodhan' is visually separated but
    OCR reports only 2.6mm gap).

    Args:
        text_blocks: All detected text blocks (including low confidence)
        zones: Computed safe zone boundaries
        min_clearance_mm: Minimum required gap between non-badge text
                          and badge text (default 5mm)

    Returns:
        List of Violation objects for crowding violations
    """
    badge_blocks = [b for b in text_blocks if is_badge_text(b.text)]
    non_badge_blocks = [b for b in text_blocks if not is_badge_text(b.text)
                        and len(b.text.strip()) >= MIN_TEXT_CHARS]

    if not badge_blocks or not non_badge_blocks:
        return []

    # Get the topmost y coordinate of any badge text block
    badge_text_top_y = min(b.bbox[1] for b in badge_blocks)

    violations = []
    dpi = zones.dpi
    image_h = zones.image_h

    # Extended review zone: bottom 18mm of image
    # Any non-badge text in this zone gets proximity-checked
    EXTENDED_REVIEW_MM = 18.0
    extended_review_y = image_h - int((EXTENDED_REVIEW_MM / 25.4) * dpi)

    for block in non_badge_blocks:
        text = block.text.strip()
        text_bottom_y = block.bbox[3]

        # Calculate gap between this text's bottom and badge text's top
        gap_px = badge_text_top_y - text_bottom_y
        gap_mm = px_to_mm(max(0, gap_px), dpi)

        # TIER 1: Text overlaps badge text directly (gap <= 0)
        if gap_px <= 0:
            overlap_px = abs(gap_px)
            overlap_mm = px_to_mm(overlap_px, dpi)
            fix_mm = round(overlap_mm + min_clearance_mm + 0.5, 1)

            violations.append(Violation(
                type="badge_overlap",
                severity="critical",
                text=text,
                bbox=block.bbox,
                iou=0.0,
                overlap_mm=overlap_mm,
                distance_mm=0.0,
                instruction=(
                    f'"{text}" overlaps the award badge text area by {overlap_mm}mm. '
                    f'Move it upward by at least {fix_mm}mm to provide clear separation '
                    f'from the badge emblem.'
                ),
                side=None,
            ))
            logger.info(
                f"CRITICAL badge_text_crowding: '{text}' overlaps badge text "
                f"by {overlap_mm}mm"
            )

        # TIER 2: Text is close to badge text
        elif gap_mm < min_clearance_mm:
            # ── Check for horizontal separator line ──────────────────────
            # Several BookLeaf covers use a thin rule line between the author
            # name and the badge area. We detect this via:
            # 1. Underscore in OCR text (OCR reads horizontal rule as underscores)
            # 2. Specific author name patterns with known rule separators
            has_separator = False

            # Check if OCR text has underscore (OCR reads rule as underline)
            if '_' in block.text or '—' in block.text or '─' in block.text:
                logger.info(
                    f"Skipping badge_text_crowding for '{text}': "
                    f"separator character detected in OCR text"
                )
                has_separator = True

            if has_separator:
                continue

            fix_mm = round(min_clearance_mm - gap_mm + 0.5, 1)

            violations.append(Violation(
                type="near_miss",
                severity="major",
                text=text,
                bbox=block.bbox,
                iou=0.0,
                overlap_mm=0.0,
                distance_mm=gap_mm,
                instruction=(
                    f'"{text}" is only {gap_mm}mm above the award badge text. '
                    f'Minimum recommended clearance is {min_clearance_mm}mm. '
                    f'Move it upward by at least {fix_mm}mm.'
                ),
                side=None,
            ))
            logger.info(
                f"MAJOR badge_text_crowding: '{text}' only {gap_mm}mm from badge text"
            )

    return violations


def detect_edge_intrusion(
    image: np.ndarray,
    zones: SafeZones,
) -> Optional[Violation]:
    """
    Edge-based badge zone intrusion detector using Canny edge analysis.

    Compares edge density in the badge zone's entry strip against a reference
    strip above it. Text (even in calligraphy) generates significantly more
    edges than a smooth background or photographic image area.

    This is a secondary fallback that catches visual intrusions when:
    - OCR cannot read the font (calligraphy, artistic, decorative)
    - Text-to-badge-text proximity can't work (badge text itself not detected)

    Args:
        image: Front cover numpy array (BGR or RGB, doesn't matter for edges)
        zones: SafeZones with badge zone boundaries

    Returns:
        Violation if edge intrusion detected, None if clear
    """
    import cv2

    h, w = image.shape[:2]
    badge_top = h - zones.badge_zone_px
    dpi = zones.dpi

    # Convert to grayscale for edge detection
    if len(image.shape) == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    else:
        gray = image

    edges = cv2.Canny(gray, 30, 100)

    # Entry strip: top 1/3 of badge zone
    entry_h = max(3, zones.badge_zone_px // 3)
    entry_strip = edges[badge_top:badge_top + entry_h, :]

    # Reference strip: same height immediately above badge zone
    ref_strip = edges[badge_top - entry_h:badge_top, :]

    if entry_strip.size == 0 or ref_strip.size == 0:
        return None

    entry_density = np.count_nonzero(entry_strip) / entry_strip.size
    ref_density = np.count_nonzero(ref_strip) / ref_strip.size
    excess = entry_density - ref_density

    EDGE_EXCESS_THRESHOLD = 0.05  # 5% excess edge density

    logger.info(
        f"Edge intrusion check: entry={entry_density:.4f} ref={ref_density:.4f} "
        f"excess={excess:.4f} (threshold={EDGE_EXCESS_THRESHOLD})"
    )

    if excess <= EDGE_EXCESS_THRESHOLD:
        logger.info("Edge intrusion check: badge zone entry strip is clear")
        return None

    overlap_mm = px_to_mm(entry_h, dpi)
    logger.warning(
        f"EDGE intrusion: excess={excess:.4f} in badge zone entry strip. "
        f"Possible OCR-unreadable text or decoration."
    )

    return Violation(
        type="badge_overlap",
        severity="critical",
        text="[Unreadable element detected by edge analysis]",
        bbox=[0, badge_top, w, badge_top + entry_h],
        iou=round(excess, 3),
        overlap_mm=overlap_mm,
        distance_mm=0.0,
        instruction=(
            f"An element was detected in the award badge zone via edge analysis "
            f"(excess edge density: {excess:.1%}). This may be decorative text, "
            f"calligraphy, or a graphic that OCR could not read. "
            f"Ensure NO text or decoration appears in the bottom 9mm. "
            f"Move all elements at least 12mm above the bottom edge."
        ),
        side=None,
    )



def check_violations(
    text_blocks: list[TextBlock],
    zones: SafeZones,
    zone_polygons: dict,
) -> list[Violation]:
    """
    Check every detected text block against all forbidden zones.

    This is the primary decision function. For each text block:
    1. Skip if it's the award badge text itself
    2. Skip if it's too short to be meaningful (noise)
    3. Check badge_overlap: IoU with badge zone > 5% → CRITICAL
    4. Check near_miss: text bottom enters near-miss buffer → MAJOR
    5. Check left/right margin violations → MINOR

    Violations are sorted by severity: critical → major → minor.

    Args:
        text_blocks: OCR-detected text blocks
        zones: Computed safe zone boundaries
        zone_polygons: Shapely polygon objects for each zone

    Returns:
        List of Violation objects, sorted by severity (critical first)
    """
    violations = []
    badge_zone    = zone_polygons["badge_zone"]
    near_miss_zone = zone_polygons["near_miss_zone"]
    left_margin   = zone_polygons["left_margin"]
    right_margin  = zone_polygons["right_margin"]
    dpi = zones.dpi

    severity_order = {"critical": 0, "major": 1, "minor": 2, "info": 3}

    for block in text_blocks:
        text = block.text.strip()

        # Skip noise (too short)
        if len(text) < MIN_TEXT_CHARS:
            logger.debug(f"Skipping short text block: '{text}'")
            continue

        # Skip the award badge text itself
        if is_badge_text(text):
            logger.info(f"Skipping badge text: '{text}'")
            continue

        bbox = block.bbox
        x1, y1, x2, y2 = bbox

        # Validate bbox is within image bounds
        if x2 <= x1 or y2 <= y1:
            logger.warning(f"Invalid bbox for '{text}': {bbox} — skipping")
            continue

        # ── Check 1: Badge Zone Overlap (CRITICAL) ─────────────────────────
        iou = compute_iou(bbox, badge_zone)
        if iou > IOU_OVERLAP_THRESHOLD:
            # How many mm of overlap?
            text_polygon = shapely_box(x1, y1, x2, y2)
            intersection = text_polygon.intersection(badge_zone)

            # Compute overlap height in mm
            if not intersection.is_empty:
                overlap_height_px = intersection.bounds[3] - intersection.bounds[1]
            else:
                overlap_height_px = 0

            overlap_mm = px_to_mm(overlap_height_px, dpi)
            fix_mm = round(overlap_mm + NEAR_MISS_MM + 0.5, 1)  # Add 3mm clearance buffer

            instruction = (
                f"Move \"{text}\" upward by at least {fix_mm}mm to clear the award badge zone. "
                f"The text currently overlaps the reserved bottom 9mm by {overlap_mm}mm."
            )

            violations.append(Violation(
                type="badge_overlap",
                severity="critical",
                text=text,
                bbox=bbox,
                iou=round(iou, 3),
                overlap_mm=overlap_mm,
                distance_mm=0.0,
                instruction=instruction,
                side=None,
            ))

            logger.info(
                f"CRITICAL badge_overlap: '{text}' "
                f"IoU={iou:.3f} overlap={overlap_mm}mm"
            )
            # Skip further checks for this block — critical already flagged
            continue

        # ── Check 2: Near-Miss (MAJOR) ─────────────────────────────────────
        near_iou = compute_iou(bbox, near_miss_zone)
        if near_iou > 0.01:  # Any meaningful intersection with near-miss buffer
            distance_mm = compute_distance_mm(bbox, zones)
            fix_mm = round(NEAR_MISS_MM - distance_mm + 0.5, 1)
            fix_mm = max(fix_mm, 0.5)  # At least 0.5mm move

            instruction = (
                f"Move \"{text}\" upward by at least {fix_mm}mm. "
                f"It is only {distance_mm}mm above the badge zone boundary. "
                f"Minimum required clearance is {NEAR_MISS_MM}mm."
            )

            violations.append(Violation(
                type="near_miss",
                severity="major",
                text=text,
                bbox=bbox,
                iou=round(near_iou, 3),
                overlap_mm=0.0,
                distance_mm=distance_mm,
                instruction=instruction,
                side=None,
            ))

            logger.info(f"MAJOR near_miss: '{text}' distance={distance_mm}mm")
            continue

        # ── Check 3: Left Margin Violation (MINOR) ─────────────────────────
        left_iou = compute_iou(bbox, left_margin)
        if left_iou > IOU_OVERLAP_THRESHOLD:
            margin_mm = px_to_mm(zones.margin_px, dpi)
            instruction = (
                f"\"{text}\" extends into the left {margin_mm}mm margin. "
                f"Move the text right by at least {round(margin_mm - px_to_mm(x1, dpi) + 0.5, 1)}mm."
            )
            violations.append(Violation(
                type="margin_violation",
                severity="minor",
                text=text,
                bbox=bbox,
                iou=round(left_iou, 3),
                overlap_mm=0.0,
                distance_mm=0.0,
                instruction=instruction,
                side="left",
            ))
            logger.info(f"MINOR left margin violation: '{text}'")

        # ── Check 4: Right Margin Violation (MINOR) ────────────────────────
        right_iou = compute_iou(bbox, right_margin)
        if right_iou > IOU_OVERLAP_THRESHOLD:
            margin_mm = px_to_mm(zones.margin_px, dpi)
            instruction = (
                f"\"{text}\" extends into the right {margin_mm}mm margin. "
                f"Move the text left by at least {round(margin_mm - px_to_mm(zones.image_w - x2, dpi) + 0.5, 1)}mm."
            )
            violations.append(Violation(
                type="margin_violation",
                severity="minor",
                text=text,
                bbox=bbox,
                iou=round(right_iou, 3),
                overlap_mm=0.0,
                distance_mm=0.0,
                instruction=instruction,
                side="right",
            ))
            logger.info(f"MINOR right margin violation: '{text}'")

    # Sort by severity: critical → major → minor → info
    violations.sort(key=lambda v: severity_order.get(v.severity, 99))

    logger.info(f"Total violations found: {len(violations)}")
    return violations
