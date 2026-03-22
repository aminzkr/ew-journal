-- ============================================
-- EW Journal — Supabase Schema
-- Jalankan di: Supabase Dashboard > SQL Editor
-- ============================================

-- Tabel trades
create table if not exists trades (
  id          text primary key,
  num         text,
  date        date,
  session     text,
  bias        text,
  waves       text,
  subwave     text,
  h1ctx       text,
  h1pat       text,
  swing_high  numeric,
  swing_low   numeric,
  scenario1   text,
  inv1        numeric,
  scenario2   text,
  inv2        numeric,
  fibo        jsonb,
  m15pat      text,
  m15ctx      text,
  zonestr     text,
  checks      text,
  entry       numeric,
  entry_time  text,
  ezone       text,
  candle      text,
  lot         numeric,
  fractal     text,
  scaling     text,
  sl          numeric,
  tp1         numeric,
  tp2         numeric,
  tp3         numeric,
  slbasis     text,
  wcinv       text,
  h1inv       text,
  outcome     text,
  pnl         numeric,
  good        text,
  bad         text,
  rule        text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Aktifkan RLS tapi allow semua (no auth)
alter table trades enable row level security;
create policy "allow all" on trades for all using (true) with check (true);

-- Storage bucket untuk gambar
insert into storage.buckets (id, name, public)
values ('chart-images', 'chart-images', true)
on conflict do nothing;

-- Policy storage: allow upload & read
create policy "allow upload" on storage.objects
  for insert with check (bucket_id = 'chart-images');

create policy "allow read" on storage.objects
  for select using (bucket_id = 'chart-images');

create policy "allow delete" on storage.objects
  for delete using (bucket_id = 'chart-images');
