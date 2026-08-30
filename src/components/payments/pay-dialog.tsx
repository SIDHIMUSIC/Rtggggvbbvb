import { useState } from "react";
import { Banknote, Copy, Smartphone } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { inr } from "@/lib/rent/months";
import { upiPayUrl } from "@/lib/rent/upi";
import type { Building, PayMethod, Payment } from "@/lib/rent/types";
import { cn } from "@/lib/utils";
import { UpiQr } from "./upi-qr";

export function PayDialog({
  payment,
  tenantName,
  building,
  open,
  onOpenChange,
  onPay,
  busy,
}: {
  payment: Payment | null;
  tenantName?: string;
  building?: Building | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPay: (amount: number, method: PayMethod, reference?: string) => void;
  busy: boolean;
}) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PayMethod>("upi");
  const [reference, setReference] = useState("");
  const remaining = payment?.remainingAmount ?? 0;
  const payAmount = Number(amount || remaining) || remaining;
  const upiId = building?.upiId ?? "";
  const payee = building?.ownerName || building?.name || "Owner";

  const qrValue =
    payment && upiId
      ? upiPayUrl({
          pa: upiId,
          pn: payee,
          am: payAmount > 0 ? payAmount : remaining,
          tn: `Rent ${payment.month} ${payment.roomNumber}`,
        })
      : "";

  function reset() {
    setAmount("");
    setReference("");
    setMethod("upi");
  }

  function submit() {
    const n = Number(amount || remaining);
    if (!Number.isFinite(n) || n <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    onPay(n, method, reference.trim() || undefined);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="w-[min(100%-1.5rem,480px)]">
        <DialogTitle>Collect rent</DialogTitle>
        <DialogDescription>
          {tenantName ? `${tenantName} · ` : ""}
          {payment?.month} · {payment?.roomNumber}
        </DialogDescription>

        {payment && (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-2xl bg-bg px-4 py-3 text-sm">
                <p className="text-[11px] text-muted uppercase">Paid</p>
                <p className="mt-1 tabular text-accent">{inr(payment.paidAmount)}</p>
              </div>
              <div className="rounded-2xl bg-bg px-4 py-3 text-sm">
                <p className="text-[11px] text-muted uppercase">Due</p>
                <p className="mt-1 tabular text-danger">{inr(payment.remainingAmount)}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMethod("upi")}
                className={cn(
                  "flex h-11 items-center justify-center gap-2 rounded-[10px] border text-sm font-medium",
                  method === "upi"
                    ? "border-primary bg-primary text-primary-fg"
                    : "border-border bg-surface-2 text-fg",
                )}
              >
                <Smartphone className="size-4" />
                UPI
              </button>
              <button
                type="button"
                onClick={() => setMethod("cash")}
                className={cn(
                  "flex h-11 items-center justify-center gap-2 rounded-[10px] border text-sm font-medium",
                  method === "cash"
                    ? "border-primary bg-primary text-primary-fg"
                    : "border-border bg-surface-2 text-fg",
                )}
              >
                <Banknote className="size-4" />
                Cash
              </button>
            </div>

            <div>
              <Label htmlFor="pay-amount">Amount</Label>
              <Input
                id="pay-amount"
                type="number"
                min={1}
                value={amount}
                placeholder={String(remaining)}
                onChange={(e) => setAmount(e.target.value)}
              />
              <p className="mt-1.5 text-xs text-faint">
                Extra rupees roll forward to later months.
              </p>
            </div>

            {method === "upi" && (
              <div className="rounded-2xl border border-border bg-bg p-4">
                {upiId ? (
                  <>
                    <UpiQr value={qrValue} label="Tenant scans this to pay you" />
                    <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-[11px] text-muted uppercase">UPI ID</p>
                        <p className="truncate font-mono text-sm">{upiId}</p>
                      </div>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="size-9 shrink-0"
                        aria-label="Copy UPI ID"
                        onClick={() => {
                          void navigator.clipboard.writeText(upiId);
                          toast.success("UPI ID copied");
                        }}
                      >
                        <Copy className="size-4" />
                      </Button>
                    </div>
                  </>
                ) : (
                  <p className="text-center text-sm text-muted">
                    Add your UPI ID in{" "}
                    <Link to="/settings" className="text-fg underline underline-offset-2">
                      building settings
                    </Link>{" "}
                    to show a collection QR.
                  </p>
                )}
                <div className="mt-3">
                  <Label htmlFor="upi-ref">UPI UTR / reference</Label>
                  <Input
                    id="upi-ref"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="Optional — from the bank SMS"
                    autoCapitalize="characters"
                  />
                </div>
              </div>
            )}

            {method === "cash" && (
              <div>
                <Label htmlFor="cash-ref">Receipt number</Label>
                <Input
                  id="cash-ref"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Optional"
                />
              </div>
            )}

            <Button type="button" className="w-full" disabled={busy} onClick={submit}>
              {busy
                ? "Recording…"
                : `Mark ${inr(payAmount || remaining)} received`}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
