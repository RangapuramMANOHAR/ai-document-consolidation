"""Validate and coerce invoice dict from LLM/output before DB insert."""

from datetime import datetime
from decimal import Decimal
from typing import Any

REQUIRED_KEYS = (
    "invoice_number",
    "vendor_name",
    "invoice_date",
    "subtotal_amount",
    "tax_amount",
    "total_amount",
    "currency",
    "payment_status",
)
ALLOWED_CURRENCIES = {"USD", "EUR", "GBP", "INR"}
VALIDATION_FAILED_PREFIX = "LLM output validation failed"


def _format_validation_failed_warning(reason: str) -> str:
    """Build warning string including failure reason."""
    return f"{VALIDATION_FAILED_PREFIX} ({reason}); using regex fallback"


def _safe_numeric(value: Any) -> float | None:
    """Convert to float safely; None for empty or invalid."""
    if value is None:
        return None
    if isinstance(value, str) and not value.strip():
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, Decimal):
        return float(value)
    try:
        s = str(value).strip().replace(",", "")
        return float(s) if s else None
    except (TypeError, ValueError):
        return None


def _normalize_date(value: Any) -> str | None:
    """Normalize to YYYY-MM-DD string or None."""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d")
    if isinstance(value, str):
        s = value.strip()
        if not s:
            return None
        try:
            # Accept ISO date or datetime
            if "T" in s:
                dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
            else:
                dt = datetime.strptime(s[:10], "%Y-%m-%d")
            return dt.strftime("%Y-%m-%d")
        except (ValueError, TypeError):
            return None
    return None


def _clamp_currency(value: Any) -> str:
    """Clamp to USD, EUR, GBP, INR; default USD."""
    if not value:
        return "USD"
    c = str(value).strip().upper()[:3]
    return c if c in ALLOWED_CURRENCIES else "USD"


def validate_and_coerce_invoice_dict(
    data: Any,
) -> tuple[dict[str, Any] | None, list[str], str | None]:
    """
    Enforce keys, coerce numerics, normalize dates to YYYY-MM-DD or None, clamp currency.
    Returns (coerced_dict, validation_warnings, failure_reason).
    When coerced_dict is None, failure_reason describes why (e.g. "non-dict or null", "missing keys: [...]", "invalid date", "invalid numeric").
    """
    warnings: list[str] = []
    if data is None or not isinstance(data, dict):
        return (None, [_format_validation_failed_warning("non-dict or null")], "non-dict or null")

    out: dict[str, Any] = {}
    missing_keys: list[str] = []
    invalid_date = False
    invalid_numeric = False

    for key in REQUIRED_KEYS:
        val = data.get(key)
        if key == "invoice_date":
            out[key] = _normalize_date(val)
            if val is not None and val != "" and out[key] is None:
                invalid_date = True
                warnings.append("Invoice date could not be parsed; using None")
        elif key == "currency":
            raw = val or "USD"
            out[key] = _clamp_currency(raw)
            if str(raw).strip().upper()[:3] not in ALLOWED_CURRENCIES:
                warnings.append(f"Currency not in allowed set; clamped to {out[key]}")
        elif key in ("subtotal_amount", "tax_amount", "total_amount"):
            out[key] = _safe_numeric(val)
            if out[key] is None and (val is not None and str(val).strip() != ""):
                invalid_numeric = True
        elif key in ("invoice_number", "vendor_name"):
            out[key] = str(val).strip() if val is not None else ""
        elif key == "payment_status":
            out[key] = str(val).strip() if val is not None else "pending"
        else:
            out[key] = str(val).strip() if val is not None else ""

    if not out.get("payment_status"):
        out["payment_status"] = "pending"
    if out.get("total_amount") is None or out.get("total_amount") == 0:
        warnings.append("Total missing")
        invalid_numeric = True

    for key in ("invoice_number", "vendor_name", "invoice_date", "subtotal_amount", "tax_amount", "total_amount"):
        v = out.get(key)
        if v is None or (isinstance(v, str) and not v.strip()) or (key == "total_amount" and isinstance(v, (int, float)) and v == 0):
            missing_keys.append(key)

    # Failure reason for logging/warning when we reject the result (non-dict already handled above)
    failure_reason_str: str | None = None
    if missing_keys:
        failure_reason_str = f"missing keys: {sorted(set(missing_keys))}"
    elif invalid_date:
        failure_reason_str = "invalid date"
    elif invalid_numeric:
        failure_reason_str = "invalid numeric"

    # Reject when critical data missing so caller falls back to regex and can show reason
    if failure_reason_str:
        warning_msg = _format_validation_failed_warning(failure_reason_str)
        other_warnings = [w for w in warnings if w != "Total missing" or failure_reason_str != "invalid numeric"]
        return (None, [warning_msg] + other_warnings, failure_reason_str)

    return (out, warnings, None)
