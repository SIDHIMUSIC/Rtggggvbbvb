import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import type {
  Building,
  Dashboard,
  PayMethod,
  Payment,
  PaymentStatus,
  Room,
  RoomDetail,
  RoomStatus,
  Tenant,
  TenantWithLedger,
} from "./types";
import {
  currentMonthIndex,
  monthIndex,
  monthLabel,
  monthsFrom,
  parseDate,
  roomSort,
  toIsoDate,
  txId,
} from "./months";

type RoomRow = {
  id: number;
  room_number: string;
  rent: number;
  status: string;
  tenant_name: string;
};

type TenantRow = {
  id: number;
  name: string;
  phone: string;
  email: string;
  room_number: string;
  rent_amount: number;
  deposit_amount: number;
  start_date: string;
  notes: string;
  is_active: boolean;
};

type PaymentRow = {
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
  tenant_name?: string;
  tenant_phone?: string;
};

function mapRoom(r: RoomRow): Room {
  return {
    id: r.id,
    roomNumber: r.room_number,
    rent: Number(r.rent),
    status: (r.status === "occupied" ? "occupied" : "vacant") as RoomStatus,
    tenantName: r.tenant_name ?? "",
  };
}

function mapTenant(t: TenantRow): Tenant {
  return {
    id: t.id,
    name: t.name,
    phone: t.phone ?? "",
    email: t.email ?? "",
    roomNumber: t.room_number,
    rentAmount: Number(t.rent_amount),
    depositAmount: Number(t.deposit_amount ?? 0),
    startDate: typeof t.start_date === "string" ? t.start_date.slice(0, 10) : toIsoDate(t.start_date),
    notes: t.notes ?? "",
    isActive: t.is_active !== false,
  };
}

function mapPayment(p: PaymentRow): Payment {
  return {
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
    tenantName: p.tenant_name,
    tenantPhone: p.tenant_phone,
  };
}

export const emptyBuilding = (): Building => ({
  name: "",
  address: "",
  ownerName: "",
  phone: "",
  upiId: "",
});

type BuildingRow = {
  name: string;
  address: string;
  owner_name: string;
  phone: string;
  upi_id: string;
};

function mapBuilding(r: BuildingRow): Building {
  return {
    name: r.name ?? "",
    address: r.address ?? "",
    ownerName: r.owner_name ?? "",
    phone: r.phone ?? "",
    upiId: r.upi_id ?? "",
  };
}

async function loadBuilding(userId: string): Promise<Building> {
  const sql = await getSql();
  const rows = await sql<BuildingRow>`
    select name, address, owner_name, phone, upi_id
    from buildings where user_id = ${userId}
  `;
  return rows[0] ? mapBuilding(rows[0]) : emptyBuilding();
}

async function ensureMonths(userId: string, tenant: TenantRow): Promise<void> {
  const sql = await getSql();
  const start = parseDate(tenant.start_date);
  for (const m of monthsFrom(start)) {
    await sql`
      insert into payments (
        user_id, tenant_id, room_number, month, month_index,
        total_rent, paid_amount, remaining_amount, status
      ) values (
        ${userId}, ${tenant.id}, ${tenant.room_number},
        ${monthLabel(m)}, ${monthIndex(m)},
        ${Number(tenant.rent_amount)}, 0, ${Number(tenant.rent_amount)}, 'unpaid'
      )
      on conflict (user_id, tenant_id, month_index) do nothing
    `;
  }
}

async function loadRooms(userId: string): Promise<Room[]> {
  const sql = await getSql();
  const rows = await sql<RoomRow>`
    select id, room_number, rent, status, tenant_name
    from rooms where user_id = ${userId}
  `;
  return rows.map(mapRoom).sort((a, b) => roomSort(a.roomNumber, b.roomNumber));
}

async function loadTenants(userId: string): Promise<TenantRow[]> {
  const sql = await getSql();
  return sql<TenantRow>`
    select id, name, phone, email, room_number, rent_amount, deposit_amount,
           start_date, notes, is_active
    from tenants
    where user_id = ${userId} and is_active = true
    order by name
  `;
}

