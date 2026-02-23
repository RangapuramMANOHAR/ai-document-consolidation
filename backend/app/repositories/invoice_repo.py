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


def get_by_id(db: Session, invoice_id: int):
    """Get a single invoice by id, or None."""
    return db.query(Invoice).filter(Invoice.id == invoice_id).first()


def delete_by_id(db: Session, invoice_id: int) -> bool:
    """Delete an invoice by id. Returns True if deleted, False if not found."""
    inv = get_by_id(db, invoice_id)
    if inv is None:
        return False
    db.delete(inv)
    db.commit()
    return True
