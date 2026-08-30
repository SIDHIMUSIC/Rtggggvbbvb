export function isUpiId(value: string): boolean {
  return /^[\w.\-]{2,256}@[a-zA-Z]{2,64}$/.test(value.trim());
}

export function upiPayUrl(opts: {
  pa: string;
  pn: string;
  am?: number;
  tn?: string;
}): string {
  const p = new URLSearchParams();
  p.set("pa", opts.pa.trim());
  p.set("pn", (opts.pn.trim() || "Rentweb").slice(0, 50));
  p.set("cu", "INR");
  if (opts.am && opts.am > 0) p.set("am", String(opts.am));
  if (opts.tn) p.set("tn", opts.tn.slice(0, 50));
  return `upi://pay?${p.toString()}`;
}
