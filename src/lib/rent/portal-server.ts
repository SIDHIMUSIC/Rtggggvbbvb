import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { mintPayToken, readPayToken } from "./pay-token";
import { txId } from "./months";
import {
  PAY_METHODS,
  type PayClaim,
  type PayMethod,
  type Payment,
  type PaymentEvent,
  type PaymentStatus,
} from "./types";

export const getTenantPayLink = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { tenantId: number }) => {
    const tenantId = Number(input.tenantId);
    if (!tenantId) throw new Error("Tenant is required");
    return { tenantId };
  })
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql<{ id: number }>`
      select id from tenants
      where id = ${data.tenantId} and user_id = ${context.userId} and is_active = true
    `;
    if (!rows[0]) throw new Error("Tenant not found");
    const token = mintPayToken(context.userId, data.tenantId);
    return { token, path: `/pay/${token}` };
  });

function mapClaim(c: {
  id: number;
  tenant_id: number;
  payment_id: number;
  amount: number;
  method: string;
  reference: string;
  status: string;
  created_at: string | Date;
  decided_at: string | Date | null;
  tenant_name?: string;
  room_number?: string;
  month?: string;
}): PayClaim {
  return {
    id: c.id,
    tenantId: c.tenant_id,
    paymentId: c.payment_id,
    amount: Number(c.amount),
    method: PAY_METHODS.includes(c.method as PayMethod) ? (c.method as PayMethod) : "upi",
    reference: c.reference ?? "",
    status: c.status === "confirmed" || c.status === "rejected" ? c.status : "pending",
    createdAt: new Date(c.created_at).toISOString(),
    decidedAt: c.decided_at ? new Date(c.decided_at).toISOString() : null,
    tenantName: c.tenant_name,
    roomNumber: c.room_number,
    month: c.month,
  };
}

async function loadPortal(token: string) {
  const { userId, tenantId } = readPayToken(token);
  const sql = await getSql();
  const tenants = await sql<{ id: number; name: string; phone: string; room_number: string }>`
    select id, name, phone, room_number
    from tenants
    where id = ${tenantId} and user_id = ${userId} and is_active = true
  `;
  if (!tenants[0]) throw new Error("This pay link is no longer active");

  const pays = await sql<{
    id: number;
    tenant_id: number;
    room_number: string;
    month: string;
    month_index: number;
    total_rent: number;
    paid_amount: number;
    remaining_amount: number;
    status: string;
    paid_by: string;
    paid_at: string | Date | null;
    transaction_id: string;
    extra_amount: number;
    extra_note: string;
  }>`
    select id, tenant_id, room_number, month, month_index, total_rent, paid_amount,
           remaining_amount, status, paid_by, paid_at, transaction_id,
           extra_amount, extra_note
    from payments
    where user_id = ${userId} and tenant_id = ${tenantId}
    order by month_index
  `;

  const evs = await sql<{
    id: number;
    tenant_id: number;
    payment_id: number;
    amount: number;
    method: string;
    reference: string;
    created_at: string | Date;
    month?: string;
  }>`
    select e.id, e.tenant_id, e.payment_id, e.amount, e.method, e.reference, e.created_at, p.month
    from payment_events e
    join payments p on p.id = e.payment_id
    where e.user_id = ${userId} and e.tenant_id = ${tenantId}
    order by e.created_at desc
  `;

  const claimRows = await sql<{
    id: number;
    tenant_id: number;
    payment_id: number;
    amount: number;
    method: string;
    reference: string;
    status: string;
    created_at: string | Date;
    decided_at: string | Date | null;
    month?: string;
  }>`
    select c.id, c.tenant_id, c.payment_id, c.amount, c.method, c.reference, c.status,
           c.created_at, c.decided_at, p.month
    from pay_claims c
    join payments p on p.id = c.payment_id
    where c.user_id = ${userId} and c.tenant_id = ${tenantId}
    order by c.created_at desc
  `;

  const buildingRows = await sql<{
    name: string;
    address: string;
    owner_name: string;
    phone: string;
    upi_id: string;
  }>`select name, address, owner_name, phone, upi_id from buildings where user_id = ${userId}`;
  const b = buildingRows[0];

  const payments: Payment[] = pays.map((p) => ({
    id: p.id,
    tenantId: p.tenant_id,
    roomNumber: p.room_number,
    month: p.month,
    monthIndex: Number(p.month_index),
    totalRent: Number(p.total_rent),
    paidAmount: Number(p.paid_amount),
    remainingAmount: Number(p.remaining_amount),
    status: (p.status as PaymentStatus) || "unpaid",
    paidBy: p.paid_by ?? "",
    paidAt: p.paid_at ? new Date(p.paid_at).toISOString() : null,
    transactionId: p.transaction_id ?? "",
    extraAmount: Number(p.extra_amount ?? 0),
    extraNote: p.extra_note ?? "",
    tenantName: tenants[0].name,
    tenantPhone: tenants[0].phone,
  }));

  const events: PaymentEvent[] = evs.map((e) => ({
    id: e.id,
    tenantId: e.tenant_id,
    paymentId: e.payment_id,
    amount: Number(e.amount),
    method: PAY_METHODS.includes(e.method as PayMethod) ? (e.method as PayMethod) : "upi",
    reference: e.reference ?? "",
    createdAt: new Date(e.created_at).toISOString(),
    month: e.month,
    tenantName: tenants[0].name,
  }));

  return {
    token,
    building: {
      name: b?.name ?? "",
      address: b?.address ?? "",
      ownerName: b?.owner_name ?? "",
      phone: b?.phone ?? "",
      upiId: b?.upi_id ?? "",
    },
    tenant: {
      id: tenants[0].id,
      name: tenants[0].name,
      roomNumber: tenants[0].room_number,
      phone: tenants[0].phone ?? "",
    },
    due: payments.filter((p) => p.status !== "paid"),
    events,
    claims: claimRows.map((c) =>
      mapClaim({ ...c, tenant_name: tenants[0].name, room_number: tenants[0].room_number }),
    ),
    totalDue: payments.reduce((s, p) => s + p.remainingAmount, 0),
  };
}