async function loadPayments(userId: string, tenantId?: number): Promise<Payment[]> {
  const sql = await getSql();
  const rows = tenantId
    ? await sql<PaymentRow>`
        select p.id, p.tenant_id, p.room_number, p.month, p.month_index,
               p.total_rent, p.paid_amount, p.remaining_amount, p.status,
               p.paid_by, p.paid_at, p.transaction_id,
               t.name as tenant_name, t.phone as tenant_phone
        from payments p
        join tenants t on t.id = p.tenant_id
        where p.user_id = ${userId} and p.tenant_id = ${tenantId}
        order by p.month_index
      `
    : await sql<PaymentRow>`
        select p.id, p.tenant_id, p.room_number, p.month, p.month_index,
               p.total_rent, p.paid_amount, p.remaining_amount, p.status,
               p.paid_by, p.paid_at, p.transaction_id,
               t.name as tenant_name, t.phone as tenant_phone
        from payments p
        join tenants t on t.id = p.tenant_id
        where p.user_id = ${userId}
        order by p.month_index
      `;
  return rows.map(mapPayment);
}

async function withLedger(userId: string, tenant: TenantRow): Promise<TenantWithLedger> {
  await ensureMonths(userId, tenant);
  const payments = await loadPayments(userId, tenant.id);
  return {
    ...mapTenant(tenant),
    payments,
    totalPaid: payments.reduce((s, p) => s + p.paidAmount, 0),
    totalDue: payments.reduce((s, p) => s + p.remainingAmount, 0),
  };
}

async function loadDashboard(userId: string): Promise<Dashboard> {
  const tenants = await loadTenants(userId);
  for (const t of tenants) await ensureMonths(userId, t);
  const [rooms, payments, building] = await Promise.all([
    loadRooms(userId),
    loadPayments(userId),
    loadBuilding(userId),
  ]);
  const income = payments.reduce((s, p) => s + p.paidAmount, 0);
  const pending = payments.reduce((s, p) => s + p.remainingAmount, 0);
  const nowIdx = currentMonthIndex();
  const overdue = payments
    .filter((p) => p.remainingAmount > 0 && p.monthIndex < nowIdx)
    .reduce((s, p) => s + p.remainingAmount, 0);
  const occupied = rooms.filter((r) => r.status === "occupied").length;
  return {
    building,
    rooms,
    tenants: tenants.map(mapTenant),
    payments,
    stats: {
      totalRooms: rooms.length,
      occupied,
      vacant: rooms.length - occupied,
      income,
      pending,
      overdue,
      tenantCount: tenants.length,
    },
  };
}

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<Dashboard> => {
    return loadDashboard(context.userId);
  });

export const getBuilding = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<Building> => {
    return loadBuilding(context.userId);
  });

export const upsertBuilding = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: {
    name: string;
    address?: string;
    ownerName?: string;
    phone?: string;
    upiId?: string;
  }) => {
    const name = String(input.name ?? "").trim();
    const upiId = String(input.upiId ?? "").trim().toLowerCase();
    if (!name) throw new Error("Building name is required");
    if (upiId && !/^[\w.-]{2,256}@[a-z]{2,64}$/.test(upiId)) {
      throw new Error("Enter a valid UPI ID, like name@okaxis");
    }
    return {
      name,
      address: String(input.address ?? "").trim(),
      ownerName: String(input.ownerName ?? "").trim(),
      phone: String(input.phone ?? "").trim(),
      upiId,
    };
  })
  .handler(async ({ context, data }): Promise<Building> => {
    const sql = await getSql();
    const rows = await sql<BuildingRow>`
      insert into buildings (user_id, name, address, owner_name, phone, upi_id, updated_at)
      values (
        ${context.userId}, ${data.name}, ${data.address},
        ${data.ownerName}, ${data.phone}, ${data.upiId}, now()
      )
      on conflict (user_id) do update set
        name = excluded.name,
        address = excluded.address,
        owner_name = excluded.owner_name,
        phone = excluded.phone,
        upi_id = excluded.upi_id,
        updated_at = now()
      returning name, address, owner_name, phone, upi_id
    `;
    return mapBuilding(rows[0]!);
  });

