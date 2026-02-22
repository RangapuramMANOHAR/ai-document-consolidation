"""Invoice repository — data access for invoices."""

from sqlalchemy.orm import Session

from app.models.invoice import Invoice


def list_(db: Session, skip: int = 0, limit: int = 100):
    """List invoices with optional pagination."""
    return db.query(Invoice).offset(skip).limit(limit).all()


def create(db: Session, invoice: Invoice) -> Invoice:
    """Create an invoice."""
    db.add(invoice)
    db.commit()
    db.refresh(invoice)
    return invoice
