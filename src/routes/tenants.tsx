import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Pencil, Plus, Printer, Trash2, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { ChargeDialog } from "@/components/payments/charge-dialog";
import { PayDialog } from "@/components/payments/pay-dialog";
import { BillDialog } from "@/components/payments/bill-dialog";
import { ReceiptDialog } from "@/components/payments/receipt-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { formatDateIN, formatDateTimeIN, inr, methodLabel, monthLabel } from "@/lib/rent/months";
import { rentKeys } from "@/lib/rent/queries";
import {
  addCharge,
  addTenant,
  applyPayment,
  deleteTenant,
  getDashboard,
  getTenant,
  updateTenant,
} from "@/lib/rent/server";
import type { PayMethod, Payment, Tenant } from "@/lib/rent/types";
import { cn, errMsg } from "@/lib/utils";

type Search = { id?: number };

export const Route = createFileRoute("/tenants")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    id: typeof s.id === "number" ? s.id : s.id ? Number(s.id) : undefined,
  }),
  component: TenantsPage,
});

function TenantsPage() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) {
    return (
      <AppShell>
        <Skeleton className="h-96 rounded-3xl" />
      </AppShell>
    );
  }
  if (!user) return <RedirectToSignIn />;
  return (
    <AppShell>
      <TenantsView />
    </AppShell>
  );
}

function emptyForm(roomNumber = "") {
  return {
    name: "",
    phone: "",
    email: "",
    roomNumber,
    rentAmount: "3000",
    depositAmount: "0",
    startDate: new Date().toISOString().slice(0, 10),
    notes: "",
  };
}

