"""Sanity validation for money fields: flag amounts above a configurable threshold."""

import os
from decimal import Decimal
from typing import Any


MONEY_SANITY_THRESHOLD_ENV = "MONEY_SANITY_THRESHOLD"
DEFAULT_THRESHOLD = 1e12  # effectively off if env not set
MONEY_KEYS = ("subtotal_amount", "tax_amount", "total_amount")
SANITY_WARNING_MSG = "Amount(s) exceed sanity threshold; please verify."


def get_money_sanity_threshold() -> float:
    """Configurable max allowed amount (any of subtotal/tax/total). From env MONEY_SANITY_THRESHOLD."""
    raw = os.environ.get(MONEY_SANITY_THRESHOLD_ENV, "").strip()
    if not raw:
        return float(DEFAULT_THRESHOLD)
    try:
        return float(raw)
    except (TypeError, ValueError):
        return float(DEFAULT_THRESHOLD)


def _to_float(v: Any) -> float | None:
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    if isinstance(v, Decimal):
        return float(v)
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def check_amounts_sanity(amounts: dict[str, Any], threshold: float) -> list[str]:
    """
    If any of subtotal_amount, tax_amount, total_amount exceeds threshold, return a warning list.
    Otherwise return [].
    """
    for key in MONEY_KEYS:
        val = _to_float(amounts.get(key))
        if val is not None and val > threshold:
            return [SANITY_WARNING_MSG]
    return []
