"""KPI analytics routes for invoices."""

from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.invoice import Invoice

router = APIRouter()

STATUS_KEYS = ("SUCCESS", "PARTIAL", "FAILED")
CURRENCY_KEYS = ("USD", "INR", "EUR", "GBP")


@router.get("/summary")
def get_analytics_summary(db: Session = Depends(get_db)):
    """
    KPI summary: total invoices, by status, by currency, amount totals,
    top 5 vendors by count, daily totals for last 14 days.
    """
    # total_invoices
    total_invoices = db.query(func.count(Invoice.id)).scalar() or 0

    # by_status
    status_rows = (
        db.query(Invoice.processing_status, func.count(Invoice.id))
        .group_by(Invoice.processing_status)
        .all()
    )
    by_status = {k: 0 for k in STATUS_KEYS}
    for row in status_rows:
        if row[0] in by_status:
            by_status[row[0]] = row[1]

    # by_currency
    currency_rows = (
        db.query(Invoice.currency, func.count(Invoice.id))
        .group_by(Invoice.currency)
        .all()
    )
    by_currency = {k: 0 for k in CURRENCY_KEYS}
    for row in currency_rows:
        key = (row[0] or "").upper()[:3]
        if key in by_currency:
            by_currency[key] = row[1]

    # amount_totals
    sums = (
        db.query(
            func.coalesce(func.sum(Invoice.subtotal_amount), 0),
            func.coalesce(func.sum(Invoice.tax_amount), 0),
            func.coalesce(func.sum(Invoice.total_amount), 0),
        )
        .first()
    )
    subtotal_sum = float(sums[0]) if sums else 0.0
    tax_sum = float(sums[1]) if sums else 0.0
    total_sum = float(sums[2]) if sums else 0.0
    amount_totals = {
        "subtotal_sum": subtotal_sum,
        "tax_sum": tax_sum,
        "total_sum": total_sum,
    }

    # top_vendors: top 5 by invoice count, include count + sum(total_amount)
    vendor_rows = (
        db.query(
            Invoice.vendor_name,
            func.count(Invoice.id).label("count"),
            func.coalesce(func.sum(Invoice.total_amount), 0).label("total_sum"),
        )
        .group_by(Invoice.vendor_name)
        .order_by(func.count(Invoice.id).desc())
        .limit(5)
        .all()
    )
    top_vendors = [
        {
            "vendor_name": row[0] or "",
            "count": row[1],
            "total_sum": float(row[2]),
        }
        for row in vendor_rows
    ]

    # daily_totals_last_14_days: last 14 days inclusive, group by invoice_date, sort ascending
    end_date = date.today()
    start_date = end_date - timedelta(days=13)
    daily_rows = (
        db.query(
            Invoice.invoice_date,
            func.count(Invoice.id).label("count"),
            func.coalesce(func.sum(Invoice.total_amount), 0).label("total_sum"),
        )
        .filter(Invoice.invoice_date.isnot(None))
        .filter(Invoice.invoice_date >= start_date)
        .filter(Invoice.invoice_date <= end_date)
        .group_by(Invoice.invoice_date)
        .order_by(Invoice.invoice_date.asc())
        .all()
    )
    daily_totals_last_14_days = [
        {
            "date": row[0].isoformat(),
            "count": row[1],
            "total_sum": float(row[2]),
        }
        for row in daily_rows
    ]

    return {
        "total_invoices": total_invoices,
        "by_status": by_status,
        "by_currency": by_currency,
        "amount_totals": amount_totals,
        "top_vendors": top_vendors,
        "daily_totals_last_14_days": daily_totals_last_14_days,
    }
