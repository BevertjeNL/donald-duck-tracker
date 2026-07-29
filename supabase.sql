-- Donald Duck Tracker - schema
-- Voer dit uit in de Supabase SQL editor van je nieuwe project.

create extension if not exists pgcrypto;

create table if not exists public.magazines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type text not null check (type in ('dd_weekblad', 'kd_weekblad', 'pocket', 'dubbel_pocket')),
  year int,
  number int,
  label text,
  is_special boolean not null default false,
  gelezen boolean not null default false,
  gelezen_op timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists magazines_user_type_year_idx
  on public.magazines (user_id, type, year);

alter table public.magazines enable row level security;

create policy "select own magazines" on public.magazines
  for select using (auth.uid() = user_id);

create policy "insert own magazines" on public.magazines
  for insert with check (auth.uid() = user_id);

create policy "update own magazines" on public.magazines
  for update using (auth.uid() = user_id);

create policy "delete own magazines" on public.magazines
  for delete using (auth.uid() = user_id);
