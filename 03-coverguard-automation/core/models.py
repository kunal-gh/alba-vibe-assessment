"""
CoverGuard AI — Core Data Models
==================================
Pydantic v2 models used throughout the pipeline.
All modules import from here — single source of truth for data shapes.
"""

from __future__ import annotations
from typing import Optional, Literal
from pydantic import BaseModel, Field, field_validator
from datetime import datetime


class QualityReport(BaseModel):
    """Image quality assessment results from the preprocessing stage."""
    laplacian_variance: float = Field(
        ..., description="OpenCV Laplacian variance — lower means blurrier. < 50 = blurry."
    )
    is_blurry: bool = Field(..., description="True if laplacian_variance < 50")
    dpi: float = Field(..., description="Dynamically computed DPI from image dimensions")
    is_low_resolution: bool = Field(..., description="True if DPI < 72")
    notes: str = Field(default="", description="Human-readable quality notes")

    model_config = {
        "json_schema_extra": {
            "example": {
                "laplacian_variance": 312.4,
                "is_blurry": False,
                "dpi": 97.8,
                "is_low_resolution": False,
                "notes": "Good quality image at ~98 DPI"
            }
        }
    }


class TextBlock(BaseModel):
    """A single detected text region from OCR."""
    text: str = Field(..., description="Detected text content")
    bbox: list[int] = Field(
        ..., description="Axis-aligned bounding box [x1, y1, x2, y2] in pixels",
        min_length=4, max_length=4
    )
    confidence: float = Field(
        ..., ge=0.0, le=1.0, description="OCR confidence score 0.0–1.0"
    )
    source: str = Field(
        default="paddleocr",
        description="Which OCR engine detected this block: 'paddleocr' or 'easyocr'"
    )

    @field_validator("bbox")
    @classmethod
    def validate_bbox(cls, v: list[int]) -> list[int]:
        if len(v) != 4:
            raise ValueError("bbox must have exactly 4 elements: [x1, y1, x2, y2]")
        x1, y1, x2, y2 = v
        if x2 <= x1 or y2 <= y1:
            raise ValueError(f"Invalid bbox dimensions: x2({x2}) must > x1({x1}), y2({y2}) must > y1({y1})")
        return v


class Violation(BaseModel):
    """A detected layout violation on the book cover."""
    type: Literal["badge_overlap", "near_miss", "margin_violation", "low_resolution", "text_alignment"] = Field(
        ..., description="Type of violation detected"
    )
    severity: Literal["critical", "major", "minor", "info"] = Field(
        ..., description="Severity level: critical=must fix, major=should fix, minor=review"
    )
    text: str = Field(..., description="The offending text content")
    bbox: list[int] = Field(
        ..., description="Bounding box of the offending text [x1, y1, x2, y2]"
    )
    iou: float = Field(
        default=0.0, ge=0.0, le=1.0,
        description="Intersection over Union with badge zone (for badge_overlap type)"
    )
    overlap_mm: float = Field(
        default=0.0, ge=0.0,
        description="Overlap depth in millimeters (for badge_overlap type)"
    )
    distance_mm: float = Field(
        default=0.0,
        description="Distance from text bottom to badge zone top in mm (for near_miss type)"
    )
    instruction: str = Field(
        ..., description="Human-readable correction instruction for this specific violation"
    )
    side: Optional[str] = Field(
        default=None,
        description="Which side (left/right) for margin_violation type"
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "type": "badge_overlap",
                "severity": "critical",
                "text": "Parisha Shodhan",
                "bbox": [420, 740, 720, 770],
                "iou": 0.82,
                "overlap_mm": 6.2,
                "distance_mm": 0.0,
                "instruction": "Move 'Parisha Shodhan' up by at least 9.2mm to clear the award badge zone.",
                "side": None
            }
        }
    }


class SafeZones(BaseModel):
    """Computed pixel boundaries for all safe zones on the front cover."""
    badge_zone_px: int = Field(
        ..., description="Height in pixels of the badge zone from the bottom (9mm converted)"
    )
    near_miss_px: int = Field(
        ..., description="Height in pixels of the near-miss buffer above badge zone (3mm converted)"
    )
    margin_px: int = Field(
        ..., description="Width in pixels of left/right margins (3mm converted)"
    )
    image_h: int = Field(..., description="Full image height in pixels")
    image_w: int = Field(..., description="Full image width in pixels")
    dpi: float = Field(..., description="Computed DPI used for all calculations")


class AnalysisRequest(BaseModel):
    """Request body for POST /analyze endpoint."""
    file_url: Optional[str] = Field(
        default=None,
        description="Direct download URL for the book cover file"
    )
    isbn: str = Field(..., description="13-digit (or 10-digit) ISBN extracted from filename")
    filename: str = Field(
        ..., description="Original filename following BookLeaf convention: ISBN_bookname.ext"
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "file_url": "https://drive.google.com/uc?id=xxxxx&export=download",
                "isbn": "9789373147499",
                "filename": "9789373147499_shabd.pdf"
            }
        }
    }


class ValidationResult(BaseModel):
    """Complete validation result returned by the pipeline."""
    status: Literal["PASS", "REVIEW NEEDED"] = Field(
        ..., description="Final decision: PASS means all clear, REVIEW NEEDED means action required"
    )
    confidence: int = Field(
        ..., ge=0, le=100,
        description="Confidence score 0-100%. High = more certain of decision."
    )
    isbn: str = Field(..., description="ISBN extracted from filename")
    filename: str = Field(..., description="Original uploaded filename")
    primary_issue: Optional[str] = Field(
        default=None,
        description="Most critical issue type detected, or None if PASS"
    )
    violations: list[Violation] = Field(
        default_factory=list,
        description="List of all detected violations, sorted by severity (critical first)"
    )
    quality: QualityReport = Field(..., description="Image quality assessment")
    ocr_engine: str = Field(
        ..., description="Which OCR engine was used: 'paddleocr' or 'easyocr'"
    )
    annotated_image_path: Optional[str] = Field(
        default=None,
        description="Local file path to the annotated image with violations highlighted"
    )
    correction_text: str = Field(
        default="",
        description="Numbered correction instructions for the author"
    )
    processing_time_ms: int = Field(
        ..., description="Total pipeline processing time in milliseconds"
    )
    timestamp: str = Field(
        ..., description="ISO 8601 UTC timestamp of when the analysis was completed"
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "status": "REVIEW NEEDED",
                "confidence": 5,
                "isbn": "9789373147499",
                "filename": "9789373147499_shabd.pdf",
                "primary_issue": "badge_overlap",
                "violations": [],
                "quality": {
                    "laplacian_variance": 187.3,
                    "is_blurry": False,
                    "dpi": 97.8,
                    "is_low_resolution": False,
                    "notes": ""
                },
                "ocr_engine": "paddleocr",
                "annotated_image_path": "./output/annotated/9789373147499_annotated.png",
                "correction_text": "1. Move author name up by at least 9mm.",
                "processing_time_ms": 5100,
                "timestamp": "2026-05-27T06:00:00Z"
            }
        }
    }


class ErrorResponse(BaseModel):
    """Standard error response returned by all error handlers."""
    error_type: str = Field(
        ...,
        description="Error category: FORMAT_ERROR, UNSUPPORTED_FORMAT, FILE_TOO_SMALL, PIPELINE_ERROR, etc."
    )
    message: str = Field(..., description="Human-readable error description")
    isbn: Optional[str] = Field(default=None, description="ISBN if available")
    filename: Optional[str] = Field(default=None, description="Filename if available")
