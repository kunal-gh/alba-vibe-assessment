"""
CoverGuard AI — FastAPI Vision Engine
======================================
Main application entry point for the BookLeaf Publishing
Automated Book Cover Validation System.

Author: CoverGuard AI Team
Version: 1.0.0
Assignment: BookLeaf Publishing Round 2 Technical Assignment
"""

import os
import sys
import time
import logging
import tempfile
import traceback
from datetime import datetime
from pathlib import Path
from typing import Optional

import httpx
import numpy as np
from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

# ── Load environment variables ─────────────────────────────────────────────
load_dotenv()

# ── Configure logging ──────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("coverguard.log", encoding="utf-8"),
    ]
)
logger = logging.getLogger("coverguard.main")

# ── Import core modules ────────────────────────────────────────────────────
# These are imported after logging setup so any import errors are captured
try:
    from core.preprocessor import (
        extract_isbn,
        rasterize_to_image,
        compute_dpi,
        split_cover_spread,
        assess_quality,
        normalize_image,
    )
    from core.ocr_engine import detect_text, filter_low_confidence_blocks
    from core.geometry_engine import (
        compute_safe_zones,
        build_zone_polygons,
        check_violations,
        detect_badge_text_crowding,
        detect_edge_intrusion,
    )
    from core.decision_engine import make_decision, build_correction_text, compute_severity_score
    from core.annotation_engine import annotate_image, save_annotated_image
    from core.models import ValidationResult, ErrorResponse, QualityReport
    from integrations.airtable_client import (
        get_author_info,
        find_existing_record,
        create_validation_record,
    )
    from integrations.email_client import send_pass_email, send_review_email
    logger.info("All core modules imported successfully")
except ImportError as e:
    logger.error(f"Failed to import core module: {e}")
    logger.error(traceback.format_exc())
    # Don't crash on import — allow health check to still work


