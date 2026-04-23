#!/usr/bin/env python3
"""Extract markdown from a supported document for setlist's digest generator.

Invoked as:  python3 extract.py <file-path>

Stdout: markdown text (or empty on unsupported format / extraction failure).
Exit code: 0 on success (even when empty), 2 when docling is missing,
           3 when the file format is unsupported, 4 on extraction error.

Install docling once per user Python:  pip install --user docling
"""

from __future__ import annotations

import sys
from pathlib import Path

NATIVE_EXTS = {".md", ".txt", ".html", ".htm"}
DOCLING_EXTS = {".pdf", ".docx", ".pptx", ".xlsx"}


def read_native(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")


def read_docling(path: Path) -> str:
    try:
        from docling.document_converter import DocumentConverter  # type: ignore
    except ImportError:
        print(
            "docling not installed — pip install --user docling",
            file=sys.stderr,
        )
        sys.exit(2)
    converter = DocumentConverter()
    result = converter.convert(str(path))
    return result.document.export_to_markdown()


def main() -> None:
    if len(sys.argv) != 2:
        print("usage: extract.py <file-path>", file=sys.stderr)
        sys.exit(1)
    path = Path(sys.argv[1])
    if not path.exists():
        print(f"file not found: {path}", file=sys.stderr)
        sys.exit(1)
    ext = path.suffix.lower()
    try:
        if ext in NATIVE_EXTS:
            sys.stdout.write(read_native(path))
        elif ext in DOCLING_EXTS:
            sys.stdout.write(read_docling(path))
        else:
            print(f"unsupported format: {ext}", file=sys.stderr)
            sys.exit(3)
    except SystemExit:
        raise
    except Exception as err:  # pragma: no cover — extractor errors bubble up
        print(f"extraction failed: {err}", file=sys.stderr)
        sys.exit(4)


if __name__ == "__main__":
    main()
