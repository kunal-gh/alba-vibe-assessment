"""
CoverGuard AI — Email Notification Client
==========================================
Sends personalized HTML emails to authors via Gmail SMTP.

Two email types:
1. PASS: Celebratory, green-themed, confirms cover proceeds to print
2. REVIEW NEEDED: Amber/red-themed, specific issues, numbered correction steps

Uses Python stdlib smtplib — no external email library required.
All HTML templates are built as inline-CSS strings (email client compatibility).

DEMO MODE: When SEND_EMAILS=false, the system logs the email content
to console instead of actually sending. Perfect for demo/testing.
"""

import os
import smtplib
import logging
from datetime import datetime, timedelta
from typing import Optional
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("coverguard.email")

GMAIL_USER         = os.getenv("GMAIL_USER", "")
GMAIL_APP_PASSWORD = os.getenv("GMAIL_APP_PASSWORD", "")
FROM_NAME          = os.getenv("EMAIL_FROM_NAME", "BookLeaf Publishing QA Team")
SEND_EMAILS        = os.getenv("SEND_EMAILS", "false").lower() == "true"


def _resubmission_deadline() -> str:
    """Return a resubmission deadline 5 business days from today."""
    deadline = datetime.now()
    days_added = 0
    while days_added < 5:
        deadline += timedelta(days=1)
        if deadline.weekday() < 5:  # Monday–Friday
            days_added += 1
    return deadline.strftime("%B %d, %Y")


