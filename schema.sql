-- Donald Duck Tracker - schema voor Neon (Postgres)
-- Draai dit eenmalig in de Neon SQL editor.

create table if not exists magazines (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('dd_weekblad', 'kd_weekblad', 'pocket', 'dubbel_pocket')),
  year int,
  number int,
  label text,
  is_special boolean not null default false,
  gelezen boolean not null default false,
  gelezen_op timestamptz,
  created_at timestamptz not null default now(),
  constraint magazines_valid_shape check (
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
  )
);

create unique index if not exists magazines_periodic_unique_idx
  on magazines (type, year, number)
  where type in ('dd_weekblad', 'kd_weekblad') and not is_special;

create unique index if not exists magazines_pocket_unique_idx
  on magazines (type, number)
  where type in ('pocket', 'dubbel_pocket') and number is not null;
