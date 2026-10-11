# BPRCONVERT

BPRCONVERT adalah website konversi file dengan katalog alat di halaman utama. Katalog menampilkan jumlah alat aktual dan status ketersediaan dari backend; upload hanya muncul setelah Anda membuka alat pada URL `#tool/<id>`. Halaman alat menyediakan upload keyboard-accessible, status pemrosesan inline, dan hasil unduhan tanpa toast tambahan. Tema mengikuti preferensi terang/gelap sistem dan menghormati pengaturan reduced motion. Setiap alat memproses file melalui backend Flask; hasilnya dapat diunduh langsung dari halaman alat tersebut.

## Fitur

- Katalog alat dengan status ketersediaan aktual dari backend.
- Halaman upload terpisah untuk setiap alat, bukan upload di halaman utama.
- Tombol `Mulai proses` dan unduhan hasil asli dari backend.
- Status ketersediaan jujur: PDF to PDF/A nonaktif sampai Ghostscript terpasang.
- Branding BPRCONVERT dan logo `public/bprconvert-logo.png`.

## Menjalankan lokal

Install dependency:

```bash
pnpm install
pip install -r backend/requirements.txt
```

Salin `.env.example` menjadi `.env`, lalu sesuaikan isinya:

```bash
cp .env.example .env
```

Variabel penting:

```bash
AI_API_BASE=http://localhost:20128/v1
AI_API_KEY=isi-dengan-api-key-asli
AI_MODEL=my9
PORT=5001
VITE_BACKEND_URL=http://localhost:5001
```

Jalankan backend dan frontend:

```bash
python backend/app.py
pnpm run dev
```

Frontend membaca `VITE_BACKEND_URL` saat build/dev. Backend membaca `AI_API_BASE`, `AI_API_KEY`, `AI_MODEL`, dan `PORT` hanya di sisi server.

## Cara pakai

1. Buka halaman utama dan pilih salah satu alat.
2. Halaman alat terbuka dengan URL berbeda, misalnya `#tool/pdf-tool-0`.
3. Unggah file yang sesuai lalu klik `Mulai proses`.
4. Unduh hasil konversi.

## Deploy

File secret hanya `.env`, jangan commit dan jangan deploy file tersebut. File `.env.example` aman di-commit sebagai contoh.

Yang boleh public:

- `dist/` hasil build frontend.
- `public/bprconvert-logo.png`.
- `.env.example`.

Yang tidak boleh public:

- `.env`.
- API key backend.
- Direktori `backend/` sebagai kode sumber private bila tidak ingin diekspos.

Langkah deploy:

1. Pasang LibreOffice dan Ghostscript di server bila ingin semua fitur aktif.
2. Isi environment server dengan nilai dari `.env.example`.
3. Jalankan backend di belakang WSGI server, bukan Flask dev server.
4. Build frontend dengan `VITE_BACKEND_URL` yang menunjuk backend production.
5. Serve `dist/` melalui HTTPS dan batasi CORS ke domain frontend.

## Batasan saat ini

PDF to PDF/A membutuhkan Ghostscript dengan hak Administrator saat instalasi. Jika belum tersedia, backend menjawab `503` dengan alasan jelas dan frontend menampilkan status tersebut. Tidak ada hasil palsu.

## Verifikasi

```bash
python backend/regression_test.py
python backend/smoke.py
pnpm run build
pnpm run lint
```

# bprconvert
