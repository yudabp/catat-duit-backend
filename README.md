# Catat Duit — Backend API

Backend REST untuk aplikasi pencatat keuangan pribadi **Catat Duit**, dibangun sesuai
[`catat-duit-PRD.md`](../catat-duit-PRD.md). API ini melayani aplikasi mobile React
Native/Expo (maupun klien web) dengan autentikasi, pencatatan transaksi, kategori,
analitik, batas pengeluaran, sinkronisasi idempotent, dan ekspor CSV.

**Stack:** Node.js 22 · Express 5 · TypeScript · PostgreSQL · Drizzle ORM · Better Auth ·
Zod · Swagger UI · Resend.

Klien mobile yang memakai API ini ada di [`../frontend`](../frontend): Expo Router,
SQLite local-first, outbox idempotent, dan bearer token Better Auth.

---

## Fitur yang tersedia

| Kebutuhan PRD | Implementasi backend |
|---|---|
| F1 Catat pengeluaran & pemasukan | `POST/PATCH/DELETE /api/v1/transactions` |
| F2 Kelola kategori | CRUD `/api/v1/categories`, 13 kategori bawaan, ikon, warna, arsip |
| F3 Riwayat transaksi | Daftar + pencarian + filter jenis/kategori/tanggal/bulan + pagination + sorting |
| F4 Grafik & analisis | Rekap per kategori, tren harian, pemasukan vs pengeluaran |
| F5 Rekap bulanan | Total masuk/keluar/sisa, peringatan boncos 80%/100%, status batas belanja |
| F6 Akun pengguna | Register, login, logout, reset password lewat email, ganti email dengan verifikasi |
| F7 Sinkronisasi server | `clientId` idempotent, batch sync antrian offline, semua data difilter per pemilik |
| F8 Pengaturan | Profil, batas pengeluaran harian/bulanan, ekspor CSV |

Tambahan untuk produksi: validasi Zod, dokumentasi OpenAPI, helmet, CORS terbatas,
rate limit, logging terstruktur, health check, Dockerfile, dan 56 integration test.

---

## Struktur proyek

```text
backend/
├── src/
│   ├── app.ts                 # express app, middleware, routing
│   ├── server.ts              # entry point + graceful shutdown
│   ├── config/env.ts          # validasi environment dengan Zod
│   ├── db/
│   │   ├── schema.ts          # skema Drizzle (Better Auth + tabel aplikasi)
│   │   ├── default-categories.ts
│   │   ├── migrate.ts
│   │   └── seed.ts
│   ├── lib/                   # auth, mailer, logger, uang, tanggal, CSV, error
│   ├── middleware/            # sesi, rate limit, error handler
│   ├── modules/
│   │   ├── auth (Better Auth terpasang di /api/auth)
│   │   ├── me/                # profil & email
│   │   ├── categories/
│   │   ├── transactions/
│   │   ├── budgets/
│   │   ├── analytics/
│   │   ├── export/
│   │   └── health/
│   └── docs/openapi.ts        # spesifikasi OpenAPI 3.0
├── drizzle/                   # migrasi SQL yang di-generate
├── tests/                     # integration test Vitest + Supertest
├── docker-compose.yml         # PostgreSQL 17 lokal
├── Dockerfile
└── .env.example
```

---

## Mulai cepat

### Prasyarat

- Node.js **22+**
- Docker (untuk PostgreSQL lokal) atau database PostgreSQL lain
- npm

### 1. Jalankan PostgreSQL

```bash
cd backend
docker compose up -d
```

Compose membuat dua database:

- `catatduit` — untuk development
- `catatduit_test` — untuk integration test (dibuat otomatis oleh `docker/init.sql`)

Port host: **5435**.

### 2. Siapkan environment

```bash
cp .env.example .env
```

Buat secret acak minimal 32 karakter:

```bash
openssl rand -hex 32
```

Tempel hasilnya ke `BETTER_AUTH_SECRET` di `.env`. Sesuaikan `PORT` dan
`BETTER_AUTH_URL` bila port 4000 sedang dipakai aplikasi lain.

### 3. Install, migrasi, seed, jalankan