def build_pass_html(author_info: dict, result: dict) -> str:
    """
    Build the complete HTML body for a PASS email.

    Design: Green-themed, celebratory, professional.
    All CSS is inline for email client compatibility.

    Args:
        author_info: Dict with name, email, book
        result: ValidationResult dict

    Returns:
        Complete HTML string
    """
    author_name = author_info.get("name", "Author")
    book_title  = author_info.get("book", "Your Book")
    isbn        = result.get("isbn", "")
    dpi         = result.get("quality", {}).get("dpi", 0)
    confidence  = result.get("confidence", 0)
    timestamp   = result.get("timestamp", "")[:10]

    html = f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Cover Approved - BookLeaf Publishing</title></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:20px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">

  <!-- Header -->
  <tr><td style="background:#1a1a2e;padding:30px 40px;text-align:center;">
    <h1 style="color:#e94560;margin:0;font-size:24px;letter-spacing:2px;">BOOKLEAF PUBLISHING</h1>
    <p style="color:#a0a0b0;margin:6px 0 0;font-size:13px;">Quality Assurance System</p>
  </td></tr>

  <!-- Status Banner -->
  <tr><td style="background:#27ae60;padding:20px 40px;text-align:center;">
    <p style="color:#ffffff;font-size:28px;font-weight:bold;margin:0;">&#10003; COVER APPROVED</p>
    <p style="color:#d5f5e3;font-size:14px;margin:6px 0 0;">All quality checks passed successfully</p>
  </td></tr>

  <!-- Body -->
  <tr><td style="padding:35px 40px;">
    <p style="font-size:16px;color:#333;margin:0 0 20px;">Hi <strong>{author_name}</strong>,</p>
    <p style="font-size:15px;color:#555;line-height:1.6;margin:0 0 25px;">
      Great news! Your book cover for <strong>"{book_title}"</strong> (ISBN: {isbn}) has
      successfully passed our automated quality check. Your cover is now approved to proceed
      to the next stage of production.
    </p>

    <!-- Checklist -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#eafaf1;border-radius:6px;padding:20px;margin:0 0 25px;">
      <tr><td style="font-size:14px;color:#333;">
        <p style="margin:0 0 10px;font-weight:bold;color:#27ae60;">What We Verified:</p>
        <p style="margin:5px 0;">&#10003; &nbsp;<strong>Award Badge Zone (9mm)</strong> — Clear, no text overlap</p>
        <p style="margin:5px 0;">&#10003; &nbsp;<strong>Side Margins (3mm each)</strong> — All text within safe area</p>
        <p style="margin:5px 0;">&#10003; &nbsp;<strong>Author Name Positioning</strong> — Correctly placed above badge</p>
        <p style="margin:5px 0;">&#10003; &nbsp;<strong>Image Resolution</strong> — {dpi:.0f} DPI ({('Good' if dpi >= 72 else 'Acceptable')})</p>
        <p style="margin:5px 0;">&#10003; &nbsp;<strong>Text Legibility</strong> — Clear and readable</p>
      </td></tr>
    </table>

    <!-- Details -->
    <table width="100%" cellpadding="8" cellspacing="0" style="border:1px solid #eee;border-radius:6px;margin:0 0 25px;">
      <tr style="background:#f8f9fa;"><td style="font-size:13px;color:#666;padding:10px 15px;"><strong>ISBN:</strong></td><td style="font-size:13px;color:#333;padding:10px 15px;">{isbn}</td></tr>
      <tr><td style="font-size:13px;color:#666;padding:10px 15px;"><strong>Book Title:</strong></td><td style="font-size:13px;color:#333;padding:10px 15px;">{book_title}</td></tr>
      <tr style="background:#f8f9fa;"><td style="font-size:13px;color:#666;padding:10px 15px;"><strong>Check Date:</strong></td><td style="font-size:13px;color:#333;padding:10px 15px;">{timestamp}</td></tr>
      <tr><td style="font-size:13px;color:#666;padding:10px 15px;"><strong>Confidence:</strong></td><td style="font-size:13px;color:#27ae60;padding:10px 15px;font-weight:bold;">{confidence}%</td></tr>
    </table>

    <p style="font-size:15px;color:#555;line-height:1.6;">
      Thank you for working with BookLeaf Publishing. We're excited to help bring your
      book to readers around the world!
    </p>
  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#1a1a2e;padding:25px 40px;text-align:center;">
    <p style="color:#a0a0b0;font-size:13px;margin:0 0 8px;">BookLeaf Publishing QA Team</p>
    <p style="margin:0;"><a href="mailto:support@bookleafpub.com" style="color:#e94560;font-size:13px;text-decoration:none;">support@bookleafpub.com</a></p>
    <p style="color:#606070;font-size:12px;margin:8px 0 0;">India &nbsp;|&nbsp; USA &nbsp;|&nbsp; UK &nbsp;|&nbsp; www.bookleafpub.com</p>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>"""

    return html


def build_review_html(author_info: dict, result: dict) -> str:
    """
    Build the complete HTML body for a REVIEW NEEDED email.

    Design: Amber/red-themed, helpful, actionable, specific.
    Lists exact violations with measurements and numbered fix steps.

    Args:
        author_info: Dict with name, email, book
        result: ValidationResult dict

    Returns:
        Complete HTML string
    """
    author_name  = author_info.get("name", "Author")
    book_title   = author_info.get("book", "Your Book")
    isbn         = result.get("isbn", "")
    violations   = result.get("violations", [])
    deadline     = _resubmission_deadline()
    timestamp    = result.get("timestamp", "")[:10]

    # Build violations table rows
    violation_rows = ""
    for v in violations:
        severity_colors = {
            "critical": "#e74c3c",
            "major": "#e67e22",
            "minor": "#f39c12",
            "info": "#3498db",
        }
        color = severity_colors.get(v.get("severity", "info"), "#999")
        vtype = v.get("type", "").replace("_", " ").title()
        text  = v.get("text", "")[:50]
        sev   = v.get("severity", "info").upper()

        violation_rows += f"""
        <tr>
          <td style="padding:10px 15px;border-bottom:1px solid #eee;">
            <span style="background:{color};color:white;padding:2px 8px;border-radius:3px;font-size:11px;font-weight:bold;">{sev}</span>
            &nbsp; {vtype}
          </td>
          <td style="padding:10px 15px;border-bottom:1px solid #eee;font-size:13px;color:#555;">"{text}"</td>
        </tr>"""

    # Build correction steps
    correction_text = result.get("correction_text", "")
    correction_lines = correction_text.split("\n") if correction_text else []
    correction_html = ""
    for line in correction_lines:
        line = line.strip()
        if not line:
            correction_html += "<br>"
        elif line.startswith("Step "):
            correction_html += f'<p style="font-weight:bold;color:#c0392b;margin:15px 0 5px;">{line}</p>'
        elif line.startswith("  "):
            correction_html += f'<p style="margin:3px 0 3px 20px;font-size:13px;color:#555;">{line.strip()}</p>'
        else:
            correction_html += f'<p style="margin:5px 0;font-size:13px;color:#444;">{line}</p>'

    html = f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Cover Revision Required - BookLeaf Publishing</title></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:20px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">

  <!-- Header -->
  <tr><td style="background:#1a1a2e;padding:30px 40px;text-align:center;">
    <h1 style="color:#e94560;margin:0;font-size:24px;letter-spacing:2px;">BOOKLEAF PUBLISHING</h1>
    <p style="color:#a0a0b0;margin:6px 0 0;font-size:13px;">Quality Assurance System</p>
  </td></tr>

  <!-- Status Banner -->
  <tr><td style="background:#c0392b;padding:20px 40px;text-align:center;">
    <p style="color:#ffffff;font-size:26px;font-weight:bold;margin:0;">&#9888; ACTION REQUIRED</p>
    <p style="color:#f5b7b1;font-size:14px;margin:6px 0 0;">Cover revision needed before proceeding to print</p>
  </td></tr>

  <!-- Body -->
  <tr><td style="padding:35px 40px;">
    <p style="font-size:16px;color:#333;margin:0 0 20px;">Hi <strong>{author_name}</strong>,</p>
    <p style="font-size:15px;color:#555;line-height:1.6;margin:0 0 25px;">
      Thank you for submitting your cover for <strong>"{book_title}"</strong> (ISBN: {isbn}).
      During our automated quality check, we identified <strong>{len(violations)} issue(s)</strong>
      that must be resolved before we can proceed to print.
    </p>

    <!-- Issues Table -->
    <p style="font-size:14px;font-weight:bold;color:#333;margin:0 0 10px;">Issues Detected:</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:6px;overflow:hidden;margin:0 0 25px;">
      <tr style="background:#f8f9fa;">
        <th style="padding:10px 15px;text-align:left;font-size:13px;color:#666;border-bottom:2px solid #eee;">Issue Type</th>
        <th style="padding:10px 15px;text-align:left;font-size:13px;color:#666;border-bottom:2px solid #eee;">Text Affected</th>
      </tr>
      {violation_rows}
    </table>

    <!-- Visual Note -->
    <div style="background:#fff3cd;border-left:4px solid #f39c12;padding:12px 16px;border-radius:0 4px 4px 0;margin:0 0 25px;">
      <p style="margin:0;font-size:13px;color:#856404;">
        <strong>Tip:</strong> We have generated an annotated image showing the exact location of
        each issue highlighted in red. Please refer to the attached image.
      </p>
    </div>

    <!-- Correction Steps -->
    <p style="font-size:14px;font-weight:bold;color:#333;margin:0 0 10px;">How to Fix:</p>
    <div style="background:#fdf2f2;border-radius:6px;padding:20px;margin:0 0 25px;">
      {correction_html}
    </div>

    <!-- Resubmission -->
    <div style="background:#eaf6ff;border-radius:6px;padding:20px;margin:0 0 25px;">
      <p style="margin:0 0 10px;font-weight:bold;color:#1a5276;">How to Resubmit:</p>
      <p style="margin:5px 0;font-size:13px;color:#555;">1. Make the corrections listed above in your design software.</p>
      <p style="margin:5px 0;font-size:13px;color:#555;">2. Export your cover as PDF or PNG at 300 DPI or higher.</p>
      <p style="margin:5px 0;font-size:13px;color:#555;">3. Rename the file: <code style="background:#e8e8e8;padding:2px 6px;border-radius:3px;">{isbn}_bookname.pdf</code></p>
      <p style="margin:5px 0;font-size:13px;color:#555;">4. Upload to the same Google Drive folder.</p>
      <p style="margin:15px 0 0;font-size:13px;color:#c0392b;font-weight:bold;">
        &#128197; Please resubmit by: <strong>{deadline}</strong>
      </p>
    </div>

    <p style="font-size:14px;color:#555;margin:0 0 5px;">Need help? We're here for you:</p>
    <p style="font-size:14px;margin:0;">
      <a href="mailto:support@bookleafpub.com" style="color:#e94560;text-decoration:none;font-weight:bold;">support@bookleafpub.com</a>
    </p>
  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#1a1a2e;padding:25px 40px;text-align:center;">
    <p style="color:#a0a0b0;font-size:13px;margin:0 0 8px;">BookLeaf Publishing QA Team</p>
    <p style="margin:0;"><a href="mailto:support@bookleafpub.com" style="color:#e94560;font-size:13px;text-decoration:none;">support@bookleafpub.com</a></p>
    <p style="color:#606070;font-size:12px;margin:8px 0 0;">India &nbsp;|&nbsp; USA &nbsp;|&nbsp; UK &nbsp;|&nbsp; www.bookleafpub.com</p>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>"""

    return html


