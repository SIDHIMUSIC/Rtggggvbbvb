-- Tenant self-pay is a claim until the owner confirms it.

create table if not exists pay_claims (
  id          serial primary key,
  user_id     text not null,
  tenant_id   integer not null references tenants(id) on delete cascade,
  payment_id  integer not null references payments(id) on delete cascade,
  amount      integer not null,
  method      text not null,
  reference   text not null default '',
  status      text not null default 'pending',
  created_at  timestamptz not null default now(),
  decided_at  timestamptz
);

create index if not exists pay_claims_user_status_idx on pay_claims (user_id, status);
create index if not exists pay_claims_tenant_idx on pay_claims (tenant_id);
