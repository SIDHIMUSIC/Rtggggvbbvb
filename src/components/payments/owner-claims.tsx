import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTimeIN, inr, methodLabel } from "@/lib/rent/months";
import { rentKeys } from "@/lib/rent/queries";
import { confirmPayClaim, listPayClaims, rejectPayClaim } from "@/lib/rent/portal-server";
import { errMsg } from "@/lib/utils";

export function OwnerClaims() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: rentKeys.claims, queryFn: () => listPayClaims() });
  const confirm = useMutation({
    mutationFn: (id: number) => confirmPayClaim({ data: { id } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: rentKeys.claims });
      void qc.invalidateQueries({ queryKey: rentKeys.dashboard });
      toast.success("Payment confirmed");
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const reject = useMutation({
    mutationFn: (id: number) => rejectPayClaim({ data: { id } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: rentKeys.claims });
      toast.success("Claim rejected — bill stays unpaid");
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const rows = q.data ?? [];
  if (q.isLoading || rows.length === 0) return null;

  return (
    <section className="mb-6 rounded-3xl border border-warn/30 bg-surface p-4">
      <div className="mb-3 flex items-center gap-2">
        <Bell className="size-4 text-warn" />
        <h2 className="text-sm font-medium">Tenant payment alerts</h2>
        <Badge variant="pending">{rows.length} waiting</Badge>
      </div>
      <ul className="space-y-2">
        {rows.map((c) => (
          <li
            key={c.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-bg px-4 py-3"
          >
            <div>
              <p className="text-sm font-medium">
                {c.tenantName} · {c.roomNumber} says paid {inr(c.amount)}
              </p>
              <p className="text-xs text-muted">
                {c.month} · {methodLabel(c.method)}
                {c.reference ? ` · ${c.reference}` : ""} · {formatDateTimeIN(c.createdAt)}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={reject.isPending || confirm.isPending}
                onClick={() => reject.mutate(c.id)}
              >
                Reject
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={confirm.isPending || reject.isPending}
                onClick={() => confirm.mutate(c.id)}
              >
                Confirm payment
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
