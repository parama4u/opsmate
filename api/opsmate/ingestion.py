"""Text extraction shared by uploads and connectors."""

import io
import shutil
import subprocess
import tempfile
from html.parser import HTMLParser
from pathlib import Path
from zipfile import BadZipFile, ZipFile
from xml.etree import ElementTree

from fastapi import HTTPException


class _TextParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        self.parts.append(data)


def _xml_values(xml: bytes) -> list[str]:
    root = ElementTree.fromstring(xml)
    return [node.text.strip() for node in root.iter() if node.tag.endswith("}t") and node.text and node.text.strip()]


def _extract_xlsx(content: bytes) -> str:
    with ZipFile(io.BytesIO(content)) as archive:
        shared: list[str] = []
        if "xl/sharedStrings.xml" in archive.namelist():
            shared = _xml_values(archive.read("xl/sharedStrings.xml"))
        rows: list[str] = []
        for name in sorted(item for item in archive.namelist() if item.startswith("xl/worksheets/sheet") and item.endswith(".xml")):
            root = ElementTree.fromstring(archive.read(name))
            for row in (node for node in root.iter() if node.tag.endswith("}row")):
                values: list[str] = []
                for cell in (node for node in row if node.tag.endswith("}c")):
                    cell_type = cell.attrib.get("t")
                    value = next((node.text for node in cell if node.tag.endswith("}v") and node.text), "")
                    if cell_type == "s" and value.isdigit() and int(value) < len(shared):
                        value = shared[int(value)]
                    values.append(value)
                if any(values):
                    rows.append("\t".join(values))
    return "\n".join(rows)


def _extract_pptx(content: bytes) -> str:
    with ZipFile(io.BytesIO(content)) as archive:
        slides = sorted(item for item in archive.namelist() if item.startswith("ppt/slides/slide") and item.endswith(".xml"))
        return "\n\n".join(" ".join(_xml_values(archive.read(name))) for name in slides)


def _extract_image_ocr(content: bytes, extension: str) -> str:
    tesseract = shutil.which("tesseract")
    if not tesseract:
        raise HTTPException(status_code=400, detail="Image OCR is not configured on this deployment")
    try:
        with tempfile.TemporaryDirectory(prefix="orgchai-ocr-") as temp_dir:
            image_path = Path(temp_dir) / f"source{extension}"
            image_path.write_bytes(content)
            result = subprocess.run(
                [tesseract, str(image_path), "stdout", "--psm", "3"],
                capture_output=True,
                text=True,
                timeout=60,
                check=False,
            )
    except (OSError, subprocess.SubprocessError) as exc:
        raise HTTPException(status_code=400, detail="Could not process this image for OCR") from exc
    if result.returncode != 0 or not result.stdout.strip():
        raise HTTPException(status_code=400, detail="The image contains no readable text")
    return result.stdout


def extract_text(content: bytes, extension: str) -> str:
    """Extract UTF-8 text from a supported source format."""
    extension = extension.lower()
    try:
        if extension == ".docx":
            with ZipFile(io.BytesIO(content)) as archive:
                xml = archive.read("word/document.xml")
            root = ElementTree.fromstring(xml)
            text = "\n".join(node.text or "" for node in root.iter() if node.tag.endswith("}t"))
        elif extension == ".xlsx":
            text = _extract_xlsx(content)
        elif extension == ".pptx":
            text = _extract_pptx(content)
        elif extension == ".pdf":
            try:
                from pypdf import PdfReader
            except ImportError as exc:
                raise HTTPException(status_code=400, detail="PDF extraction is not configured on this deployment") from exc
            reader = PdfReader(io.BytesIO(content))
            text = "\n\n".join(page.extract_text() or "" for page in reader.pages)
        elif extension in OCR_EXTENSIONS:
            text = _extract_image_ocr(content, extension)
        else:
            text = content.decode("utf-8")
            if extension in {".html", ".htm"}:
                parser = _TextParser()
                parser.feed(text)
                text = "\n".join(parser.parts)
    except UnicodeDecodeError as exc:
        raise HTTPException(status_code=400, detail="Text files must be UTF-8 encoded") from exc
    except (BadZipFile, OSError, ValueError, KeyError, ElementTree.ParseError) as exc:
        raise HTTPException(status_code=400, detail="Could not extract readable text from this file") from exc
    if not text.strip():
        raise HTTPException(status_code=400, detail="The uploaded file contains no readable text")
    return text


SUPPORTED_EXTENSIONS = {
    ".txt", ".md", ".markdown", ".html", ".htm", ".csv", ".tsv", ".rtf",
    ".docx", ".xlsx", ".pptx", ".pdf", ".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif", ".tif", ".tiff",
}

OCR_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif", ".tif", ".tiff"}


def supported_path(path: Path) -> bool:
    return path.is_file() and path.suffix.lower() in SUPPORTED_EXTENSIONS