export const addRoom = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { roomNumber: string; rent: number }) => {
    const roomNumber = String(input.roomNumber ?? "").trim();
    const rent = Math.round(Number(input.rent));
    if (!roomNumber) throw new Error("Room number is required");
    if (!Number.isFinite(rent) || rent <= 0) throw new Error("Rent must be a positive amount");
    return { roomNumber, rent };
  })
  .handler(async ({ context, data }): Promise<Room> => {
    const sql = await getSql();
    const dup = await sql<{ id: number }>`
      select id from rooms
      where user_id = ${context.userId} and room_number = ${data.roomNumber}
    `;
    if (dup.length) throw new Error("A room with that number already exists");
    const rows = await sql<RoomRow>`
      insert into rooms (user_id, room_number, rent, status, tenant_name)
      values (${context.userId}, ${data.roomNumber}, ${data.rent}, 'vacant', '')
      returning id, room_number, rent, status, tenant_name
    `;
    return mapRoom(rows[0]!);
  });

export const updateRoom = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: number; rent: number }) => {
    const id = Number(input.id);
    const rent = Math.round(Number(input.rent));
    if (!id) throw new Error("Room is required");
    if (!Number.isFinite(rent) || rent <= 0) throw new Error("Rent must be a positive amount");
    return { id, rent };
  })
  .handler(async ({ context, data }): Promise<Room> => {
    const sql = await getSql();
    const rows = await sql<RoomRow>`
      update rooms set rent = ${data.rent}
      where id = ${data.id} and user_id = ${context.userId}
      returning id, room_number, rent, status, tenant_name
    `;
    if (!rows[0]) throw new Error("Room not found");
    return mapRoom(rows[0]);
  });

export const deleteRoom = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: number }) => {
    const id = Number(input.id);
    if (!id) throw new Error("Room is required");
    return { id };
  })
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const sql = await getSql();
    const rows = await sql<{ status: string }>`
      select status from rooms where id = ${data.id} and user_id = ${context.userId}
    `;
    if (!rows[0]) throw new Error("Room not found");
    if (rows[0].status === "occupied") {
      throw new Error("Vacate the room before deleting it");
    }
    await sql`delete from rooms where id = ${data.id} and user_id = ${context.userId}`;
    return { ok: true };
  });

