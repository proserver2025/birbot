"""Axtarış nəticəsi linklərindən Birmarket SKU-larının çıxarılması.

Birmarket link formatı: https://birmarket.az/product/<id>-<slug>
DİQQƏT: <id>-nin satıcı kabinetindəki SKU ilə eyni olduğu VPS-də yoxlanmalıdır
(TOPLU_KOPYALAMA.md, addım 2). Fərqlidirsə, SKU səhifə mətnindən götürülür.
"""
from __future__ import annotations

import re
from urllib.parse import parse_qs, unquote, urlparse

from .models import Candidate

BIRMARKET_HOSTS = {"birmarket.az", "www.birmarket.az"}
UMICO_HOSTS = {"umico.az", "www.umico.az"}

_PRODUCT_PATH = re.compile(r"^/(?:[a-z]{2}/)?product/(\d+)(?:-[^/]*)?/?$")
_PAGE_SKU = re.compile(r"(?:SKU|M[əe]hsul kodu|Артикул|Код товара)\s*[:#]?\s*(\d{3,})", re.IGNORECASE)


def unwrap_google_url(url: str) -> str:
    """Google yönləndirmə linkini (/url?q=...) açır."""
    parsed = urlparse(url)
    if parsed.path == "/url":
        target = parse_qs(parsed.query).get("q") or parse_qs(parsed.query).get("url")
        if target:
            return unquote(target[0])
    return url


def sku_from_url(url: str) -> str | None:
    parsed = urlparse(unwrap_google_url(url))
    if parsed.hostname not in BIRMARKET_HOSTS | UMICO_HOSTS:
        return None
    match = _PRODUCT_PATH.match(parsed.path)
    return match.group(1) if match else None


def sku_from_page(text: str) -> str | None:
    match = _PAGE_SKU.search(text or "")
    return match.group(1) if match else None


def candidates_from_links(links: list[tuple[str, str]]) -> list[Candidate]:
    """(url, başlıq) siyahısından təkrarsız Birmarket namizədləri."""
    seen: set[str] = set()
    result: list[Candidate] = []
    for url, title in links:
        clean = unwrap_google_url(url)
        sku = sku_from_url(clean)
        if not sku or sku in seen:
            continue
        seen.add(sku)
        result.append(Candidate(url=clean, sku=sku, title=title or ""))
    return result