export const getPayPortal = createServerFn({ method: "GET" })
  .validator((input: { token: string }) => {
    const token = String(input.token ?? "").trim();
    if (!token) throw new Error("Pay link is missing");
    return { token };
  })
  .handler(async ({ data }) => loadPortal(data.token));

export const confirmTenantPay = createServerFn({ method: "POST" })
  .validator((input: {
    token: string;
    paymentId: number;
    amount: number;
    method: PayMethod;
    reference?: string;
  }) => {
    const token = String(input.token ?? "").trim();
    const paymentId = Number(input.paymentId);
    const amount = Math.round(Number(input.amount));
    const method = PAY_METHODS.includes(input.method) ? input.method : "upi";
    const reference = String(input.reference ?? "").trim().slice(0, 64);
    if (!token) throw new Error("Pay link is missing");
    if (!paymentId) throw new Error("Bill is required");
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Amount must be positive");
    return { token, paymentId, amount, method: method as PayMethod, reference };
  })
  .handler(async ({ data }) => {
    const { userId, tenantId } = readPayToken(data.token);
    const sql = await getSql();
    const bill = await sql<{ id: number }>`
      select id from payments
      where id = ${data.paymentId} and user_id = ${userId} and tenant_id = ${tenantId}
    `;
    if (!bill[0]) throw new Error("Bill not found");

    const tid = data.reference || txId();
    const existing = await sql<{
      id: number;
      tenant_id: number;
      payment_id: number;
      amount: number;
      method: string;
      reference: string;
      status: string;
      created_at: string | Date;
      decided_at: string | Date | null;
    }>`
      select id, tenant_id, payment_id, amount, method, reference, status, created_at, decided_at
      from pay_claims
      where user_id = ${userId} and tenant_id = ${tenantId} and status = 'pending'
        and (reference = ${tid} or payment_id = ${data.paymentId})
      order by created_at desc
      limit 1
    `;
    if (existing[0] && existing[0].reference === tid) {
      const portal = await loadPortal(data.token);
      return { claim: mapClaim(existing[0]), portal };
    }
    if (existing[0] && existing[0].payment_id === data.paymentId) {
      throw new Error("This bill already has a payment waiting for the owner to confirm");
    }

    const inserted = await sql<{
      id: number;
      tenant_id: number;
      payment_id: number;
      amount: number;
      method: string;
      reference: string;
      status: string;
      created_at: string | Date;
      decided_at: string | Date | null;
    }>`
      insert into pay_claims (
        user_id, tenant_id, payment_id, amount, method, reference, status
      ) values (
        ${userId}, ${tenantId}, ${data.paymentId}, ${data.amount}, ${data.method}, ${tid}, 'pending'
      )
      returning id, tenant_id, payment_id, amount, method, reference, status, created_at, decided_at
    `;
    const portal = await loadPortal(data.token);
    return { claim: mapClaim(inserted[0]!), portal };
  });

