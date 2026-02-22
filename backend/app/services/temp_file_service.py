"""Temporary file storage for uploads. Single responsibility: save and cleanup."""

import os
import tempfile
from pathlib import Path
from typing import Optional


def save_temporarily(file_bytes: bytes, filename: str) -> str:
    """Write bytes to a temp file. Returns absolute path. Caller must call cleanup when done."""
    suffix = Path(filename).suffix or ""
    fd, path = tempfile.mkstemp(suffix=suffix, prefix="upload_")
    os.close(fd)
    with open(path, "wb") as f:
        f.write(file_bytes)
    return path


def cleanup(path: Optional[str]) -> None:
    """Remove a temporary file if it exists."""
    if not path:
        return
    try:
        os.unlink(path)
    except OSError:
        pass
