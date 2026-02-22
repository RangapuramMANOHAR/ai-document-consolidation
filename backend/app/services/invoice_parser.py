"""Invoice parsing from extracted text. Regex fallback extraction of key fields."""

import re
from datetime import date
from decimal import Decimal


def parse_invoice_from_text(text: str) -> dict:
    """
    Extract invoice_number, vendor_name, total_amount, currency from text.
    Returns a normalized dict with all fields required for Invoice (defaults for rest).
    When vendor_name is taken from "Sold By:" and invoice_number from "Invoice Number",
    sets _anchors_used so ingestion can mark processing_status = SUCCESS.
    """
    text = (text or "").strip()
    invoice_number, inv_from_anchor = _extract_invoice_number(text)
    vendor_name, vendor_from_anchor = _extract_vendor_name(text)
    total_amount = _extract_total_amount(text)
    currency = _extract_currency(text)
    # Subtotal/tax simulation when we only have total
    subtotal = total_amount * Decimal("0.9")
    tax = total_amount * Decimal("0.1")
    result = {
        "invoice_number": invoice_number,
        "vendor_name": vendor_name,
        "invoice_date": date.today(),
        "subtotal_amount": subtotal,
        "tax_amount": tax,
        "total_amount": total_amount,
        "currency": currency,
        "payment_status": "pending",
    }
    if vendor_from_anchor and inv_from_anchor:
        result["_anchors_used"] = True
    return result


def _extract_invoice_number(text: str) -> tuple[str, bool]:
    """
    Try to find invoice number. Prefer capture after "Invoice Number" (allow # and spaces).
    Returns (value, from_anchor).
    """
    if not text:
        return "UNKNOWN", False
    # Anchor: "Invoice Number" or "Invoice # Number" etc., then value until newline
    m = re.search(
        r"Invoice\s*#?\s*Number\s*[:\s]*([^\n]+)",
        text,
        re.I,
    )
    if m:
        val = m.group(1).strip()
        if val:
            return val[:100], True
    # Fallbacks
    m = re.search(r"(?:invoice\s*#?|no\.?)\s*([A-Z0-9\-]+)", text, re.I)
    if m:
        return m.group(1).strip(), False
    m = re.search(r"\b(INV[-_]?\d+)\b", text, re.I)
    if m:
        return m.group(1), False
    first_line = text.split("\n")[0].strip()
    if first_line and len(first_line) < 50:
        return first_line[:50], False
    return "UNKNOWN", False


def _extract_vendor_name(text: str) -> tuple[str, bool]:
    """
    Try to find vendor/seller name. Prefer capture after "Sold By:" until comma or newline.
    Returns (value, from_anchor).
    """
    if not text:
        return "Unknown Vendor", False
    # Anchor: Sold By: ... until comma or newline
    m = re.search(r"Sold\s+By\s*:\s*(.+?)(?:,|\n|$)", text, re.I)
    if m:
        val = m.group(1).strip()
        if val:
            return val[:200], True
    # Fallbacks
    m = re.search(r"(?:from|vendor|seller):\s*(.+?)(?:\n|$)", text, re.I | re.DOTALL)
    if m:
        return m.group(1).strip().split("\n")[0][:200], False
    lines = [ln.strip() for ln in text.split("\n") if ln.strip()]
    if len(lines) >= 2:
        return lines[1][:200], False
    if lines:
        return lines[0][:200], False
    return "Unknown Vendor", False


def _extract_total_amount(text: str) -> Decimal:
    """
    Prefer "Grand Total" line; else pick the last ₹ <number> near the bottom.
    """
    if not text:
        return Decimal("0")

    def _parse_amount(s: str) -> Decimal | None:
        s = s.replace(",", "").strip()
        try:
            return Decimal(s)
        except Exception:
            return None

    # Prefer Grand Total line
    m = re.search(
        r"Grand\s*Total\s*[:\s]*₹?\s*([\d,]+\.?\d*)",
        text,
        re.I,
    )
    if m:
        amt = _parse_amount(m.group(1))
        if amt is not None:
            return amt

    # Else: last ₹ <number> in text (often near bottom)
    rupee_amounts = re.findall(r"₹\s*([\d,]+\.?\d*)", text)
    if rupee_amounts:
        amt = _parse_amount(rupee_amounts[-1])
        if amt is not None:
            return amt

    # Fallback: any "total" / amount patterns
    amounts = re.findall(r"(?:total|amount|sum)\s*[:\$₹]?\s*([\d,]+\.?\d*)", text, re.I)
    if amounts:
        amt = _parse_amount(amounts[-1])
        if amt is not None:
            return amt
    numbers = re.findall(r"\b(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\b", text)
    if numbers:
        try:
            return max(Decimal(n.replace(",", "")) for n in numbers)
        except Exception:
            pass
    return Decimal("0")


def _extract_currency(text: str) -> str:
    """If extracted text contains ₹ set INR; else try explicit codes or $."""
    if not text:
        return "USD"
    if "₹" in text:
        return "INR"
    m = re.search(r"\b(USD|EUR|GBP|INR)\b", text, re.I)
    if m:
        return m.group(1).upper()[:3]
    if "$" in text:
        return "USD"
    return "USD"
