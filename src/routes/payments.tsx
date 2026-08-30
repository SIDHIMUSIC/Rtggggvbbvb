import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Printer, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { OwnerClaims } from "@/components/payments/owner-claims";
import { PayDialog } from "@/components/payments/pay-dialog";
import { ReceiptDialog } from "@/components/payments/receipt-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { currentMonthIndex, inr, isOverdue, methodLabel } from "@/lib/rent/months";
import { rentKeys } from "@/lib/rent/queries";
import { applyPayment, getDashboard, resetPayment } from "@/lib/rent/server";
import type { PayMethod, Payment } from "@/lib/rent/types";
import { cn, errMsg } from "@/lib/utils";

type Search = { tenant?: number };
type Filter = "all" | "due" | "paid";

export const Route = createFileRoute("/payments")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    tenant: typeof s.tenant === "number" ? s.tenant : s.tenant ? Number(s.tenant) : undefined,
  }),
  component: PaymentsPage,
});

function PaymentsPage() {
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
      <PaymentsView />
    </AppShell>
  );
}

function PaymentsView() {
  const { tenant } = Route.useSearch();
  const navigate = Route.useNavigate();
  const qc = useQueryClient();
  const dash = useQuery({ queryKey: rentKeys.dashboard, queryFn: () => getDashboard() });
  const [pay, setPay] = useState<Payment | null>(null);
  const [receipt, setReceipt] = useState<Payment | null>(null);
  const [filter, setFilter] = useState<Filter>("due");

  const payments = useMemo(() => {
    const all = dash.data?.payments ?? [];
    const scoped = tenant ? all.filter((p) => p.tenantId === tenant) : all;
    if (filter === "paid") return scoped.filter((p) => p.status === "paid");
    if (filter === "due") return scoped.filter((p) => p.status !== "paid");
    return scoped;
  }, [dash.data, tenant, filter]);

  const pending = (dash.data?.payments ?? [])
    .filter((p) => (tenant ? p.tenantId === tenant : true))
    .reduce((s, p) => s + p.remainingAmount, 0);
  const collected = (dash.data?.payments ?? [])
    .filter((p) => (tenant ? p.tenantId === tenant : true))
    .reduce((s, p) => s + p.paidAmount, 0);
  const selectedTenant = dash.data?.tenants.find((t) => t.id === tenant);
  const nowIdx = currentMonthIndex();

  const payMut = useMutation({
    mutationFn: ({ amount, method, reference }: { amount: number; method: PayMethod; reference?: string }) =>
      applyPayment({ data: { paymentId: pay!.id, amount, method, reference } }),
    onSuccess: (rows) => {
      void qc.invalidateQueries({ queryKey: rentKeys.dashboard });
      const updated = pay ? rows.find((r) => r.id === pay.id) : undefined;
      setPay(null);
      toast.success("Payment recorded");
      if (updated) setReceipt(updated);
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const reset = useMutation({
    mutationFn: (id: number) => resetPayment({ data: { id } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: rentKeys.dashboard });
      toast.success("Month reset");
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <div>
      <div className="mb-6">
        <p className="text-xs font-medium tracking-[0.18em] text-muted uppercase">Money</p>
        <h1 className="mt-1 font-display text-3xl tracking-tight">Hisab</h1>
      </div>

      <OwnerClaims />

      {dash.isLoading ? (
        <Skeleton className="h-80 rounded-3xl" />
      ) : (
        <>
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <p className="mb-1.5 text-xs font-medium text-muted">Tenant</p>
              <Select
                value={tenant ? String(tenant) : ""}
                onChange={(e) =>
                  navigate({
                    search: { tenant: e.target.value ? Number(e.target.value) : undefined },
                  })
                }
              >
                <option value="">All tenants</option>
                {(dash.data?.tenants ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} · {t.roomNumber}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid flex-1 grid-cols-2 gap-3">
              <div className="rounded-2xl border border-border bg-surface px-4 py-3">
                <p className="text-[11px] text-muted uppercase">Collected</p>
                <p className="mt-1 font-display text-xl tabular">{inr(collected)}</p>
              </div>
              <div className="rounded-2xl border border-border bg-surface px-4 py-3">
                <p className="text-[11px] text-muted uppercase">Pending</p>
                <p className="mt-1 font-display text-xl tabular text-danger">{inr(pending)}</p>
              </div>
            </div>
          </div>

          <div className="mb-4 flex gap-1 rounded-2xl border border-border bg-surface p-1">
            {([
              ["due", "Due"],
              ["paid", "Paid"],
              ["all", "All"],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id)}
                className={cn(
                  "h-9 flex-1 rounded-xl text-sm font-medium",
                  filter === id ? "bg-surface-2 text-fg" : "text-muted hover:text-fg",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {payments.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border px-6 py-16 text-center">
              <p className="font-display text-xl">No payment rows</p>
              <p className="mt-2 text-sm text-muted">
                {filter === "due"
                  ? "Nothing due in this view."
                  : "Add a tenant and months will appear from their start date."}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {payments
                .slice()
                .sort((a, b) => a.monthIndex - b.monthIndex)
                .map((p) => {
                  const overdue = isOverdue(p);
                  const thisMonth = p.monthIndex === nowIdx;
                  return (
                    <div
                      key={p.id}
                      className={cn(
                        "flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-surface px-4 py-3",
                        overdue ? "border-danger/30" : "border-border",
                      )}
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {p.month}
                          {thisMonth ? (
                            <span className="ml-2 text-[11px] text-faint">this month</span>
                          ) : overdue ? (
                            <span className="ml-2 text-[11px] text-danger">overdue</span>
                          ) : null}
                          <span className="ml-2 text-muted">
                            {p.tenantName ?? selectedTenant?.name} · {p.roomNumber}
                          </span>
                        </p>
                        <p className="text-xs tabular text-muted">
                          {inr(p.paidAmount)} / {inr(p.totalRent)}
                          {p.paidBy ? ` · ${methodLabel(p.paidBy)}` : ""}
                          {p.transactionId ? ` · ${p.transactionId}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={p.status}>{p.status}</Badge>
                        {p.status !== "paid" && (
                          <Button type="button" size="sm" onClick={() => setPay(p)}>
                            Collect
                          </Button>
                        )}
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="size-9"
                          onClick={() => setReceipt(p)}
                          aria-label="Receipt"
                        >
                          <Printer className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="size-9"
                          onClick={() => {
                            if (confirm(`Reset ${p.month} to unpaid?`)) reset.mutate(p.id);
                          }}
                          aria-label="Reset"
                        >
                          <RotateCcw className="size-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </>
      )}

      <PayDialog
        payment={pay}
        tenantName={pay?.tenantName}
        building={dash.data?.building}
        open={Boolean(pay)}
        onOpenChange={(o) => {
          if (!o) setPay(null);
        }}
        busy={payMut.isPending}
        onPay={(amount, method, reference) => payMut.mutate({ amount, method, reference })}
      />
      <ReceiptDialog
        payment={receipt}
        building={dash.data?.building}
        open={Boolean(receipt)}
        onOpenChange={(o) => {
          if (!o) setReceipt(null);
        }}
      />
    </div>
  );
}
