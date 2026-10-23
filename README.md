# PORTOFOLIO

Portofolio Swandy Sianturi — situs statis bertema komik Spider-Man.
Ditulis dengan HTML + CSS + JavaScript vanilla, dengan Tailwind CSS yang
di-build statis (tanpa CDN runtime) agar tidak ada FOUC saat halaman dimuat.

## Struktur Repo

```
PORTOFOLIO/
├── index.html              # Halaman utama (tetap di root)
├── css/
│   ├── style.css           # Style utama (komik, komponen, animasi)
│   └── tailwind.build.css  # Hasil build Tailwind (auto-generate, jangan edit manual)
├── js/
│   ├── main.js             # Interaksi: bg web canvas, cursor, reveal, menu
│   ├── chat.js             # Chatbot (endpoint /api/chat -> chat.php)
│   ├── guestbook.js        # Buku tamu (Supabase + mode demo localStorage)
│   ├── mascot.js           # Mascot reaktif di pojok kiri bawah
│   └── supabase-config.js  # Konfigurasi Supabase (URL + anon key)
├── assets/                 # Gambar & aset statis (tambah file baru di sini)
│   ├── AJUK.png
│   └── handrmv.png
├── tailwind/
│   ├── tailwind.config.js  # Konfigurasi Tailwind (warna, font, content)
│   └── input.css           # Entry CSS Tailwind (@tailwind base/components/utilities)
├── api/                    # Handler chat (deploy serverless)
├── netlify/                # Netlify Functions
├── supabase/               # schema.sql (setup database buku tamu)
├── netlify.toml            # Konfigurasi deploy Netlify
├── _headers                # Header keamanan & cache (Netlify)
├── package.json            # Script build Tailwind
└── README.md
```

## Menambah Aset Baru

Taruh semua gambar/aset statis di folder **`assets/`**, lalu rujuk dari
`index.html` dengan path relatif:

```html
<img src="assets/nama-file.png" alt="deskripsi">
```

## Build Tailwind (CSS)

Tailwind **tidak** dimuat dari CDN. Setiap menambah/mengubah class Tailwind
di `index.html` atau di file `js/*.js`, jalankan build ulang:

```bash
npm install          # sekali saja, untuk mengambil dependency
npm run build:css    # build sekali (output: css/tailwind.build.css)
npm run watch:css    # build otomatis tiap ada perubahan (untuk dev)
```

Output `css/tailwind.build.css` **di-commit** ke repo karena hosting
(Netlify) bersifat statis tanpa build step.

## Menjalankan Lokal

Karena memakai `fetch`/modul ES, buka lewat server lokal (bukan `file://`):

```bash
python -m http.server 8000
# buka http://localhost:8000
```

## Catatan

- `chat.php`, `portuy.php`, `.env` dll bersifat lokal/rahasia dan di-ignore git.
- Konfigurasi Supabase ada di `js/supabase-config.js` (anon key aman dipublikasikan; RLS menjaga data).