```bash
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Buka:

- API: <http://localhost:4000>
- Health check: <http://localhost:4000/health>
- Swagger UI: <http://localhost:4000/api/docs>
- OpenAPI JSON: <http://localhost:4000/api/openapi.json>

### Perintah npm

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Jalankan server dengan hot reload (`tsx watch`) |
| `npm run build` | Compile TypeScript ke `dist/` |
| `npm start` | Jalankan hasil build (`node dist/server.js`) |
| `npm run typecheck` | Cek tipe tanpa emit |
| `npm test` | Jalankan seluruh integration test |
| `npm run db:generate` | Generate migrasi baru dari `src/db/schema.ts` |
| `npm run db:migrate` | Terapkan migrasi ke database |
| `npm run db:seed` | Seed 13 kategori bawaan (idempotent) |
| `npm run db:migrate:prod` | Migrasi dari hasil build (`dist/`) |
| `npm run db:seed:prod` | Seed dari hasil build (`dist/`) |
| `npm run db:studio` | Buka Drizzle Studio |

---

## Environment

| Variabel | Default | Wajib | Keterangan |
|---|---|---|---|
| `NODE_ENV` | `development` | — | `development`, `test`, `production` |
| `PORT` | `4000` | — | Port HTTP |
| `DATABASE_URL` | — | ✅ | Connection string PostgreSQL |
| `TEST_DATABASE_URL` | — | — | Database test; **harus** mengandung `_test` |
| `DB_SSL` | `false` | — | `true` untuk Neon/Supabase yang mewajibkan SSL |
| `DB_POOL_MAX` | `10` | — | Maksimal koneksi pool |
| `BETTER_AUTH_URL` | `http://localhost:4000` | — | Base URL API; wajib HTTPS di production |
| `BETTER_AUTH_SECRET` | — | ✅ | Minimal 32 karakter |
| `BETTER_AUTH_RATE_LIMIT_ENABLED` | `true` | — | Rate limit internal Better Auth |
| `APP_NAME` | `Catat Duit` | — | Nama aplikasi di email & respons |
| `APP_TIMEZONE` | `Asia/Jakarta` | — | Zona waktu untuk "hari ini"/bulan berjalan |
| `ALLOWED_ORIGINS` | localhost dev | — | Daftar origin CORS, pisahkan dengan koma |
| `TRUST_PROXY` | `false` | — | `true`, `false`, atau jumlah hop proxy (Railway: `1`) |
| `RATE_LIMIT_ENABLED` | `true` | — | Rate limit Express |
| `RATE_LIMIT_WINDOW_MS` | `900000` | — | Window rate limit global (15 menit) |
| `RATE_LIMIT_MAX` | `300` | — | Maksimal request global per window |
| `AUTH_RATE_LIMIT_MAX` | `20` | — | Maksimal request auth per 15 menit |
| `LOG_LEVEL` | `info` | — | Level pino |
| `EMAIL_TRANSPORT` | `log` | — | `log` (dev) atau `resend` (production) |
| `ALLOW_INSECURE_EMAIL_LOG` | `false` | — | Bypass pengaman production hanya bila disengaja |
| `RESEND_API_KEY` | — | production | Wajib bila `EMAIL_TRANSPORT=resend` |
| `EMAIL_FROM` | `Catat Duit <no-reply@catatduit.app>` | — | Pengirim email |
| `APP_RESET_PASSWORD_URL` | `catatduit://auth/reset-password` | — | Deep link reset password |
| `APP_EMAIL_VERIFICATION_CALLBACK_URL` | `catatduit://auth/email-verified` | — | Callback setelah verifikasi email |
| `SWAGGER_ENABLED` | `true` | — | Aktifkan `/api/docs` |

> Development memakai `EMAIL_TRANSPORT=log`: isi email & tautan reset ditulis ke log,
> bukan dikirim. Jangan pakai mode ini di production. Validasi environment akan
> menolak `EMAIL_TRANSPORT=log` di production kecuali `ALLOW_INSECURE_EMAIL_LOG=true`.

---

## Autentikasi untuk aplikasi mobile

Better Auth menangani seluruh route di `/api/auth/*`. Middleware aplikasi menerima
**bearer token** (plugin `bearer`) maupun cookie sesi.

### Alur token

1. `POST /api/auth/sign-up/email` atau `POST /api/auth/sign-in/email`.
2. Ambil session token dari response header **`set-auth-token`**.
   Body response juga mengembalikan `token`; header adalah nilai bertanda tangan yang
   dipakai plugin bearer.
3. Simpan token di secure storage perangkat (Expo SecureStore / Keychain).
4. Kirim pada setiap request:

```http
Authorization: Bearer <set-auth-token>
```

5. `POST /api/auth/sign-out` untuk mencabut sesi aktif.

> Route `/api/auth/*` ditangani langsung oleh Better Auth. Bila terjadi kesalahan,
> bentuk responsnya `{ "message": "...", "code": "..." }` — berbeda dari envelope
> `{ "error": { "code", "message" } }` yang dipakai endpoint `/api/v1/*`. Aplikasi
> mobile sebaiknya menangani kedua format.

