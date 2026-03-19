from __future__ import annotations

import json
import re
import sys
import zlib
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path


TITLE_BIOLOGY = "Správne odpovede - Biológia"
TITLE_CHEMISTRY = "Správne odpovede - Chémia"


@dataclass
class PageRecord:
    index: int
    object_number: int
    text: str


def read_objects(pdf_bytes: bytes) -> dict[int, bytes]:
    return {
        int(match.group(1)): match.group(3)
        for match in re.finditer(rb"(\d+)\s+(\d+)\s+obj(.*?)endobj", pdf_bytes, re.S)
    }


def inflate_stream(obj_body: bytes) -> bytes:
    match = re.search(rb"stream\r?\n(.*?)endstream", obj_body, re.S)
    if not match:
        return b""
    data = match.group(1)
    try:
        return zlib.decompress(data)
    except zlib.error:
        return data


def parse_cmap(cmap_stream: bytes) -> dict[int, str]:
    cmap: dict[int, str] = {}
    for start_hex, end_hex, unicode_hex in re.findall(
        rb"<([0-9A-Fa-f]+)><([0-9A-Fa-f]+)><([0-9A-Fa-f]+)>", cmap_stream
    ):
        start = int(start_hex, 16)
        end = int(end_hex, 16)
        unicode_start = int(unicode_hex, 16)
        for offset, code in enumerate(range(start, end + 1)):
            cmap[code] = chr(unicode_start + offset)
    for block in re.findall(rb"beginbfchar(.*?)endbfchar", cmap_stream, re.S):
        for src_hex, dst_hex in re.findall(rb"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>", block):
            if len(src_hex) == 4 and len(dst_hex) == 4:
                cmap[int(src_hex, 16)] = chr(int(dst_hex, 16))
    return cmap


def build_font_maps(objects: dict[int, bytes]) -> tuple[dict[int, dict[int, str]], dict[int, dict[str, int]]]:
    font_cmaps: dict[int, dict[int, str]] = {}
    resource_fonts: dict[int, dict[str, int]] = {}

    for obj_num, body in objects.items():
        match = re.search(rb"/ToUnicode\s+(\d+)\s+0\s+R", body)
        if match:
            to_unicode_obj = int(match.group(1))
            font_cmaps[obj_num] = parse_cmap(inflate_stream(objects[to_unicode_obj]))

        fonts = {
            font_name.decode(): int(font_obj)
            for font_name, font_obj in re.findall(rb"/([A-Za-z0-9]+)\s+(\d+)\s+0\s+R", body)
        }
        if fonts:
            resource_fonts[obj_num] = fonts

    return font_cmaps, resource_fonts


def decode_hex_string(hex_string: str, cmap: dict[int, str]) -> str:
    out: list[str] = []
    for index in range(0, len(hex_string), 4):
        chunk = hex_string[index : index + 4]
        if len(chunk) < 4:
            break
        out.append(cmap.get(int(chunk, 16), "?"))
    return "".join(out)


def decode_literal_string(raw: bytes) -> str:
    out: list[str] = []
    index = 0
    while index < len(raw):
        char = raw[index]
        if char == 92 and index + 1 < len(raw):
            index += 1
            escaped = raw[index]
            escape_map = {
                ord("n"): "\n",
                ord("r"): "\r",
                ord("t"): "\t",
                ord("b"): "\b",
                ord("f"): "\f",
                ord("("): "(",
                ord(")"): ")",
                ord("\\"): "\\",
            }
            out.append(escape_map.get(escaped, chr(escaped)))
        else:
            out.append(chr(char))
        index += 1
    return "".join(out)


def extract_pages(objects: dict[int, bytes]) -> list[tuple[int, int, int]]:
    pages: list[tuple[int, int, int]] = []
    for obj_num, body in objects.items():
        if b"/Type/Page" not in body:
            continue
        content_match = re.search(rb"/Contents\s+(\d+)\s+0\s+R", body)
        resource_match = re.search(rb"/Resources\s+(\d+)\s+0\s+R", body)
        if content_match and resource_match:
            pages.append((obj_num, int(content_match.group(1)), int(resource_match.group(1))))
    pages.sort()
    return pages