def _send_email(
    to_email: str,
    subject: str,
    html_body: str,
    attachments: list[str] = None,
) -> bool:
    """
    Send an HTML email via Gmail SMTP.

    Uses STARTTLS (port 587) for encrypted connection.
    Attaches files if provided (annotated cover images).

    Args:
        to_email: Recipient email address
        subject: Email subject line
        html_body: Complete HTML email body
        attachments: List of file paths to attach

    Returns:
        True if sent successfully, False if failed (never raises)
    """
    if not SEND_EMAILS:
        logger.info(f"Demo mode: would send email to {to_email}")
        logger.info(f"Subject: {subject}")
        print(f"\n[EMAIL PREVIEW — Demo Mode]")
        print(f"  To:      {to_email}")
        print(f"  Subject: {subject}")
        print(f"  Body:    (HTML — {len(html_body)} chars)")
        return True

    if not GMAIL_USER or not GMAIL_APP_PASSWORD:
        logger.error("Gmail credentials not configured (GMAIL_USER + GMAIL_APP_PASSWORD)")
        return False

    try:
        msg = MIMEMultipart("mixed")
        msg["From"]    = f"{FROM_NAME} <{GMAIL_USER}>"
        msg["To"]      = to_email
        msg["Subject"] = subject

        # Attach HTML body
        msg.attach(MIMEText(html_body, "html", "utf-8"))

        # Attach files if provided
        if attachments:
            for filepath in attachments:
                if filepath and os.path.exists(filepath):
                    with open(filepath, "rb") as f:
                        part = MIMEBase("application", "octet-stream")
                        part.set_payload(f.read())
                    encoders.encode_base64(part)
                    filename = os.path.basename(filepath)
                    part.add_header("Content-Disposition", f"attachment; filename={filename}")
                    msg.attach(part)

        # Send via Gmail SMTP with STARTTLS
        with smtplib.SMTP("smtp.gmail.com", 587, timeout=15) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(GMAIL_USER, GMAIL_APP_PASSWORD)
            server.sendmail(GMAIL_USER, to_email, msg.as_string())

        logger.info(f"Email sent successfully to {to_email}")
        return True

    except smtplib.SMTPAuthenticationError:
        logger.error("Gmail authentication failed — check GMAIL_APP_PASSWORD")
        return False
    except smtplib.SMTPException as e:
        logger.error(f"SMTP error sending to {to_email}: {e}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error sending email to {to_email}: {e}")
        return False


