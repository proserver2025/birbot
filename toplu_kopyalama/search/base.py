"""Brauzer axtarışı üçün ümumi köməkçilər: tempo, CAPTCHA aşkarlanması, brauzer profili.

CAPTCHA-nı azaltmaq üçün qaydalar (bax TOPLU_KOPYALAMA.md, "Google və CAPTCHA"):
- Daimi brauzer profili (user_data_dir), içində Gmail-ə bir dəfə əl ilə giriş edilib.
- Headless yox, VPS-də Xvfb + görünən Chromium (noVNC ilə baxmaq olur).
- Sorğular arası təsadüfi fasilə, saatlıq limit, bir tab.
- MPN varsa əvvəlcə adi mətn axtarışı (daha dəqiq və CAPTCHA az çıxır).
"""
from __future__ import annotations

import asyncio
import random
import time
from collections import deque
from dataclasses import dataclass

CAPTCHA_MARKERS = (
    "/sorry/", "unusual traffic", "qeyri-adi trafik", "необычный трафик",
    "recaptcha", "showcaptcha", "captcha",
)


def looks_like_captcha(url: str, html: str) -> bool:
    low_url = (url or "").lower()
    if "/sorry/" in low_url or "showcaptcha" in low_url:
        return True
    low = (html or "")[:200_000].lower()
    return any(m in low for m in CAPTCHA_MARKERS[1:4]) or 'id="captcha-form"' in low


@dataclass
class Pace:
    min_delay_s: float = 8
    max_delay_s: float = 20
    max_per_hour: int = 60


class RateLimiter:
    def __init__(self, pace: Pace):
        self.pace = pace
        self._history: deque[float] = deque()

    async def wait(self) -> None:
        now = time.monotonic()
        while self._history and now - self._history[0] > 3600:
            self._history.popleft()
        if len(self._history) >= self.pace.max_per_hour:
            await asyncio.sleep(3600 - (now - self._history[0]) + 1)
        if self._history:
            await asyncio.sleep(random.uniform(self.pace.min_delay_s, self.pace.max_delay_s))
        self._history.append(time.monotonic())


async def wait_for_human(page, timeout_s: float, notify) -> bool:
    """CAPTCHA çıxanda: xəbər ver, insan həll edənə qədər gözlə (səhifə dəyişəndə davam)."""
    await notify(f"CAPTCHA çıxdı ({page.url[:80]}). VPS brauzerində (noVNC) həll et, bot gözləyir.")
    deadline = time.monotonic() + timeout_s
    while time.monotonic() < deadline:
        await asyncio.sleep(5)
        if not looks_like_captcha(page.url, await page.content()):
            return True
    return False


async def open_persistent_browser(user_data_dir: str, headless: bool = False):
    """Daimi profil ilə Chromium. Qaytarır: (playwright, context)."""
    from playwright.async_api import async_playwright  # lazım olanda yüklənir

    pw = await async_playwright().start()
    context = await pw.chromium.launch_persistent_context(
        user_data_dir,
        headless=headless,
        locale="az-AZ",
        viewport={"width": 1366, "height": 850},
        args=["--disable-blink-features=AutomationControlled"],
    )
    return pw, context
