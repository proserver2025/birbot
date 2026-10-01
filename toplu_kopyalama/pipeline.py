"""Toplu kopyalama işçisi: mənbə -> axtarış -> yoxlama -> kopyalama -> maya/təchizatçı."""
from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

from . import pricing
from .matching import MatchThresholds, score
from .models import (
    Candidate, Decision, ItemState, MatchResult, SkuStatus, SourceItem, StockFilter,
)
from .parsing import extract_cost, extract_mpns
from .ports import (
    CandidateInspector, CaptchaRequired, Copier, ImageSearcher, Notifier, Repository,
    SearchUnavailable,
)
from .skus import candidates_from_links

log = logging.getLogger(__name__)


@dataclass
class JobConfig:
    stock_filter: StockFilter = StockFilter.BOTH
    merchant_id: str | None = None             # işin aid olduğu mağaza (məs. Trendify), paneldən
    price_rule: pricing.PriceRule = field(default_factory=pricing.PriceRule)
    thresholds: MatchThresholds = field(default_factory=MatchThresholds)
    keywords: tuple[str, ...] = ("birmarket", "umico")
    days_back: int = 15
    limit: int | None = 3                      # ilk sınaq: 3 mal
    copy_timeout_s: float = 60
    copy_retries: int = 2


def merchant_for(status: SkuStatus, cfg: JobConfig) -> str | None:
    """SKU filtrdən keçirsə işin mağazasını qaytarır, keçmirsə None.

    Filtr: rəqibsiz (deaktiv) / rəqibli (aktiv) / hər ikisi — hamısı eyni mağazaya.
    """
    if status == SkuStatus.ACTIVE and cfg.stock_filter in (StockFilter.ONLY_ACTIVE, StockFilter.BOTH):
        return cfg.merchant_id
    if status == SkuStatus.INACTIVE and cfg.stock_filter in (StockFilter.ONLY_INACTIVE, StockFilter.BOTH):
        return cfg.merchant_id
    return None


def select_window(items: list[SourceItem], days_back: int, now: datetime | None = None) -> list[SourceItem]:
    """Son N gün; ən yenidən geriyə doğru."""
    now = now or datetime.now(timezone.utc)
    since = now - timedelta(days=days_back)

    def ts(i: SourceItem) -> datetime:
        p = i.posted_at or now
        return p if p.tzinfo else p.replace(tzinfo=timezone.utc)

    picked = [i for i in items if ts(i) >= since]
    return sorted(picked, key=ts, reverse=True)


def enrich(item: SourceItem) -> SourceItem:
    """Mətndən maya və MPN doldurur (mənbə artıq doldurubsa toxunmur)."""
    if item.cost is None:
        item.cost, item.cost_uncertain = extract_cost(item.text)
    if not item.mpns:
        item.mpns = extract_mpns(item.text)
    return item


