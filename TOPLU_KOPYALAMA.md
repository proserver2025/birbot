# Toplu Kopyalama — Claude CLI üçün tapşırıq

> Bu fayl VPS-dəki Claude CLI üçündür. Oxu, sırayla icra et, hər mərhələnin sonunda
> qısa hesabat ver. Əmin olmadığın yerdə **dayan və istifadəçidən soruş**.

## 0. Məqsəd (istifadəçinin dili ilə)

Bot bir **işçi kimi** işləməlidir:

1. Mənbədən malları götürür: **WhatsApp qrupu**, **Telegram qrupu**, **PDF kataloq**
   (şəkil + MPN + qiymət) və ya **link**.
2. Hər malın şəklinə/modelinə görə **Google**-da axtarır. Açar söz `birmarket` və ya
   `umico` olur. Oxşar mal yox, **eyni model** axtarılır.
3. Nəticədəki Birmarket linklərindən **SKU**-ları götürür. SKU linkdə və ya səhifədə
   yazılır. Bir neçə variant varsa, **hamısını** yoxlayır.
   - Birmarket axtarışında artıq görünməyən, amma Google-da görünən **deaktiv**
     (satıcısız) SKU-lar da tapılır. Bunlar xüsusilə vacibdir.
4. Filtrə görə kopyalayır. Filtrlər:
   - yalnız deaktiv (satıcısız) SKU-lar;
   - yalnız aktiv (satıcılı) SKU-lar;
   - hər ikisi.

   Mağaza bölgüsü:
   - Aktiv SKU-lar bir merchant-a gedir (məs. **Trendify**).
   - Deaktiv SKU-lar başqa merchant-a gedir (məs. **Maxi Shop**).
   - Hansı merchant-ın hansı statusa aid olduğu hər işdə paneldə seçilir.
5. SKU-nu botun **mövcud Birmarket API inteqrasiyası** ilə kopyalayır. Yeni məhsul yaratmır.
6. Mal DB-yə düşəndən sonra ona **maya**nı (WhatsApp/PDF/link qiyməti) və
   **təchizatçı**nı yazır. Təchizatçı = qrup adı olduğu kimi, məs. `PMT EVIZ`.
7. Satış qiyməti digər satıcılardan **götürülmür**. Maya üzərinə faizlə hesablanır.
   Standart faizlər paneldə hər iş üçün dəyişdirilə bilər:
   - adi satış = maya + **110%**
   - endirim = maya + **40%**
   - üst limit = maya + **100%**
8. Bot əmin deyilsə (model və ya maya şübhəlidir), malı **"Təsdiq gözləyir"**
   siyahısına salır. İstifadəçi baxıb təsdiqləyir və ya rədd edir.
9. Mənbədə **son 15 gün** götürülür. İş ən son tarixdən başlayıb geriyə doğru gedir.
10. **İlk işə salma: yalnız 3 mal.** Nəticəni göstər və istifadəçinin təsdiqini gözlə.

Funksiyanın adı: **Toplu kopyalama**. Botda artıq olan funksiyalardan fərqlidir:
- **Toplu yükləmə** yeni məhsul yaradır.
- **SKU kopyalama** tək-tək işləyir, zəifdir və ilişir.

## 1. Hazır olanlar (bulud sessiyasında yazılıb və test edilib)

Qovluq: `toplu_kopyalama/`. Python 3.11+, xarici sistemlər interfeyslər arxasındadır.

