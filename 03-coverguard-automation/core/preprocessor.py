"""
CoverGuard AI — Preprocessing Module
======================================
Handles file ingestion, rasterization, cover splitting,
DPI computation, and image quality assessment.

All pixel calculations use dynamic DPI derived from image dimensions.
NEVER hardcode DPI values — sample images are ~98 DPI, not 300 DPI.
"""

import os
import logging
import tempfile
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

# pdf2image uses poppler — installed separately
try:
    from pdf2image import convert_from_path
    PDF_SUPPORT = True
except ImportError:
    PDF_SUPPORT = False
    logging.warning("pdf2image not available — PDF support disabled")

from core.models import QualityReport

logger = logging.getLogger("coverguard.preprocessor")


def extract_isbn(filename: str) -> str:
    """
    Extract ISBN from BookLeaf filename convention: ISBN_bookname.ext

    The ISBN is always the sequence of digits before the first underscore.
    Valid ISBN lengths: 10 or 13 digits.

    Args:
        filename: Filename string (e.g., '9789373147499_shabd.pdf')

    Returns:
        ISBN string (e.g., '9789373147499')

    Raises:
        ValueError: If the filename doesn't match expected format
    """
    basename = Path(filename).stem   # Remove extension
    parts = basename.split("_", 1)  # Split at FIRST underscore only

    if len(parts) < 2:
        raise ValueError(
            f"Invalid filename format: '{filename}'. "
            f"Expected: ISBN_bookname.ext (e.g., 9789373147499_shabd.pdf). "
            f"No underscore found."
        )

    isbn = parts[0]

    if not isbn.isdigit():
        raise ValueError(
            f"Invalid ISBN '{isbn}' extracted from '{filename}'. "
            f"ISBN must contain digits only."
        )

    if len(isbn) not in [10, 13]:
        raise ValueError(
            f"Invalid ISBN length {len(isbn)} in '{filename}'. "
            f"ISBN must be exactly 10 or 13 digits. Got: '{isbn}'"
        )

    logger.info(f"Extracted ISBN: {isbn} from filename: {filename}")
    return isbn


