import { createHmac, timingSafeEqual } from "node:crypto";

function secret(): string {
  return (
    process.env.BETTER_AUTH_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.DATABASE_URL ||
    "rentweb-pay-link"
  );
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url").slice(0, 24);
}

export function mintPayToken(userId: string, tenantId: number): string {
  const payload = `${userId}|${tenantId}`;
  return Buffer.from(`${payload}|${sign(payload)}`, "utf8").toString("base64url");
}

export function readPayToken(token: string): { userId: string; tenantId: number } {
  const raw = String(token ?? "").trim();
  if (!raw) throw new Error("Pay link is missing");
  let decoded = "";
  try {
    decoded = Buffer.from(raw, "base64url").toString("utf8");
  } catch {
    throw new Error("This pay link is not valid");
  }
  const parts = decoded.split("|");
  if (parts.length !== 3) throw new Error("This pay link is not valid");
  const [userId, tenantIdStr, sig] = parts;
  if (!userId || !tenantIdStr || !sig) throw new Error("This pay link is not valid");
  const expected = sign(`${userId}|${tenantIdStr}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error("This pay link is not valid");
  }
  const tenantId = Number(tenantIdStr);
  if (!Number.isFinite(tenantId) || tenantId <= 0) throw new Error("This pay link is not valid");
  return { userId, tenantId };
}
