"""LLM adapter: abstraction for invoice parsing. Groq implementation with strict JSON."""

import json
import os
import re
from abc import ABC, abstractmethod
from typing import Any

INVOICE_JSON_SCHEMA = {
    "invoice_number": "",
    "vendor_name": "",
    "invoice_date": "",  # ISO 8601 string
    "subtotal_amount": 0.0,
    "tax_amount": 0.0,
    "total_amount": 0.0,
    "currency": "USD",
    "payment_status": "pending",
}


def _safe_extract_json(raw: str) -> dict[str, Any] | None:
    """Extract a single JSON object from raw text (handles markdown, extra text)."""
    if not raw or not raw.strip():
        return None
    s = raw.strip()
    # Strip markdown code block if present
    if "```" in s:
        match = re.search(r"```(?:json)?\s*(\{[\s\S]*?\})\s*```", s)
        if match:
            s = match.group(1)
        else:
            # Find first { to last }
            start = s.find("{")
            end = s.rfind("}")
            if start != -1 and end != -1 and end > start:
                s = s[start : end + 1]
    else:
        start = s.find("{")
        end = s.rfind("}")
        if start != -1 and end != -1 and end > start:
            s = s[start : end + 1]
    try:
        return json.loads(s)
    except json.JSONDecodeError:
        return None


class LlmAdapter(ABC):
    """Interface for LLM-based invoice parsing."""

    @abstractmethod
    def parse_invoice_text(self, raw_text: str) -> dict[str, Any]:
        """Parse raw extracted text into a validated invoice JSON dict. Keys match Invoice model."""
        ...


class GroqLlmAdapter(LlmAdapter):
    """Groq-backed parser. Forces JSON-only output, retries on parse failure, safe JSON extraction."""

    DEFAULT_MODEL = "llama-3.3-70b-versatile"
    MAX_RETRIES = 2

    def __init__(self, model: str | None = None):
        self.api_key = os.getenv("GROQ_API_KEY")
        if not self.api_key:
            raise RuntimeError("GROQ_API_KEY not set")
        self._model = model or self.DEFAULT_MODEL
        self._client = None

    def _get_client(self):
        if self._client is None:
            from groq import Groq
            self._client = Groq(api_key=self.api_key)
        return self._client

    def _system_prompt(self) -> str:
        return """You extract invoice data from raw text. Respond with ONLY a single JSON object, no other text or markdown.

Use exactly these keys: invoice_number, vendor_name, invoice_date, subtotal_amount, tax_amount, total_amount, currency, payment_status.

Formats (strict):
- invoice_date: date only as YYYY-MM-DD (e.g. 2025-01-15). No time, no slashes, no other formats.
- subtotal_amount, tax_amount, total_amount: decimal numbers only (e.g. 100.50 or 0). No currency symbols, no commas, no quotes.

Allowed enums only:
- currency: exactly one of "USD", "EUR", "GBP", "INR".
- payment_status: exactly one of "pending", "paid", "overdue", "cancelled".

For any value that cannot be determined from the text, output null. Do not guess or invent values. Use null for unknown invoice_number, null for unknown vendor_name, null for unknown date, null for unknown amounts, null for unknown currency or payment_status."""

    def _user_prompt(self, raw_text: str) -> str:
        return f"Extract invoice fields from this text:\n\n{raw_text[:12000]}"

    def parse_invoice_text(self, raw_text: str) -> dict[str, Any]:
        """Call Groq, force JSON-only, retry on failure; return validated invoice dict."""
        if not (raw_text or "").strip():
            return dict(INVOICE_JSON_SCHEMA)
        out = dict(INVOICE_JSON_SCHEMA)
        last_error = None
        for attempt in range(self.MAX_RETRIES + 1):
            try:
                client = self._get_client()
                resp = client.chat.completions.create(
                    messages=[
                        {"role": "system", "content": self._system_prompt()},
                        {"role": "user", "content": self._user_prompt(raw_text)},
                    ],
                    model=self._model,
                    temperature=0.1,
                    max_tokens=1024,
                )
                content = (resp.choices[0].message.content or "").strip()
                parsed = _safe_extract_json(content)
                if parsed:
                    for key in INVOICE_JSON_SCHEMA:
                        if key in parsed and parsed[key] is not None:
                            out[key] = parsed[key]
                    return out
            except Exception as e:
                last_error = e
        # Fallback: return schema defaults (caller can treat as low confidence)
        if last_error:
            raise last_error
        return out
