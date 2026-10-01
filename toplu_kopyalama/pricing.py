"""Qiymət hesablaması: maya üzərinə faiz.

Standart (paneldə hər toplu iş üçün dəyişdirilə bilər):
  adi satış  = maya + 110%
  endirim    = maya + 40%
  üst limit  = maya + 100%
"""
from __future__ import annotations

from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

from .models import PriceSet


@dataclass(frozen=True)
class PriceRule:
    sale_pct: Decimal = Decimal("110")
    discount_pct: Decimal = Decimal("40")
    upper_limit_pct: Decimal = Decimal("100")

    @classmethod
    def from_mapping(cls, data: dict | None) -> "PriceRule":
        if not data:
            return cls()
        default = cls()
        return cls(
            sale_pct=Decimal(str(data.get("sale_pct", default.sale_pct))),
            discount_pct=Decimal(str(data.get("discount_pct", default.discount_pct))),
            upper_limit_pct=Decimal(str(data.get("upper_limit_pct", default.upper_limit_pct))),
        )


def _markup(cost: Decimal, pct: Decimal) -> Decimal:
    return (cost * (Decimal(1) + pct / Decimal(100))).quantize(Decimal("0.01"), ROUND_HALF_UP)


def calculate(cost: Decimal, rule: PriceRule = PriceRule()) -> PriceSet:
    if cost is None or cost <= 0:
        raise ValueError("maya müsbət olmalıdır")
    return PriceSet(
        cost=cost,
        sale=_markup(cost, rule.sale_pct),
        discount=_markup(cost, rule.discount_pct),
        upper_limit=_markup(cost, rule.upper_limit_pct),
    )
