"""Mesaj/PDF mətnindən maya və model (MPN) çıxarılması."""
from __future__ import annotations

import re
from decimal import Decimal, InvalidOperation

# "100 azn", "100₼", "100 manat", "100m", "qiymət: 100", "maya 100"
_CURRENCY = r"(?:azn|₼|manat|man\b|m\b)"
_NUM = r"(\d{1,6}(?:[.,]\d{1,2})?)"
_PRICE_PATTERNS = [
    re.compile(rf"{_NUM}\s*{_CURRENCY}", re.IGNORECASE),
    re.compile(rf"(?:qiym[əe]t|maya|price|цена)\s*[:\-=]?\s*{_NUM}", re.IGNORECASE),
]

# Model kodu: hərf+rəqəm qarışığı, ən az 4 simvol (məs. BHR8396GL, SM-A155F, RM-1234)
_MPN = re.compile(r"\b(?=[A-Z0-9\-/]*\d)(?=[A-Z0-9\-/]*[A-Z])[A-Z0-9][A-Z0-9\-/]{3,24}\b")
# Ölçü vahidləri MPN sayılmasın
_UNIT_LIKE = re.compile(r"^\d+(?:GB|TB|MB|ML|L|KG|G|W|V|MAH|HZ|MM|CM|M|X)$")


def _to_decimal(raw: str) -> Decimal | None:
    try:
        value = Decimal(raw.replace(",", "."))
    except InvalidOperation:
        return None
    return value if value > 0 else None


def extract_cost(text: str) -> tuple[Decimal | None, bool]:
    """(maya, şübhəli_mi) qaytarır.

    Fərqli bir neçə qiymət tapılarsa və ya heç biri tapılmazsa şübhəli sayılır
    -> mal təsdiq siyahısına düşür.
    """
    found: list[Decimal] = []
    for pattern in _PRICE_PATTERNS:
        for match in pattern.finditer(text or ""):
            value = _to_decimal(match.group(1))
            if value is not None and value not in found:
                found.append(value)
    if not found:
        return None, True
    if len(found) > 1:
        return found[0], True
    return found[0], False


def extract_mpns(text: str) -> list[str]:
    result: list[str] = []
    for match in _MPN.finditer((text or "").upper()):
        token = match.group(0).strip("-/")
        if len(token) < 4 or _UNIT_LIKE.match(token) or token in result:
            continue
        result.append(token)
    return result


def normalize_mpn(value: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", (value or "").upper())