```bash
# Daftar
curl -i -X POST http://localhost:4000/api/auth/sign-up/email \
  -H 'Content-Type: application/json' \
  -d '{"name":"Siti","email":"siti@example.com","password":"password123"}'

# Login
curl -i -X POST http://localhost:4000/api/auth/sign-in/email \
  -H 'Content-Type: application/json' \
  -d '{"email":"siti@example.com","password":"password123"}'

# Profil
curl http://localhost:4000/api/v1/me \
  -H "Authorization: Bearer $TOKEN"
```

### Reset password

1. `POST /api/auth/request-password-reset` dengan `{ "email": "..." }`.
2. Resend mengirim email berisi deep link
   `catatduit://auth/reset-password?token=...` (dapat diubah lewat `APP_RESET_PASSWORD_URL`).
3. Aplikasi mobile membaca `token`, lalu memanggil:

```http
POST /api/auth/reset-password
Content-Type: application/json

{ "token": "<token-dari-email>", "newPassword": "kata-sandi-baru" }
```

Token berlaku 1 jam. Setelah reset berhasil, **semua sesi lama dicabut** sehingga
pengguna harus login ulang. Respons request reset selalu sama, termasuk bila email
tidak terdaftar (anti-enumerasi akun).

### Ganti email

`POST /api/v1/me/email` dengan `{ "newEmail": "baru@example.com" }` mengirim tautan
verifikasi. Email baru baru aktif setelah tautan diverifikasi. Respons tidak
mengubah email secara langsung.

> Better Auth mensyaratkan sesi yang masih "fresh" (< 24 jam sejak login) untuk
> operasi sensitif seperti ganti email/password. Bila menerima `403` dengan
> `details.authCode = "SESSION_NOT_FRESH"`, minta pengguna login ulang lalu ulangi.

### Email transaksional

- Development/test: `EMAIL_TRANSPORT=log` (isi email masuk ke log).
- Production: set `EMAIL_TRANSPORT=resend` dan `RESEND_API_KEY`.
- Template email: reset password, verifikasi email, dan konfirmasi perubahan email.

---

## Daftar endpoint

Semua endpoint di bawah `/api/v1` memerlukan bearer token atau cookie sesi, kecuali
`/health` dan route Better Auth publik (register/login/reset).

### Auth (`/api/auth`)

| Method | Path | Fungsi |
|---|---|---|
| POST | `/sign-up/email` | Daftar akun (email + password) |
| POST | `/sign-in/email` | Login |
| POST | `/sign-out` | Logout sesi aktif |
| GET | `/get-session` | Ambil sesi & profil |
| POST | `/request-password-reset` | Kirim tautan reset |
| POST | `/reset-password` | Simpan password baru dengan token |
| POST | `/change-password` | Ganti password (sesi aktif) |
| POST | `/send-verification-email` | Kirim ulang verifikasi email |

### Profil

| Method | Path | Fungsi |
|---|---|---|
| GET | `/api/v1/me` | Profil pengguna |
| PATCH | `/api/v1/me` | Ubah nama/foto profil |
| POST | `/api/v1/me/email` | Ajukan perubahan email |

### Kategori

| Method | Path | Fungsi |
|---|---|---|
| GET | `/api/v1/categories?type=&includeArchived=` | Daftar kategori bawaan + milik user |
| POST | `/api/v1/categories` | Buat kategori sendiri |
| GET | `/api/v1/categories/:id` | Detail + jumlah pemakaian |
| PATCH | `/api/v1/categories/:id` | Ubah nama/jenis/ikon/warna/arsip |
| DELETE | `/api/v1/categories/:id` | Hapus bila belum dipakai transaksi |

Kategori bawaan (`user_id = NULL`) tidak dapat diubah/dihapus. Kategori yang sudah
dipakai transaksi harus diarsipkan (`isArchived: true`) agar riwayat tetap utuh.

### Transaksi

| Method | Path | Fungsi |
|---|---|---|
| GET | `/api/v1/transactions` | Riwayat + pencarian + filter + pagination |
| POST | `/api/v1/transactions` | Catat transaksi (idempotent) |
| POST | `/api/v1/transactions/sync` | Kirim antrian offline (maks. 100 item) |
| GET | `/api/v1/transactions/:id` | Detail |
| PATCH | `/api/v1/transactions/:id` | Edit |
| DELETE | `/api/v1/transactions/:id` | Hapus |

Query `GET /transactions`:

