import asyncio
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest

from toplu_kopyalama import pricing
from toplu_kopyalama.inspector import status_from_text
from toplu_kopyalama.matching import score
from toplu_kopyalama.models import (
    Candidate, Decision, SkuStatus, SourceItem, SourceType, StockFilter,
)
from toplu_kopyalama.parsing import extract_cost, extract_mpns
from toplu_kopyalama.pipeline import BulkCopyWorker, JobConfig, merchant_for, select_window
from toplu_kopyalama.ports import CaptchaRequired
from toplu_kopyalama.search.base import looks_like_captcha
from toplu_kopyalama.skus import candidates_from_links, sku_from_url
from toplu_kopyalama.sources.messages import RawMessage, group_messages
from toplu_kopyalama.sources.pdf import assign_blocks

NOW = datetime(2026, 10, 1, 12, tzinfo=timezone.utc)


# --- qiymət ---------------------------------------------------------------

def test_default_prices_for_cost_100():
    p = pricing.calculate(Decimal("100"))
    assert (p.sale, p.discount, p.upper_limit) == (Decimal("210.00"), Decimal("140.00"), Decimal("200.00"))


def test_custom_rule_and_invalid_cost():
    rule = pricing.PriceRule.from_mapping({"sale_pct": 50})
    assert pricing.calculate(Decimal("10"), rule).sale == Decimal("15.00")
    with pytest.raises(ValueError):
        pricing.calculate(Decimal("0"))


# --- parser ---------------------------------------------------------------

@pytest.mark.parametrize("text,cost,uncertain", [
    ("Redmi Buds 6 Active\n35 azn", Decimal("35"), False),
    ("Qiymət: 12,50", Decimal("12.50"), False),
    ("maya 40₼", Decimal("40"), False),
    ("topdan 30 azn, pərakəndə 45 azn", Decimal("30"), True),
    ("sadəcə şəkil", None, True),
])
def test_extract_cost(text, cost, uncertain):
    assert extract_cost(text) == (cost, uncertain)


def test_extract_mpns_skips_units():
    mpns = extract_mpns("Xiaomi Redmi Buds 6 Active BHR8396GL 128GB 5000mAh SM-A155F")
    assert "BHR8396GL" in mpns and "SM-A155F" in mpns
    assert "128GB" not in mpns and "5000MAH" not in mpns


# --- SKU ------------------------------------------------------------------

def test_sku_from_urls():
    assert sku_from_url("https://birmarket.az/product/950388-simsiz-qulaqliqlar") == "950388"
    assert sku_from_url("https://www.google.com/url?q=https://birmarket.az/product/7792-arko-250&sa=U") == "7792"
    # İstifadəçi təsdiqlədi: linkdəki rəqəm = SKU (dil prefiksi və #search_id ilə)
    assert sku_from_url("https://birmarket.az/ru/product/2819110-agcaqanad-paneli-led"
                        "#search_id=3a4a5212-85b6-46d9-925b-20a38a7d21ec") == "2819110"
    assert sku_from_url("https://birmarket.az/category/telefonlar") is None
    assert sku_from_url("https://example.com/product/123") is None


def test_candidates_dedupe():
    c = candidates_from_links([
        ("https://birmarket.az/product/1-a", "A"),
        ("https://birmarket.az/product/1-a?utm=x", "A"),
        ("https://birmarket.az/product/2-b", "B"),
    ])
    assert [x.sku for x in c] == ["1", "2"]


# --- uyğunluq -------------------------------------------------------------

def _item(text="", mpns=None, cost=Decimal("100"), uncertain=False, days_ago=1):
    return SourceItem(source_type=SourceType.WHATSAPP, source_ref=f"m{days_ago}{text[:5]}",
                      supplier="PMT EVIZ", text=text, mpns=mpns or [], cost=cost,
                      cost_uncertain=uncertain, posted_at=NOW - timedelta(days=days_ago),
                      image_paths=["x.jpg"])


def test_mpn_match_is_auto():
    r = score(_item(mpns=["BHR8396GL"]), Candidate(url="u", sku="1", title="Redmi Buds 6 (BHR8396GL)"))
    assert r.decision == Decision.AUTO


def test_mpn_mismatch_never_auto():
    r = score(_item(text="Redmi Buds 6 Active", mpns=["BHR8396GL"]),
              Candidate(url="u", sku="1", title="Redmi Buds 6 Active Black BHR9999GL"))
    assert r.decision != Decision.AUTO