| Fayl | Nə edir | Vəziyyət |
|---|---|---|
| `models.py` | Məlumat modelləri, statuslar, filtr | ✅ test |
| `pricing.py` | Maya + faiz hesablaması (110/40/100, dəyişdirilə bilən) | ✅ test |
| `parsing.py` | Mətndən maya və MPN çıxarma; bir neçə qiymət olanda "şübhəli" | ✅ test |
| `skus.py` | Google/Birmarket linklərindən SKU, təkrarların silinməsi | ✅ test, SKU formatı təsdiqlənib |
| `matching.py` | Eyni model yoxlaması: MPN uyğunluğu → avtomatik, başqa hallar → təsdiq/rədd | ✅ test |
| `pipeline.py` | İşçi: pəncərə (15 gün, yenidən köhnəyə), limit (3), axtarış, bütün variantların yoxlanması, filtr → merchant, artıq olanları keçmək, kopyalama (timeout + təkrar cəhd + dublikat qoruması), maya/təchizatçı yazılması, təsdiq | ✅ test (saxta adapterlərlə) |
| `ports.py` | İnterfeyslər: `ImageSearcher`, `CandidateInspector`, `Copier`, `Repository`, `Notifier` | — |
| `search/base.py` | Tempo limiti, CAPTCHA aşkarlanması, insanı gözləmə, daimi brauzer profili | ✅ test (aşkarlanma) |
| `search/google.py` | Google: MPN varsa mətn axtarışı, yoxdursa Google Lens + açar söz | ⚠️ selektorlar VPS-də yoxlanmalıdır |
| `search/fallbacks.py` | Yandex (ehtiyat), SerpAPI (gələcək, `SERPAPI_KEY` varsa) | ⚠️ yoxlanmalıdır |
| `inspector.py` | Birmarket səhifəsini oxuyur: başlıq, mətn, aktiv/deaktiv | ⚠️ markerlər yoxlanmalıdır |
| `sources/messages.py` | WhatsApp/Telegram mesajlarını mala çevirir (şəkil + 3 dəq ərzində gələn mətn, albom) | ✅ test |
| `sources/pdf.py` | PDF: hər şəkil bir mal, mətn ən yaxın şəklə bağlanır (PyMuPDF) | ✅ test (bağlama məntiqi) |
| `db/schema.sql` | `bulk_copy_jobs`, `bulk_copy_items`, `bulk_copy_candidates`, təsdiq görünüşü | — |
| `tests/test_toplu_kopyalama.py` | 25 test | ✅ keçir |

Testləri işlət: `python -m pytest -q tests`

## 2. Əvvəlcə yoxla (bulud sessiyası birmarket.az-a çıxa bilmədi)

### 2.1 SKU = linkdəki rəqəm — ✅ istifadəçi təsdiqlədi
`https://birmarket.az/ru/product/2819110-agcaqanad-paneli-led#search_id=...` linkində
SKU `2819110`-dur. Dil prefiksi (`/ru/`, `/en/`) və `#search_id` nəzərə alınır, test var.
Yalnız bir real SKU ilə API-də sınaq et və davam et.
- `umico.az` linkləri üçün bunu yoxla. Umico SKU-su Birmarket ilə eyni deyilsə,
  umico nəticəsini Birmarket SKU-suna çevirmə yolunu tap və ya umico linklərini yalnız
  MPN/başlıq ipucu kimi istifadə et.

### 2.2 Aktiv / deaktiv necə bilinir?
- **Üstün yol:** botun Birmarket API-si SKU üzrə satıcı/təklif sayını qaytarırsa,
  `CandidateInspector`-u API ilə yaz. Qayda: satıcı sayı > 0 → `ACTIVE`, 0 → `INACTIVE`.
- **Ehtiyat yol:** `inspector.py` səhifəni oxuyur. `INACTIVE_MARKERS` və `ACTIVE_MARKERS`
  siyahılarını real səhifələrə görə düzəlt. Hər iki status üçün ən azı 3 nümunə ilə yoxla.
- Status bilinməyəndə (`UNKNOWN`), mal avtomatik təsdiq siyahısına düşür. Bu məntiq artıq yazılıb.

## 3. Botun mövcud kodunu öyrən (dəyişiklikdən əvvəl)

Botun kodunda bunları tap və istifadəçiyə qısa xəritə ver (fayl:sətir):
- Toplu yükləmə: WhatsApp/Telegram QR girişi, qrupların tapılması, mesaj və şəkillərin
  endirilməsi, təchizatçının qrup adından götürülməsi, faiz hesablaması.