def rasterize_to_image(file_path: str) -> np.ndarray:
    """
    Convert a PDF or PNG file to a numpy RGB array.

    For PDF: Uses pdf2image (poppler) at 200 DPI initial raster.
    For PNG/JPG: Loads directly with Pillow for accurate color handling.

    Args:
        file_path: Absolute path to the file

    Returns:
        numpy ndarray in RGB format, shape (height, width, 3)

    Raises:
        FileNotFoundError: If file doesn't exist
        ValueError: If file format is unsupported
        RuntimeError: If rasterization fails
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")

    ext = Path(file_path).suffix.lower()
    logger.info(f"Rasterizing {ext} file: {file_path}")

    if ext == ".pdf":
        if not PDF_SUPPORT:
            raise RuntimeError(
                "PDF support requires pdf2image and poppler. "
                "Install poppler and run: pip install pdf2image"
            )
        try:
            # Rasterize at 200 DPI — we compute actual DPI from dimensions later
            pages = convert_from_path(file_path, dpi=200, first_page=1, last_page=1)
            if not pages:
                raise RuntimeError("PDF rasterization returned no pages")
            img_pil = pages[0]
            img_rgb = np.array(img_pil.convert("RGB"))
            logger.info(f"PDF rasterized: {img_rgb.shape[1]}x{img_rgb.shape[0]}px")
            return img_rgb
        except Exception as e:
            raise RuntimeError(f"PDF rasterization failed: {e}") from e

    elif ext in [".png", ".jpg", ".jpeg", ".tiff", ".bmp"]:
        try:
            # Use Pillow for accurate color reading
            img_pil = Image.open(file_path)
            img_rgb = np.array(img_pil.convert("RGB"))
            logger.info(f"Image loaded: {img_rgb.shape[1]}x{img_rgb.shape[0]}px")
            return img_rgb
        except Exception as e:
            raise RuntimeError(f"Image loading failed for {file_path}: {e}") from e

    else:
        raise ValueError(
            f"Unsupported file format: '{ext}'. "
            f"Supported formats: PDF, PNG, JPG, JPEG, TIFF, BMP"
        )


def compute_dpi(image: np.ndarray) -> float:
    """
    Compute effective DPI from image dimensions using the known cover spec.

    BookLeaf front covers are ALWAYS 8 inches tall (5x8 inch spec).
    Therefore: DPI = image_height_pixels / 8.0

    This is CRITICAL — never hardcode 300 DPI.
    The provided sample images are ~98 DPI.
    Hardcoding 300 DPI would place the badge zone fence 3x too high.

    Args:
        image: numpy ndarray of the front cover

    Returns:
        Computed DPI as float
    """
    height_px = image.shape[0]
    dpi = height_px / 8.0  # 8 inches = BookLeaf front cover spec
    logger.info(f"Computed DPI: {dpi:.1f} (height={height_px}px / 8 inches)")
    return dpi


def split_cover_spread(image: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """
    Split a full cover spread image into front and back covers.

    BookLeaf covers are submitted as full spreads (front + spine + back).
    We split at the midpoint: right half = front cover, left half = back cover.

    This works because:
    - Both covers are approximately the same width (5 inches each)
    - The spine is narrow relative to the total spread

    For single-page covers (aspect ratio close to 5:8), returns the full image
    as the front cover with an empty back cover.

    Args:
        image: Full spread image as numpy RGB array

    Returns:
        Tuple of (front_cover, back_cover) as numpy RGB arrays
    """
    height, width = image.shape[:2]
    aspect_ratio = width / height

    # If aspect ratio is close to single cover (0.5 to 0.75), it's already a single cover
    if aspect_ratio < 0.85:
        logger.info(f"Single cover detected (aspect {aspect_ratio:.2f}) — no split needed")
        empty_back = np.zeros_like(image)
        return image, empty_back

    # Full spread split at midpoint
    mid = width // 2
    back_cover = image[:, :mid]    # Left half = back cover
    front_cover = image[:, mid:]   # Right half = front cover

    logger.info(
        f"Cover split: spread={width}x{height}px "
        f"-> front={front_cover.shape[1]}x{front_cover.shape[0]}px "
        f"| back={back_cover.shape[1]}x{back_cover.shape[0]}px"
    )

    return front_cover, back_cover


def assess_quality(image: np.ndarray, dpi: float) -> QualityReport:
    """
    Assess image quality for the front cover.

    Checks:
    1. Sharpness: Laplacian variance (< 50 = blurry, unreliable for OCR)
    2. Resolution: DPI < 72 = unacceptably low for print quality assessment

    Args:
        image: Front cover numpy RGB array
        dpi: Computed DPI for this image

    Returns:
        QualityReport with all quality metrics
    """
    # Convert to grayscale for Laplacian
    if len(image.shape) == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
    else:
        gray = image

    # Laplacian variance — measures sharpness/blur
    laplacian = cv2.Laplacian(gray, cv2.CV_64F)
    variance = float(laplacian.var())

    is_blurry = variance < 50.0
    is_low_res = dpi < 72.0

    notes = []
    if is_blurry:
        notes.append(f"Image appears blurry (Laplacian variance={variance:.1f} < 50 threshold)")
    if is_low_res:
        notes.append(f"Resolution too low for reliable analysis (DPI={dpi:.1f} < 72 minimum)")
    if not notes:
        notes.append(f"Good quality image at {dpi:.1f} DPI (Laplacian={variance:.1f})")

    report = QualityReport(
        laplacian_variance=round(variance, 2),
        is_blurry=is_blurry,
        dpi=round(dpi, 1),
        is_low_resolution=is_low_res,
        notes=" | ".join(notes),
    )

    logger.info(f"Quality assessment: {report.notes}")
    return report


def normalize_image(image: np.ndarray) -> np.ndarray:
    """
    Normalize image to ensure consistent RGB format for downstream processing.

    Handles:
    - Grayscale → RGB conversion
    - RGBA → RGB conversion (drop alpha channel)
    - Ensures uint8 dtype
    - Validates minimum dimensions

    Args:
        image: Input image as numpy array (any format)

    Returns:
        Normalized RGB numpy array, dtype uint8

    Raises:
        ValueError: If image dimensions are too small to process
    """
    if image is None:
        raise ValueError("Image is None — cannot normalize")

    # Ensure uint8
    if image.dtype != np.uint8:
        if image.max() <= 1.0:
            image = (image * 255).astype(np.uint8)
        else:
            image = image.astype(np.uint8)

    # Handle channel formats
    if len(image.shape) == 2:
        # Grayscale → RGB
        image = cv2.cvtColor(image, cv2.COLOR_GRAY2RGB)
        logger.info("Converted grayscale to RGB")
    elif len(image.shape) == 3:
        channels = image.shape[2]
        if channels == 4:
            # RGBA → RGB (drop alpha)
            image = image[:, :, :3]
            logger.info("Converted RGBA to RGB (dropped alpha channel)")
        elif channels == 1:
            image = np.repeat(image, 3, axis=2)
            logger.info("Expanded single channel to RGB")
        elif channels == 3:
            pass  # Already RGB
        else:
            raise ValueError(f"Unexpected number of channels: {channels}")

    # Validate minimum size
    h, w = image.shape[:2]
    if h < 100 or w < 100:
        raise ValueError(
            f"Image too small: {w}x{h}px. "
            f"Minimum required: 100x100px. "
            f"File may be corrupt or not a valid book cover."
        )

    logger.info(f"Normalized image: {w}x{h}px, dtype={image.dtype}, channels=3")
    return image