export const listPayClaims = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<PayClaim[]> => {
    const sql = await getSql();
    const rows = await sql<{
      id: number;
      tenant_id: number;
      payment_id: number;
      amount: number;
      method: string;
      reference: string;
      status: string;
      created_at: string | Date;
      decided_at: string | Date | null;
      tenant_name: string;
      room_number: string;
      month: string;
    }>`
      select c.id, c.tenant_id, c.payment_id, c.amount, c.method, c.reference, c.status,
             c.created_at, c.decided_at, t.name as tenant_name, t.room_number, p.month
      from pay_claims c
      join tenants t on t.id = c.tenant_id
      join payments p on p.id = c.payment_id
      where c.user_id = ${context.userId} and c.status = 'pending'
      order by c.created_at desc
    `;
    return rows.map(mapClaim);
  });

async function applyConfirmed(
  userId: string,
  paymentId: number,
  tenantId: number,
  amount: number,
  method: PayMethod,
  reference: string,
) {
  const sql = await getSql();
  const bill = await sql<{ month_index: number }>`
    select month_index from payments
    where id = ${paymentId} and user_id = ${userId} and tenant_id = ${tenantId}
  `;
  if (!bill[0]) throw new Error("Bill not found");
  const tid = reference || txId();
  const now = new Date().toISOString();
  let remainingToApply = amount;
  const queue = await sql<{ id: number; paid_amount: number; remaining_amount: number }>`
    select id, paid_amount, remaining_amount from payments
    where user_id = ${userId} and tenant_id = ${tenantId}
      and month_index >= ${bill[0].month_index} and status <> 'paid'
    order by month_index
  `;
  for (const p of queue) {
    if (remainingToApply <= 0) break;
    const due = Number(p.remaining_amount);
    const take = Math.min(due, remainingToApply);
    const paidAmount = Number(p.paid_amount) + take;
    const remainingAmount = due - take;
    const status: PaymentStatus =
      remainingAmount <= 0 ? "paid" : paidAmount > 0 ? "partial" : "unpaid";
    await sql`
      update payments set
        paid_amount = ${paidAmount},
        remaining_amount = ${remainingAmount},
        status = ${status},
        paid_by = ${method},
        paid_at = ${now}::timestamptz,
        transaction_id = ${tid}
      where id = ${p.id} and user_id = ${userId}
    `;
    remainingToApply -= take;
  }
  await sql`
    insert into payment_events (user_id, tenant_id, payment_id, amount, method, reference)
    values (${userId}, ${tenantId}, ${paymentId}, ${amount}, ${method}, ${tid})
  `;
}

export const confirmPayClaim = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: number }) => {
    const id = Number(input.id);
    if (!id) throw new Error("Claim is required");
    return { id };
  })
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql<{
      id: number;
      tenant_id: number;
      payment_id: number;
      amount: number;
      method: string;
      reference: string;
      status: string;
    }>`
      select id, tenant_id, payment_id, amount, method, reference, status
      from pay_claims
      where id = ${data.id} and user_id = ${context.userId}
    `;
    const claim = rows[0];
    if (!claim) throw new Error("Claim not found");
    if (claim.status !== "pending") throw new Error("This claim was already decided");
    await applyConfirmed(
      context.userId,
      claim.payment_id,
      claim.tenant_id,
      Number(claim.amount),
      PAY_METHODS.includes(claim.method as PayMethod) ? (claim.method as PayMethod) : "upi",
      claim.reference,
    );
    await sql`
      update pay_claims set status = 'confirmed', decided_at = now()
      where id = ${claim.id} and user_id = ${context.userId}
    `;
    return { ok: true as const };
  });

export const rejectPayClaim = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: number }) => {
    const id = Number(input.id);
    if (!id) throw new Error("Claim is required");
    return { id };
  })
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql<{ id: number; status: string }>`
      select id, status from pay_claims
      where id = ${data.id} and user_id = ${context.userId}
    `;
    if (!rows[0]) throw new Error("Claim not found");
    if (rows[0].status !== "pending") throw new Error("This claim was already decided");
    await sql`
      update pay_claims set status = 'rejected', decided_at = now()
      where id = ${data.id} and user_id = ${context.userId}
    `;
    return { ok: true as const };
  });
