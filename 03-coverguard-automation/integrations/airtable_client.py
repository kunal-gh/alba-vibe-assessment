"""
CoverGuard AI — Airtable Integration Client
=============================================
Handles all Airtable operations: creating records, checking for
existing records (revision detection), and looking up author info.

DEMO MODE: When ENVIRONMENT=demo, all API calls are mocked —
the system logs what it would do and returns fake record IDs.
This allows full demo without real Airtable credentials.
"""

import os
import json
import logging
from datetime import datetime
from typing import Optional

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("coverguard.airtable")

ENVIRONMENT = os.getenv("ENVIRONMENT", "demo")
AIRTABLE_API_KEY = os.getenv("AIRTABLE_API_KEY", "")
AIRTABLE_BASE_ID = os.getenv("AIRTABLE_BASE_ID", "")
AIRTABLE_TABLE_NAME = os.getenv("AIRTABLE_TABLE_NAME", "Cover Validations")
AIRTABLE_AUTHORS_TABLE = os.getenv("AIRTABLE_AUTHORS_TABLE", "Authors")

# ── Demo Author Database ───────────────────────────────────────────────────
# Maps ISBN → author info. Used in demo mode and as fallback.
# Covers all 8 provided sample images from the assignment.
DEMO_AUTHORS = {
    "9789373147499": {"name": "Parisha Shodhan", "email": "parisha@demo.com", "book": "Shabd"},
    "9789898652616": {"name": "Parisha Shodhan", "email": "parisha@demo.com", "book": "Shabd"},
    "9789898652753": {"name": "Pulak Das",        "email": "pulak@demo.com",   "book": "Offline Sorrows Online Ghosts"},
    "9789373147994": {"name": "Benny James SDB",  "email": "benny@demo.com",   "book": "Echoes Along the Way"},
    "9789898652364": {"name": "Benny James SDB",  "email": "benny@demo.com",   "book": "Echoes Along the Way"},
    "9789373147765": {"name": "Pratik Kolekar",   "email": "pratik@demo.com",  "book": "Inner Mirror"},
    "9789373145068": {"name": "Ojal Jain",         "email": "ojal@demo.com",    "book": "Tainted By Emotion"},
}
DEMO_AUTHORS_DEFAULT = {"name": "Author", "email": "author@bookleafpub.com", "book": "Unknown"}


def get_author_info(isbn: str) -> dict:
    """
    Look up author name, email, and book title for a given ISBN.

    In demo mode: returns from hardcoded DEMO_AUTHORS dict.
    In production: queries the Airtable Authors table.

    Args:
        isbn: 10 or 13 digit ISBN string

    Returns:
        Dict with keys: name, email, book
    """
    # Always try demo dict first (covers sample images)
    if isbn in DEMO_AUTHORS:
        info = DEMO_AUTHORS[isbn]
        logger.info(f"Author lookup (demo): {info['name']} for ISBN {isbn}")
        return info

    if ENVIRONMENT == "demo" or not AIRTABLE_API_KEY:
        logger.info(f"Author not in demo dict for ISBN {isbn} — using default")
        return {**DEMO_AUTHORS_DEFAULT, "isbn": isbn}

    # Production: query Airtable Authors table
    try:
        from pyairtable import Api
        api = Api(AIRTABLE_API_KEY)
        table = api.table(AIRTABLE_BASE_ID, AIRTABLE_AUTHORS_TABLE)
        records = table.all(formula=f"{{ISBN}} = '{isbn}'")

        if records:
            fields = records[0]["fields"]
            return {
                "name":  fields.get("Author Name", "Author"),
                "email": fields.get("Author Email", "author@bookleafpub.com"),
                "book":  fields.get("Book Title", "Unknown"),
            }
    except Exception as e:
        logger.warning(f"Airtable author lookup failed for ISBN {isbn}: {e}")

    return {**DEMO_AUTHORS_DEFAULT, "isbn": isbn}


def find_existing_record(isbn: str) -> Optional[str]:
    """
    Check if an Airtable record already exists for this ISBN.

    Used for revision tracking — if a cover was already submitted and
    flagged, we link the new record to the previous one.

    Args:
        isbn: ISBN to search for

    Returns:
        Airtable record ID if found, None otherwise
    """
    if ENVIRONMENT == "demo" or not AIRTABLE_API_KEY:
        logger.info(f"Demo mode: assuming no prior record for ISBN {isbn}")
        return None

    try:
        from pyairtable import Api
        api = Api(AIRTABLE_API_KEY)
        table = api.table(AIRTABLE_BASE_ID, AIRTABLE_TABLE_NAME)

        # Search for existing record with same ISBN
        records = table.all(formula=f"{{Book ID (ISBN)}} = '{isbn}'")

        if records:
            record_id = records[0]["id"]
            logger.info(f"Found existing record for ISBN {isbn}: {record_id}")
            return record_id

        return None

    except Exception as e:
        logger.warning(f"Airtable record search failed for ISBN {isbn}: {e}")
        return None


