-- Donald Duck Tracker - schema en idempotente migratie
-- Voer dit volledige bestand uit in de Supabase SQL editor.

begin;

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

-- Bewaar bij bestaande dubbelen één record en neem de gelezen-status over.
with ranked as (
  select id,
         first_value(id) over (
           partition by user_id, type, year, number
           order by created_at, id
         ) as keep_id,
         bool_or(gelezen) over (
           partition by user_id, type, year, number
         ) as any_read,
         max(gelezen_op) over (
           partition by user_id, type, year, number
         ) as last_read
  from public.magazines
  where type in ('dd_weekblad', 'kd_weekblad') and not is_special
), merged as (
  update public.magazines m
     set gelezen = r.any_read,
         gelezen_op = case when r.any_read then r.last_read else null end
    from ranked r
   where m.id = r.keep_id
   returning m.id
)
delete from public.magazines m
using ranked r
where m.id = r.id and r.id <> r.keep_id;

with ranked as (
  select id,
         first_value(id) over (
           partition by user_id, type, number
           order by created_at, id
         ) as keep_id,
         bool_or(gelezen) over (
           partition by user_id, type, number
         ) as any_read,
         max(gelezen_op) over (
           partition by user_id, type, number
         ) as last_read
  from public.magazines
  where type in ('pocket', 'dubbel_pocket') and number is not null
), merged as (
  update public.magazines m
     set gelezen = r.any_read,
         gelezen_op = case when r.any_read then r.last_read else null end
    from ranked r
   where m.id = r.keep_id
   returning m.id
)
delete from public.magazines m
using ranked r
where m.id = r.id and r.id <> r.keep_id;

create unique index if not exists magazines_periodic_unique_idx
  on public.magazines (user_id, type, year, number)
  where type in ('dd_weekblad', 'kd_weekblad') and not is_special;

create unique index if not exists magazines_pocket_unique_idx
  on public.magazines (user_id, type, number)
  where type in ('pocket', 'dubbel_pocket') and number is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'magazines_valid_shape'
      and conrelid = 'public.magazines'::regclass
  ) then
    alter table public.magazines add constraint magazines_valid_shape check (
      (type = 'dd_weekblad' and year between 1901 and 9999 and
        ((not is_special and number between 1 and 52) or
         (is_special and number is null and nullif(btrim(label), '') is not null)))
      or
      (type = 'kd_weekblad' and year between 1901 and 9999 and
        ((not is_special and number between 1 and 12) or
         (is_special and number is null and nullif(btrim(label), '') is not null)))
      or
      (type in ('pocket', 'dubbel_pocket') and year is null and not is_special and
        (number > 0 or nullif(btrim(label), '') is not null))
    ) not valid;
  end if;
end $$;

alter table public.magazines enable row level security;

drop policy if exists "select own magazines" on public.magazines;
create policy "select own magazines" on public.magazines
  for select using (auth.uid() = user_id);

drop policy if exists "insert own magazines" on public.magazines;
create policy "insert own magazines" on public.magazines
  for insert with check (auth.uid() = user_id);

drop policy if exists "update own magazines" on public.magazines;
create policy "update own magazines" on public.magazines
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "delete own magazines" on public.magazines;
create policy "delete own magazines" on public.magazines
  for delete using (auth.uid() = user_id);

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.magazines to authenticated;

-- Nodig om ook de oude waarden van gewijzigde/verwijderde rijen door te geven.
alter table public.magazines replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.magazines;
exception
  when duplicate_object then null;
end $$;

commit;
