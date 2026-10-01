"""Toplu kopyalama: əsas məlumat modelləri."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from enum import Enum


class SourceType(str, Enum):
    WHATSAPP = "whatsapp"
    TELEGRAM = "telegram"
    PDF = "pdf"
    LINK = "link"


class SkuStatus(str, Enum):
    ACTIVE = "active"        # SKU-da ən azı bir satıcı var (Birmarket axtarışında görünür)
    INACTIVE = "inactive"    # SKU var, amma satıcısı yoxdur (yalnız Google-da görünür)
    UNKNOWN = "unknown"


class StockFilter(str, Enum):
    ONLY_INACTIVE = "only_inactive"
    ONLY_ACTIVE = "only_active"
    BOTH = "both"


class ItemState(str, Enum):
    PENDING = "pending"
    SEARCHING = "searching"
    NEEDS_APPROVAL = "needs_approval"
    APPROVED = "approved"
    COPYING = "copying"
    COPIED = "copied"
    SKIPPED = "skipped"
    REJECTED = "rejected"
    FAILED = "failed"


class Decision(str, Enum):
    AUTO = "auto"            # əmindir: avtomatik kopyala
    APPROVAL = "approval"    # şübhəlidir: təsdiq siyahısına
    REJECT = "reject"        # eyni məhsul deyil


@dataclass
class SourceItem:
    """Mənbədən (WhatsApp/Telegram/PDF/link) gələn bir mal."""
    source_type: SourceType
    source_ref: str                      # mesaj id, pdf səhifəsi, link
    supplier: str                        # təchizatçı = qrup adı olduğu kimi
    image_paths: list[str] = field(default_factory=list)
    text: str = ""
    posted_at: datetime | None = None
    cost: Decimal | None = None          # maya
    cost_uncertain: bool = False
    mpns: list[str] = field(default_factory=list)


@dataclass
class Candidate:
    """Google nəticəsindən tapılan Birmarket məhsulu."""
    url: str
    sku: str
    title: str = ""
    page_text: str = ""
    status: SkuStatus = SkuStatus.UNKNOWN
    seller_count: int | None = None


@dataclass
class MatchResult:
    candidate: Candidate
    score: float
    decision: Decision
    reasons: list[str] = field(default_factory=list)


@dataclass
class PriceSet:
    cost: Decimal
    sale: Decimal
    discount: Decimal
    upper_limit: Decimal