def send_pass_email(author_info: dict, result: dict) -> bool:
    """
    Send a congratulatory PASS email to the author.

    Args:
        author_info: Dict with name, email, book
        result: ValidationResult dict

    Returns:
        True if sent (or demo-logged), False if failed
    """
    to_email   = author_info.get("email", "")
    book_title = author_info.get("book", "Your Book")
    isbn       = result.get("isbn", "")

    if not to_email:
        logger.warning(f"No email address for ISBN {isbn} — cannot send PASS email")
        return False

    subject  = f"Your Cover Has Passed Quality Check - {book_title} | BookLeaf Publishing"
    html     = build_pass_html(author_info, result)

    logger.info(f"Sending PASS email to {to_email} for ISBN {isbn}")
    return _send_email(to_email, subject, html)


def send_review_email(
    author_info: dict,
    result: dict,
    annotated_image_path: Optional[str] = None,
) -> bool:
    """
    Send a REVIEW NEEDED email with specific correction instructions.

    Attaches the annotated image if it exists so authors can see
    exactly where the violations are without any ambiguity.

    Args:
        author_info: Dict with name, email, book
        result: ValidationResult dict
        annotated_image_path: Path to annotated cover image (may be None)

    Returns:
        True if sent (or demo-logged), False if failed
    """
    to_email   = author_info.get("email", "")
    book_title = author_info.get("book", "Your Book")
    isbn       = result.get("isbn", "")

    if not to_email:
        logger.warning(f"No email address for ISBN {isbn} — cannot send REVIEW email")
        return False

    subject = f"Action Required: Cover Revision Needed - {book_title} | BookLeaf Publishing"
    html    = build_review_html(author_info, result)

    # Attach annotated image if it exists
    attachments = []
    if annotated_image_path and os.path.exists(annotated_image_path):
        attachments.append(annotated_image_path)
        logger.info(f"Attaching annotated image: {annotated_image_path}")

    logger.info(f"Sending REVIEW NEEDED email to {to_email} for ISBN {isbn}")
    return _send_email(to_email, subject, html, attachments)