```text
page, limit (maks 100), type, categoryId, search, month=YYYY-MM,
from=YYYY-MM-DD, to=YYYY-MM-DD, sort=date_desc|date_asc|amount_desc|amount_asc
```

`search` mencocokkan catatan transaksi **atau** nama kategori.

Contoh membuat transaksi:

```bash
curl -X POST http://localhost:4000/api/v1/transactions \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "categoryId": "c0000000-0000-4000-8000-000000000001",
    "type": "expense",
    "amount": 25000,
    "note": "Nasi padang",
    "transactionDate": "2026-10-28",
    "clientId": "device-abc-0001"
  }'
```

`amount` adalah **number** dalam Rupiah (bukan string berformat), maksimal 2 desimal.
`transactionDate` default hari ini menurut `APP_TIMEZONE`.

### Batas pengeluaran

| Method | Path | Fungsi |
|---|---|---|
| GET | `/api/v1/budgets?period=&month=&activeOnly=` | Daftar batas |
| POST | `/api/v1/budgets` | Buat batas harian/bulanan |
| GET | `/api/v1/budgets/:id` | Detail |
| PATCH | `/api/v1/budgets/:id` | Ubah nominal / status aktif |
| DELETE | `/api/v1/budgets/:id` | Hapus |

Satu pengguna hanya boleh punya satu batas aktif untuk kombinasi `period + month`
(`month = null` berarti berulang setiap bulan). Bila batas khusus bulan dan batas
berulang sama-sama ada, rekap memprioritaskan batas khusus bulan.

### Analitik

| Method | Path | Fungsi |
|---|---|---|
| GET | `/api/v1/analytics/summary?month=YYYY-MM` | Total masuk/keluar/sisa + warning boncos + status batas |
| GET | `/api/v1/analytics/categories?month=&type=` | Komposisi per kategori (donut/pie) |
| GET | `/api/v1/analytics/trend?month=` | Tren harian pemasukan vs pengeluaran |
| GET | `/api/v1/analytics/months?limit=` | Daftar bulan untuk pemilih bulan |

Aturan peringatan:

- `safe` — pengeluaran < 80% pemasukan.
- `warning` — pengeluaran ≥ 80% tetapi < 100% pemasukan (kartu oranye).
- `over` — pengeluaran ≥ 100% pemasukan, atau sudah ada pengeluaran tanpa pemasukan
  bulan itu (kartu merah).
- Peringatan batas belanja dihitung terpisah untuk setiap batas aktif. Batas harian
  hanya dievaluasi saat melihat bulan berjalan; batas bulanan dievaluasi untuk bulan
  yang dipilih.
- Ringkasan tidak disimpan sebagai tabel; selalu dihitung dari transaksi terkini.

Bila `month` tidak dikirim, dipakai bulan berjalan menurut `APP_TIMEZONE`.

### Ekspor

```http
GET /api/v1/export/transactions.csv?from=YYYY-MM-DD&to=YYYY-MM-DD&type=&categoryId=
```

- Default: bulan berjalan.
- Hanya `to` diisi → mulai dari tahun 2000; hanya `from` diisi → sampai hari ini.
- File CSV UTF-8 dengan BOM, delimiter koma, dan escaping standar.
- Catatan/kategori yang diawali karakter formula (`=`, `+`, `-`, `@`) diberi prefix
  `'` untuk mencegah CSV/formula injection saat dibuka di Excel/Sheets.
- Respons menyertakan `Content-Disposition` agar bisa disimpan/dibagikan mobile.

### Health

```http
GET /health
```

Mengembalikan `200` bila API dan database sehat, `503` bila database tidak tersedia.

---

## Sinkronisasi offline (local-first)

Aplikasi mobile menyimpan transaksi ke SQLite lokal terlebih dahulu, lalu mengirim
ke server saat online. Backend mendukung dua cara:

### 1. Per transaksi

Kirim `clientId` unik yang dibuat sekali di perangkat dan **tidak berubah**:

- `201 Created` — transaksi baru.
- `200 OK` + header `Idempotent-Replay: true` — transaksi dengan `clientId` yang sama
  sudah pernah tersimpan; server mengembalikan data lama, bukan membuat duplikat.

Constraint database `UNIQUE (user_id, client_id)` menjadi pengaman terakhir bila dua
request yang sama datang bersamaan. Jangan memakai ulang `clientId` untuk transaksi
yang berbeda; untuk mengubah transaksi gunakan `PATCH /api/v1/transactions/:id`.

### 2. Batch antrian

