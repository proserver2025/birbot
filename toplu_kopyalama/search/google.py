"""Google axtarışı (API açarı olmadan, adi brauzerlə).

Strategiya:
1) Malın MPN-i varsa: google.com/search?q="MPN" birmarket  -> ən dəqiq yol.
2) Yoxdursa: Google Lens-ə şəkil yüklənir, nəticəyə açar söz (birmarket/umico) əlavə olunur.

DİQQƏT: Google-un səhifə selektorları dəyişir. VPS-də real brauzerdə yoxlanmalı və
lazım olsa SELECTORS düzəldilməlidir (TOPLU_KOPYALAMA.md, addım 4).
"""
from __future__ import annotations

from urllib.parse import quote_plus

from ..models import SourceItem
from ..ports import CaptchaRequired
from .base import Pace, RateLimiter, looks_like_captcha, wait_for_human

SELECTORS = {
    "consent_accept": "button:has-text('Accept all'), button:has-text('Hamısını qəbul edin'), button:has-text('Принять все')",
    "lens_button": "div[aria-label='Search by image'], div[aria-label='Şəklə görə axtarış'], div[role='button'][aria-label*='image' i]",
    "file_input": "input[type='file']",
    "lens_text_box": "textarea, input[type='text']",
    "result_links": "a[href*='birmarket.az/product'], a[href*='umico.az/product'], a[href*='/url?']",
}


class GoogleSearcher:
    name = "google"

    def __init__(self, context, notify, pace: Pace | None = None, captcha_wait_s: float = 900):
        self.context = context            # open_persistent_browser(...) ilə açılmış kontekst
        self.notify = notify
        self.limiter = RateLimiter(pace or Pace())
        self.captcha_wait_s = captcha_wait_s
        self._page = None

    async def _page_(self):
        if self._page is None or self._page.is_closed():
            self._page = self.context.pages[0] if self.context.pages else await self.context.new_page()
        return self._page

    async def _guard(self, page) -> None:
        if looks_like_captcha(page.url, await page.content()):
            if not await wait_for_human(page, self.captcha_wait_s, self.notify):
                raise CaptchaRequired("google")

    async def _accept_consent(self, page) -> None:
        btn = page.locator(SELECTORS["consent_accept"]).first
        if await btn.count():
            await btn.click()

    async def _collect(self, page) -> list[tuple[str, str]]:
        await page.wait_for_load_state("domcontentloaded")
        links = await page.eval_on_selector_all(
            SELECTORS["result_links"],
            "els => els.map(e => [e.href, (e.innerText || e.getAttribute('aria-label') || '').trim()])",
        )
        return [(h, t) for h, t in links if "birmarket.az" in h or "umico.az" in h]

    async def text_search(self, query: str) -> list[tuple[str, str]]:
        await self.limiter.wait()
        page = await self._page_()
        await page.goto(f"https://www.google.com/search?q={quote_plus(query)}&hl=az&num=20")
        await self._accept_consent(page)
        await self._guard(page)
        return await self._collect(page)

    async def lens_search(self, image_path: str, keyword: str) -> list[tuple[str, str]]:
        await self.limiter.wait()
        page = await self._page_()
        await page.goto("https://www.google.com/?hl=az")
        await self._accept_consent(page)
        await self._guard(page)
        await page.locator(SELECTORS["lens_button"]).first.click()
        await page.locator(SELECTORS["file_input"]).first.set_input_files(image_path)
        await page.wait_for_load_state("networkidle")
        await self._guard(page)
        # Lens nəticəsinə açar söz əlavə et ("Add to your search")
        box = page.locator(SELECTORS["lens_text_box"]).first
        if await box.count():
            await box.fill(keyword)
            await box.press("Enter")
            await page.wait_for_load_state("networkidle")
            await self._guard(page)
        return await self._collect(page)

    async def search(self, item: SourceItem, keyword: str) -> list[tuple[str, str]]:
        results: list[tuple[str, str]] = []
        for mpn in item.mpns[:2]:
            results += await self.text_search(f'"{mpn}" {keyword}')
        if not results:
            for img in item.image_paths[:2]:
                results += await self.lens_search(img, keyword)
        return results
