"""Invoice model."""

from sqlalchemy import Column, Date, Integer, String, DateTime, Numeric
from sqlalchemy.sql import func, text

from app.database import Base


class Invoice(Base):
    """Invoice entity."""

    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    invoice_number = Column(String, nullable=False, index=True)
    vendor_name = Column(String, nullable=False)
    invoice_date = Column(Date, nullable=False)
    subtotal_amount = Column(Numeric(12, 2), nullable=False)
    tax_amount = Column(Numeric(12, 2), nullable=False)
    total_amount = Column(Numeric(12, 2), nullable=False)
    currency = Column(String(3), nullable=False)
    payment_status = Column(String, nullable=False)
    processing_status = Column(String, nullable=False, default="SUCCESS", server_default=text("'SUCCESS'"))  # SUCCESS | PARTIAL | FAILED
    source_file = Column(String, nullable=True)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