def create_validation_record(
    result: dict,
    author_info: dict,
    annotated_image_url: str,
    previous_record_id: Optional[str] = None,
) -> str:
    """
    Create a new validation record in Airtable.

    Field mapping follows the exact schema required by the assignment:
    - Book ID (ISBN), Detection Timestamp, Issue Type, Severity,
      Status, Confidence Score, Visual Annotations URL,
      Correction Instructions, Revision Tracking

    In demo mode: prints a formatted record to the console and returns
    a fake record ID for testing the full pipeline.

    Args:
        result: ValidationResult dict from the pipeline
        author_info: Author info dict from get_author_info()
        annotated_image_url: URL or path to the annotated image
        previous_record_id: Airtable record ID of prior submission (for revision tracking)

    Returns:
        Airtable record ID (real in production, 'DEMO_RECORD_...' in demo)
    """
    isbn = result.get("isbn", "unknown")
    violations = result.get("violations", [])

    # Build field values
    issue_types = list(set(v["type"] for v in violations)) if violations else ["none"]
    worst_severity = "info"
    if violations:
        severity_order = {"critical": 0, "major": 1, "minor": 2, "info": 3}
        worst_severity = min(violations, key=lambda v: severity_order.get(v["severity"], 99))["severity"]

    fields = {
        "Book ID (ISBN)":         isbn,
        "Detection Timestamp":    result.get("timestamp", datetime.utcnow().isoformat() + "Z"),
        "Issue Type":             issue_types,
        "Severity":               worst_severity,
        "Status":                 result.get("status", "REVIEW NEEDED"),
        "Confidence Score":       result.get("confidence", 0),
        "Visual Annotations URL": annotated_image_url or "",
        "Correction Instructions": result.get("correction_text", ""),
        "Author Name":            author_info.get("name", "Unknown"),
        "Author Email":           author_info.get("email", ""),
        "Book Title":             author_info.get("book", "Unknown"),
        "Processing Time (ms)":   result.get("processing_time_ms", 0),
        "OCR Engine":             result.get("ocr_engine", "unknown"),
    }

    # Add revision link if this is a resubmission
    if previous_record_id:
        fields["Previous Revision"] = [previous_record_id]

    # ── Demo mode: log and return fake ID ─────────────────────────────────
    if ENVIRONMENT == "demo" or not AIRTABLE_API_KEY:
        logger.info("Demo mode: Airtable record (would create):")
        logger.info(json.dumps(fields, indent=2, ensure_ascii=False))

        print("\n" + "=" * 60)
        print("  AIRTABLE RECORD (DEMO MODE)")
        print("=" * 60)
        for key, value in fields.items():
            val_str = str(value)[:80] + ("..." if len(str(value)) > 80 else "")
            print(f"  {key:<30}: {val_str}")
        if previous_record_id:
            print(f"  {'Previous Revision':<30}: {previous_record_id}")
        print("=" * 60 + "\n")

        return f"DEMO_RECORD_{isbn}"

    # ── Production mode: create real Airtable record ───────────────────────
    try:
        from pyairtable import Api
        api = Api(AIRTABLE_API_KEY)
        table = api.table(AIRTABLE_BASE_ID, AIRTABLE_TABLE_NAME)

        record = table.create(fields)
        record_id = record["id"]

        logger.info(f"Airtable record created: {record_id} for ISBN {isbn}")
        return record_id

    except Exception as e:
        logger.error(f"Airtable record creation failed: {e}")
        # Don't crash — return error indicator
        return f"ERROR_{isbn}"


def update_record_status(
    record_id: str,
    new_status: str,
    reviewer_notes: str = "",
) -> bool:
    """
    Update an existing Airtable record's status (for human review override).

    Used when a reviewer approves or rejects a cover through the QA interface.

    Args:
        record_id: Airtable record ID to update
        new_status: New status value ('PASS' or 'REVIEW NEEDED')
        reviewer_notes: Optional notes from the human reviewer

    Returns:
        True if update succeeded, False if failed
    """
    if ENVIRONMENT == "demo" or not AIRTABLE_API_KEY:
        logger.info(f"Demo mode: would update record {record_id} → status={new_status}")
        return True

    try:
        from pyairtable import Api
        api = Api(AIRTABLE_API_KEY)
        table = api.table(AIRTABLE_BASE_ID, AIRTABLE_TABLE_NAME)

        update_fields = {"Status": new_status}
        if reviewer_notes:
            update_fields["Reviewer Notes"] = reviewer_notes

        table.update(record_id, update_fields)
        logger.info(f"Record {record_id} updated: status={new_status}")
        return True

    except Exception as e:
        logger.error(f"Failed to update record {record_id}: {e}")
        return False
