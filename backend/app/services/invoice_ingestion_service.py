"""Invoice ingestion: save temp → extract text → LLM parse → save to DB. No DB logic in route."""

import io
import json
import logging
import os
import shutil
import tempfile
import zipfile
from copy import deepcopy
from datetime import date, datetime, timezone
from decimal import Decimal
from pathlib import Path

from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

# When set (e.g. "1" or "true"), response includes llm_error with masked raw LLM output for debugging.
DEBUG_LLM_RESPONSE_ENV = "DEBUG_LLM_RESPONSE"
LLM_ERROR_MAX_LEN = 200

from app.adapters.llm_adapter import GroqLlmAdapter, LlmAdapter
from app.models.invoice import Invoice
from app.repositories import invoice_repo
from app.services.invoice_parser import parse_invoice_from_text as regex_parse_invoice
from app.services.invoice_validation import validate_and_coerce_invoice_dict
from app.services.money_sanity import check_amounts_sanity, get_money_sanity_threshold
from app.services.quality_checks import key_fields_quality_ok
from app.services.tabular_ingestion_service import TabularIngestionService
from app.services.temp_file_service import cleanup, save_temporarily
from app.services.text_extraction_service import extract_text as extract_text_from_file

ALLOWED_CONTENT_TYPES = {"application/pdf", "image/png", "image/jpeg", "image/jpg"}
ALLOWED_EXTENSIONS = (".pdf", ".png", ".jpg", ".jpeg")
ZIP_CONTENT_TYPES = {"application/zip", "application/x-zip-compressed"}
ZIP_EXTENSIONS = (".zip",)
TABULAR_EXTENSIONS = (".csv", ".xlsx")
TABULAR_CONTENT_TYPES = {"text/csv", "application/csv", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel"}


def _is_default_or_garbage_invoice_number(val: str) -> bool:
    """True if invoice_number is missing or placeholder/garbage."""
    s = (val or "").strip()
    return not s or s == "UNKNOWN"


def _is_default_or_garbage_vendor_name(val: str) -> bool:
    """True if vendor_name is missing or placeholder/garbage."""
    s = (val or "").strip()
    return not s or s == "Unknown Vendor"


def _processing_status(
    text: str,
    parsed: dict,
    warnings: list[str],
    used_groq: bool,
) -> str:
    """
    SUCCESS: invoice_number and vendor_name extracted (not default/garbage) AND total_amount > 0.
    PARTIAL: row saved but one of (invoice_number/vendor_name) missing/weak OR fallback used OR warnings exist.
    FAILED: no text extracted OR cannot save row OR total_amount=0 AND key fields missing.
    For image/pdf uploads where OCR text exists and a row is saved, status must never be FAILED.
    """
    if not (text or "").strip():
        return "FAILED"
    # When OCR text exists and we save a row, never return FAILED.
    total = parsed.get("total_amount")
    total_ok = total is not None and not (
        isinstance(total, (int, float, Decimal)) and (total == 0 or total == 0.0)
    )
    inv_ok = not _is_default_or_garbage_invoice_number(parsed.get("invoice_number") or "")
    vendor_ok = not _is_default_or_garbage_vendor_name(parsed.get("vendor_name") or "")
    if inv_ok and vendor_ok and total_ok:
        return "SUCCESS"
    # PARTIAL: fallback used, or warnings, or missing/weak key fields
    return "PARTIAL"


def _normalized_to_invoice(normalized: dict, source_file: str, processing_status: str = "SUCCESS") -> Invoice:
    """Build Invoice model from normalized dict. invoice_date must be date or None."""
    date_val = normalized.get("invoice_date")
    if isinstance(date_val, datetime):
        date_val = date_val.date()
    elif isinstance(date_val, str) and date_val:
        try:
            date_val = datetime.fromisoformat(date_val.replace("Z", "+00:00")).date()
        except (ValueError, TypeError):
            date_val = date.today()
    elif not isinstance(date_val, date):
        date_val = date.today()
    return Invoice(
        invoice_number=normalized.get("invoice_number") or "",
        vendor_name=normalized.get("vendor_name") or "",
        invoice_date=date_val,
        subtotal_amount=Decimal(str(normalized.get("subtotal_amount") or 0)),
        tax_amount=Decimal(str(normalized.get("tax_amount") or 0)),
        total_amount=Decimal(str(normalized.get("total_amount") or 0)),
        currency=(normalized.get("currency") or "USD")[:3],
        payment_status=normalized.get("payment_status") or "pending",
        processing_status=processing_status,
        source_file=source_file,
    )


def _invoice_to_json(invoice: Invoice) -> dict:
    """Saved invoice row as JSON-serializable dict."""
    return {
        "id": invoice.id,
        "invoice_number": invoice.invoice_number,
        "vendor_name": invoice.vendor_name,
        "invoice_date": invoice.invoice_date.isoformat() if invoice.invoice_date else None,
        "subtotal_amount": float(invoice.subtotal_amount),
        "tax_amount": float(invoice.tax_amount),
        "total_amount": float(invoice.total_amount),
        "currency": invoice.currency,
        "payment_status": invoice.payment_status,
        "processing_status": invoice.processing_status,
        "source_file": invoice.source_file,
        "uploaded_at": invoice.uploaded_at.isoformat() if invoice.uploaded_at else None,
    }


def _is_allowed(filename: str, content_type: str) -> bool:
    """Accept PDF, PNG, JPG only."""
    ct = (content_type or "").strip().lower()
    fn = (filename or "").lower()
    if ct in ALLOWED_CONTENT_TYPES:
        return True
    return any(fn.endswith(ext) for ext in ALLOWED_EXTENSIONS)


def _is_zip(filename: str, content_type: str) -> bool:
    """Detect ZIP upload."""
    ct = (content_type or "").strip().lower()
    fn = (filename or "").lower()
    if ct in ZIP_CONTENT_TYPES:
        return True
    return any(fn.endswith(ext) for ext in ZIP_EXTENSIONS)


def _is_tabular(filename: str, content_type: str) -> bool:
    """Detect CSV/XLSX."""
    ct = (content_type or "").strip().lower()
    fn = (filename or "").lower()
    if ct in TABULAR_CONTENT_TYPES:
        return True
    return any(fn.endswith(ext) for ext in TABULAR_EXTENSIONS)


def _to_stable_item(invoice_dict: dict, extracted_text_preview: str = "", confidence: float = 0.0, warnings: list | None = None) -> dict:
    """Normalize to stable response shape: invoice, extracted_text_preview, confidence, warnings."""
    inv = {k: v for k, v in invoice_dict.items() if k != "warnings"} if invoice_dict else {}
    w = warnings if warnings is not None else (invoice_dict.get("warnings", []) if isinstance(invoice_dict.get("warnings"), list) else [])
    return {"invoice": inv, "extracted_text_preview": extracted_text_preview or "", "confidence": confidence, "warnings": w}


def _tabular_row_to_stable(row: dict) -> dict:
    """Convert tabular result row to stable item shape."""
    inv = {k: v for k, v in row.items() if k != "warnings"}
    status = inv.get("processing_status", "")
    confidence = 1.0 if status == "SUCCESS" else 0.5
    return _to_stable_item(inv, "", confidence, row.get("warnings") or [])


def _summary_from_items(items: list[dict]) -> dict:
    """Build summary with created, partial, failed from stable items."""
    created = partial = failed = 0
    for it in items:
        if it.get("error"):
            failed += 1
        else:
            inv = it.get("invoice")
            status = inv.get("processing_status") if inv else None
            if status == "SUCCESS":
                created += 1
            elif status == "PARTIAL":
                partial += 1
            else:
                failed += 1
    return {"created": created, "partial": partial, "failed": failed}


def _content_type_from_filename(filename: str) -> str:
    """Infer content type from extension for extracted ZIP entries."""
    ext = (Path(filename).suffix or "").lower()
    if ext == ".pdf":
        return "application/pdf"
    if ext in (".png",):
        return "image/png"
    if ext in (".jpg", ".jpeg"):
        return "image/jpeg"
    if ext == ".csv":
        return "text/csv"
    if ext == ".xlsx":
        return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    return ""


EXTRACTED_TEXT_PREVIEW_MAX_LEN = 500


def _mask_llm_output(raw: object) -> str:
    """Short masked string of raw LLM output for logs/debug; no sensitive data."""
    try:
        s = json.dumps(raw, default=str) if not isinstance(raw, str) else raw
    except (TypeError, ValueError):
        s = repr(raw)
    s = s or ""
    if len(s) > LLM_ERROR_MAX_LEN:
        s = s[:LLM_ERROR_MAX_LEN] + "..."
    return s


def _debug_llm_response() -> bool:
    """True if DEBUG_LLM_RESPONSE env is set (for including llm_error in response)."""
    return os.environ.get(DEBUG_LLM_RESPONSE_ENV, "").strip().lower() in ("1", "true", "yes")


def _build_warnings(text: str, parsed: dict) -> list[str]:
    """Build warnings from extraction/parse result."""
    warnings = []
    if not (text or "").strip():
        warnings.append("No text extracted from document")
    vendor = (parsed.get("vendor_name") or "").strip()
    if not vendor or vendor == "Unknown Vendor":
        warnings.append("Vendor name could not be determined")
    inv_num = (parsed.get("invoice_number") or "").strip()
    if not inv_num or inv_num == "UNKNOWN":
        warnings.append("Invoice number could not be determined")
    total = parsed.get("total_amount")
    if total is None or (isinstance(total, (int, float)) and total == 0):
        warnings.append("Total missing")
    return warnings


def _confidence_from_parsed(parsed: dict, warnings: list[str]) -> float:
    """Simple confidence score 0–1 from parsed data and warnings."""
    base = 1.0
    if not (parsed.get("vendor_name") or "").strip() or (parsed.get("vendor_name") or "") == "Unknown Vendor":
        base -= 0.2
    if not (parsed.get("invoice_number") or "").strip() or (parsed.get("invoice_number") or "") == "UNKNOWN":
        base -= 0.2
    total = parsed.get("total_amount")
    if total is None or (isinstance(total, (int, float)) and total == 0):
        base -= 0.3
    base -= 0.05 * len(warnings)
    return max(0.0, min(1.0, base))


def _apply_confidence_caps(
    raw_confidence: float,
    processing_status: str,
    used_groq: bool,
) -> float:
    """Cap confidence by status and parser: regex fallback ≤0.7, PARTIAL ≤0.7, FAILED 0.0–0.2."""
    capped = raw_confidence
    if processing_status == "FAILED":
        capped = min(raw_confidence, 0.2)
    elif processing_status == "PARTIAL":
        capped = min(capped, 0.7)
    if not used_groq:
        capped = min(capped, 0.7)
    return max(0.0, min(1.0, capped))


def _normalize_parsed_for_invoice(parsed: dict) -> dict:
    """Ensure parsed dict has types expected by _normalized_to_invoice (date, decimals)."""
    out = deepcopy(parsed)
    date_val = out.get("invoice_date")
    if isinstance(date_val, datetime):
        out["invoice_date"] = date_val.date()
    elif isinstance(date_val, str) and date_val:
        try:
            out["invoice_date"] = datetime.fromisoformat(date_val.replace("Z", "+00:00")).date()
        except Exception:
            out["invoice_date"] = date.today()
    elif not isinstance(date_val, date):
        out["invoice_date"] = date.today()
    for key in ("subtotal_amount", "tax_amount", "total_amount"):
        v = out.get(key)
        if v is None:
            continue
        if isinstance(v, (int, float, Decimal)):
            out[key] = float(v) if v is not None else None
        else:
            try:
                out[key] = float(v)
            except (TypeError, ValueError):
                out[key] = None
    return out


class InvoiceIngestionService:
    """Orchestrates: save temp file → extract text → LLM parse (Groq) → persist via repository."""

    def __init__(self, llm_adapter: LlmAdapter | None = None, tabular_service: TabularIngestionService | None = None):
        self._llm = llm_adapter if llm_adapter is not None else GroqLlmAdapter()
        self._tabular = tabular_service if tabular_service is not None else TabularIngestionService()

    def process_one_file(
        self, file_bytes: bytes, filename: str, content_type: str, db: Session
    ) -> dict:
        """
        Process a single file (PDF/PNG/JPG). Returns stable response: invoice, extracted_text_preview, confidence, warnings.
        """
        if not _is_allowed(filename, content_type):
            raise ValueError(f"File type not allowed: {filename}")
        temp_path = None
        llm_error_for_response: str | None = None
        try:
            temp_path = save_temporarily(file_bytes, filename)
            text = extract_text_from_file(file_bytes, filename, content_type)
            parsed = None
            used_groq = False
            validation_warnings: list[str] = []
            failure_reason: str | None = None
            llm_out: object = None
            try:
                llm_out = self._llm.parse_invoice_text(text)
                coerced, validation_warnings, failure_reason = validate_and_coerce_invoice_dict(llm_out)
                if coerced is not None:
                    parsed = _normalize_parsed_for_invoice(coerced)
                    used_groq = True
                else:
                    masked = _mask_llm_output(llm_out)
                    logger.warning("LLM validation failed (%s): raw_output_masked=%s", failure_reason or "unknown", masked)
                    if _debug_llm_response():
                        llm_error_for_response = masked
            except Exception as e:
                logger.warning("LLM parse or validation error: %s", e, exc_info=True)
                if _debug_llm_response():
                    llm_error_for_response = (str(e) or repr(e))[:LLM_ERROR_MAX_LEN]
            if parsed is None:
                parsed = regex_parse_invoice(text)
                if not any("regex fallback" in w for w in validation_warnings):
                    validation_warnings.append("LLM output validation failed; using regex fallback")
            parsed["source_file"] = filename
            warnings = validation_warnings + _build_warnings(text, parsed)
            threshold = get_money_sanity_threshold()
            sanity_warnings = check_amounts_sanity(parsed, threshold)
            warnings.extend(sanity_warnings)
            status = _processing_status(text, parsed, warnings, used_groq)
            if status == "SUCCESS" and not key_fields_quality_ok(
                parsed.get("invoice_number") or "", parsed.get("vendor_name") or ""
            ):
                status = "PARTIAL"
                warnings.append("Low-quality vendor/invoice fields")
            # Regex fallback: if both vendor_name and invoice_number came from anchors, mark SUCCESS
            if status == "PARTIAL" and parsed.get("_anchors_used"):
                total = parsed.get("total_amount")
                total_ok = total is not None and not (
                    isinstance(total, (int, float, Decimal)) and (total == 0 or total == 0.0)
                )
                if (
                    total_ok
                    and not _is_default_or_garbage_invoice_number(parsed.get("invoice_number") or "")
                    and not _is_default_or_garbage_vendor_name(parsed.get("vendor_name") or "")
                ):
                    status = "SUCCESS"
            if sanity_warnings and status == "SUCCESS":
                status = "PARTIAL"
            raw_confidence = _confidence_from_parsed(parsed, warnings)
            confidence = _apply_confidence_caps(raw_confidence, status, used_groq)
            invoice = _normalized_to_invoice(parsed, filename, processing_status=status)
            saved = invoice_repo.create(db, invoice)
            invoice_json = _invoice_to_json(saved)
            preview = (text or "")[:EXTRACTED_TEXT_PREVIEW_MAX_LEN]
            if len(text or "") > EXTRACTED_TEXT_PREVIEW_MAX_LEN:
                preview += "..."
            result = {
                "invoice": invoice_json,
                "extracted_text_preview": preview,
                "confidence": round(confidence, 2),
                "warnings": warnings,
            }
            if llm_error_for_response is not None:
                result["llm_error"] = llm_error_for_response
            return result
        finally:
            cleanup(temp_path)

    def process_zip_upload(
        self, file_bytes: bytes, filename: str, content_type: str, db: Session
    ) -> dict:
        """
        Extract ZIP to temp dir, process each file with same detection (pdf/image → doc; csv/xlsx → tabular), collect per-file results, return { items, summary }. Cleanup temp dir always (finally).
        """
        if not _is_zip(filename, content_type):
            raise ValueError("Not a ZIP file")
        tmpdir = None
        items: list[dict] = []
        try:
            tmpdir = tempfile.mkdtemp(prefix="upload_zip_")
            with zipfile.ZipFile(io.BytesIO(file_bytes), "r") as zf:
                names = [n for n in zf.namelist() if not n.endswith("/") and "__MACOSX" not in n]
                zf.extractall(tmpdir)
            for name in names:
                base = os.path.basename(name)
                base_lower = base.lower()
                if not any(base_lower.endswith(ext) for ext in TABULAR_EXTENSIONS) and not any(base_lower.endswith(ext) for ext in ALLOWED_EXTENSIONS):
                    continue
                path = os.path.join(tmpdir, name)
                if not os.path.isfile(path):
                    continue
                try:
                    with open(path, "rb") as f:
                        data = f.read()
                    ct = _content_type_from_filename(base)
                    if any(base_lower.endswith(ext) for ext in TABULAR_EXTENSIONS):
                        tabular_list = self._tabular.process_tabular(data, base, ct, db)
                        for row in tabular_list:
                            items.append(_tabular_row_to_stable(row))
                    elif any(base_lower.endswith(ext) for ext in ALLOWED_EXTENSIONS):
                        one = self.process_one_file(data, base, ct, db)
                        items.append(one)
                except Exception as e:
                    items.append({
                        "error": str(e),
                        "filename": base,
                        "invoice": None,
                        "extracted_text_preview": "",
                        "confidence": 0.0,
                        "warnings": [str(e)],
                    })
            return {"items": items, "summary": _summary_from_items(items)}
        finally:
            if tmpdir and os.path.isdir(tmpdir):
                try:
                    shutil.rmtree(tmpdir)
                except OSError:
                    pass

    def process_upload(
        self, file_bytes: bytes, filename: str, content_type: str, db: Session
    ) -> dict:
        """
        Auto-detect: PDF/JPG/PNG → doc; CSV/XLSX → tabular; ZIP → extract to temp dir, process each with same detection, return { items, summary }. Cleanup always. Single file → stable object.
        """
        if _is_zip(filename, content_type):
            return self.process_zip_upload(file_bytes, filename, content_type, db)
        if _is_tabular(filename, content_type):
            tabular_list = self._tabular.process_tabular(file_bytes, filename, content_type, db)
            stable_items = [_tabular_row_to_stable(row) for row in tabular_list]
            return {"items": stable_items, "summary": _summary_from_items(stable_items)}
        if _is_allowed(filename, content_type):
            return self.process_one_file(file_bytes, filename, content_type, db)
        raise ValueError("Only PDF, PNG, JPG, CSV, XLSX, or ZIP are accepted")