```http
POST /api/v1/transactions/sync
Content-Type: application/json

{
  "transactions": [
    { "clientId": "...", "categoryId": "...", "type": "expense", "amount": 25000, "transactionDate": "2026-10-28", "note": "Makan" }
  ]
}
```

Maksimal 100 item per batch. Setiap item divalidasi dan diproses terpisah; item yang
gagal tidak membatalkan item lain. Respons berisi `results[]` dengan status
`created`, `replayed`, atau `failed`, plus `summary` jumlahnya.

Saran implementasi mobile: tandai transaksi lokal `pending` → kirim → ganti status
menjadi `synced` dengan id server; bila offline, biarkan di antrian dan tampilkan
ikon "menunggu jaringan".

---

## Keamanan

- Semua query transaksi/kategori/batas/analitik difilter dengan `user_id` dari sesi.
  Resource milik pengguna lain menghasilkan `404` (tidak membocorkan keberadaannya).
- Password di-hash oleh Better Auth (scrypt bawaan).
- Session token bertanda tangan; reset password mencabut seluruh sesi.
- Helmet, CORS origin terbatas, rate limit global + endpoint auth, body limit 1 MB.
- `clientId` unik per pengguna mencegah duplikasi saat retry.
- CSV injection disanitasi.
- Secret dan token tidak ditulis ke log produksi (redaksi pino); mode email `log`
  dilarang di production kecuali disengaja.
- Gunakan HTTPS di production dan simpan bearer token di secure storage perangkat.

---

## Testing

Integration test memakai PostgreSQL nyata, Vitest, dan Supertest.

```bash
docker compose up -d     # bila belum
npm test
```

Test berjalan pada database `TEST_DATABASE_URL` (default
`catatduit_test`). Setup akan menolak berjalan bila nama database tidak mengandung
`_test`, lalu memigrasi, mengosongkan tabel, dan seed ulang kategori bawaan.

Cakupan: auth/register/login/logout/reset password, isolasi data antar pengguna,
CRUD kategori & transaksi, idempotensi, batch sync, filter/pagination, rekap bulanan,
grafik kategori, tren harian, batas harian/bulanan, peringatan boncos, ekspor CSV,
CORS, header keamanan, dan OpenAPI.

---

## Build & deploy

### Build lokal

```bash
npm run build
NODE_ENV=production node dist/server.js
```

### Docker

```bash
docker build -t catat-duit-api .
docker run --env-file .env -p 4000:4000 catat-duit-api
```

Image menjalankan migrasi + seed otomatis sebelum server start.

### Railway / Render

1. Set root project ke folder `backend/` (bila memakai repo ini).
2. Build command: `npm ci && npm run build`
   Start command: `npm run db:migrate:prod && npm run db:seed:prod && npm start`
   (Dockerfile sudah menangani urutan ini.)
3. Environment minimum:
   - `NODE_ENV=production`
   - `DATABASE_URL` (Neon/Supabase; set `DB_SSL=true` bila perlu)
   - `BETTER_AUTH_URL=https://api.domainmu.com`
   - `BETTER_AUTH_SECRET` (acak, ≥ 32 karakter)
   - `ALLOWED_ORIGINS=https://app.domainmu.com` (atau origin web yang dipakai)
   - `TRUST_PROXY=1` bila di belakang proxy platform
   - `EMAIL_TRANSPORT=resend`, `RESEND_API_KEY`, `EMAIL_FROM`
   - `SWAGGER_ENABLED=false` bila dokumentasi tidak boleh publik
4. Arahkan health check platform ke `/health`.

Rate limit bawaan memakai memori proses. Untuk lebih dari satu instance, gunakan
Redis/secondary storage (Better Auth) dan rate-limit store terdistribusi.

---

## Catatan batasan MVP

- Satu pengguna hanya mengelola keuangannya sendiri; belum ada multi-user/keluarga.
- Mata uang tunggal IDR; nominal disimpan `NUMERIC(14,2)`.
- Belum ada integrasi rekening bank.
- Reset password memakai tautan/email (bukan OTP angka).
- Perubahan email memerlukan verifikasi email.
- Ringkasan/analitik dihitung on-the-fly dari transaksi (sesuai PRD), bukan tabel
  materialized.
- Session token bearer tidak memiliki refresh token terpisah; sesi berlaku 30 hari
  dan diperpanjang otomatis saat dipakai (Better Auth `updateAge` 1 hari).

---

## Dokumen terkait

- PRD: [`../catat-duit-PRD.md`](../catat-duit-PRD.md)
- OpenAPI/Swagger: `/api/docs` saat server berjalan
- Skema database: `src/db/schema.ts`
- Migrasi: `drizzle/0000_init.sql`