# ── FastAPI App ────────────────────────────────────────────────────────────
app = FastAPI(
    title="CoverGuard AI — Vision Engine",
    description=(
        "Automated Book Cover Validation System for BookLeaf Publishing. "
        "Detects badge zone overlaps, margin violations, and quality issues "
        "with geometric precision using PaddleOCR + Shapely."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS — allow n8n and any frontend to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Configuration ──────────────────────────────────────────────────────────
OUTPUT_DIR = os.getenv("OUTPUT_ANNOTATED_DIR", "./output/annotated")
ENVIRONMENT = os.getenv("ENVIRONMENT", "demo")
os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs("./output/processed", exist_ok=True)


# ── Request / Response Models ──────────────────────────────────────────────
class AnalysisRequest(BaseModel):
    """Request body for the /analyze endpoint (URL-based file input)."""
    file_url: Optional[str] = None
    isbn: str
    filename: str

    model_config = {
        "json_schema_extra": {
            "example": {
                "file_url": "https://drive.google.com/file/d/xxxxx/view",
                "isbn": "9789373147499",
                "filename": "9789373147499_shabd.pdf"
            }
        }
    }


class HealthResponse(BaseModel):
    status: str
    version: str
    environment: str
    ocr_available: bool
    timestamp: str


# ── Core Pipeline Function ─────────────────────────────────────────────────
def run_full_pipeline(
    image_bytes: bytes,
    filename: str,
    isbn: str,
) -> dict:
    """
    Execute the full CoverGuard AI validation pipeline on a cover image.

    Pipeline stages:
    1. Rasterize (PDF→PNG or PNG load)
    2. Split spread into front + back cover
    3. Compute dynamic DPI from image dimensions
    4. Quality assessment (blur + resolution)
    5. Run OCR (PaddleOCR primary, EasyOCR fallback)
    6. Filter low-confidence text blocks
    7. Compute safe zones (badge zone, margins) from dynamic DPI
    8. Check violations (geometric IoU + proximity)
    9. Make decision (PASS / REVIEW NEEDED)
    10. Annotate image if REVIEW NEEDED
    11. Build correction instructions

    Returns dict matching ValidationResult schema.

    Args:
        image_bytes: Raw file bytes (PDF or PNG)
        filename: Original filename (for ISBN extraction + format detection)
        isbn: Pre-extracted ISBN (from filename)

    Returns:
        dict with all ValidationResult fields
    """
    start_time = time.time()
    logger.info(f"[PIPELINE START] ISBN={isbn} | File={filename}")

    # ── Stage 1: Write bytes to temp file and rasterize ───────────────────
    ext = Path(filename).suffix.lower()
    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
        tmp.write(image_bytes)
        tmp_path = tmp.name

    try:
        raw_image = rasterize_to_image(tmp_path)
        logger.info(f"[S1] Rasterized: {raw_image.shape[1]}x{raw_image.shape[0]}px")
    finally:
        os.unlink(tmp_path)

    # Normalize (ensure RGB)
    raw_image = normalize_image(raw_image)

    # ── Stage 2: Split spread → front cover ───────────────────────────────
    front_cover, back_cover = split_cover_spread(raw_image)
    logger.info(f"[S2] Front cover: {front_cover.shape[1]}x{front_cover.shape[0]}px")

    # ── Stage 3: Dynamic DPI computation ──────────────────────────────────
    dpi = compute_dpi(front_cover)
    logger.info(f"[S3] DPI={dpi:.1f} (computed from height {front_cover.shape[0]}px / 8 inches)")

    # ── Stage 4: Quality assessment ───────────────────────────────────────
    quality = assess_quality(front_cover, dpi)
    logger.info(
        f"[S4] Quality — Laplacian={quality.laplacian_variance:.1f} | "
        f"Blurry={quality.is_blurry} | LowRes={quality.is_low_resolution} | DPI={quality.dpi}"
    )

    # ── Stage 5: OCR text detection ────────────────────────────────────────
    text_blocks, ocr_engine = detect_text(front_cover)
    logger.info(f"[S5] OCR={ocr_engine} | Detected {len(text_blocks)} text blocks")
    for block in text_blocks:
        logger.debug(f"     '{block.text}' conf={block.confidence:.2f} bbox={block.bbox}")

    # ── Stage 6: Compute safe zones (BEFORE filtering, so badge_top is available) ─
    zones = compute_safe_zones(front_cover, dpi)
    zone_polygons = build_zone_polygons(zones)
    badge_top_y = zones.image_h - zones.badge_zone_px
    logger.info(
        f"[S6] Zones — Badge={zones.badge_zone_px}px (top y={badge_top_y}) | "
        f"Margin={zones.margin_px}px | NearMiss={zones.near_miss_px}px"
    )

    # ── Stage 7: Filter low-confidence noise (badge-zone-aware) ───────────
    # Low-confidence blocks NEAR the badge zone are preserved regardless of
    # confidence. This catches calligraphy/decorative fonts where OCR returns
    # a valid bbox but garbled text (e.g., "Parisha Shodhan" → "Waatoics").
    text_blocks = filter_low_confidence_blocks(
        text_blocks,
        threshold=0.30,
        preserve_near_badge=True,
        image_h=zones.image_h,
        badge_top=badge_top_y,
    )
    logger.info(f"[S7] After filtering: {len(text_blocks)} blocks")

    # ── Stage 8: Check violations ────────────────────────────────────
    violations = check_violations(text_blocks, zones, zone_polygons)

    # ── Stage 8b: Text-to-badge-text proximity check ──────────────────────
    # Checks if non-badge text is too close to the badge text itself
    # (not just the mathematical 9mm zone). This catches:
    # - Image 28: calligraphy bbox touches 'Award' with 0mm gap
    # - Image 34: 'PRATIK KOLEKAR' only 5.4mm from badge text line
    crowding_violations = detect_badge_text_crowding(text_blocks, zones)
    if crowding_violations:
        # Only add crowding violations that aren't already caught by zone check
        existing_texts = {v.text for v in violations}
        for cv in crowding_violations:
            if cv.text not in existing_texts:
                violations.append(cv)
                logger.info(f"[S8b] Badge text crowding: '{cv.text}' — {cv.instruction[:60]}...")

    # ── Stage 8c: Edge-based fallback (catches calligraphy / decorative text) ─
    # If no critical violations found by OCR or proximity, check edge density
    has_critical = any(v.severity == "critical" for v in violations)
    if not has_critical:
        edge_violation = detect_edge_intrusion(front_cover, zones)
        if edge_violation:
            violations.insert(0, edge_violation)
            logger.info(f"[S8c] Edge intrusion detected: {edge_violation.instruction[:60]}...")
        else:
            logger.info("[S8c] Edge intrusion check: badge zone clear")

    logger.info(f"[S8] Violations found: {len(violations)}")
    for v in violations:
        logger.info(f"     [{v.severity.upper()}] {v.type} — '{v.text}' — {v.instruction}")

    # ── Stage 9: Decision ─────────────────────────────────────────────────
    decision = make_decision(violations, quality, ocr_engine, len(text_blocks))
    status = decision["status"]
    confidence = decision["confidence"]
    primary_issue = decision["primary_issue"]
    logger.info(f"[S9] Decision: {status} | Confidence: {confidence}% | Primary: {primary_issue}")

    # ── Stage 10: Annotate image (always annotate, even for PASS) ─────────
    annotated = annotate_image(front_cover, violations, zones, status)
    annotated_path = save_annotated_image(annotated, OUTPUT_DIR, isbn)
    logger.info(f"[S10] Annotated image saved: {annotated_path}")

    # ── Stage 11: Build correction text ───────────────────────────────────
    correction_text = build_correction_text(violations, zones) if violations else ""

    # ── Compute processing time ────────────────────────────────────────────
    processing_time_ms = int((time.time() - start_time) * 1000)
    logger.info(f"[PIPELINE DONE] {status} | {processing_time_ms}ms | ISBN={isbn}")

    return {
        "status": status,
        "confidence": confidence,
        "isbn": isbn,
        "filename": filename,
        "primary_issue": primary_issue,
        "violations": [v.model_dump() for v in violations],
        "quality": quality.model_dump(),
        "ocr_engine": ocr_engine,
        "annotated_image_path": annotated_path,
        "correction_text": correction_text,
        "processing_time_ms": processing_time_ms,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        # For interactive frontend bounding boxes
        "image_width":      front_cover.shape[1],
        "image_height":     front_cover.shape[0],
        "badge_zone_y_px":  badge_top_y,
    }


# ── API Endpoints ──────────────────────────────────────────────────────────

@app.get("/", response_model=dict)
async def root():
    """Root endpoint — API info."""
    return {
        "service": "CoverGuard AI Vision Engine",
        "version": "1.0.0",
        "description": "BookLeaf Publishing Automated Book Cover Validation",
        "endpoints": {
            "health": "/health",
            "analyze_upload": "POST /analyze/upload",
            "analyze_url": "POST /analyze",
            "docs": "/docs",
        }
    }


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """
    Health check endpoint.
    Verifies the service is running and core modules are loaded.
    Called by n8n and monitoring tools.
    """
    try:
        from core.ocr_engine import ocr_paddle
        ocr_available = ocr_paddle is not None
    except Exception:
        ocr_available = False

    return HealthResponse(
        status="healthy",
        version="1.0.0",
        environment=ENVIRONMENT,
        ocr_available=ocr_available,
        timestamp=datetime.utcnow().isoformat() + "Z",
    )


@app.get("/analyze/image/{filename}")
async def get_annotated_image(filename: str):
    """
    Serve the generated annotated image by filename.
    """
    # Check if this is already an annotated filename format
    if filename.endswith("_annotated.png"):
        annotated_filename = filename
    else:
        # Replace extension with _annotated.png format as saved by the pipeline
        base_name = os.path.splitext(filename)[0]
        # In case the frontend sent ISBN_name.png, we just want the ISBN part or we just append _annotated
        # Actually, the annotation engine saves it as `{isbn}_annotated.png`
        try:
            isbn = extract_isbn(filename)
            annotated_filename = f"{isbn}_annotated.png"
        except ValueError:
            annotated_filename = f"{base_name}_annotated.png"
            
    file_path = os.path.join(OUTPUT_DIR, annotated_filename)
    
    if os.path.exists(file_path):
        return FileResponse(file_path)
    return JSONResponse(status_code=404, content={"message": "Annotated image not found."})


@app.post("/analyze/upload")
async def analyze_upload(
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = None,
):
    """
    Analyze a book cover uploaded directly as a file.

    This is the PRIMARY endpoint used for:
    - Local testing with sample images
    - Direct uploads without Google Drive
    - Demo mode

    The filename MUST follow the format: ISBN_bookname.ext
    Example: 9789373147499_shabd.pdf

    Returns:
        ValidationResult JSON with status, confidence, violations, and annotated image path.
    """
    filename = file.filename
    logger.info(f"[UPLOAD] Received file: {filename}")

    # ── Validate filename format ───────────────────────────────────────────
    try:
        isbn = extract_isbn(filename)
    except ValueError as e:
        logger.warning(f"[UPLOAD] Invalid filename: {filename} — {e}")
        return JSONResponse(
            status_code=400,
            content={
                "error_type": "FORMAT_ERROR",
                "message": str(e),
                "isbn": None,
                "filename": filename,
            }
        )

    # ── Validate file format ───────────────────────────────────────────────
    ext = Path(filename).suffix.lower()
    if ext not in [".pdf", ".png", ".jpg", ".jpeg"]:
        return JSONResponse(
            status_code=400,
            content={
                "error_type": "UNSUPPORTED_FORMAT",
                "message": f"Unsupported file format: {ext}. Supported: PDF, PNG",
                "isbn": isbn,
                "filename": filename,
            }
        )

    # ── Read file bytes ────────────────────────────────────────────────────
    file_bytes = await file.read()
    if len(file_bytes) < 10_000:  # < 10KB is suspiciously small
        logger.warning(f"[UPLOAD] File too small: {len(file_bytes)} bytes")
        return JSONResponse(
            status_code=400,
            content={
                "error_type": "FILE_TOO_SMALL",
                "message": f"File appears corrupt or too small ({len(file_bytes)} bytes)",
                "isbn": isbn,
                "filename": filename,
            }
        )

    # ── Run pipeline ───────────────────────────────────────────────────────
    try:
        result = run_full_pipeline(file_bytes, filename, isbn)
    except Exception as e:
        logger.error(f"[PIPELINE ERROR] {e}")
        logger.error(traceback.format_exc())
        return JSONResponse(
            status_code=500,
            content={
                "error_type": "PIPELINE_ERROR",
                "message": f"Processing failed: {str(e)}",
                "isbn": isbn,
                "filename": filename,
            }
        )

    # ── Post-processing: Airtable + Email (non-blocking) ──────────────────
    if background_tasks:
        background_tasks.add_task(
            _post_process,
            isbn=isbn,
            result=result,
            annotated_image_path=result.get("annotated_image_path"),
        )

    return JSONResponse(status_code=200, content=result)


@app.post("/analyze")
async def analyze_from_url(
    request: AnalysisRequest,
    background_tasks: BackgroundTasks = None,
):
    """
    Analyze a book cover provided via URL (e.g. Google Drive download URL).

    This is the endpoint called by n8n after detecting a new file in Google Drive.
    n8n downloads the file URL, gets a direct download link, and passes it here.

    The filename in the request MUST follow: ISBN_bookname.ext

    Returns:
        ValidationResult JSON with status, confidence, violations, and annotated image path.
    """
    filename = request.filename
    isbn = request.isbn
    file_url = request.file_url

    logger.info(f"[URL ANALYZE] ISBN={isbn} | File={filename} | URL={file_url}")

    if not file_url:
        return JSONResponse(
            status_code=400,
            content={"error_type": "MISSING_URL", "message": "file_url is required", "isbn": isbn, "filename": filename}
        )

    # ── Download file from URL ─────────────────────────────────────────────
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(file_url)
            response.raise_for_status()
            file_bytes = response.content
            logger.info(f"[URL ANALYZE] Downloaded {len(file_bytes)} bytes")
    except Exception as e:
        logger.error(f"[URL ANALYZE] Download failed: {e}")
        return JSONResponse(
            status_code=502,
            content={
                "error_type": "DOWNLOAD_ERROR",
                "message": f"Could not download file from URL: {str(e)}",
                "isbn": isbn,
                "filename": filename,
            }
        )

    # ── Run pipeline ───────────────────────────────────────────────────────
    try:
        result = run_full_pipeline(file_bytes, filename, isbn)
    except Exception as e:
        logger.error(f"[PIPELINE ERROR] {e}")
        logger.error(traceback.format_exc())
        return JSONResponse(
            status_code=500,
            content={
                "error_type": "PIPELINE_ERROR",
                "message": f"Processing failed: {str(e)}",
                "isbn": isbn,
                "filename": filename,
            }
        )

    # ── Post-processing: Airtable + Email ─────────────────────────────────
    if background_tasks:
        background_tasks.add_task(
            _post_process,
            isbn=isbn,
            result=result,
            annotated_image_path=result.get("annotated_image_path"),
        )

    return JSONResponse(status_code=200, content=result)


async def _post_process(isbn: str, result: dict, annotated_image_path: Optional[str]):
    """
    Background task: Write to Airtable and send email notification.
    Runs AFTER the API response is already sent — doesn't block the client.

    This ensures the author and BookLeaf team are notified regardless of how
    long Airtable or email takes.
    """
    logger.info(f"[POST-PROCESS] Starting background tasks for ISBN={isbn}")
    try:
        # 1. Get author info from Airtable Authors table (or demo fallback)
        author_info = get_author_info(isbn)
        logger.info(f"[POST-PROCESS] Author: {author_info.get('name')} <{author_info.get('email')}>")

        # 2. Check for existing record (revision detection)
        previous_record_id = find_existing_record(isbn)
        if previous_record_id:
            logger.info(f"[POST-PROCESS] Revision detected — previous record: {previous_record_id}")

        # 3. Annotated image URL (for demo: local path; production: CDN URL)
        annotated_url = annotated_image_path or ""

        # 4. Create Airtable record
        from integrations.airtable_client import create_validation_record
        from core.models import ValidationResult, QualityReport, Violation
        
        # Reconstruct ValidationResult from dict for Airtable client
        violations_objs = [Violation(**v) for v in result.get("violations", [])]
        quality_obj = QualityReport(**result.get("quality", {}))
        
        record_id = create_validation_record(
            result=result,
            author_info=author_info,
            annotated_image_url=annotated_url,
            previous_record_id=previous_record_id,
        )
        logger.info(f"[POST-PROCESS] Airtable record created: {record_id}")

        # 5. Send email notification
        status = result.get("status")
        if status == "PASS":
            send_pass_email(author_info, result)
            logger.info(f"[POST-PROCESS] PASS email sent to {author_info.get('email')}")
        else:
            send_review_email(author_info, result, annotated_image_path)
            logger.info(f"[POST-PROCESS] REVIEW email sent to {author_info.get('email')}")

    except Exception as e:
        logger.error(f"[POST-PROCESS ERROR] {e}")
        logger.error(traceback.format_exc())
        # Never raise — post-processing failure should not affect the API response


# ── Error handlers ─────────────────────────────────────────────────────────

@app.exception_handler(404)
async def not_found_handler(request, exc):
    return JSONResponse(
        status_code=404,
        content={"error_type": "NOT_FOUND", "message": f"Endpoint not found: {request.url.path}"}
    )


@app.exception_handler(500)
async def internal_error_handler(request, exc):
    logger.error(f"Unhandled server error: {exc}")
    return JSONResponse(
        status_code=500,
        content={"error_type": "INTERNAL_ERROR", "message": "An unexpected error occurred. Check server logs."}
    )


# ── Startup event ──────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup_event():
    """Verify all modules load correctly on startup."""
    logger.info("=" * 60)
    logger.info("CoverGuard AI Vision Engine — Starting Up")
    logger.info(f"Environment: {ENVIRONMENT}")
    logger.info(f"Output directory: {OUTPUT_DIR}")
    logger.info("=" * 60)

    # Warm up OCR engines (prevent cold start on first request)
    try:
        from core.ocr_engine import ocr_paddle, ocr_easy
        logger.info("OCR engines loaded and ready")
    except Exception as e:
        logger.warning(f"OCR warmup failed (will retry on first request): {e}")


# ── Entry point ────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", 8000)),
        reload=os.getenv("ENVIRONMENT") != "production",
        log_level="info",
    )
