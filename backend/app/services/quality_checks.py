"""Quality checks for invoice_number and vendor_name used for SUCCESS status."""

# invoice_number: common words that are not valid invoice numbers (case-insensitive)
INVOICE_NUMBER_FORBIDDEN_WORDS = frozenset({
    "date", "invoice", "number", "no", "n/a", "na", "none", "total", "subtotal",
    "amount", "id", "#",
})

# vendor_name: exact matches (case-insensitive) that are labels, not vendor names
VENDOR_NAME_FORBIDDEN = frozenset({
    "billing address", "invoice", "tax invoice",
})


def invoice_number_quality_ok(val: str) -> bool:
    """
    invoice_number must match a reasonable pattern: length >= 4, at least one digit,
    and not equal to common words like "Date".
    """
    s = (val or "").strip()
    if len(s) < 4:
        return False
    if not any(c.isdigit() for c in s):
        return False
    if s.lower() in INVOICE_NUMBER_FORBIDDEN_WORDS:
        return False
    return True


def vendor_name_quality_ok(val: str) -> bool:
    """
    vendor_name must be >= 3 chars, contain at least one letter (A–Z),
    and not be in ["Billing Address", "Invoice", "Tax Invoice"].
    """
    s = (val or "").strip()
    if len(s) < 3:
        return False
    if not any(c.isalpha() for c in s):
        return False
    if s.lower() in VENDOR_NAME_FORBIDDEN:
        return False
    return True


def key_fields_quality_ok(invoice_number: str, vendor_name: str) -> bool:
    """True if both invoice_number and vendor_name pass quality checks."""
    return invoice_number_quality_ok(invoice_number) and vendor_name_quality_ok(vendor_name)