- SKU kopyalama: Birmarket API çağırışı. Niyə ilişir? Timeout yoxdur? Sinxron sorğu async
  daxilindədir? Sessiya/token bitir?
- Tək şəkillə axtarış (AI ilə): hansı xidmətdən istifadə edir və niyə Google qədər dəqiq deyil?
- DB: məhsul cədvəli, maya və təchizatçı sahələri, merchant cədvəli, miqrasiya aləti (Alembic?).
- Panel: veb, yoxsa Telegram bot? Yeni bölmə harada olmalıdır?
- Fon işlər: Celery, RQ, asyncio task? Uzun işlər necə işlədilir?

## 4. Birləşdirmə

1. `toplu_kopyalama/` qovluğunu botun layihəsinə köçür. Import yollarını uyğunlaşdır.
   Asılılıqlar: `playwright`, `pymupdf`. `playwright install chromium` əmrini yalnız lazım olsa işlət.
2. **Copier:** botdakı mövcud SKU kopyalama API funksiyasını bura bağla. Eyni zamanda onu düzəlt:
   - hər sorğuya timeout;
   - şəbəkə xətalarında təkrar cəhd;
   - async kodda bloklayan sorğu olmamalıdır;
   - token/sessiya bitəndə yenilənməlidir;
   - eyni SKU iki dəfə kopyalanmamalıdır.

   Köhnə "SKU kopyalama" düyməsi də bu düzəldilmiş funksiyadan istifadə etməlidir.
3. **Repository:** `db/schema.sql`-i botun miqrasiya alətinə köçür. Əvvəlcə DB-nin
   **backup**-ını al. `set_cost_and_supplier` botun mövcud maya/təchizatçı sahələrinə yazmalıdır.
   Yeni sütun yaratma, əgər mövcud sahə varsa.
4. **Mənbələr:** WhatsApp/Telegram üçün toplu yükləmənin mövcud oxuyucularından istifadə et.
   Yeni QR giriş yazma. Onların çıxışını `sources/messages.RawMessage`-ə çevir. PDF üçün
   `sources/pdf.read_pdf` istifadə olunur. Link üçün səhifədəki şəkil və mətni götürən kiçik
   oxuyucu yaz.
5. **Notifier:** botun mövcud bildiriş kanalı (Telegram və ya panel).
6. **Ümumi kodu birləşdir:** faiz hesablaması, təchizatçının qrup adından götürülməsi və mesaj
   qruplaşdırması toplu yükləmədə də eyni modullardan istifadə etməlidir. Dublikat kodu sil,
   amma mövcud davranışı pozma.

## 5. Google və CAPTCHA (API açarı yoxdur, adi brauzer)

- VPS-də **Xvfb + görünən Chromium + noVNC** qur. İstifadəçi brauzeri görə bilməlidir.
- `open_persistent_browser("/var/lib/birbot/google-profile")` daimi profil yaradır.
  **Gmail-ə girişi istifadəçi özü edir** (noVNC ilə). Parol yazma, saxlama və ya soruşma.
  Daxil olmuş profil CAPTCHA-nı xeyli azaldır.
- Bir brauzer, bir tab, sorğular arası 8–20 saniyə, saatda ən çox 60 sorğu. Bunları
  konfiqurasiyaya çıxar.
- MPN varsa, əvvəlcə `"MPN" birmarket` mətn axtarışı edilir. Bu, ən dəqiq yoldur və CAPTCHA az çıxır.
- CAPTCHA çıxanda bot istifadəçiyə bildiriş göndərir və 15 dəqiqə gözləyir. Həll olunmasa,
  iş `paused_captcha` vəziyyətində qalır və sonra davam etdirilə bilir.
- Ehtiyat sıra: Google → Yandex → SerpAPI (`SERPAPI_KEY` varsa) → botun AI axtarışı (ən son).
- `search/google.py`-dakı `SELECTORS`-u real brauzerdə yoxla. Google Lens-in
  "axtarışa əlavə et" sahəsi dəyişə bilər. 5 real mal ilə sına.
- **Tək şəkillə axtarışı da düzəlt:** botdakı tək şəkil axtarışı da `GoogleSearcher` istifadə etsin.