export const seedSampleBuilding = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<Dashboard> => {
    const sql = await getSql();
    const existing = await sql<{ c: number }>`
      select count(*)::int as c from rooms where user_id = ${context.userId}
    `;
    if ((existing[0]?.c ?? 0) > 0) {
      return loadDashboard(context.userId);
    }

    const floors = [
      { prefix: "F1", count: 10, rent: 3000 },
      { prefix: "F2", count: 11, rent: 3000 },
      { prefix: "F3", count: 10, rent: 3000 },
      { prefix: "F4", count: 6, rent: 3500 },
    ];
    const placeholders: string[] = [];
    const params: unknown[] = [];
    let p = 1;
    for (const f of floors) {
      for (let i = 1; i <= f.count; i++) {
        placeholders.push(`($${p}, $${p + 1}, $${p + 2}, 'vacant', '')`);
        params.push(context.userId, `${f.prefix}-R${i}`, f.rent);
        p += 3;
      }
    }
    await sql.query(
      `insert into rooms (user_id, room_number, rent, status, tenant_name)
       values ${placeholders.join(",")}
       on conflict (user_id, room_number) do nothing`,
      params,
    );

    const samples: Array<{
      name: string;
      phone: string;
      room: string;
      rent: number;
      start: string;
      paidThrough: number;
      partial?: { index: number; paid: number };
    }> = [
      {
        name: "Rahul Kumar",
        phone: "9876543210",
        room: "F3-R10",
        rent: 3000,
        start: "2026-02-01",
        paidThrough: 202606,
        partial: { index: 202607, paid: 1500 },
      },
      {
        name: "Priya Singh",
        phone: "9123456780",
        room: "F1-R4",
        rent: 3000,
        start: "2026-05-01",
        paidThrough: 202605,
      },
      {
        name: "Amit Verma",
        phone: "9988776655",
        room: "F2-R2",
        rent: 3000,
        start: "2026-07-01",
        paidThrough: 202607,
      },
    ];

    for (const s of samples) {
      const created = await sql<TenantRow>`
        insert into tenants (
          user_id, name, phone, room_number, rent_amount, start_date
        ) values (
          ${context.userId}, ${s.name}, ${s.phone}, ${s.room}, ${s.rent}, ${s.start}::date
        )
        returning id, name, phone, email, room_number, rent_amount, deposit_amount,
                  start_date, notes, is_active
      `;
      const tenant = created[0]!;
      await sql`
        update rooms
        set status = 'occupied', tenant_name = ${s.name}
        where user_id = ${context.userId} and room_number = ${s.room}
      `;
      await ensureMonths(context.userId, tenant);

      const pays = await sql<PaymentRow>`
        select id, tenant_id, room_number, month, month_index, total_rent,
               paid_amount, remaining_amount, status, paid_by, paid_at, transaction_id
        from payments
        where user_id = ${context.userId} and tenant_id = ${tenant.id}
      `;
      for (const p of pays) {
        if (p.month_index <= s.paidThrough) {
          await sql`
            update payments
            set paid_amount = total_rent, remaining_amount = 0, status = 'paid',
                paid_by = 'cash', paid_at = now(), transaction_id = ${txId()}
            where id = ${p.id} and user_id = ${context.userId}
          `;
        } else if (s.partial && p.month_index === s.partial.index) {
          const paid = s.partial.paid;
          await sql`
            update payments
            set paid_amount = ${paid}, remaining_amount = total_rent - ${paid},
                status = 'partial', paid_by = 'upi', paid_at = now(),
                transaction_id = ${txId()}
            where id = ${p.id} and user_id = ${context.userId}
          `;
        }
      }
    }

    return loadDashboard(context.userId);
  });

export const getTenant = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { id: number }) => {
    const id = Number(input.id);
    if (!id) throw new Error("Tenant is required");
    return { id };
  })
  .handler(async ({ context, data }): Promise<TenantWithLedger> => {
    const sql = await getSql();
    const rows = await sql<TenantRow>`
      select id, name, phone, email, room_number, rent_amount, deposit_amount,
             start_date, notes, is_active
      from tenants
      where id = ${data.id} and user_id = ${context.userId} and is_active = true
    `;
    if (!rows[0]) throw new Error("Tenant not found");
    return withLedger(context.userId, rows[0]);
  });

export const addTenant = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: {
    name: string;
    phone?: string;
    email?: string;
    roomNumber: string;
    rentAmount: number;
    depositAmount?: number;
    startDate: string;
    notes?: string;
  }) => {
    const name = String(input.name ?? "").trim();
    const roomNumber = String(input.roomNumber ?? "").trim();
    const rentAmount = Math.round(Number(input.rentAmount));
    const depositAmount = Math.round(Number(input.depositAmount ?? 0)) || 0;
    const startDate = String(input.startDate ?? "").slice(0, 10);
    if (!name) throw new Error("Name is required");
    if (!roomNumber) throw new Error("Room is required");
    if (!Number.isFinite(rentAmount) || rentAmount <= 0) throw new Error("Rent must be a positive amount");
    if (!startDate) throw new Error("Start date is required");
    return {
      name,
      phone: String(input.phone ?? "").trim(),
      email: String(input.email ?? "").trim(),
      roomNumber,
      rentAmount,
      depositAmount: depositAmount < 0 ? 0 : depositAmount,
      startDate,
      notes: String(input.notes ?? "").trim(),
    };
  })
  .handler(async ({ context, data }): Promise<TenantWithLedger> => {
    const sql = await getSql();
    const room = await sql<RoomRow>`
      select id, room_number, rent, status, tenant_name
      from rooms
      where user_id = ${context.userId} and room_number = ${data.roomNumber}
    `;
    if (!room[0]) throw new Error("Room not found");
    if (room[0].status === "occupied") throw new Error("That room is already occupied");

    const created = await sql<TenantRow>`
      insert into tenants (
        user_id, name, phone, email, room_number, rent_amount, deposit_amount, start_date, notes
      ) values (
        ${context.userId}, ${data.name}, ${data.phone}, ${data.email},
        ${data.roomNumber}, ${data.rentAmount}, ${data.depositAmount}, ${data.startDate}::date, ${data.notes}
      )
      returning id, name, phone, email, room_number, rent_amount, deposit_amount,
                start_date, notes, is_active
    `;
    await sql`
      update rooms
      set status = 'occupied', tenant_name = ${data.name}
      where user_id = ${context.userId} and room_number = ${data.roomNumber}
    `;
    return withLedger(context.userId, created[0]!);
  });

