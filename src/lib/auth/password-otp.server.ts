import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";

const OTP_TTL_MS = 10 * 60 * 1000;
const TICKET_TTL_MS = 15 * 60 * 1000;
const RESEND_GAP_MS = 45 * 1000;
const MAX_ATTEMPTS = 5;

export type OtpChannel = "email" | "phone";

function env(key: string): string | undefined {
  const v = process.env[key]?.trim();
  return v || undefined;
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
}

function isEmail(raw: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.trim());
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const keep = local.slice(0, Math.min(2, local.length));
  return `${keep}${"•".repeat(Math.max(1, local.length - keep.length))}@${domain}`;
}

function maskPhone(phone: string): string {
  const d = normalizePhone(phone);
  if (d.length < 4) return d;
  return `+91 ${d.slice(0, 2)}••• ••${d.slice(-3)}`;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function newId(bytes = 18): string {
  return randomBytes(bytes).toString("hex");
}

type OwnerRow = { id: string; name: string; email: string; phone: string };

async function findOwner(identifier: string): Promise<OwnerRow | null> {
  const sql = await getSql();
  const trimmed = identifier.trim();
  if (isEmail(trimmed)) {
    const rows = await sql<OwnerRow>`
      select u.id, u.name, u.email, coalesce(b.phone, '') as phone
      from "user" u
      left join buildings b on b.user_id = u.id
      where lower(u.email) = ${trimmed.toLowerCase()}
      limit 1
    `;
    return rows[0] ?? null;
  }
  const phone = normalizePhone(trimmed);
  if (phone.length !== 10) return null;
  const rows = await sql<OwnerRow>`
    select u.id, u.name, u.email, coalesce(b.phone, '') as phone
    from buildings b
    join "user" u on u.id = b.user_id
    where right(regexp_replace(coalesce(b.phone, ''), '[^0-9]', '', 'g'), 10) = ${phone}
    limit 1
  `;
  return rows[0] ?? null;
}

async function sendEmailOtp(to: string, code: string, name: string): Promise<boolean> {
  const key = env("RESEND_API_KEY");
  if (!key) return false;
  const from = env("RESEND_FROM") || "Rentweb <onboarding@resend.dev>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject: `${code} is your Rentweb password OTP`,
        html: `<p>Hi ${name || "owner"},</p>
<p>Your Rentweb verification code is <strong style="font-size:20px;letter-spacing:4px">${code}</strong>.</p>
<p>This code expires in 10 minutes. If you did not request it, ignore this email.</p>`,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function sendSmsOtp(phone10: string, code: string): Promise<boolean> {
  const fast = env("FAST2SMS_API_KEY");
  if (fast) {
    try {
      const url = new URL("https://www.fast2sms.com/dev/bulkV2");
      url.searchParams.set("authorization", fast);
      url.searchParams.set("route", "q");
      url.searchParams.set("message", `Rentweb OTP ${code}. Valid 10 min. Do not share.`);
      url.searchParams.set("language", "english");
      url.searchParams.set("flash", "0");
      url.searchParams.set("numbers", phone10);
      const res = await fetch(url.toString(), { method: "GET" });
      return res.ok;
    } catch {
      return false;
    }
  }
  const msg91 = env("MSG91_AUTH_KEY");
  if (msg91) {
    try {
      const res = await fetch("https://control.msg91.com/api/v5/flow", {
        method: "POST",
        headers: {
          authkey: msg91,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          template_id: env("MSG91_TEMPLATE_ID") || "",
          recipients: [{ mobiles: `91${phone10}`, otp: code }],
        }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
  return false;
}

export const requestPasswordOtp = createServerFn({ method: "POST" })
  .validator((input: { identifier: string; channel: OtpChannel }) => {
    const identifier = String(input.identifier ?? "").trim();
    const channel: OtpChannel = input.channel === "phone" ? "phone" : "email";
    if (!identifier) throw new Error("Enter your owner email or phone number");
    if (channel === "email" && !isEmail(identifier) && normalizePhone(identifier).length !== 10) {
      throw new Error("Enter a valid email or 10-digit phone");
    }
    return { identifier, channel };
  })
  .handler(async ({ data }) => {
    const owner = await findOwner(data.identifier);
    if (!owner) throw new Error("No owner account matches those details");

    const destination =
      data.channel === "phone" ? normalizePhone(owner.phone) : owner.email.trim().toLowerCase();
    if (data.channel === "phone" && destination.length !== 10) {
      throw new Error("No phone is saved on this owner account. Use email, or add a phone in Settings after login.");
    }
    if (data.channel === "email" && !isEmail(destination)) {
      throw new Error("This owner account has no email to send OTP to");
    }

    const sql = await getSql();
    const recent = await sql<{ created_at: string | Date }>`
      select created_at from password_otps
      where destination = ${destination} and used = false
      order by created_at desc
      limit 1
    `;
    if (recent[0]) {
      const age = Date.now() - new Date(recent[0].created_at).getTime();
      if (age < RESEND_GAP_MS) {
        const wait = Math.ceil((RESEND_GAP_MS - age) / 1000);
        throw new Error(`Wait ${wait}s before requesting another OTP`);
      }
    }

    const code = String(randomInt(100000, 1000000));
    const expires = new Date(Date.now() + OTP_TTL_MS).toISOString();
    await sql`
      update password_otps set used = true
      where user_id = ${owner.id} and used = false
    `;
    await sql`
      insert into password_otps (user_id, destination, channel, code_hash, expires_at)
      values (${owner.id}, ${destination}, ${data.channel}, ${sha256(code)}, ${expires}::timestamptz)
    `;

    const delivered =
      data.channel === "email"
        ? await sendEmailOtp(destination, code, owner.name)
        : await sendSmsOtp(destination, code);

    return {
      ok: true as const,
      channel: data.channel,
      masked: data.channel === "email" ? maskEmail(destination) : maskPhone(destination),
      delivered,
      previewCode: delivered ? undefined : code,
    };
  });

export const verifyPasswordOtp = createServerFn({ method: "POST" })
  .validator((input: { identifier: string; channel: OtpChannel; code: string }) => {
    const identifier = String(input.identifier ?? "").trim();
    const channel: OtpChannel = input.channel === "phone" ? "phone" : "email";
    const code = String(input.code ?? "").replace(/\D/g, "");
    if (code.length !== 6) throw new Error("Enter the complete 6-digit OTP");
    return { identifier, channel, code };
  })
  .handler(async ({ data }) => {
    const owner = await findOwner(data.identifier);
    if (!owner) throw new Error("No owner account matches those details");
    const destination =
      data.channel === "phone" ? normalizePhone(owner.phone) : owner.email.trim().toLowerCase();

    const sql = await getSql();
    const rows = await sql<{
      id: number;
      code_hash: string;
      expires_at: string | Date;
      attempts: number;
      used: boolean;
    }>`
      select id, code_hash, expires_at, attempts, used
      from password_otps
      where user_id = ${owner.id} and destination = ${destination} and channel = ${data.channel}
      order by created_at desc
      limit 1
    `;
    const row = rows[0];
    if (!row || row.used) throw new Error("Request a new OTP first");
    if (new Date(row.expires_at).getTime() < Date.now()) throw new Error("OTP expired. Resend a new code.");
    if (row.attempts >= MAX_ATTEMPTS) throw new Error("Too many attempts. Resend a new OTP.");

    if (!safeEqual(row.code_hash, sha256(data.code))) {
      await sql`update password_otps set attempts = attempts + 1 where id = ${row.id}`;
      throw new Error("Invalid OTP. Please try again.");
    }

    await sql`update password_otps set used = true where id = ${row.id}`;
    const ticket = newId(24);
    const expires = new Date(Date.now() + TICKET_TTL_MS).toISOString();
    await sql`
      insert into password_reset_tickets (id, user_id, expires_at)
      values (${ticket}, ${owner.id}, ${expires}::timestamptz)
    `;
    return { ok: true as const, ticket };
  });

export const resetOwnerPassword = createServerFn({ method: "POST" })
  .validator((input: { ticket: string; password: string }) => {
    const ticket = String(input.ticket ?? "").trim();
    const password = String(input.password ?? "");
    if (!ticket) throw new Error("Verify OTP again");
    if (password.length < 8) throw new Error("Password must be at least 8 characters");
    return { ticket, password };
  })
  .handler(async ({ data }) => {
    const sql = await getSql();
    const rows = await sql<{ id: string; user_id: string; expires_at: string | Date; used: boolean }>`
      select id, user_id, expires_at, used from password_reset_tickets where id = ${data.ticket}
    `;
    const ticket = rows[0];
    if (!ticket || ticket.used) throw new Error("This reset link is no longer valid");
    if (new Date(ticket.expires_at).getTime() < Date.now()) throw new Error("Reset session expired. Start again.");

    const { hashPassword } = await import("better-auth/crypto");
    const hashed = await hashPassword(data.password);
    const now = new Date().toISOString();

    const accounts = await sql<{ id: string }>`
      select id from account
      where "userId" = ${ticket.user_id} and "providerId" = 'credential'
      limit 1
    `;
    if (accounts[0]) {
      await sql`
        update account set password = ${hashed}, "updatedAt" = ${now}::timestamptz
        where id = ${accounts[0].id}
      `;
    } else {
      const owner = await sql<{ email: string }>`
        select email from "user" where id = ${ticket.user_id}
      `;
      const email = owner[0]?.email || ticket.user_id;
      await sql`
        insert into account (
          id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt"
        ) values (
          ${newId()}, ${email}, 'credential', ${ticket.user_id}, ${hashed},
          ${now}::timestamptz, ${now}::timestamptz
        )
      `;
    }

    await sql`update password_reset_tickets set used = true where id = ${ticket.id}`;
    await sql`delete from session where "userId" = ${ticket.user_id}`;
    return { ok: true as const };
  });
