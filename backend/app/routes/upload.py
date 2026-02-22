"""Upload route: thin controller; only coordinates HTTP. No DB logic."""

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.invoice_ingestion_service import InvoiceIngestionService

router = APIRouter()
ingestion_service = InvoiceIngestionService()


@router.post("/upload")
async def upload(file: UploadFile, db: Session = Depends(get_db)):
    """Auto-detect: PDF/JPG/PNG → doc; CSV/XLSX → tabular; ZIP → extract to temp dir, process each (same detection), return { items, summary }. Cleanup always. Single file → stable object."""
    file_bytes = await file.read()
    filename = file.filename or ""
    content_type = file.content_type or ""
    try:
        return ingestion_service.process_upload(file_bytes, filename, content_type, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