## 6. Panel: "Toplu kopyalama" bölməsi

Yeni iş formu:
- mənbə: WhatsApp / Telegram / PDF / link;
- qrupların seçilməsi (istifadəçi hansı qrupları seçirsə, yalnız onlar);
- gün sayı (standart 15);
- filtr: yalnız deaktiv / yalnız aktiv / hər ikisi;
- aktiv SKU-lar üçün merchant və deaktiv SKU-lar üçün merchant;
- faizlər (110 / 40 / 100 standart olaraq doldurulub);
- mal limiti (ilk dəfə 3).

İş hesabatı:
- sayğaclar: emal olunan, kopyalanan, təsdiq gözləyən, keçilən, xəta;
- hər mal üçün: şəkil, tapılan SKU-lar, qərarın səbəbi.

**Təsdiq gözləyir** siyahısı (`bulk_copy_approval_queue`):
- WhatsApp şəkli və Birmarket linki yan-yana;
- səbəb ("model əmin deyil", "maya əmin deyil", "status bilinmir");
- mayanı düzəltmək imkanı;
- Təsdiqlə / Rədd et düymələri. Təsdiq `BulkCopyWorker.approve` çağırır.

## 7. Qəbul meyarları (tamamlandı demədən əvvəl)

1. `pytest` yaşıl: köhnə testlər və bu 25 test.
2. 2.1 və 2.2 yoxlamalarının nəticəsi istifadəçiyə yazılıb.
3. Real sınaq: istifadəçinin seçdiyi **bir qrupda 3 mal** emal olunub. Hər mal üçün hesabat:
   - mənbə;
   - tapılan linklər və SKU-lar;
   - aktiv/deaktiv;
   - qərar və səbəb;
   - hansı merchant-a kopyalandı;
   - maya və təchizatçı DB-yə yazılıbmı (SQL ilə yoxla).
4. **İstifadəçi təsdiq etmədən 3-dən çox mal emal etmə.**
5. Köhnə toplu yükləmə və SKU kopyalama funksiyaları işləyir (reqressiya yoxdur).

## 8. Qaydalar

- Açar, token və parolu koda və ya git-ə yazma. Hamısı `.env`-də saxlanır.
- QR, parol və Gmail girişini **yalnız istifadəçi** daxil edir. Sən dayanıb xəbər verirsən.
- DB miqrasiyasından əvvəl backup al.
- Hər mərhələdən sonra qısa hesabat ver. Uyğunsuzluq olanda təxmin etmə, soruş.

## 9. Açıq suallar (istifadəçidən soruş)

1. Üst limit (+100%) adi satışdan (+110%) aşağıdır: 100 AZN mayada 200 < 210. Bu düzdürmü?
   Botun mövcud yeni məhsul əlavəsində necədir? Eyni məntiqi götür.
2. Umico linklərinin necə istifadə olunacağı.
3. Bir mal həm aktiv, həm deaktiv SKU kimi tapılarsa (eyni model, iki SKU), hər ikisini
   müvafiq merchant-lara kopyalamaq düzdürmü? (İndiki məntiq: bəli.)

## 10. Tövsiyələr (arxitektor qeydi)

- **Əlavə yoxlama siqnalı:** WhatsApp şəkli ilə Birmarket əsas şəkli arasında perceptual hash
  (`imagehash`) müqayisəsi. Bu siqnal yalnız təsdiq siyahısına salma qərarına təsir etməlidir,
  avtomatik kopyalamaya yox.
- **Keş:** eyni MPN və ya şəkil hash-i üçün axtarış nəticəsini 7 gün saxla. Google sorğularını
  azaldır.
- **Tək işçi:** Google üçün eyni anda yalnız bir axtarış işi işləsin (növbə ilə). Paralel
  sorğular CAPTCHA-nı artırır.
- **Loglar:** hər addım `bulk_copy_*` cədvəllərində qalır. "Niyə kopyalanmadı?" sualı
  paneldən cavablanmalıdır.
