"""Text extraction: PDF vs image (PNG/JPG). Isolated so adding DOCX later is easy."""

from io import BytesIO
from typing import Optional

from app.adapters.ocr_adapter import OcrAdapter, EasyOcrAdapter

_default_ocr_adapter: Optional[OcrAdapter] = None


def get_default_ocr_adapter() -> OcrAdapter:
    """Default injectable OCR adapter."""
    global _default_ocr_adapter
    if _default_ocr_adapter is None:
        _default_ocr_adapter = EasyOcrAdapter()
    return _default_ocr_adapter


def _extract_text_pdf(file_bytes: bytes) -> str:
    """Extract text from PDF using pypdf."""
    from pypdf import PdfReader
    reader = PdfReader(BytesIO(file_bytes))
    parts = []
    for page in reader.pages:
        parts.append(page.extract_text() or "")
    return "\n".join(parts)


def _extract_text_image(file_bytes: bytes, ocr_adapter: OcrAdapter) -> str:
    """Extract text from image using injected OCR adapter."""
    return ocr_adapter.extract_text(file_bytes)


def extract_text(
    file_bytes: bytes,
    filename: str,
    content_type: str,
    ocr_adapter: Optional[OcrAdapter] = None,
) -> str:
    """Extract plain text from file. PDF uses pypdf; PNG/JPG use injected OCR adapter."""
    adapter = ocr_adapter if ocr_adapter is not None else get_default_ocr_adapter()
    ct = (content_type or "").lower()
    fn = (filename or "").lower()
    if "pdf" in ct or fn.endswith(".pdf"):
        return _extract_text_pdf(file_bytes)
    if ct in ("image/png", "image/jpeg", "image/jpg") or fn.endswith((".png", ".jpg", ".jpeg")):
        return _extract_text_image(file_bytes, adapter)
    return ""
