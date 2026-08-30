-- Collection events (full hisab) and extra charges on a month's bill.

create table if not exists payment_events (
  id          serial primary key,
  user_id     text not null,
  tenant_id   integer not null references tenants(id) on delete cascade,
  payment_id  integer not null references payments(id) on delete cascade,
  amount      integer not null,
  method      text not null,
  reference   text not null default '',
  created_at  timestamptz not null default now()
);

create index if not exists payment_events_user_idx on payment_events (user_id);
create index if not exists payment_events_tenant_idx on payment_events (tenant_id);

alter table payments add column if not exists extra_amount integer not null default 0;
alter table payments add column if not exists extra_note text not null default '';