def test_unrelated_rejected():
    r = score(_item(text="Saç maskası zeytun"), Candidate(url="u", sku="1", title="Simsiz qulaqlıq Xiaomi"))
    assert r.decision == Decision.REJECT


# --- filtr və tarix -------------------------------------------------------

def test_merchant_routing():
    cfg = JobConfig(stock_filter=StockFilter.BOTH, merchant_for_active="TRENDIFY", merchant_for_inactive="MAXI")
    assert merchant_for(SkuStatus.ACTIVE, cfg) == "TRENDIFY"
    assert merchant_for(SkuStatus.INACTIVE, cfg) == "MAXI"
    cfg.stock_filter = StockFilter.ONLY_INACTIVE
    assert merchant_for(SkuStatus.ACTIVE, cfg) is None


def test_window_newest_first():
    items = [_item("a", days_ago=20), _item("b", days_ago=2), _item("c", days_ago=1)]
    assert [i.text for i in select_window(items, 15, now=NOW)] == ["c", "b"]


def test_status_markers():
    assert status_from_text("... Stokda yoxdur ...") == SkuStatus.INACTIVE
    assert status_from_text("Səbətə əlavə et") == SkuStatus.ACTIVE
    assert status_from_text("") == SkuStatus.UNKNOWN


def test_captcha_detection():
    assert looks_like_captcha("https://www.google.com/sorry/index?x", "")
    assert looks_like_captcha("https://google.com/search", "Our systems have detected unusual traffic")
    assert not looks_like_captcha("https://google.com/search", "<html>results</html>")


# --- mənbələr -------------------------------------------------------------

def test_whatsapp_caption_grouping():
    t = NOW
    msgs = [
        RawMessage("1", "ali", t, image_paths=["a.jpg"]),
        RawMessage("2", "ali", t + timedelta(minutes=1), text="BHR8396GL 35 azn"),
        RawMessage("3", "ali", t + timedelta(minutes=10), image_paths=["b.jpg"], text="50 azn"),
        RawMessage("4", "veli", t + timedelta(minutes=11), text="salam"),
    ]
    items = group_messages(msgs, "  PMT   EVIZ ")
    assert len(items) == 2
    assert items[0].text == "BHR8396GL 35 azn" and items[0].supplier == "PMT EVIZ"
    assert items[1].text == "50 azn"


def test_pdf_block_assignment():
    images = [(0, 0, 100, 100), (0, 300, 100, 400)]
    blocks = [((0, 110, 100, 130), "BHR8396GL 35 azn"), ((0, 410, 100, 430), "SM-A155F 200 azn")]
    assert assign_blocks(images, blocks) == [["BHR8396GL 35 azn"], ["SM-A155F 200 azn"]]


# --- pipeline (saxta adapterlərlə) ----------------------------------------

class FakeSearcher:
    name = "fake"

    def __init__(self, links=None, captcha=False):
        self.links, self.captcha, self.calls = links or [], captcha, 0

    async def search(self, item, keyword):
        self.calls += 1
        if self.captcha:
            raise CaptchaRequired("fake")
        return self.links


class FakeInspector:
    def __init__(self, pages):
        self.pages = pages

    async def inspect(self, cand):
        title, status = self.pages[cand.sku]
        cand.title, cand.status = title, status
        return cand


class FakeCopier:
    def __init__(self, fail_times=0, hang=False):
        self.calls, self.fail_times, self.hang = [], fail_times, hang

    async def copy_sku(self, merchant_id, sku, prices):
        self.calls.append((merchant_id, sku, prices.sale))
        if self.hang:
            await asyncio.sleep(10)
        if len(self.calls) <= self.fail_times:
            raise RuntimeError("ilişdi")
        return f"P-{sku}"


class FakeRepo:
    def __init__(self, existing=()):
        self.existing = set(existing)
        self.items, self.cands, self.costs = {}, {}, []

    async def is_sku_in_merchant(self, merchant_id, sku):
        return (merchant_id, sku) in self.existing

    async def set_cost_and_supplier(self, product_id, cost, supplier):
        self.costs.append((product_id, cost, supplier))

    async def save_item(self, job_id, item):
        self.items[len(self.items) + 1] = ["pending", ""]
        return len(self.items)

    async def save_candidate(self, item_id, result, merchant_id, state, note="", product_id=None):
        cid = len(self.cands) + 1
        self.cands[cid] = {"sku": result.candidate.sku, "merchant": merchant_id, "state": state, "note": note}
        return cid

    async def update_candidate(self, candidate_id, state, note="", product_id=None):
        self.cands[candidate_id].update(state=state, note=note, product_id=product_id)

    async def update_item_state(self, item_id, state, note=""):
        self.items[item_id] = [state, note]


