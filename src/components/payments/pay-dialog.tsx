import { useState } from "react";
import { Banknote, Copy, CreditCard, FlaskConical, Smartphone } from "lucide-react";
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

const methods: Array<{ id: PayMethod; label: string; icon: typeof Smartphone }> = [
  { id: "upi", label: "UPI", icon: Smartphone },
  { id: "cash", label: "Cash", icon: Banknote },
  { id: "card", label: "Card", icon: CreditCard },
  { id: "dummy", label: "Dummy", icon: FlaskConical },
];

function last4(card: string): string {
  const digits = card.replace(/\D/g, "");
  return digits.slice(-4);
}

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
  const [cardNumber, setCardNumber] = useState("");
  const [cardName, setCardName] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
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
    setCardNumber("");
    setCardName("");
    setCardExpiry("");
  }

  function submit() {
    const n = Number(amount || remaining);
    if (!Number.isFinite(n) || n <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (method === "card") {
      const digits = cardNumber.replace(/\D/g, "");
      if (digits.length < 12) {
        toast.error("Enter the card number (last 4 is stored, never the full PAN)");
        return;
      }
      const tag = `**** ${last4(digits)}${cardName ? ` · ${cardName.trim()}` : ""}${
        reference.trim() ? ` · ${reference.trim()}` : ""
      }`;
      onPay(n, "card", tag.slice(0, 64));
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

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {methods.map((m) => {
                const Icon = m.icon;
                const on = method === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMethod(m.id)}
                    className={cn(
                      "flex h-11 items-center justify-center gap-1.5 rounded-[10px] border text-sm font-medium",
                      on
                        ? "border-primary bg-primary text-primary-fg"
                        : "border-border bg-surface-2 text-fg",
                    )}
                  >
                    <Icon className="size-4" />
                    {m.label}
                  </button>
                );
              })}
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
                    placeholder="From the bank SMS"
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

            {method === "card" && (
              <div className="space-y-3 rounded-2xl border border-border bg-bg p-4">
                <p className="text-xs leading-relaxed text-muted">
                  Record a card swipe or POS settlement. Only the last four digits
                  are stored — never the full card number.
                </p>
                <div>
                  <Label htmlFor="card-name">Name on card</Label>
                  <Input
                    id="card-name"
                    value={cardName}
                    onChange={(e) => setCardName(e.target.value)}
                    placeholder="As printed"
                    autoComplete="cc-name"
                  />
                </div>
                <div>
                  <Label htmlFor="card-number">Card number</Label>
                  <Input
                    id="card-number"
                    inputMode="numeric"
                    autoComplete="cc-number"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    placeholder="XXXX XXXX XXXX 4242"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="card-exp">Expiry</Label>
                    <Input
                      id="card-exp"
                      value={cardExpiry}
                      onChange={(e) => setCardExpiry(e.target.value)}
                      placeholder="MM/YY"
                      autoComplete="cc-exp"
                    />
                  </div>
                  <div>
                    <Label htmlFor="card-auth">Auth / approval</Label>
                    <Input
                      id="card-auth"
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                </div>
              </div>
            )}

            {method === "dummy" && (
              <p className="rounded-2xl border border-border bg-bg px-4 py-3 text-sm leading-relaxed text-muted">
                Dummy books the amount as received with no money moving — use it
                to test the ledger, bills, and receipts.
              </p>
            )}

            <Button type="button" className="w-full" disabled={busy} onClick={submit}>
              {busy
                ? "Recording…"
                : method === "dummy"
                  ? `Record dummy ${inr(payAmount || remaining)}`
                  : `Mark ${inr(payAmount || remaining)} received`}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
