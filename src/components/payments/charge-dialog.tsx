import { useState } from "react";
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
import type { Payment } from "@/lib/rent/types";

export function ChargeDialog({
  payment,
  open,
  onOpenChange,
  onAdd,
  busy,
}: {
  payment: Payment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (amount: number, note: string) => void;
  busy: boolean;
}) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  function submit() {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      toast.error("Enter a charge amount");
      return;
    }
    onAdd(n, note.trim());
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setAmount("");
          setNote("");
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="w-[min(100%-1.5rem,420px)]">
        <DialogTitle>Add to bill</DialogTitle>
        <DialogDescription>
          Electricity, water, or any extra on {payment?.month} · {payment?.roomNumber}
        </DialogDescription>
        {payment && (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-muted">
              Current bill {inr(payment.totalRent)} · due {inr(payment.remainingAmount)}
            </p>
            <div>
              <Label htmlFor="ch-amt">Amount</Label>
              <Input
                id="ch-amt"
                type="number"
                min={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="ch-note">What for</Label>
              <Input
                id="ch-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Electricity, water, repair…"
              />
            </div>
            <Button type="button" className="w-full" disabled={busy} onClick={submit}>
              {busy ? "Adding…" : "Add to this month"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
