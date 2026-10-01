"""Ehtiyat axtarış sistemləri: Yandex (brauzer) və SerpAPI (gələcək, pullu).

Pipeline-da sıra: [GoogleSearcher, YandexSearcher, (istəyə görə) SerpApiSearcher].
Ehtiyat yalnız Google heç nə tapmayanda və ya CAPTCHA həll olunmayanda işə düşür.
"""
from __future__ import annotations

import json
import os
from urllib.parse import quote_plus
from urllib.request import urlopen

from ..models import SourceItem
from ..ports import CaptchaRequired, SearchUnavailable
from .base import Pace, RateLimiter, looks_like_captcha


class YandexSearcher:
    name = "yandex"

    def __init__(self, context, pace: Pace | None = None):
        self.context = context
        self.limiter = RateLimiter(pace or Pace())

    async def search(self, item: SourceItem, keyword: str) -> list[tuple[str, str]]:
        page = await self.context.new_page()
        try:
            await self.limiter.wait()
            if item.mpns:
                await page.goto(f"https://yandex.com/search/?text={quote_plus(item.mpns[0] + ' ' + keyword)}")
            elif item.image_paths:
                await page.goto("https://yandex.com/images/")
                await page.locator("input[type='file']").first.set_input_files(item.image_paths[0])
                await page.wait_for_load_state("networkidle")
            else:
                return []
            if looks_like_captcha(page.url, await page.content()):
                raise CaptchaRequired("yandex")
            links = await page.eval_on_selector_all(
                "a[href]", "els => els.map(e => [e.href, (e.innerText || '').trim()])")
            return [(h, t) for h, t in links if "birmarket.az/product" in h or "umico.az/product" in h]
        finally:
            await page.close()


class SerpApiSearcher:
    """Gələcək üçün: SERPAPI_KEY env dəyişəni varsa aktivdir. Şəkil ictimai URL olmalıdır."""
    name = "serpapi"

    def __init__(self, image_url_for, api_key: str | None = None):
        self.api_key = api_key or os.getenv("SERPAPI_KEY")
        self.image_url_for = image_url_for   # lokal şəkil yolu -> ictimai URL

    async def search(self, item: SourceItem, keyword: str) -> list[tuple[str, str]]:
        if not self.api_key or not item.image_paths:
            raise SearchUnavailable("serpapi deaktivdir")
        url = ("https://serpapi.com/search.json?engine=google_lens"
               f"&url={quote_plus(self.image_url_for(item.image_paths[0]))}"
               f"&q={quote_plus(keyword)}&api_key={self.api_key}")
        with urlopen(url, timeout=60) as resp:  # noqa: S310 — sabit https host
            data = json.load(resp)
        return [(m.get("link", ""), m.get("title", "")) for m in data.get("visual_matches", [])]
