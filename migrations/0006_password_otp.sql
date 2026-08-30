create table if not exists password_otps (
  id          serial primary key,
  user_id     text not null,
  destination text not null,
  channel     text not null,
  code_hash   text not null,
  expires_at  timestamptz not null,
  attempts    integer not null default 0,
  used        boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists password_otps_dest_idx on password_otps (destination, created_at desc);

create table if not exists password_reset_tickets (
  id          text primary key,
  user_id     text not null,
  expires_at  timestamptz not null,
  used        boolean not null default false,
  created_at  timestamptz not null default now()
);