export const updateTenant = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: {
    id: number;
    name: string;
    phone?: string;
    email?: string;
    roomNumber: string;
    rentAmount: number;
    depositAmount?: number;
    startDate: string;
    notes?: string;
  }) => {
    const id = Number(input.id);
    const name = String(input.name ?? "").trim();
    const roomNumber = String(input.roomNumber ?? "").trim();
    const rentAmount = Math.round(Number(input.rentAmount));
    const depositAmount = Math.round(Number(input.depositAmount ?? 0)) || 0;
    const startDate = String(input.startDate ?? "").slice(0, 10);
    if (!id) throw new Error("Tenant is required");
    if (!name) throw new Error("Name is required");
    if (!roomNumber) throw new Error("Room is required");
    if (!Number.isFinite(rentAmount) || rentAmount <= 0) throw new Error("Rent must be a positive amount");
    if (!startDate) throw new Error("Start date is required");
    return {
      id,
      name,
      phone: String(input.phone ?? "").trim(),
      email: String(input.email ?? "").trim(),
      roomNumber,
      rentAmount,
      depositAmount: depositAmount < 0 ? 0 : depositAmount,
      startDate,
      notes: String(input.notes ?? "").trim(),
    };
  })
  .handler(async ({ context, data }): Promise<TenantWithLedger> => {
    const sql = await getSql();
    const old = await sql<TenantRow>`
      select id, name, phone, email, room_number, rent_amount, deposit_amount,
             start_date, notes, is_active
      from tenants where id = ${data.id} and user_id = ${context.userId}
    `;
    if (!old[0]) throw new Error("Tenant not found");

    if (old[0].room_number !== data.roomNumber) {
      const target = await sql<RoomRow>`
        select id, room_number, rent, status, tenant_name
        from rooms
        where user_id = ${context.userId} and room_number = ${data.roomNumber}
      `;
      if (!target[0]) throw new Error("Room not found");
      if (target[0].status === "occupied") throw new Error("That room is already occupied");
      await sql`
        update rooms set status = 'vacant', tenant_name = ''
        where user_id = ${context.userId} and room_number = ${old[0].room_number}
      `;
      await sql`
        update rooms set status = 'occupied', tenant_name = ${data.name}
        where user_id = ${context.userId} and room_number = ${data.roomNumber}
      `;
    } else {
      await sql`
        update rooms set tenant_name = ${data.name}
        where user_id = ${context.userId} and room_number = ${data.roomNumber}
      `;
    }

    const updated = await sql<TenantRow>`
      update tenants set
        name = ${data.name},
        phone = ${data.phone},
        email = ${data.email},
        room_number = ${data.roomNumber},
        rent_amount = ${data.rentAmount},
        deposit_amount = ${data.depositAmount},
        start_date = ${data.startDate}::date,
        notes = ${data.notes}
      where id = ${data.id} and user_id = ${context.userId}
      returning id, name, phone, email, room_number, rent_amount, deposit_amount,
                start_date, notes, is_active
    `;
    return withLedger(context.userId, updated[0]!);
  });

