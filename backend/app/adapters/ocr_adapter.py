"""OCR adapter: abstraction so the engine can be swapped without changing service logic."""

import logging
from abc import ABC, abstractmethod
from io import BytesIO
from typing import Any, List, Tuple

import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)


class OcrAdapter(ABC):
    """Interface for OCR. Service depends on this abstraction, not a concrete library."""

    @abstractmethod
    def extract_text(self, image_bytes: bytes) -> str:
        """Extract plain text from image bytes."""
        ...


def _image_bytes_to_numpy_rgb(image_bytes: bytes) -> np.ndarray:
    """Decode image bytes to RGB numpy array (H, W, 3) for EasyOCR."""
    img = Image.open(BytesIO(image_bytes)).convert("RGB")
    return np.array(img)


class EasyOcrAdapter(OcrAdapter):
    """Implementation using EasyOCR. Extracts text from image bytes."""

    def __init__(self, languages: List[str] | None = None) -> None:
        self._languages = languages or ["en"]
        self._reader: Any = None

    def _get_reader(self) -> Any:
        if self._reader is None:
            import easyocr
            self._reader = easyocr.Reader(self._languages)
        return self._reader

    def extract_text(self, image_bytes: bytes) -> str:
        """Extract text from image bytes using EasyOCR."""
        if not image_bytes:
            return ""
        try:
            img_array = _image_bytes_to_numpy_rgb(image_bytes)
            reader = self._get_reader()
            results: List[Tuple[Any, str, float]] = reader.readtext(img_array)
            return "\n".join((text for (_, text, _) in results)).strip()
        except Exception as e:
            logger.warning("OCR extraction failed: %s", e, exc_info=True)
            return ""
