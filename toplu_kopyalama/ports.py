"""Xarici sistemlərlə əlaqə interfeysləri.

Hər interfeysi VPS-də botun mövcud kodu ilə birləşdirmək lazımdır
(TOPLU_KOPYALAMA.md, addım 3). Pipeline yalnız bu interfeyslərdən istifadə edir.
"""
from __future__ import annotations

from typing import Protocol

from .models import Candidate, PriceSet, SourceItem


class CaptchaRequired(Exception):
    """Axtarış sistemi CAPTCHA göstərdi; insan həll edənə qədər gözləmək lazımdır."""


class SearchUnavailable(Exception):
    """Axtarış sistemi müvəqqəti işləmir (bloklanma, şəbəkə)."""


class ImageSearcher(Protocol):
    name: str

    async def search(self, item: SourceItem, keyword: str) -> list[tuple[str, str]]:
        """(url, başlıq) siyahısı. keyword: 'birmarket' və ya 'umico'."""
        ...


class CandidateInspector(Protocol):
    async def inspect(self, cand: Candidate) -> Candidate:
        """Başlıq, səhifə mətni, status (aktiv/deaktiv) və satıcı sayını doldurur."""
        ...


class Copier(Protocol):
    async def copy_sku(self, merchant_id: str, sku: str, prices: PriceSet) -> str:
        """Mövcud SKU-nu mağazaya kopyalayır, botdakı məhsul id-sini qaytarır.

        Botdakı mövcud Birmarket API inteqrasiyası ilə edilməlidir.
        """
        ...


class Repository(Protocol):
    async def is_sku_in_merchant(self, merchant_id: str, sku: str) -> bool: ...

    async def set_cost_and_supplier(self, product_id: str, cost, supplier: str) -> None: ...

    async def save_item(self, job_id: int, item: SourceItem) -> int: ...

    async def save_candidate(self, item_id: int, result, merchant_id: str | None,
                             state: str, note: str = "", product_id: str | None = None) -> int: ...

    async def update_candidate(self, candidate_id: int, state: str, note: str = "",
                               product_id: str | None = None) -> None: ...

    async def update_item_state(self, item_id: int, state: str, note: str = "") -> None: ...


class Notifier(Protocol):
    async def notify(self, text: str) -> None: ...