export const deleteTenant = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: number }) => {
    const id = Number(input.id);
    if (!id) throw new Error("Tenant is required");
    return { id };
  })
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const sql = await getSql();
    const rows = await sql<{ room_number: string }>`
      select room_number from tenants where id = ${data.id} and user_id = ${context.userId}
    `;
    if (!rows[0]) throw new Error("Tenant not found");
    await sql`
      update rooms set status = 'vacant', tenant_name = ''
      where user_id = ${context.userId} and room_number = ${rows[0].room_number}
    `;
    await sql`delete from tenants where id = ${data.id} and user_id = ${context.userId}`;
    return { ok: true };
  });

async function applyAmount(
  userId: string,
  paymentId: number,
  amount: number,
  method: PayMethod,
  reference?: string,
): Promise<Payment[]> {
  const sql = await getSql();
  const rows = await sql<PaymentRow>`
    select id, tenant_id, room_number, month, month_index, total_rent,
           paid_amount, remaining_amount, status, paid_by, paid_at, transaction_id
    from payments
    where id = ${paymentId} and user_id = ${userId}
  `;
  const payment = rows[0];
  if (!payment) throw new Error("Payment not found");
  if (amount <= 0) throw new Error("Amount must be positive");

  let remainingToApply = amount;
  const tid = (reference && reference.trim()) || txId();
  const now = new Date().toISOString();

  const queue = await sql<PaymentRow>`
    select id, tenant_id, room_number, month, month_index, total_rent,
           paid_amount, remaining_amount, status, paid_by, paid_at, transaction_id
    from payments
    where user_id = ${userId}
      and tenant_id = ${payment.tenant_id}
      and month_index >= ${payment.month_index}
      and status <> 'paid'
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

  return loadPayments(userId, payment.tenant_id);
}

export const applyPayment = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { paymentId: number; amount: number; method: PayMethod; reference?: string }) => {
    const paymentId = Number(input.paymentId);
    const amount = Math.round(Number(input.amount));
    const method = input.method === "upi" ? "upi" : "cash";
    const reference = String(input.reference ?? "").trim().slice(0, 64);
    if (!paymentId) throw new Error("Payment is required");
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Amount must be positive");
    return { paymentId, amount, method: method as PayMethod, reference };
  })
  .handler(async ({ context, data }): Promise<Payment[]> => {
    return applyAmount(context.userId, data.paymentId, data.amount, data.method, data.reference);
  });

export const resetPayment = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: number }) => {
    const id = Number(input.id);
    if (!id) throw new Error("Payment is required");
    return { id };
  })
  .handler(async ({ context, data }): Promise<Payment[]> => {
    const sql = await getSql();
    const rows = await sql<{ tenant_id: number; total_rent: number }>`
      select tenant_id, total_rent from payments
      where id = ${data.id} and user_id = ${context.userId}
    `;
    if (!rows[0]) throw new Error("Payment not found");
    await sql`
      update payments set
        paid_amount = 0,
        remaining_amount = ${Number(rows[0].total_rent)},
        status = 'unpaid',
        paid_by = '',
        paid_at = null,
        transaction_id = ''
      where id = ${data.id} and user_id = ${context.userId}
    `;
    return loadPayments(context.userId, rows[0].tenant_id);
  });

export const getRoomDetail = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { id: number }) => {
    const id = Number(input.id);
    if (!id) throw new Error("Room is required");
    return { id };
  })
  .handler(async ({ context, data }): Promise<RoomDetail> => {
    const sql = await getSql();
    const rooms = await sql<RoomRow>`
      select id, room_number, rent, status, tenant_name
      from rooms where id = ${data.id} and user_id = ${context.userId}
    `;
    if (!rooms[0]) throw new Error("Room not found");
    const room = mapRoom(rooms[0]);
    const tenants = await sql<TenantRow>`
      select id, name, phone, email, room_number, rent_amount, deposit_amount,
             start_date, notes, is_active
      from tenants
      where user_id = ${context.userId}
        and room_number = ${room.roomNumber}
        and is_active = true
    `;
    const tenant = tenants[0] ? await withLedger(context.userId, tenants[0]) : null;
    return { room, tenant };
  });

