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
- Production-da `SESSION_SECRET` və admin parolunu mütləq dəyişin.
