"""
CoverGuard AI — OCR Engine
============================
Dual OCR system: PaddleOCR (primary) + EasyOCR (fallback).

PaddleOCR is preferred because:
- Best-in-class on artistic/decorative fonts (common on book covers)
- Handles mixed typography well
- Good confidence calibration
- Fast on CPU at our resolution (~98 DPI input images)

EasyOCR is the fallback for:
- Dark/low-contrast images where PaddleOCR struggles
- Images where PaddleOCR returns very low average confidence

Both engines are initialized as module-level singletons to avoid
the ~2–4 second initialization penalty on every request.
"""

import logging
from typing import Optional

import numpy as np

from core.models import TextBlock

logger = logging.getLogger("coverguard.ocr")

# ── PaddleOCR Singleton ────────────────────────────────────────────────────
# Initialized once at module load time. Subsequent calls reuse the same instance.
ocr_paddle = None

try:
    from paddleocr import PaddleOCR
    ocr_paddle = PaddleOCR(
        use_angle_cls=True,    # Detect and correct rotated text
        lang="en",             # English (primary language on covers)
        show_log=False,        # Suppress PaddlePaddle's verbose logging
        use_gpu=False,         # CPU mode — works on any machine
    )
    logger.info("PaddleOCR initialized successfully")
except ImportError:
    logger.warning("PaddleOCR not installed — will use EasyOCR only")
except Exception as e:
    logger.warning(f"PaddleOCR initialization failed: {e} — will use EasyOCR fallback")


# ── EasyOCR Singleton ──────────────────────────────────────────────────────
ocr_easy = None

try:
    import easyocr
    ocr_easy = easyocr.Reader(
        ["en"],       # English
        gpu=False,    # CPU mode
        verbose=False # Suppress verbose output
    )
    logger.info("EasyOCR initialized successfully")
except ImportError:
    logger.warning("EasyOCR not installed")
except Exception as e:
    logger.warning(f"EasyOCR initialization failed: {e}")


def _polygon_to_bbox(polygon_points: list) -> list[int]:
    """
    Convert a polygon (list of [x, y] points) to an axis-aligned bounding box.

    Both PaddleOCR and EasyOCR return polygon coordinates.
    We convert to [x1, y1, x2, y2] (top-left, bottom-right) for Shapely.

    Args:
        polygon_points: List of [x, y] coordinate pairs

    Returns:
        [x1, y1, x2, y2] as integers
    """
    xs = [int(p[0]) for p in polygon_points]
    ys = [int(p[1]) for p in polygon_points]
    x1, y1 = min(xs), min(ys)
    x2, y2 = max(xs), max(ys)

    # Ensure valid bbox
    if x2 <= x1:
        x2 = x1 + 1
    if y2 <= y1:
        y2 = y1 + 1

    return [x1, y1, x2, y2]


def run_paddle_ocr(image: np.ndarray) -> list[TextBlock]:
    """
    Run PaddleOCR on an image and return detected text blocks.

    PaddleOCR result format:
        result[0] = list of detections
        Each detection: [polygon_points, (text, confidence)]
        polygon_points: [[x1,y1], [x2,y1], [x2,y2], [x1,y2]]

    Args:
        image: numpy RGB array of the front cover

    Returns:
        List of TextBlock objects, sorted by y-position (top to bottom)
    """
    if ocr_paddle is None:
        logger.warning("PaddleOCR not available")
        return []

    try:
        result = ocr_paddle.ocr(image, cls=True)

        if not result or result[0] is None:
            logger.info("PaddleOCR returned no results")
            return []

        blocks = []
        for line in result[0]:
            if not line or len(line) < 2:
                continue

            polygon_points = line[0]
            text_data = line[1]

            if not text_data or len(text_data) < 2:
                continue

            text, confidence = text_data
            text = str(text).strip()
            confidence = float(confidence)

            if not text:
                continue

            bbox = _polygon_to_bbox(polygon_points)

            blocks.append(TextBlock(
                text=text,
                bbox=bbox,
                confidence=round(confidence, 3),
                source="paddleocr",
            ))

        # Sort by y-position (top of image first)
        blocks.sort(key=lambda b: b.bbox[1])

        logger.info(f"PaddleOCR: detected {len(blocks)} text blocks")
        for b in blocks:
            logger.debug(f"  [{b.confidence:.2f}] '{b.text}' @ {b.bbox}")

        return blocks

    except Exception as e:
        logger.error(f"PaddleOCR inference failed: {e}")
        return []