def extract_page_text(
    content_obj: int,
    resource_obj: int,
    objects: dict[int, bytes],
    font_cmaps: dict[int, dict[int, str]],
    resource_fonts: dict[int, dict[str, int]],
) -> str:
    token_pattern = re.compile(
        rb"/([A-Za-z0-9]+)\s+[\d\.]+\s+Tf|<([0-9A-Fa-f]+)>\s*Tj|\[(.*?)\]\s*TJ|\((.*?)\)\s*Tj",
        re.S,
    )
    inner_pattern = re.compile(rb"<([0-9A-Fa-f]+)>|\((.*?)\)", re.S)

    fonts = resource_fonts.get(resource_obj, {})
    content = inflate_stream(objects[content_obj])
    current_font: str | None = None
    parts: list[str] = []

    for match in token_pattern.finditer(content):
        if match.group(1):
            current_font = match.group(1).decode()
            continue

        cmap = font_cmaps.get(fonts.get(current_font or "", -1), {})

        if match.group(2):
            parts.append(decode_hex_string(match.group(2).decode(), cmap))
            continue

        if match.group(3):
            segment_parts: list[str] = []
            for inner in inner_pattern.finditer(match.group(3)):
                if inner.group(1):
                    segment_parts.append(decode_hex_string(inner.group(1).decode(), cmap))
                elif inner.group(2):
                    segment_parts.append(decode_literal_string(inner.group(2)))
            parts.append("".join(segment_parts))
            continue

        if match.group(4):
            parts.append(decode_literal_string(match.group(4)))

    return "\n".join(parts)


def normalize_answer_page(text: str) -> str:
    return re.sub(r"\s+", "", text)


def parse_answer_page_sequences(text: str, title: str) -> list[dict[str, object]]:
    compact = normalize_answer_page(text)
    compact = compact.replace(title.replace(" ", ""), "")
    entries: list[dict[str, object]] = []

    index = 0
    while index < len(compact):
        if not compact[index].isdigit():
            index += 1
            continue

        number_end = index
        while number_end < len(compact) and compact[number_end].isdigit():
            number_end += 1

        letters_end = number_end
        while letters_end < len(compact) and compact[letters_end] in "ABCD":
            letters_end += 1

        number_text = compact[index:number_end]
        answer_text = compact[number_end:letters_end]
        if number_text and answer_text:
            entries.append(
                {
                    "questionNumber": int(number_text),
                    "correctChoices": list(answer_text),
                }
            )
        index = letters_end if letters_end > index else index + 1

    entries.sort(key=lambda item: int(item["questionNumber"]))
    return entries


def write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def write_text(path: Path, payload: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(payload, encoding="utf-8")


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: import_pdf.py <path-to-pdf>")
        return 1

    pdf_path = Path(sys.argv[1]).expanduser().resolve()
    if not pdf_path.exists():
        print(f"Missing PDF: {pdf_path}")
        return 1

    repo_root = Path(__file__).resolve().parents[1]
    output_root = repo_root / "packages" / "question-bank" / "data" / "imports"

    pdf_bytes = pdf_path.read_bytes()
    objects = read_objects(pdf_bytes)
    font_cmaps, resource_fonts = build_font_maps(objects)
    pages = extract_pages(objects)

    page_records: list[PageRecord] = []
    for page_index, (page_object, content_object, resource_object) in enumerate(pages, start=1):
        text = extract_page_text(content_object, resource_object, objects, font_cmaps, resource_fonts)
        page_records.append(PageRecord(page_index, page_object, text))

    for page in page_records:
        write_text(
            output_root / "raw-pages" / f"page-{page.index:03d}.txt",
            page.text,
        )

    biology_pages = [page for page in page_records if "LF - Biológia" in page.text]
    chemistry_pages = [page for page in page_records if "LF - Chémia" in page.text]

    write_json(
        output_root / "manifests" / "latest-import.json",
        {
            "sourceFileName": pdf_path.name,
            "importedAt": datetime.now(timezone.utc).isoformat(),
            "pageCount": len(page_records),
            "sections": ["biology", "chemistry"],
            "biologyPageCount": len(biology_pages),
            "chemistryPageCount": len(chemistry_pages),
        },
    )

    answer_pages = []
    for page in page_records:
        normalized_page = normalize_answer_page(page.text)
        if TITLE_BIOLOGY.replace(" ", "") in normalized_page:
            answer_pages.append(("biology", page))
        elif TITLE_CHEMISTRY.replace(" ", "") in normalized_page:
            answer_pages.append(("chemistry", page))

    for subject, page in answer_pages:
        title = TITLE_BIOLOGY if subject == "biology" else TITLE_CHEMISTRY
        entries = parse_answer_page_sequences(page.text, title)
        write_json(
            output_root / "answer-keys" / f"{subject}-page-{page.index:03d}.json",
            {
                "subject": subject,
                "pageIndex": page.index,
                "sourceTitle": title,
                "entries": entries,
            },
        )

    print(f"Imported {len(page_records)} pages from {pdf_path.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