class FakeNotifier:
    def __init__(self):
        self.messages = []

    async def notify(self, text):
        self.messages.append(text)


LINKS = [("https://birmarket.az/product/11-buds-black", "Buds Black BHR8396GL"),
         ("https://birmarket.az/product/12-buds-black-2", "Buds Black BHR8396GL v2"),
         ("https://birmarket.az/product/13-other", "Başqa mal")]
PAGES = {"11": ("Redmi Buds 6 Active BHR8396GL", SkuStatus.ACTIVE),
         "12": ("Redmi Buds 6 Active BHR8396GL", SkuStatus.INACTIVE),
         "13": ("Saç maskası", SkuStatus.ACTIVE)}


def _worker(copier=None, repo=None, searchers=None, **cfg):
    cfg = JobConfig(merchant_for_active="TRENDIFY", merchant_for_inactive="MAXI",
                    keywords=("birmarket",), copy_timeout_s=0.2, **cfg)
    return BulkCopyWorker(searchers or [FakeSearcher(LINKS)], FakeInspector(PAGES),
                          copier or FakeCopier(), repo or FakeRepo(), FakeNotifier(), cfg)


def test_pipeline_copies_all_matching_variants_to_right_merchants():
    w = _worker()
    stats = asyncio.run(w.run(1, [_item("Redmi Buds", mpns=["BHR8396GL"])]))
    assert stats["copied"] == 1
    assert sorted((m, s) for m, s, _ in w.copier.calls) == [("MAXI", "12"), ("TRENDIFY", "11")]
    assert all(sale == Decimal("210.00") for *_, sale in w.copier.calls)
    assert ("P-11", Decimal("100"), "PMT EVIZ") in w.repo.costs


def test_pipeline_uncertain_cost_goes_to_approval():
    w = _worker()
    stats = asyncio.run(w.run(1, [_item("Redmi Buds", mpns=["BHR8396GL"], uncertain=True)]))
    assert stats["approval"] == 1 and not w.copier.calls
    assert {c["state"] for c in w.repo.cands.values()} == {"needs_approval"}


def test_pipeline_skips_sku_already_in_merchant():
    w = _worker(repo=FakeRepo(existing={("TRENDIFY", "11")}))
    asyncio.run(w.run(1, [_item("Redmi Buds", mpns=["BHR8396GL"])]))
    assert [s for _, s, _ in w.copier.calls] == ["12"]


def test_pipeline_retries_and_handles_hang():
    w = _worker(copier=FakeCopier(fail_times=1), stock_filter=StockFilter.ONLY_ACTIVE)
    asyncio.run(w.run(1, [_item("Redmi Buds", mpns=["BHR8396GL"])]))
    assert len(w.copier.calls) == 2 and w.repo.costs

    w2 = _worker(copier=FakeCopier(hang=True), stock_filter=StockFilter.ONLY_ACTIVE, copy_retries=0)
    stats = asyncio.run(w2.run(1, [_item("Redmi Buds", mpns=["BHR8396GL"])]))
    assert stats["skipped"] == 1 and not w2.repo.costs
    assert any(c["state"] == "failed" for c in w2.repo.cands.values())


def test_pipeline_limit_three_newest():
    w = _worker(limit=3)
    items = [_item(f"x{i}", mpns=["NOPE1234"], days_ago=i) for i in range(1, 6)]
    stats = asyncio.run(w.run(1, items))
    assert stats["processed"] == 3


def test_pipeline_falls_back_on_captcha_and_stops_if_all_fail():
    w = _worker(searchers=[FakeSearcher(captcha=True), FakeSearcher(LINKS)])
    assert asyncio.run(w.run(1, [_item("Redmi", mpns=["BHR8396GL"])]))["copied"] == 1

    w2 = _worker(searchers=[FakeSearcher(captcha=True)])
    with pytest.raises(CaptchaRequired):
        asyncio.run(w2.run(1, [_item("Redmi", mpns=["BHR8396GL"])]))
    assert w2.notifier.messages
