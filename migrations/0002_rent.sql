-- Rentweb: per-landlord rooms, tenants, and rent ledger.

create table if not exists rooms (
  id           serial primary key,
  user_id      text not null,
  room_number  text not null,
  rent         integer not null default 3000,
  status       text not null default 'vacant',
  tenant_name  text not null default '',
  created_at   timestamptz not null default now(),
  unique (user_id, room_number)
);

create index if not exists rooms_user_id_idx on rooms (user_id);

create table if not exists tenants (
  id              serial primary key,
  user_id         text not null,
  name            text not null,
  phone           text not null default '',
  email           text not null default '',
  room_number     text not null,
  rent_amount     integer not null default 3000,
  deposit_amount  integer not null default 0,
  start_date      date not null,
  notes           text not null default '',
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

create index if not exists tenants_user_id_idx on tenants (user_id);
create index if not exists tenants_user_room_idx on tenants (user_id, room_number);

create table if not exists payments (
  id                serial primary key,
  user_id           text not null,
  tenant_id         integer not null references tenants(id) on delete cascade,
  room_number       text not null default '',
  month             text not null,
  month_index       integer not null,
  total_rent        integer not null,
  paid_amount       integer not null default 0,
  remaining_amount  integer not null,
  status            text not null default 'unpaid',
  paid_by           text not null default '',
  paid_at           timestamptz,
  transaction_id    text not null default '',
  created_at        timestamptz not null default now(),
  unique (user_id, tenant_id, month_index)
);

create index if not exists payments_user_id_idx on payments (user_id);
create index if not exists payments_tenant_id_idx on payments (tenant_id);
