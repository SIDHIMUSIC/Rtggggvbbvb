import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Printer, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { BillDialog } from "@/components/payments/bill-dialog";
import { ChargeDialog } from "@/components/payments/charge-dialog";
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
import { addCharge, applyPayment, getDashboard } from "@/lib/rent/server";
import type { PayMethod, Payment } from "@/lib/rent/types";
import { errMsg } from "@/lib/utils";

export const Route = createFileRoute("/bills")({
  component: BillsPage,
});

function BillsPage() {
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
      <BillsView />
    </AppShell>
  );
}

function BillsView() {
  const qc = useQueryClient();
  const dash = useQuery({ queryKey: rentKeys.dashboard, queryFn: () => getDashboard() });
  const nowIdx = currentMonthIndex();
  const months = useMemo(() => {
    const map = new Map<number, string>();
    for (const p of dash.data?.payments ?? []) map.set(p.monthIndex, p.month);
    return [...map.entries()].sort((a, b) => b[0] - a[0]);
  }, [dash.data]);
  const [monthIdx, setMonthIdx] = useState<number | "all">("all");
  const [pay, setPay] = useState<Payment | null>(null);
  const [bill, setBill] = useState<Payment | null>(null);
  const [receipt, setReceipt] = useState<Payment | null>(null);
  const [charge, setCharge] = useState<Payment | null>(null);

  const rows = useMemo(() => {
    const all = dash.data?.payments ?? [];
    if (monthIdx === "all") return all;
    return all.filter((p) => p.monthIndex === monthIdx);
  }, [dash.data, monthIdx]);

  const due = rows.reduce((s, p) => s + p.remainingAmount, 0);
  const billed = rows.reduce((s, p) => s + p.totalRent, 0);

  const payMut = useMutation({
    mutationFn: ({ amount, method, reference }: { amount: number; method: PayMethod; reference?: string }) =>
      applyPayment({ data: { paymentId: pay!.id, amount, method, reference } }),
    onSuccess: (updated) => {
      void qc.invalidateQueries({ queryKey: rentKeys.dashboard });
      const row = pay ? updated.find((r) => r.id === pay.id) : undefined;
      setPay(null);
      toast.success("Payment recorded");
      if (row) setReceipt(row);
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const chargeMut = useMutation({
    mutationFn: ({ amount, note }: { amount: number; note: string }) =>
      addCharge({ data: { paymentId: charge!.id, amount, note } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: rentKeys.dashboard });
      setCharge(null);
      toast.success("Added to bill");
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <div>
      <div className="mb-6">
        <p className="text-xs font-medium tracking-[0.18em] text-muted uppercase">Paper</p>
        <h1 className="mt-1 font-display text-3xl tracking-tight">Bills</h1>
      </div>

      {dash.isLoading ? (
        <Skeleton className="h-80 rounded-3xl" />
      ) : (
        <>
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <p className="mb-1.5 text-xs font-medium text-muted">Month</p>
              <Select
                value={monthIdx === "all" ? "" : String(monthIdx)}
                onChange={(e) => setMonthIdx(e.target.value ? Number(e.target.value) : "all")}
              >
                <option value="">All months</option>
                {months.map(([idx, label]) => (
                  <option key={idx} value={idx}>
                    {label}
                    {idx === nowIdx ? " · this month" : ""}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid flex-1 grid-cols-2 gap-2">
              <div className="rounded-2xl border border-border bg-surface px-4 py-3">
                <p className="text-[11px] text-muted uppercase">Billed</p>
                <p className="mt-1 tabular font-medium">{inr(billed)}</p>
              </div>
              <div className="rounded-2xl border border-border bg-surface px-4 py-3">
                <p className="text-[11px] text-muted uppercase">Still due</p>
                <p className="mt-1 tabular font-medium text-danger">{inr(due)}</p>
              </div>
            </div>
          </div>

          {rows.length === 0 ? (
            <p className="rounded-3xl border border-border bg-surface px-5 py-12 text-center text-sm text-muted">
              No bills yet. Add a tenant and months generate themselves.
            </p>
          ) : (
            <ul className="space-y-2">
              {rows.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-border bg-surface px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {p.tenantName} · {p.roomNumber}
                    </p>
                    <p className="text-xs tabular text-muted">
                      {p.month} · {inr(p.totalRent)}
                      {p.extraAmount > 0 ? ` incl. extra ${inr(p.extraAmount)}` : ""}
                      {p.paidBy ? ` · ${methodLabel(p.paidBy)}` : ""}
                      {isOverdue(p) ? " · overdue" : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={p.status}>{p.status}</Badge>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setBill(p)}>
                      <Printer className="size-3.5" />
                      Bill
                    </Button>
                    <Button type="button" size="sm" variant="secondary" onClick={() => setCharge(p)}>
                      <Plus className="size-3.5" />
                      Extra
                    </Button>
                    {p.status !== "paid" && (
                      <Button type="button" size="sm" onClick={() => setPay(p)}>
                        <Wallet className="size-3.5" />
                        Collect
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <PayDialog
        payment={pay}
        tenantName={pay?.tenantName}
        building={dash.data?.building}
        open={Boolean(pay)}
        onOpenChange={(o) => !o && setPay(null)}
        onPay={(amount, method, reference) => payMut.mutate({ amount, method, reference })}
        busy={payMut.isPending}
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
