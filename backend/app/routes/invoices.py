"""Invoice API routes."""

from datetime import date
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Body, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.invoice import Invoice
from app.repositories import invoice_repo

router = APIRouter()


def _invoice_to_json(inv):
    """Invoice row as JSON-serializable dict."""
    return {
        "id": inv.id,
        "invoice_number": inv.invoice_number,
        "vendor_name": inv.vendor_name,
        "invoice_date": inv.invoice_date.isoformat() if inv.invoice_date else None,
        "subtotal_amount": float(inv.subtotal_amount),
        "tax_amount": float(inv.tax_amount),
        "total_amount": float(inv.total_amount),
        "currency": inv.currency,
        "payment_status": inv.payment_status,
        "processing_status": inv.processing_status,
        "source_file": inv.source_file,
        "uploaded_at": inv.uploaded_at.isoformat() if inv.uploaded_at else None,
    }


class InvoiceCreateBody(BaseModel):
    """Request body for POST /invoices/test. Matches Invoice model fields exactly."""

    invoice_number: str
    vendor_name: str
    invoice_date: date
    subtotal_amount: Decimal = Field(..., decimal_places=2)
    tax_amount: Decimal = Field(..., decimal_places=2)
    total_amount: Decimal = Field(..., decimal_places=2)
    currency: str = Field(..., min_length=1, max_length=3)
    payment_status: str
    processing_status: str = Field(..., description="SUCCESS | PARTIAL | FAILED")
    source_file: Optional[str] = None


_DEFAULT_TEST_PAYLOAD = InvoiceCreateBody(
    invoice_number="TEST-001",
    vendor_name="Test Vendor Inc.",
    invoice_date=date.today(),
    subtotal_amount=Decimal("100.00"),
    tax_amount=Decimal("10.00"),
    total_amount=Decimal("110.00"),
    currency="USD",
    payment_status="pending",
    processing_status="SUCCESS",
    source_file="test.pdf",
)


@router.get("/")
def list_invoices(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """List invoices."""
    return invoice_repo.list_(db, skip=skip, limit=limit)


@router.post("/test")
def create_test_invoice(
    body: Optional[InvoiceCreateBody] = Body(None),
    db: Session = Depends(get_db),
):
    """Insert an invoice. Send a body matching Invoice model, or omit for default test record. Returns created row."""
    payload = body if body is not None else _DEFAULT_TEST_PAYLOAD
    invoice = Invoice(
        invoice_number=payload.invoice_number,
        vendor_name=payload.vendor_name,
        invoice_date=payload.invoice_date,
        subtotal_amount=payload.subtotal_amount,
        tax_amount=payload.tax_amount,
        total_amount=payload.total_amount,
        currency=payload.currency,
        payment_status=payload.payment_status,
        processing_status=payload.processing_status,
        source_file=payload.source_file,
    )
    created = invoice_repo.create(db, invoice)
    return _invoice_to_json(created)


