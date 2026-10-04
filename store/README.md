# SaaS Home — Online Mağaza

Node.js + Express + EJS + SQLite ilə qurulmuş, tam funksional onlayn mağaza: müştəri tərəfi (vitrin, səbət, sifariş, qeydiyyat) və admin panel (məhsul/kateqoriya/sifariş/müştəri idarəetməsi).

## Quraşdırma

```bash
cd store
npm install
cp .env.example .env    # .env faylını açıb SESSION_SECRET və admin parolunu dəyişin
npm run seed             # ilk admin hesabını və nümunə məlumatları yaradır
npm start
```

Sayt: http://localhost:3000
Admin panel: http://localhost:3000/admin/login (istifadəçi adı/parol `.env`-dəki `ADMIN_DEFAULT_USERNAME`/`ADMIN_DEFAULT_PASSWORD`-dir)

## Struktur

- `server.js` — Express app giriş nöqtəsi
- `routes/public.js` — müştəri tərəfi (vitrin, səbət, qeydiyyat/giriş)
- `routes/admin.js` — admin panel (məhsul/kateqoriya/sifariş/müştəri CRUD)
- `db/` — SQLite baza (schema.sql, seed.js), fayl olaraq `db/store.db`-də saxlanılır
- `views/` — EJS şablonlar (müştəri tərəfi + `views/admin/`)
- `public/` — CSS və yüklənmiş şəkillər
- `config/brand.js` — brend məlumatları (telefon, email, sosial media)

## Qeydlər

- Verilənlər bazası SQLite-dır (fayl, `db/store.db`) — sadə başlanğıc üçün əladır, sonra ERP/Postgres-ə keçid planlaşdırılır.
- Səbət sessiya (cookie) əsaslıdır, giriş etmədən də alış-veriş etmək olar.
- Şəkillər `public/uploads/`-a yüklənir (diskdə saxlanılır, Docker-də volume ilə qorunmalıdır).
- Production-da `SESSION_SECRET` və admin parolunu mütləq dəyişin, həmçinin `.env`-də `NODE_ENV=production` təyin edin (sessiya cookie-lərinin `secure` olması üçün — bu, sayt HTTPS arxasında olmalıdır, Nginx+Let's Encrypt ilə).

## Təhlükəsizlik

- **Brute-force qorunması**: həm müştəri, həm admin girişində 5 yanlış cəhddən sonra hesab 15 dəqiqəliyə kilidlənir; IP üzrə də əlavə sürət məhdudiyyəti var (`express-rate-limit`).
- **CSRF qorunması**: bütün formalar sessiyaya bağlı gizli token daşıyır (`middleware/csrf.js`).
- **Təhlükəsizlik header-ləri**: `helmet` ilə (CSP, XSS qorunması və s.).
- **Fayl yükləmə filtri**: admin panelində yalnız şəkil fayllarına (jpg/png/webp/gif, max 5MB) icazə verilir.
- **SSRF qorunması**: "Linkdən idxal et" funksiyası daxili/lokal şəbəkə ünvanlarına sorğu göndərə bilmir.
- **Sessiyalar** SQLite-da saxlanılır (server yenidən başlasa belə itmir) — `express-session`-ın defolt yaddaş-əsaslı saxlanması production üçün uyğun deyildi.

## Google ilə giriş

`.env`-də `GOOGLE_CLIENT_ID` boş saxlasanız, Google düyməsi sadəcə görünmür və sayt adi email/parol ilə işləyir. Aktivləşdirmək üçün:
1. https://console.cloud.google.com/apis/credentials -> "Create Credentials" -> "OAuth client ID" -> "Web application".
2. "Authorized JavaScript origins"-ə saytın domenini (məs. `https://saashome.az`) əlavə edin.
3. Alınan Client ID-ni `.env`-dəki `GOOGLE_CLIENT_ID`-yə yazın, serveri yenidən başladın.

## Məhsul idxalı (başqa saytdan)

Admin panelində "Yeni məhsul" səhifəsində bir link yapışdırıb "Çək" düyməsinə basmaqla (Birmarket, Umico, Lalafo və s.) başlıq, qiymət, təsvir və şəkil avtomatik çəkilib formu doldurur (`og:title`/`og:image`/schema.org JSON-LD oxuyur, tapılmasa səhifədəki "₼" qiymətlərini axtarır). Nəticəni həmişə göndərmədən əvvəl yoxlayın — avtomatik çəkilən məlumat bəzən natamam ola bilər.
