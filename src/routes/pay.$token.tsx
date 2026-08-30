import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Checkout } from "@/components/payments/checkout";
import { Badge } from "@/components/ui/badge";
import { formatDateTimeIN, inr, methodLabel } from "@/lib/rent/months";
import { confirmTenantPay, getPayPortal } from "@/lib/rent/portal-server";
import type { PayConfirm, Payment } from "@/lib/rent/types";
import { errMsg } from "@/lib/utils";

export const Route = createFileRoute("/pay/$token")({
  component: TenantPayPage,
});

function TenantPayPage() {
  const { token } = Route.useParams();
  const portal = useQuery({
    queryKey: ["pay-portal", token],
    queryFn: () => getPayPortal({ data: { token } }),
  });
  const [target, setTarget] = useState<Payment | null>(null);

  const firstDue = useMemo(() => {
    const due = portal.data?.due ?? [];
    return due.slice().sort((a, b) => a.monthIndex - b.monthIndex)[0] ?? null;
  }, [portal.data]);

  const pending = (portal.data?.claims ?? []).filter((c) => c.status === "pending");

  const payMut = useMutation({
    mutationFn: (input: {
      paymentId: number;
      amount: number;
      method: PayConfirm["claim"]["method"];
      reference: string;
    }) =>
      confirmTenantPay({
        data: {
          token,
          paymentId: input.paymentId,
          amount: input.amount,
          method: input.method,
          reference: input.reference,
        },
      }),
    onSuccess: () => {
      toast.success("Owner notified. Bill stays unpaid until they confirm.");
      void portal.refetch();
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  if (portal.isLoading) {
    return (
      <div className="grid min-h-dvh place-items-center bg-[#0b1220] px-4 text-white">
        <p className="text-sm text-white/70">Opening checkout…</p>
      </div>
    );
  }

  if (portal.isError || !portal.data) {
    return (
      <div className="grid min-h-dvh place-items-center bg-[#0b1220] px-4 text-center text-white">
        <div>
          <p className="font-display text-2xl">Link not valid</p>
          <p className="mt-2 text-sm text-white/70">Ask the owner to send a fresh pay link.</p>
        </div>
      </div>
    );
  }

  const data = portal.data;
  const paying = target ?? firstDue;
  const waitingOnPaying = paying
    ? pending.some((c) => c.paymentId === paying.id)
    : pending.length > 0;

  return (
    <div className="min-h-dvh bg-[#0b1220] px-4 py-8 text-white">
      <div className="mx-auto w-full max-w-md">
        <p className="text-[11px] tracking-[0.16em] text-white/50 uppercase">
          {data.building.name || "Rentweb"}
        </p>
        <h1 className="mt-1 font-display text-3xl tracking-tight">Pay rent</h1>
        <p className="mt-2 text-sm text-white/70">
          {data.tenant.name} · Room {data.tenant.roomNumber}
        </p>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-white/8 px-4 py-3">
            <p className="text-[11px] text-white/50 uppercase">Due</p>
            <p className="mt-1 text-xl tabular">{inr(data.totalDue)}</p>
          </div>
          <div className="rounded-2xl bg-white/8 px-4 py-3">
            <p className="text-[11px] text-white/50 uppercase">Waiting owner</p>
            <p className="mt-1 text-xl tabular">{pending.length}</p>
          </div>
        </div>

        {pending.length > 0 ? (
          <ul className="mt-5 space-y-2">
            {pending.map((c) => (
              <li key={c.id} className="rounded-2xl bg-amber-400/15 px-4 py-3 text-sm">
                <p className="font-medium">Reported {inr(c.amount)} · {c.month}</p>
                <p className="mt-1 text-xs text-white/70">
                  {methodLabel(c.method)}
                  {c.reference ? ` · ${c.reference}` : ""} · {formatDateTimeIN(c.createdAt)}
                </p>
                <p className="mt-1 text-xs text-amber-200">Waiting for owner to confirm payment</p>
              </li>
            ))}
          </ul>
        ) : null}

        {data.totalDue <= 0 ? (
          <p className="mt-8 rounded-2xl bg-emerald-500/15 px-4 py-6 text-center text-sm text-emerald-200">
            Nothing due. You are clear.
          </p>
        ) : waitingOnPaying ? (
          <p className="mt-6 rounded-2xl bg-white/8 px-4 py-4 text-center text-sm text-white/70">
            This bill is already with the owner. Receipt comes after they tap Confirm payment.
          </p>
        ) : paying ? (
          <div className="mt-6">
            <Checkout
              payment={paying}
              building={data.building}
              tenantName={data.tenant.name}
              busy={payMut.isPending}
              onConfirm={({ amount, method, reference }) =>
                payMut.mutateAsync({
                  paymentId: paying.id,
                  amount,
                  method,
                  reference,
                })
              }
            />
          </div>
        ) : null}

        {data.due.length > 1 ? (
          <ul className="mt-6 space-y-2">
            {data.due.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setTarget(p)}
                  className="flex w-full items-center justify-between rounded-2xl bg-white/8 px-4 py-3 text-left"
                >
                  <span>
                    <span className="block text-sm">{p.month}</span>
                    <span className="text-xs text-white/50">{inr(p.remainingAmount)} due</span>
                  </span>
                  <Badge variant={pending.some((c) => c.paymentId === p.id) ? "pending" : p.status}>
                    {pending.some((c) => c.paymentId === p.id) ? "waiting" : p.status}
                  </Badge>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
