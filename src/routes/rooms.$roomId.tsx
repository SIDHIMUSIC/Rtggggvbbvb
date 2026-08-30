import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { PayDialog } from "@/components/payments/pay-dialog";
import { ReceiptDialog } from "@/components/payments/receipt-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { formatDateIN, inr } from "@/lib/rent/months";
import { rentKeys } from "@/lib/rent/queries";
import { applyPayment, deleteRoom, getDashboard, getRoomDetail, updateRoom } from "@/lib/rent/server";
import type { PayMethod, Payment } from "@/lib/rent/types";
import { errMsg } from "@/lib/utils";

export const Route = createFileRoute("/rooms/$roomId")({
  component: RoomPage,
});

function RoomPage() {
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
      <RoomView />
    </AppShell>
  );
}

function RoomView() {
  const { roomId } = Route.useParams();
  const id = Number(roomId);
  const navigate = Route.useNavigate();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: rentKeys.room(id),
    queryFn: () => getRoomDetail({ data: { id } }),
    enabled: Number.isFinite(id),
  });
  const dash = useQuery({ queryKey: rentKeys.dashboard, queryFn: () => getDashboard() });
  const [pay, setPay] = useState<Payment | null>(null);
  const [receipt, setReceipt] = useState<Payment | null>(null);
  const [rentOpen, setRentOpen] = useState(false);
  const [rent, setRent] = useState("");

  const update = useMutation({
    mutationFn: () => updateRoom({ data: { id, rent: Number(rent) } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: rentKeys.room(id) });
      void qc.invalidateQueries({ queryKey: rentKeys.dashboard });
      setRentOpen(false);
      toast.success("Rent updated");
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const remove = useMutation({
    mutationFn: () => deleteRoom({ data: { id } }),
    onSuccess: () => {
      toast.success("Room deleted");
      void navigate({ to: "/" });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const payMut = useMutation({
    mutationFn: ({ amount, method, reference }: { amount: number; method: PayMethod; reference?: string }) =>
      applyPayment({ data: { paymentId: pay!.id, amount, method, reference } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: rentKeys.room(id) });
      void qc.invalidateQueries({ queryKey: rentKeys.dashboard });
      setPay(null);
      toast.success("Payment recorded");
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  if (q.isLoading) return <Skeleton className="h-96 rounded-3xl" />;
  if (q.error || !q.data) {
    return (
      <div>
        <p className="text-sm text-danger">{q.error ? errMsg(q.error) : "Room not found"}</p>
        <Link to="/" className="mt-3 inline-flex text-sm text-muted hover:text-fg">
          Back to board
        </Link>
      </div>
    );
  }

  const { room, tenant } = q.data;
  const occupied = room.status === "occupied";

  return (
    <div>
      <Link to="/" className="mb-5 inline-flex items-center gap-2 text-sm text-muted hover:text-fg">
        <ArrowLeft className="size-4" />
        Board
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-[0.18em] text-muted uppercase">Room</p>
          <h1 className="mt-1 font-display text-3xl tracking-tight">{room.roomNumber}</h1>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              setRent(String(room.rent));
              setRentOpen(true);
            }}
          >
            <Pencil className="size-3.5" />
            Rent
          </Button>
          {!occupied && (
            <Button type="button" variant="outline" size="sm" onClick={() => remove.mutate()}>
              <Trash2 className="size-3.5" />
              Delete
            </Button>
          )}
        </div>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-3xl border border-border bg-surface p-4">
          <p className="text-[11px] text-muted uppercase">Status</p>
          <div className="mt-2">
            <Badge variant={occupied ? "occupied" : "vacant"}>
              {occupied ? "Occupied" : "Vacant"}
            </Badge>
          </div>
        </div>
        <div className="rounded-3xl border border-border bg-surface p-4">
          <p className="text-[11px] text-muted uppercase">Listed rent</p>
          <p className="mt-2 font-display text-2xl tabular">{inr(tenant ? tenant.rentAmount : room.rent)}</p>
        </div>
        <div className="rounded-3xl border border-border bg-surface p-4">
          <p className="text-[11px] text-muted uppercase">Due</p>
          <p className="mt-2 font-display text-2xl tabular text-danger">
            {inr(tenant?.totalDue ?? 0)}
          </p>
        </div>
      </div>

      {tenant ? (
        <div className="rounded-3xl border border-border bg-surface p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs text-muted">Tenant</p>
              <h2 className="font-display text-2xl tracking-tight">{tenant.name}</h2>
              <p className="mt-1 text-sm text-muted">
                {tenant.phone || "No phone"} · since {formatDateIN(tenant.startDate)}
              </p>
            </div>
            <Link
              to="/tenants"
              search={{ id: tenant.id }}
              className="text-sm text-muted hover:text-fg"
            >
              Open file
            </Link>
          </div>

          <div className="mt-6 space-y-2">
            {tenant.payments.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-bg px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium">{p.month}</p>
                  <p className="text-xs tabular text-muted">
                    {inr(p.paidAmount)} / {inr(p.totalRent)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={p.status}>{p.status}</Badge>
                  {p.status !== "paid" && (
                    <Button type="button" size="sm" onClick={() => setPay(p)}>
                      Collect
                    </Button>
                  )}
                  <Button type="button" size="sm" variant="ghost" onClick={() => setReceipt(p)}>
                    Slip
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-border px-6 py-14 text-center">
          <p className="font-display text-xl">This room is vacant</p>
          <p className="mt-2 text-sm text-muted">Assign a tenant from the tenants page.</p>
          <Button asChild className="mt-4">
            <Link to="/tenants">Go to tenants</Link>
          </Button>
        </div>
      )}

      <Dialog open={rentOpen} onOpenChange={setRentOpen}>
        <DialogContent>
          <DialogTitle>Update listed rent</DialogTitle>
          <DialogDescription>Changes the room’s default monthly rent.</DialogDescription>
          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              update.mutate();
            }}
          >
            <div>
              <Label htmlFor="rent">Monthly rent</Label>
              <Input
                id="rent"
                type="number"
                min={1}
                value={rent}
                onChange={(e) => setRent(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={update.isPending}>
              Save
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <PayDialog
        payment={pay}
        tenantName={tenant?.name}
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
