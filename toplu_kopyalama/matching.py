"""Namizədin həmin mal olub-olmadığının qiymətləndirilməsi.

Qayda: oxşar mal yox, EYNİ model. MPN tam uyğun gəlirsə əmin, gəlmirsə
başlıq oxşarlığına görə ya təsdiqə, ya da rədd.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

from .models import Candidate, Decision, MatchResult, SourceItem
from .parsing import normalize_mpn

_WORD = re.compile(r"[a-z0-9əğıöşüç]+", re.IGNORECASE)
_STOP = {"ve", "və", "ile", "ilə", "ucun", "üçün", "the", "for", "with", "and", "azn", "qiymeti", "satisi"}


@dataclass(frozen=True)
class MatchThresholds:
    auto: float = 0.85
    approval: float = 0.45


def _tokens(text: str) -> set[str]:
    return {t.lower() for t in _WORD.findall(text or "") if len(t) > 1 and t.lower() not in _STOP}


def score(item: SourceItem, cand: Candidate, th: MatchThresholds = MatchThresholds()) -> MatchResult:
    reasons: list[str] = []
    haystack = normalize_mpn(f"{cand.title} {cand.page_text} {cand.url}")
    item_mpns = [normalize_mpn(m) for m in item.mpns if len(normalize_mpn(m)) >= 4]

    mpn_hit = [m for m in item_mpns if m in haystack]
    if mpn_hit:
        reasons.append(f"MPN uyğun: {', '.join(mpn_hit)}")
        value = 0.95
    else:
        if item_mpns:
            reasons.append("MPN səhifədə tapılmadı")
        a, b = _tokens(item.text), _tokens(f"{cand.title} {cand.page_text[:500]}")
        overlap = len(a & b) / max(1, min(len(a), len(b))) if a and b else 0.0
        reasons.append(f"başlıq oxşarlığı {overlap:.2f}")
        # MPN var, amma səhifədə yoxdursa — avtomatik heç vaxt olmur
        value = min(overlap, th.auto - 0.01) if item_mpns else overlap * 0.8

    if value >= th.auto:
        decision = Decision.AUTO
    elif value >= th.approval:
        decision = Decision.APPROVAL
    else:
        decision = Decision.REJECT
    return MatchResult(candidate=cand, score=round(value, 3), decision=decision, reasons=reasons)