class BulkCopyWorker:
    def __init__(self, searchers: list[ImageSearcher], inspector: CandidateInspector,
                 copier: Copier, repo: Repository, notifier: Notifier, cfg: JobConfig):
        if not searchers:
            raise ValueError("ən azı bir axtarış sistemi lazımdır")
        self.searchers = searchers          # sıra: Google, sonra ehtiyat (Yandex, SerpAPI)
        self.inspector = inspector
        self.copier = copier
        self.repo = repo
        self.notifier = notifier
        self.cfg = cfg

    async def run(self, job_id: int, items: list[SourceItem]) -> dict[str, int]:
        stats = {"processed": 0, "copied": 0, "approval": 0, "skipped": 0, "failed": 0}
        window = select_window(items, self.cfg.days_back)
        if self.cfg.limit is not None:
            window = window[: self.cfg.limit]
        for item in window:
            enrich(item)
            item_id = await self.repo.save_item(job_id, item)
            try:
                outcome = await self.process_item(item_id, item)
            except CaptchaRequired as exc:
                await self.repo.update_item_state(item_id, ItemState.PENDING, f"captcha: {exc}")
                await self.notifier.notify(f"Toplu kopyalama dayandı: CAPTCHA ({exc}). Həll edib davam et.")
                raise
            except Exception as exc:  # bir malın xətası bütün işi dayandırmasın
                log.exception("mal emal olunmadı: %s", item.source_ref)
                await self.repo.update_item_state(item_id, ItemState.FAILED, str(exc)[:500])
                outcome = "failed"
            stats["processed"] += 1
            stats[outcome] += 1
        return stats

    async def search(self, item: SourceItem) -> list[Candidate]:
        last_captcha: CaptchaRequired | None = None
        for searcher in self.searchers:
            links: list[tuple[str, str]] = []
            try:
                for kw in self.cfg.keywords:
                    links += await searcher.search(item, kw)
            except CaptchaRequired as exc:
                last_captcha = exc
                continue
            except SearchUnavailable:
                log.warning("%s əlçatmazdır, növbətiyə keçirəm", searcher.name)
                continue
            cands = candidates_from_links(links)
            if cands:
                return cands
        if last_captcha:
            raise last_captcha
        return []

    async def process_item(self, item_id: int, item: SourceItem) -> str:
        await self.repo.update_item_state(item_id, ItemState.SEARCHING)
        cands = await self.search(item)
        if not cands:
            await self.repo.update_item_state(item_id, ItemState.SKIPPED, "Birmarket linki tapılmadı")
            return "skipped"

        # Bir neçə variant varsa hamısı yoxlanılır
        matches: list[MatchResult] = []
        for cand in cands:
            cand = await self.inspector.inspect(cand)
            result = score(item, cand, self.cfg.thresholds)
            if result.decision != Decision.REJECT:
                matches.append(result)

        if not matches:
            await self.repo.update_item_state(item_id, ItemState.SKIPPED, "eyni mal tapılmadı")
            return "skipped"

        copied = approval = 0
        for m in matches:
            if m.candidate.status == SkuStatus.UNKNOWN:
                await self.repo.save_candidate(item_id, m, None, ItemState.NEEDS_APPROVAL,
                                               "SKU statusu (aktiv/deaktiv) bilinmir")
                approval += 1
                continue
            merchant = merchant_for(m.candidate.status, self.cfg)
            if merchant is None:
                await self.repo.save_candidate(item_id, m, None, ItemState.SKIPPED, "filtrdən keçmədi")
                continue
            if await self.repo.is_sku_in_merchant(merchant, m.candidate.sku):
                await self.repo.save_candidate(item_id, m, merchant, ItemState.SKIPPED, "artıq mağazada var")
                continue

            reasons = []
            if m.decision != Decision.AUTO:
                reasons.append("model əmin deyil")
            if item.cost is None or item.cost_uncertain:
                reasons.append("maya əmin deyil")
            if reasons:
                await self.repo.save_candidate(item_id, m, merchant, ItemState.NEEDS_APPROVAL, "; ".join(reasons))
                approval += 1
                continue

            cand_id = await self.repo.save_candidate(item_id, m, merchant, ItemState.COPYING)
            if await self.copy_one(cand_id, merchant, m.candidate.sku, item):
                copied += 1

        if copied:
            state, outcome = ItemState.COPIED, "copied"
        elif approval:
            state, outcome = ItemState.NEEDS_APPROVAL, "approval"
        else:
            state, outcome = ItemState.SKIPPED, "skipped"
        await self.repo.update_item_state(item_id, state)
        return outcome

    async def copy_one(self, cand_id: int, merchant: str, sku: str, item: SourceItem) -> bool:
        """Kopyalama + maya/təchizatçı yazılması. İlişməyə qarşı timeout və təkrar cəhd."""
        prices = pricing.calculate(item.cost, self.cfg.price_rule)
        last_error = ""
        for attempt in range(self.cfg.copy_retries + 1):
            try:
                product_id = await asyncio.wait_for(
                    self.copier.copy_sku(merchant, sku, prices), self.cfg.copy_timeout_s)
            except Exception as exc:
                last_error = f"{type(exc).__name__}: {exc}"
                log.warning("kopyalama cəhdi %s uğursuz: %s", attempt + 1, last_error)
                # Timeout olsa da SKU əlavə olunmuş ola bilər — təkrar kopya yaratmayaq
                if await self.repo.is_sku_in_merchant(merchant, sku):
                    last_error += " (SKU mağazada göründü, product_id yoxlanmalıdır)"
                    break
                await asyncio.sleep(2 ** attempt)
                continue
            # Mal DB-yə düşəndən sonra maya və təchizatçı
            await self.repo.set_cost_and_supplier(product_id, item.cost, item.supplier)
            await self.repo.update_candidate(cand_id, ItemState.COPIED, product_id=product_id)
            return True
        await self.repo.update_candidate(cand_id, ItemState.FAILED, last_error[:500])
        return False

    async def approve(self, cand_id: int, merchant: str, sku: str, item: SourceItem) -> bool:
        """Paneldən təsdiq: istifadəçi mayanı düzəldib təsdiqləyəndə çağırılır."""
        if item.cost is None:
            raise ValueError("təsdiqdən əvvəl maya daxil edilməlidir")
        await self.repo.update_candidate(cand_id, ItemState.COPYING)
        return await self.copy_one(cand_id, merchant, sku, item)
