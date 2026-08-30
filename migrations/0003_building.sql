-- Per-owner building profile (UPI collection details).

create table if not exists buildings (
  user_id     text primary key,
  name        text not null default '',
  address     text not null default '',
  owner_name  text not null default '',
  phone       text not null default '',
  upi_id      text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
