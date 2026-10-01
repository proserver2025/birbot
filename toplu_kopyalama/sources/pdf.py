"""PDF kataloqdan malların çıxarılması (şəkil + yaxınlığındakı mətn: MPN, qiymət).

Hər şəkil ayrıca mal sayılır; mətn blokları ən yaxın şəklə bağlanır.
Asılılıq: PyMuPDF (pip install pymupdf).
"""
from __future__ import annotations

import os
from datetime import datetime, timezone

from ..models import SourceItem, SourceType

MIN_IMAGE_SIDE = 80  # loqo və ikonları atmaq üçün (pt)


def _center(b):
    return ((b[0] + b[2]) / 2, (b[1] + b[3]) / 2)


def _dist(a, b) -> float:
    (ax, ay), (bx, by) = _center(a), _center(b)
    return ((ax - bx) ** 2 + (ay - by) ** 2) ** 0.5


def assign_blocks(images: list[tuple], blocks: list[tuple]) -> list[list[str]]:
    """images: [bbox], blocks: [(bbox, text)] -> hər şəkil üçün mətnlər."""
    out: list[list[str]] = [[] for _ in images]
    if not images:
        return out
    for bbox, text in blocks:
        nearest = min(range(len(images)), key=lambda i: _dist(images[i], bbox))
        out[nearest].append(text.strip())
    return out


def read_pdf(path: str, supplier: str, out_dir: str) -> list[SourceItem]:
    import fitz  # PyMuPDF

    os.makedirs(out_dir, exist_ok=True)
    doc = fitz.open(path)
    posted = datetime.fromtimestamp(os.path.getmtime(path), tz=timezone.utc)
    items: list[SourceItem] = []
    for pno, page in enumerate(doc):
        infos = [i for i in page.get_image_info(xrefs=True)
                 if (i["bbox"][2] - i["bbox"][0]) >= MIN_IMAGE_SIDE
                 and (i["bbox"][3] - i["bbox"][1]) >= MIN_IMAGE_SIDE]
        blocks = [((b[0], b[1], b[2], b[3]), b[4]) for b in page.get_text("blocks") if b[4].strip()]
        texts = assign_blocks([i["bbox"] for i in infos], blocks)
        for idx, info in enumerate(infos):
            img_path = os.path.join(out_dir, f"{os.path.basename(path)}_p{pno + 1}_{idx + 1}.png")
            pix = page.get_pixmap(clip=fitz.Rect(info["bbox"]), dpi=200)
            pix.save(img_path)
            items.append(SourceItem(
                source_type=SourceType.PDF,
                source_ref=f"{os.path.basename(path)}#p{pno + 1}-{idx + 1}",
                supplier=supplier,
                image_paths=[img_path],
                text="\n".join(texts[idx]),
                posted_at=posted,
            ))
    return items