def run_easy_ocr(image: np.ndarray) -> list[TextBlock]:
    """
    Run EasyOCR on an image and return detected text blocks.

    EasyOCR result format:
        list of (bbox, text, confidence)
        bbox: [[x1,y1], [x2,y1], [x2,y2], [x1,y2]]

    Args:
        image: numpy RGB array of the front cover

    Returns:
        List of TextBlock objects, sorted by y-position (top to bottom)
    """
    if ocr_easy is None:
        logger.warning("EasyOCR not available")
        return []

    try:
        results = ocr_easy.readtext(image)

        if not results:
            logger.info("EasyOCR returned no results")
            return []

        blocks = []
        for (bbox_raw, text, confidence) in results:
            text = str(text).strip()
            confidence = float(confidence)

            if not text:
                continue

            bbox = _polygon_to_bbox(bbox_raw)

            blocks.append(TextBlock(
                text=text,
                bbox=bbox,
                confidence=round(confidence, 3),
                source="easyocr",
            ))

        # Sort by y-position
        blocks.sort(key=lambda b: b.bbox[1])

        logger.info(f"EasyOCR: detected {len(blocks)} text blocks")
        for b in blocks:
            logger.debug(f"  [{b.confidence:.2f}] '{b.text}' @ {b.bbox}")

        return blocks

    except Exception as e:
        logger.error(f"EasyOCR inference failed: {e}")
        return []


def cluster_text_blocks(blocks: list[TextBlock]) -> list[TextBlock]:
    """
    Cluster word-level bounding boxes into line-level or sentence-level blocks.
    This prevents EasyOCR from generating 6 violations for a single sentence.
    """
    if not blocks:
        return []

    # Sort blocks by y-axis first (top to bottom), then x-axis
    blocks.sort(key=lambda b: (b.bbox[1], b.bbox[0]))

    clustered = []
    current_line = [blocks[0]]

    for i in range(1, len(blocks)):
        block = blocks[i]
        prev_block = current_line[-1]

        # Check if they are on the same line (y-axis overlap)
        y_overlap = min(block.bbox[3], prev_block.bbox[3]) - max(block.bbox[1], prev_block.bbox[1])
        h1 = prev_block.bbox[3] - prev_block.bbox[1]
        h2 = block.bbox[3] - block.bbox[1]
        
        # If there's significant vertical overlap and horizontal distance is small
        if y_overlap > 0 and (y_overlap / min(h1, h2)) > 0.5:
            # Check horizontal distance (x-gap)
            x_gap = block.bbox[0] - prev_block.bbox[2]
            # If gap is reasonably small (e.g., less than 3x the height of the text)
            if x_gap < max(h1, h2) * 3:
                current_line.append(block)
                continue

        # If we reach here, the block is on a new line or too far away
        # Merge current_line into a single block
        if len(current_line) > 0:
            merged = _merge_line(current_line)
            clustered.append(merged)
        
        current_line = [block]

    if current_line:
        clustered.append(_merge_line(current_line))

    return clustered

def _merge_line(blocks: list[TextBlock]) -> TextBlock:
    """Helper to merge a list of text blocks into one."""
    if len(blocks) == 1:
        return blocks[0]
    
    # Calculate merged bbox
    x1 = min(b.bbox[0] for b in blocks)
    y1 = min(b.bbox[1] for b in blocks)
    x2 = max(b.bbox[2] for b in blocks)
    y2 = max(b.bbox[3] for b in blocks)
    
    # Concatenate text
    text = " ".join(b.text for b in blocks)
    
    # Average confidence
    conf = sum(b.confidence for b in blocks) / len(blocks)
    
    return TextBlock(
        text=text,
        bbox=[x1, y1, x2, y2],
        confidence=round(conf, 3),
        source=blocks[0].source
    )

def detect_text(image: np.ndarray) -> tuple[list[TextBlock], str]:
    """
    Smart OCR engine selection — tries PaddleOCR first, falls back to EasyOCR.
    """
    # Try PaddleOCR first
    paddle_blocks = run_paddle_ocr(image)

    if paddle_blocks:
        avg_conf = sum(b.confidence for b in paddle_blocks) / len(paddle_blocks)
        logger.info(f"PaddleOCR avg confidence: {avg_conf:.3f}")

        if avg_conf >= 0.65:
            logger.info("Using PaddleOCR results (high confidence)")
            # PaddleOCR usually returns lines, but let's cluster just in case
            return cluster_text_blocks(paddle_blocks), "paddleocr"

    # PaddleOCR returned few/no results or low confidence — try EasyOCR
    logger.info("Falling back to EasyOCR...")
    easy_blocks = run_easy_ocr(image)

    if not easy_blocks and not paddle_blocks:
        logger.warning("Both OCR engines returned no results")
        return [], "paddleocr"

    if len(easy_blocks) > len(paddle_blocks):
        logger.info(f"Using EasyOCR results ({len(easy_blocks)} vs {len(paddle_blocks)} blocks)")
        # EasyOCR desperately needs clustering
        return cluster_text_blocks(easy_blocks), "easyocr"

    # PaddleOCR had more/equal results — prefer it
    logger.info(f"Using PaddleOCR results ({len(paddle_blocks)} blocks, despite low conf)")
    return cluster_text_blocks(paddle_blocks), "paddleocr"


