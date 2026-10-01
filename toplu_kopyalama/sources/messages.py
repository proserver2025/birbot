"""WhatsApp/Telegram mesajlarının SourceItem-ə çevrilməsi.

Mesajları oxumağı (QR giriş, qrupların tapılması, şəkillərin endirilməsi) botun
mövcud "toplu yükləmə" funksiyası artıq edir; burada yalnız onun çıxışı
ümumi formata salınır. CLI mövcud mesaj obyektinin sahələrini bura uyğunlaşdırmalıdır.

Qayda: şəkildən dərhal sonra gələn mətn mesajı (eyni göndərən, < 3 dəq) həmin
şəklin təsviri sayılır; bir mesajda bir neçə şəkil (albom) bir mal sayılır.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta

from ..models import SourceItem, SourceType

CAPTION_GAP = timedelta(minutes=3)


@dataclass
class RawMessage:
    msg_id: str
    sender: str
    sent_at: datetime
    text: str = ""
    image_paths: list[str] = field(default_factory=list)
    album_id: str | None = None


def supplier_from_group(group_name: str) -> str:
    """Təchizatçı = qrup adı olduğu kimi (məs. 'PMT EVIZ')."""
    return " ".join((group_name or "").split())


def group_messages(messages: list[RawMessage], group_name: str,
                   source_type: SourceType = SourceType.WHATSAPP) -> list[SourceItem]:
    supplier = supplier_from_group(group_name)
    msgs = sorted(messages, key=lambda m: m.sent_at)
    items: list[SourceItem] = []
    current: SourceItem | None = None
    current_sender = None
    last_time: datetime | None = None
    current_album = None

    for m in msgs:
        if m.image_paths:
            same_album = current is not None and m.album_id and m.album_id == current_album
            if same_album:
                current.image_paths += m.image_paths
                if m.text:
                    current.text = f"{current.text}\n{m.text}".strip()
            else:
                current = SourceItem(source_type=source_type, source_ref=m.msg_id, supplier=supplier,
                                     image_paths=list(m.image_paths), text=m.text, posted_at=m.sent_at)
                items.append(current)
                current_album = m.album_id
            current_sender, last_time = m.sender, m.sent_at
        elif m.text and current is not None and m.sender == current_sender \
                and last_time is not None and m.sent_at - last_time <= CAPTION_GAP:
            current.text = f"{current.text}\n{m.text}".strip()
            last_time = m.sent_at
    return items
