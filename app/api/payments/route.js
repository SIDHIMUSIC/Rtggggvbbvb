export const dynamic = "force-dynamic";
import { connectDB } from "../../../lib/mongodb";
import Payment from "../../../models/Payment";
import Tenant from "../../../models/Tenant";
import jwt from "jsonwebtoken";

function verifyToken(req) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return null;
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

function monthIndex(dateObj) {
  return dateObj.getFullYear() * 100 + (dateObj.getMonth() + 1);
}

function monthLabel(dateObj) {
  return dateObj.toLocaleString("default", { month: "short", year: "numeric" });
}

// ─── GET ─────────────────────────────────────────────────────────────────────
export async function GET() {
  try {
    await connectDB();
    const payments = await Payment.find()
      .populate("tenant", "name phone roomNumber rentAmount startDate")
      .sort({ monthIndex: 1 })
      .lean();
    return Response.json(payments);
  } catch {
    return Response.json([]);
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────
export async function POST(req) {
  try {
    await connectDB();
    if (!verifyToken(req))
      return Response.json({ success: false, message: "Unauthorized ❌" }, { status: 401 });

    const body = await req.json();

    // ── Case A: tenant + month (tenants page se) ──────────────────────────
    if (body.tenant && body.month && !body.paymentId) {
      const tenantDoc = await Tenant.findById(body.tenant);
      if (!tenantDoc)
        return Response.json({ success: false, message: "Tenant not found ❌" });

      const paid = Number(body.paidAmount);
      if (!paid || paid <= 0)
        return Response.json({ success: false, message: "Invalid amount ❌" });

      let parsedDate = new Date(body.month + " 1");
      if (isNaN(parsedDate.getTime())) parsedDate = new Date();

      const mi = parsedDate.getFullYear() * 100 + (parsedDate.getMonth() + 1);
      const ml = monthLabel(parsedDate);

      let payment = await Payment.findOne({ tenant: body.tenant, monthIndex: mi });
      if (!payment) {
        payment = await Payment.create({
          tenant: body.tenant,
          roomNumber: tenantDoc.roomNumber,
          month: ml,
          monthIndex: mi,
          totalRent: tenantDoc.rentAmount || 3000,
          paidAmount: 0,
          remainingAmount: tenantDoc.rentAmount || 3000,
          status: "unpaid",
        });
      }

      await applyPayment(payment, paid, "cash", null);

      // ✅ Updated payments return karo
      const allPayments = await Payment.find({ tenant: body.tenant })
        .populate("tenant", "name phone roomNumber rentAmount startDate")
        .sort({ monthIndex: 1 })
        .lean();

      return Response.json({ success: true, payments: allPayments });
    }

    // ── Case B: paymentId se (Dashboard se) ──────────────────────────────
    if (body.paymentId) {
      const { paymentId, amount, method, razorpayPaymentId } = body;
      const paid = Number(amount);
      if (!paid || paid <= 0)
        return Response.json({ success: false, message: "Invalid amount ❌" });

      const payment = await Payment.findById(paymentId);
      if (!payment)
        return Response.json({ success: false, message: "Payment not found ❌" });

      const extra = await applyPayment(payment, paid, method || "cash", razorpayPaymentId);

      // Extra amount agle mahine mein apply karo
      if (extra > 0) {
        const futurePayments = await Payment.find({
          tenant: payment.tenant,
          status: { $in: ["unpaid", "partial"] },
          monthIndex: { $gt: payment.monthIndex },
        }).sort({ monthIndex: 1 });

        let rem = extra;
        for (const fp of futurePayments) {
          if (rem <= 0) break;
          if (rem >= fp.remainingAmount) {
            rem -= fp.remainingAmount;
            fp.paidAmount = fp.totalRent;
            fp.remainingAmount = 0;
            fp.status = "paid";
            fp.paidBy = method || "cash";
            fp.paidAt = new Date();
          } else {
            fp.paidAmount += rem;
            fp.remainingAmount -= rem;
            fp.status = "partial";
            rem = 0;
          }
          await fp.save();
        }
      }

      // ✅ FIX: Saari payments return karo — Dashboard UI update hogi
      const allPayments = await Payment.find({ tenant: payment.tenant })
        .populate("tenant", "name phone roomNumber rentAmount startDate")
        .sort({ monthIndex: 1 })
        .lean();

      return Response.json({ success: true, payments: allPayments });
    }

    return Response.json({ success: false, message: "Invalid request ❌" });

  } catch (err) {
    console.error("Payment POST error:", err);
    return Response.json({ success: false, message: "Server error ❌" }, { status: 500 });
  }
}

// ─── Helper ──────────────────────────────────────────────────────────────────
async function applyPayment(payment, paid, method, razorpayPaymentId) {
  let extra = 0;
  if (paid >= payment.remainingAmount) {
    extra = paid - payment.remainingAmount;
    payment.paidAmount = payment.totalRent;
    payment.remainingAmount = 0;
    payment.status = "paid";
  } else {
    payment.paidAmount += paid;
    payment.remainingAmount -= paid;
    payment.status = "partial";
  }
  payment.paidBy = method || "cash";
  payment.paidAt = new Date();
  if (razorpayPaymentId) payment.razorpayPaymentId = razorpayPaymentId;
  await payment.save();
  return extra;
}

// ─── PUT — Months generate karo ──────────────────────────────────────────────
export async function PUT(req) {
  try {
    await connectDB();
    if (!verifyToken(req))
      return Response.json({ success: false, message: "Unauthorized ❌" }, { status: 401 });

    const { tenantId } = await req.json();
    const tenant = await Tenant.findById(tenantId);
    if (!tenant)
      return Response.json({ success: false, message: "Tenant not found ❌" });

    const rawDate = tenant.startDate ? new Date(tenant.startDate) : null;
    const isValidDate = rawDate && rawDate.getFullYear() > 2000;
    const start = isValidDate ? new Date(rawDate) : new Date();
    start.setDate(1);

    const now = new Date();
    now.setDate(1);

    let current = new Date(start);
    let created = 0;

    while (current <= now) {
      const mi = monthIndex(current);
      const ml = monthLabel(current);
      const exists = await Payment.findOne({ tenant: tenantId, monthIndex: mi });
      if (!exists) {
        await Payment.create({
          tenant: tenantId,
          roomNumber: tenant.roomNumber,
          month: ml,
          monthIndex: mi,
          totalRent: tenant.rentAmount || 3000,
          paidAmount: 0,
          remainingAmount: tenant.rentAmount || 3000,
          status: "unpaid",
        });
        created++;
      }
      current.setMonth(current.getMonth() + 1);
    }

    return Response.json({ success: true, message: `${created} months generate ho gaye ✅` });
  } catch (err) {
    console.error("PUT error:", err);
    return Response.json({ success: false, message: "Server error ❌" }, { status: 500 });
  }
}
