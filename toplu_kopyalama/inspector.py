"""Birmarket məhsul səhifəsinin yoxlanması: başlıq, mətn, aktiv/deaktiv status.

Üstünlük: botdakı mövcud Birmarket API inteqrasiyası (kabinetdə SKU ilə axtarış)
SKU-nun satıcılarını qaytarırsa, onu istifadə edən inspector yazılmalıdır — bu,
səhifəni oxumaqdan daha etibarlıdır. Bu sinif ehtiyat variantdır.

DİQQƏT: aktiv/deaktiv markerləri VPS-də real səhifələrlə yoxlanmalıdır
(TOPLU_KOPYALAMA.md, addım 2).
"""
from __future__ import annotations

from .models import Candidate, SkuStatus
from .skus import sku_from_page

INACTIVE_MARKERS = ("stokda yoxdur", "mövcud deyil", "satışda yoxdur", "нет в наличии")
ACTIVE_MARKERS = ("səbətə əlavə et", "sebete elave et", "в корзину", "indi al")


def status_from_text(text: str) -> SkuStatus:
    low = (text or "").lower()
    if any(m in low for m in INACTIVE_MARKERS):
        return SkuStatus.INACTIVE
    if any(m in low for m in ACTIVE_MARKERS):
        return SkuStatus.ACTIVE
    return SkuStatus.UNKNOWN


class PlaywrightInspector:
    def __init__(self, context):
        self.context = context

    async def inspect(self, cand: Candidate) -> Candidate:
        page = await self.context.new_page()
        try:
            resp = await page.goto(cand.url, wait_until="domcontentloaded")
            if resp is not None and resp.status == 404:
                cand.status = SkuStatus.UNKNOWN
                return cand
            cand.title = (await page.title()) or cand.title
            cand.page_text = (await page.inner_text("body"))[:20_000]
            cand.status = status_from_text(cand.page_text)
            cand.sku = sku_from_page(cand.page_text) or cand.sku
            return cand
        finally:
            await page.close()
