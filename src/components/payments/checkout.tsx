import { useMemo, useState } from "react";
import { CheckCircle2, CreditCard, Loader2, ShieldCheck, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { inr } from "@/lib/rent/months";
import { upiPayUrl } from "@/lib/rent/upi";
import type { Building, PayMethod, Payment } from "@/lib/rent/types";
import { cn } from "@/lib/utils";
import { UpiQr } from "./upi-qr";

type Phase = "pick" | "upi" | "card" | "verifying" | "success";

export type CheckoutResult = {
  amount: number;
  method: PayMethod;
  reference: string;
};

export function Checkout({
  payment,
  building,
  tenantName,
  busy,
  onConfirm,
}: {
  payment: Payment;
  building?: Building | null;
  tenantName?: string;
  busy: boolean;
  onConfirm: (result: CheckoutResult) => Promise<void> | void;
}) {
  const remaining = payment.remainingAmount;
  const [amount, setAmount] = useState(String(remaining));
  const [phase, setPhase] = useState<Phase>("pick");
  const [method, setMethod] = useState<PayMethod>("upi");
  const [utr, setUtr] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardName, setCardName] = useState("");
  const payAmount = Math.max(0, Math.round(Number(amount || remaining) || remaining));
  const upiId = building?.upiId ?? "";
  const payee = building?.ownerName || building?.name || "Owner";
  const qrValue = useMemo(
    () =>
      upiId
        ? upiPayUrl({
            pa: upiId,
            pn: payee,
            am: payAmount > 0 ? payAmount : remaining,
            tn: `Rent ${payment.month} ${payment.roomNumber}`,
          })
        : "",
    [upiId, payee, payAmount, remaining, payment.month, payment.roomNumber],
  );

  async function book(nextMethod: PayMethod, reference: string) {
    if (!Number.isFinite(payAmount) || payAmount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setPhase("verifying");
    await new Promise((r) => setTimeout(r, 600));
    try {
      await onConfirm({ amount: payAmount, method: nextMethod, reference });
      setPhase("success");
    } catch {
      setPhase(nextMethod === "upi" ? "upi" : nextMethod === "card" ? "card" : "pick");
    }
  }

  if (phase === "verifying") {
    return (
      <div className="rounded-2xl bg-white p-6 text-center text-neutral-900">
        <Loader2 className="mx-auto size-8 animate-spin text-[#0b72e7]" />
        <p className="mt-3 text-sm font-medium">Sending to owner</p>
        <p className="mt-1 text-xs text-neutral-500">Your bill stays unpaid until they confirm.</p>
      </div>
    );
  }

  if (phase === "success") {
    return (
      <div className="rounded-2xl bg-white p-6 text-center text-neutral-900">
        <CheckCircle2 className="mx-auto size-10 text-amber-500" />
        <p className="mt-3 text-lg font-semibold">Reported to owner</p>
        <p className="mt-1 text-sm text-neutral-600">
          {inr(payAmount)} is waiting for confirm. Receipt comes after the owner accepts.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-white text-neutral-900 shadow-xl">
      <div className="flex items-center justify-between bg-[#0b72e7] px-4 py-3 text-white">
        <div>
          <p className="text-[11px] tracking-[0.14em] uppercase opacity-80">Rentweb Checkout</p>
          <p className="text-sm font-medium">{building?.name || "Rent"}</p>
        </div>
        <p className="text-lg font-semibold tabular">{inr(payAmount || remaining)}</p>
      </div>
      <div className="space-y-4 p-4">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <Info k="Billed" v={inr(payment.totalRent)} />
          <Info k="Already paid" v={inr(payment.paidAmount)} />
          <Info k="Due" v={inr(payment.remainingAmount)} />
          <Info k="Month" v={`${payment.month} · ${payment.roomNumber}`} />
        </div>
        {tenantName ? <p className="text-xs text-neutral-500">Paying as {tenantName}</p> : null}
        <div>
          <Label htmlFor="ck-amt" className="text-neutral-700">Pay amount</Label>
          <Input id="ck-amt" type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} className="border-neutral-300 bg-white text-neutral-900" />
        </div>
        {phase === "pick" && (
          <div className="space-y-2">
            <MethodBtn active={method === "upi"} icon={Smartphone} title="UPI" hint="Scan QR or open GPay / PhonePe / Paytm" onClick={() => { setMethod("upi"); setPhase("upi"); }} />
            <MethodBtn active={method === "card"} icon={CreditCard} title="Card" hint="Visa / Mastercard / RuPay" onClick={() => { setMethod("card"); setPhase("card"); }} />
            <button type="button" onClick={() => void book("dummy", `TEST-${Date.now().toString().slice(-8)}`)} className="w-full rounded-xl border border-dashed border-neutral-300 px-3 py-2 text-left text-sm text-neutral-600">
              Test report — still needs owner confirm
            </button>
          </div>
        )}
        {phase === "upi" && (
          <div className="space-y-3">
            {upiId ? (
              <>
                <UpiQr value={qrValue} label="Scan with any UPI app" />
                <p className="text-center font-mono text-sm">{upiId}</p>
                <Button type="button" className="w-full bg-[#0b72e7] text-white hover:bg-[#0a64cc]" onClick={() => { if (qrValue) window.location.href = qrValue; }}>
                  Open UPI app
                </Button>
              </>
            ) : (
              <p className="rounded-xl bg-neutral-100 px-3 py-3 text-sm text-neutral-600">
                Owner has not added a UPI ID yet. Pay them directly, then report UTR here.
              </p>
            )}
            <div>
              <Label htmlFor="ck-utr" className="text-neutral-700">UTR / UPI reference</Label>
              <Input id="ck-utr" value={utr} onChange={(e) => setUtr(e.target.value)} placeholder="12-digit UTR from bank SMS" className="border-neutral-300 bg-white text-neutral-900" autoCapitalize="characters" />
            </div>
            <Button type="button" className="w-full" disabled={busy} onClick={() => void book("upi", utr.trim() || `UPI-${Date.now().toString().slice(-10)}`)}>
              I have paid — notify owner
            </Button>
            <button type="button" className="w-full text-xs text-neutral-500" onClick={() => setPhase("pick")}>Other methods</button>
          </div>
        )}
        {phase === "card" && (
          <div className="space-y-3">
            <div>
              <Label htmlFor="ck-cn" className="text-neutral-700">Name on card</Label>
              <Input id="ck-cn" value={cardName} onChange={(e) => setCardName(e.target.value)} className="border-neutral-300 bg-white text-neutral-900" />
            </div>
            <div>
              <Label htmlFor="ck-cc" className="text-neutral-700">Card number</Label>
              <Input id="ck-cc" inputMode="numeric" value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} placeholder="XXXX XXXX XXXX 4242" className="border-neutral-300 bg-white text-neutral-900" />
            </div>
            <Button type="button" className="w-full bg-[#0b72e7] text-white hover:bg-[#0a64cc]" disabled={busy} onClick={() => {
              const digits = cardNumber.replace(/\D/g, "");
              if (digits.length < 12) { toast.error("Enter a card number"); return; }
              const tag = `**** ${digits.slice(-4)}${cardName ? ` · ${cardName.trim()}` : ""}`;
              void book("card", tag.slice(0, 64));
            }}>
              Report {inr(payAmount || remaining)} to owner
            </Button>
            <button type="button" className="w-full text-xs text-neutral-500" onClick={() => setPhase("pick")}>Other methods</button>
          </div>
        )}
        <p className="flex items-center justify-center gap-1 text-[11px] text-neutral-500">
          <ShieldCheck className="size-3.5" />
          Owner confirms before the bill is marked paid
        </p>
      </div>
    </div>
  );
}

function Info({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-xl bg-neutral-100 px-3 py-2">
      <p className="text-[10px] tracking-wide text-neutral-500 uppercase">{k}</p>
      <p className="mt-0.5 text-sm tabular">{v}</p>
    </div>
  );
}

function MethodBtn({
  active,
  icon: Icon,
  title,
  hint,
  onClick,
}: {
  active: boolean;
  icon: typeof Smartphone;
  title: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className={cn("flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left", active ? "border-[#0b72e7] bg-[#0b72e7]/8" : "border-neutral-200")}>
      <span className="grid size-9 place-items-center rounded-lg bg-neutral-100"><Icon className="size-4" /></span>
      <span>
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-neutral-500">{hint}</span>
      </span>
    </button>
  );
}
