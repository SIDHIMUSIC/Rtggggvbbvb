import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Building } from "@/lib/rent/types";

export function SetupBuildingForm({
  initial,
  ownerHint,
  submitLabel,
  busy,
  onSave,
}: {
  initial?: Building;
  ownerHint?: string;
  submitLabel: string;
  busy: boolean;
  onSave: (data: Building) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [ownerName, setOwnerName] = useState(initial?.ownerName || ownerHint || "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [upiId, setUpiId] = useState(initial?.upiId ?? "");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    onSave({ name, ownerName, phone, address, upiId });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <Label htmlFor="b-name">Building name</Label>
        <Input
          id="b-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ashu Residency"
          required
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="b-owner">Owner name</Label>
          <Input
            id="b-owner"
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
            placeholder="Your name"
          />
        </div>
        <div>
          <Label htmlFor="b-phone">Phone</Label>
          <Input
            id="b-phone"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="98765 43210"
          />
          <p className="mt-1.5 text-xs text-faint">
            Same number can receive the owner forgot-password OTP.
          </p>
        </div>
      </div>
      <div>
        <Label htmlFor="b-address">Address</Label>
        <Input
          id="b-address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Street, city"
        />
      </div>
      <div>
        <Label htmlFor="b-upi">UPI ID for rent collection</Label>
        <Input
          id="b-upi"
          value={upiId}
          onChange={(e) => setUpiId(e.target.value)}
          placeholder="owner@okaxis"
          autoCapitalize="none"
          autoCorrect="off"
        />
        <p className="mt-1.5 text-xs text-faint">
          Tenants scan a QR that pays this ID. You mark the month paid when the money lands.
        </p>
      </div>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