def filter_low_confidence_blocks(
    blocks: list[TextBlock],
    threshold: float = 0.30,
    preserve_near_badge: bool = True,
    image_h: int = 0,
    badge_top: int = 0,
) -> list[TextBlock]:
    """
    Remove very low-confidence text detections that are likely noise.

    IMPORTANT EXCEPTION: If preserve_near_badge=True, blocks whose bottom edge
    is within the badge zone area (y > badge_top - 20px) are kept regardless
    of confidence. This ensures calligraphy fonts near the badge zone are
    not filtered out — their bbox is spatially accurate even if confidence is low.

    Args:
        blocks: List of TextBlock objects
        threshold: Minimum confidence to keep (default 0.30)
        preserve_near_badge: If True, preserve all blocks near badge zone
        image_h: Image height in pixels (needed for badge zone check)
        badge_top: Y coordinate where badge zone begins

    Returns:
        Filtered list with low-confidence blocks removed
    """
    before = len(blocks)
    filtered = []
    for b in blocks:
        keep = b.confidence >= threshold
        # EXCEPTION: preserve any detection near the badge zone regardless of confidence
        if not keep and preserve_near_badge and badge_top > 0:
            # If the block's bottom edge is near the badge zone top, keep it.
            # We use a generous 40px window (~10mm) to catch calligraphy bboxes
            # that are slightly above the mathematical zone.
            if b.bbox[3] >= badge_top - 40:
                keep = True
                logger.info(
                    f"Preserving low-confidence block near badge zone: "
                    f"'{b.text}' conf={b.confidence:.3f} bbox={b.bbox}"
                )
        if keep:
            filtered.append(b)

    removed = before - len(filtered)
    if removed > 0:
        logger.info(f"Filtered out {removed} low-confidence blocks (< {threshold:.0%})")

    return filtered


def merge_overlapping_blocks(blocks: list[TextBlock]) -> list[TextBlock]:
    """
    Remove near-duplicate text blocks that overlap significantly.

    When PaddleOCR and EasyOCR both detect the same text, we get
    duplicate detections. This function deduplicates by:
    1. For each pair of blocks, check if their bboxes overlap > 80%
    2. If they overlap AND have similar text (same first 3 chars), keep higher confidence
    3. Otherwise keep both

    Args:
        blocks: List of TextBlock objects

    Returns:
        Deduplicated list
    """
    if len(blocks) <= 1:
        return blocks

    def bbox_overlap(b1: list[int], b2: list[int]) -> float:
        """Compute overlap fraction between two bboxes."""
        x1 = max(b1[0], b2[0])
        y1 = max(b1[1], b2[1])
        x2 = min(b1[2], b2[2])
        y2 = min(b1[3], b2[3])

        if x2 <= x1 or y2 <= y1:
            return 0.0

        intersection = (x2 - x1) * (y2 - y1)
        area1 = (b1[2] - b1[0]) * (b1[3] - b1[1])
        area2 = (b2[2] - b2[0]) * (b2[3] - b2[1])
        smaller = min(area1, area2)

        return intersection / smaller if smaller > 0 else 0.0

    kept = []
    used = set()

    for i, block in enumerate(blocks):
        if i in used:
            continue

        best = block
        for j, other in enumerate(blocks):
            if j <= i or j in used:
                continue

            overlap = bbox_overlap(block.bbox, other.bbox)
            similar_text = (
                block.text[:3].lower() == other.text[:3].lower()
                if len(block.text) >= 3 and len(other.text) >= 3
                else block.text.lower() == other.text.lower()
            )

            if overlap > 0.80 and similar_text:
                # Keep the higher confidence one
                if other.confidence > best.confidence:
                    best = other
                used.add(j)

        kept.append(best)

    removed = len(blocks) - len(kept)
    if removed > 0:
        logger.info(f"Merged {removed} overlapping duplicate blocks")

    return kept
