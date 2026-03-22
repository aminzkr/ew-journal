# EW Journal — Deployment Guide
## Supabase + Vercel + GitHub

---

## STEP 1 — Setup Supabase

1. Buka https://supabase.com → Sign up → Create new project
   - Name: `ew-journal`
   - Password: (bebas, catat)
   - Region: Southeast Asia (Singapore)

2. Tunggu project ready (~1 menit)

3. Buka **SQL Editor** (menu kiri) → paste seluruh isi file `supabase-schema.sql` → klik Run

4. Buka **Project Settings → API**:
   - Copy **Project URL** → simpan
   - Copy **anon / public key** → simpan

---

## STEP 2 — Setup GitHub

1. Buka https://github.com → New repository
   - Name: `ew-journal`
   - Private ✓
   - Jangan init dengan README

2. Upload semua file ini ke repo:
   - `index.html`
   - `style.css`
   - `app.js`
   - `package.json`
   - `vite.config.js`

3. Di file `app.js`, ganti baris ini:
   ```js
   const SUPABASE_URL  = 'GANTI_DENGAN_SUPABASE_URL'
   const SUPABASE_ANON = 'GANTI_DENGAN_SUPABASE_ANON_KEY'
   ```
   Dengan URL dan key dari Step 1.

---

## STEP 3 — Deploy ke Vercel

1. Buka https://vercel.com → Sign up with GitHub

2. Klik **Add New Project** → Import repo `ew-journal`

3. Settings:
   - Framework Preset: **Vite**
   - Build Command: `npm run build`
   - Output Directory: `dist`

4. Klik **Deploy** → tunggu ~1 menit

5. Setelah selesai, Vercel kasih URL seperti:
   `https://ew-journal-xxx.vercel.app`

   URL ini bisa dibuka dari HP dan PC manapun!

---

## STEP 4 — Add to Home Screen (Mobile)

**iPhone:**
- Buka URL di Safari
- Tap Share → Add to Home Screen
- Namanya akan muncul di home screen seperti app

**Android:**
- Buka URL di Chrome
- Tap menu (⋮) → Add to Home Screen

---

## SELESAI 🎉

Data tersimpan di Supabase (cloud) — bisa diakses dari device manapun,
gambar tersimpan di Supabase Storage (tidak ada batas ukuran praktis).

---

## Optional: Environment Variables (lebih aman)

Daripada hardcode di app.js, bisa pakai Vercel env vars:

1. Vercel dashboard → project → Settings → Environment Variables
2. Tambah:
   - `VITE_SUPABASE_URL` = your project URL
   - `VITE_SUPABASE_ANON` = your anon key

3. Di app.js ganti:
   ```js
   const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL
   const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON
   ```
