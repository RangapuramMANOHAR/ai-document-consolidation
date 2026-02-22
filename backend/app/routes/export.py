"""Export invoices to XLSX."""

from io import BytesIO

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.repositories import invoice_repo

router = APIRouter()

EXPORT_COLUMNS = [
    "id",
    "invoice_number",
    "vendor_name",
    "invoice_date",
    "subtotal_amount",
    "tax_amount",
    "total_amount",
    "currency",
    "payment_status",
    "source_file",
    "uploaded_at",
    "processing_status",
]


def _row_from_invoice(inv) -> list:
    """One row for XLSX: same order as EXPORT_COLUMNS."""
    return [
        inv.id,
        inv.invoice_number or "",
        inv.vendor_name or "",
        inv.invoice_date.strftime("%Y-%m-%d") if inv.invoice_date else "",
        float(inv.subtotal_amount) if inv.subtotal_amount is not None else 0.0,
        float(inv.tax_amount) if inv.tax_amount is not None else 0.0,
        float(inv.total_amount) if inv.total_amount is not None else 0.0,
        inv.currency or "",
        inv.payment_status or "",
        inv.source_file or "",
        inv.uploaded_at.strftime("%Y-%m-%d %H:%M:%S") if inv.uploaded_at else "",
        inv.processing_status or "",
    ]


@router.get("/export")
def export_invoices(db: Session = Depends(get_db)):
    """Export all invoices to invoices.xlsx (openpyxl, StreamingResponse). Includes processing_status and source_file."""
    from openpyxl import Workbook

    wb = Workbook(write_only=True)
    ws = wb.create_sheet("Invoices", 0)
    ws.append(EXPORT_COLUMNS)
    invoices = invoice_repo.list_(db, skip=0, limit=100_000)
    for inv in invoices:
        ws.append(_row_from_invoice(inv))
    buffer = BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="invoices.xlsx"'},
    )