function TenantsView() {
  const { id } = Route.useSearch();
  const navigate = useNavigate({ from: "/tenants" });
  const qc = useQueryClient();
  const dash = useQuery({ queryKey: rentKeys.dashboard, queryFn: () => getDashboard() });
  const detail = useQuery({
    queryKey: rentKeys.tenant(id ?? 0),
    queryFn: () => getTenant({ data: { id: id! } }),
    enabled: Boolean(id),
  });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Tenant | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [pay, setPay] = useState<Payment | null>(null);
  const [bill, setBill] = useState<Payment | null>(null);
  const [receipt, setReceipt] = useState<Payment | null>(null);
  const [charge, setCharge] = useState<Payment | null>(null);

  const vacantRooms = useMemo(
    () => (dash.data?.rooms ?? []).filter((r) => r.status === "vacant"),
    [dash.data],
  );

  const tenants = dash.data?.tenants ?? [];
  const selected = detail.data ?? tenants.find((t) => t.id === id);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        phone: form.phone,
        email: form.email,
        roomNumber: form.roomNumber,
        rentAmount: Number(form.rentAmount),
        depositAmount: Number(form.depositAmount || 0),
        startDate: form.startDate,
        notes: form.notes,
      };
      if (editing) return updateTenant({ data: { id: editing.id, ...payload } });
      return addTenant({ data: payload });
    },
    onSuccess: (t) => {
      void qc.invalidateQueries({ queryKey: rentKeys.dashboard });
      void qc.invalidateQueries({ queryKey: rentKeys.tenant(t.id) });
      setFormOpen(false);
      setEditing(null);
      toast.success(editing ? "Tenant updated" : "Tenant added");
      void navigate({ search: { id: t.id } });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const remove = useMutation({
    mutationFn: (tid: number) => deleteTenant({ data: { id: tid } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: rentKeys.dashboard });
      toast.success("Tenant removed");
      void navigate({ search: {} });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const payMut = useMutation({
    mutationFn: ({ amount, method, reference }: { amount: number; method: PayMethod; reference?: string }) =>
      applyPayment({ data: { paymentId: pay!.id, amount, method, reference } }),
    onSuccess: (rows) => {
      void qc.invalidateQueries({ queryKey: rentKeys.dashboard });
      if (id) void qc.invalidateQueries({ queryKey: rentKeys.tenant(id) });
      const updated = pay ? rows.find((r) => r.id === pay.id) : undefined;
      setPay(null);
      toast.success("Payment recorded");
      if (updated) setReceipt(updated);
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const chargeMut = useMutation({
    mutationFn: ({ amount, note }: { amount: number; note: string }) =>
      addCharge({ data: { paymentId: charge!.id, amount, note } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: rentKeys.dashboard });
      if (id) void qc.invalidateQueries({ queryKey: rentKeys.tenant(id) });
      setCharge(null);
      toast.success("Added to bill");
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  function openCreate() {
    setEditing(null);
    setForm(emptyForm(vacantRooms[0]?.roomNumber ?? ""));
    setFormOpen(true);
  }

  function openEdit(t: Tenant) {
    setEditing(t);
    setForm({
      name: t.name,
      phone: t.phone,
      email: t.email,
      roomNumber: t.roomNumber,
      rentAmount: String(t.rentAmount),
      depositAmount: String(t.depositAmount ?? 0),
      startDate: t.startDate,
      notes: t.notes,
    });
    setFormOpen(true);
  }

  const thisMonth = monthLabel(new Date());
  const ledger = detail.data?.payments ?? [];

  return (
    <div>
      <div className="mb-6 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-[0.18em] text-muted uppercase">People</p>
          <h1 className="mt-1 font-display text-3xl tracking-tight">Tenants</h1>
        </div>
        <div>
          <Button
            type="button"
            onClick={() => {
              if (vacantRooms.length === 0) {
                toast.error("Add a vacant room first, then assign a tenant.");
                return;
              }
              openCreate();
            }}
          >
            <Plus className="size-4" />
            Add tenant
          </Button>
          {vacantRooms.length === 0 && (
            <p className="mt-1 text-right text-[11px] text-muted">Needs a vacant room</p>
          )}
        </div>
      </div>

      {dash.isLoading ? (
        <Skeleton className="h-80 rounded-3xl" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <aside className="overflow-hidden rounded-3xl border border-border bg-surface">
            <div className="border-b border-border px-4 py-3 text-sm text-muted">
              {tenants.length} active
            </div>
            {tenants.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted">No tenants yet.</p>
            ) : (
              <ul>
                {tenants.map((t) => {
                  const active = t.id === id;
                  return (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => navigate({ search: { id: t.id } })}
                        className={cn(
                          "flex w-full flex-col items-start gap-0.5 border-b border-border px-4 py-3 text-left",
                          active ? "bg-surface-2" : "hover:bg-surface-2/60",
                        )}
                      >
                        <span className="text-sm font-medium">{t.name}</span>
                        <span className="text-xs text-muted">
                          {t.roomNumber} · {inr(t.rentAmount)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </aside>

          <section className="rounded-3xl border border-border bg-surface p-5">
            {!id ? (
              <div className="grid min-h-64 place-items-center text-center text-muted">
                <p>Select a tenant to open their file.</p>
              </div>
            ) : detail.isLoading ? (
              <Skeleton className="h-64" />
            ) : !detail.data ? (
              <p className="text-sm text-muted">Tenant not found.</p>
            ) : (
              <div>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-2xl tracking-tight">{detail.data.name}</h2>
                    <p className="mt-1 text-sm text-muted">
                      Room {detail.data.roomNumber} · {inr(detail.data.rentAmount)}/month
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="secondary" size="sm" onClick={() => openEdit(detail.data)}>
                      <Pencil className="size-3.5" />
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (confirm(`Remove ${detail.data.name}? The room will be marked vacant.`)) {
                          remove.mutate(detail.data.id);
                        }
                      }}
                    >
                      <Trash2 className="size-3.5" />
                      Remove
                    </Button>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Meta label="Phone" value={detail.data.phone || "—"} />
                  <Meta label="Joined" value={formatDateIN(detail.data.startDate)} />
                  <Meta label="Deposit" value={inr(detail.data.depositAmount)} />
                  <Meta label="Due" value={inr(detail.data.totalDue)} danger={detail.data.totalDue > 0} />
                </div>

                <h3 className="mt-8 mb-3 text-sm font-medium text-muted">Ledger</h3>
                <div className="space-y-2">
                  {ledger.length === 0 ? (
                    <p className="text-sm text-muted">No months generated yet.</p>
                  ) : (
                    ledger.map((p) => (
                      <div
                        key={p.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-bg px-4 py-3"
                      >
                        <div>
                          <p className="text-sm font-medium">
                            {p.month}
                            {p.month === thisMonth ? (
                              <span className="ml-2 text-[11px] text-faint">this month</span>
                            ) : null}
                          </p>
                          <p className="text-xs tabular text-muted">
                            {inr(p.paidAmount)} paid · {inr(p.remainingAmount)} due
                            {p.extraAmount > 0 ? ` · extra ${inr(p.extraAmount)}` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={p.status}>{p.status}</Badge>
                          <Button type="button" size="sm" variant="ghost" onClick={() => setBill(p)}>
                            <Printer className="size-3.5" />
                            Bill
                          </Button>
                          <Button type="button" size="sm" variant="secondary" onClick={() => setCharge(p)}>
                            Extra
                          </Button>
                          {p.status !== "paid" && (
                            <Button type="button" size="sm" onClick={() => setPay(p)}>
                              <Wallet className="size-3.5" />
                              Collect
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <h3 className="mt-8 mb-3 text-sm font-medium text-muted">Collections</h3>
                <div className="space-y-2">
                  {(detail.data.events ?? []).length === 0 ? (
                    <p className="text-sm text-muted">No collections recorded yet.</p>
                  ) : (
                    detail.data.events.map((e) => (
                      <div
                        key={e.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-bg px-4 py-3"
                      >
                        <div>
                          <p className="text-sm font-medium tabular">{inr(e.amount)}</p>
                          <p className="text-xs text-muted">
                            {methodLabel(e.method)}
                            {e.month ? ` · ${e.month}` : ""}
                            {e.reference ? ` · ${e.reference}` : ""}
                          </p>
                        </div>
                        <p className="text-xs text-faint">{formatDateTimeIN(e.createdAt)}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogTitle>{editing ? "Edit tenant" : "New tenant"}</DialogTitle>
          <DialogDescription>Occupies a vacant room and opens a monthly ledger.</DialogDescription>
          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <div>
              <Label htmlFor="t-name">Name</Label>
              <Input
                id="t-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="t-phone">Phone</Label>
                <Input
                  id="t-phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="t-email">Email</Label>
                <Input
                  id="t-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="t-rent">Rent</Label>
                <Input
                  id="t-rent"
                  type="number"
                  min={1}
                  value={form.rentAmount}
                  onChange={(e) => setForm({ ...form, rentAmount: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="t-deposit">Deposit</Label>
                <Input
                  id="t-deposit"
                  type="number"
                  min={0}
                  value={form.depositAmount}
                  onChange={(e) => setForm({ ...form, depositAmount: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="t-room">Room</Label>
              <Select
                id="t-room"
                value={form.roomNumber}
                onChange={(e) => setForm({ ...form, roomNumber: e.target.value })}
                required
              >
                <option value="">Select a room</option>
                {editing && (
                  <option value={editing.roomNumber}>{editing.roomNumber} (current)</option>
                )}
                {vacantRooms.map((r) => (
                  <option key={r.id} value={r.roomNumber}>
                    {r.roomNumber} · {inr(r.rent)}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="t-start">Start date</Label>
              <Input
                id="t-start"
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="t-notes">Notes</Label>
              <Textarea
                id="t-notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            <Button type="submit" className="w-full" disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <PayDialog
        payment={pay}
        tenantName={selected?.name}
        building={dash.data?.building}
        open={Boolean(pay)}
        onOpenChange={(o) => {
          if (!o) setPay(null);
        }}
        busy={payMut.isPending}
        onPay={(amount, method, reference) => payMut.mutate({ amount, method, reference })}
      />
      <BillDialog
        payment={bill}
        building={dash.data?.building}
        open={Boolean(bill)}
        onOpenChange={(o) => !o && setBill(null)}
      />
      <ReceiptDialog
        payment={receipt}
        building={dash.data?.building}
        open={Boolean(receipt)}
        onOpenChange={(o) => !o && setReceipt(null)}
      />
      <ChargeDialog
        payment={charge}
        open={Boolean(charge)}
        onOpenChange={(o) => !o && setCharge(null)}
        onAdd={(amount, note) => chargeMut.mutate({ amount, note })}
        busy={chargeMut.isPending}
      />
    </div>
  );
}

function Meta({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="rounded-2xl bg-bg px-3 py-3">
      <p className="text-[11px] tracking-wide text-muted uppercase">{label}</p>
      <p className={cn("mt-1 text-sm tabular", danger && "text-danger")}>{value}</p>
    </div>
  );
}
