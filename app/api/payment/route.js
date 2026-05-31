export const dynamic = "force-dynamic";
import { connectDB } from "../../../lib/mongodb";
import Payment from "../../../models/Payment";
import Tenant from "../../../models/Tenant";
import jwt from "jsonwebtoken";

function verifyToken(req) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return null;
  // ✅ Bearer prefix strip karo
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : authHeader;
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

// ─── GET — sab payments with tenant info ─────────────────────────────────────
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

// ─── POST — 2 cases handle karta hai ─────────────────────────────────────────
//
//  Case A (tenants/page.js se):  { tenant, month, paidAmount }
//    → payment dhundho by tenant+month, phir amount apply karo
//
//  Case B (payments/page.js se): { paymentId, amount, method, razorpayPaymentId }
//    → seedha paymentId se payment lo
//
export async function POST(req) {
  try {
    await connectDB();
    if (!verifyToken(req))
      return Response.json(
        { success: false, message: "Unauthorized ❌" },
        { status: 401 }
      );

    const body = await req.json();

    // ── Case A: tenant + month se payment dhundo ──────────────────────────
    if (body.tenant && body.month && !body.paymentId) {
      const tenantDoc = await Tenant.findById(body.tenant);
      if (!tenantDoc)
        return Response.json({ success: false, message: "Tenant not found ❌" });

      const paid = Number(body.paidAmount);
      if (!paid || paid <= 0)
        return Response.json({ success: false, message: "Invalid amount ❌" });

      // Month string se Date banao (e.g. "Jun 2025")
      const parsedDate = new Date(body.month + " 1");
      const mi = isNaN(parsedDate)
        ? null
        : parsedDate.getFullYear() * 100 + (parsedDate.getMonth() + 1);

      // Pehle existing payment dhundo
      let payment = mi
        ? await Payment.findOne({ tenant: body.tenant, monthIndex: mi })
        : null;

      // Nahi mila to naya banao
      if (!payment) {
        payment = await Payment.create({
          tenant: body.tenant,
          roomNumber: tenantDoc.roomNumber,
          month: body.month,
          monthIndex: mi || 0,
          totalRent: tenantDoc.rentAmount || 3000,
          paidAmount: 0,
          remainingAmount: tenantDoc.rentAmount || 3000,
          status: "unpaid",
        });
      }

      // Amount apply karo
      await applyPayment(payment, paid, "cash", null);

      return Response.json({ success: true });
    }

    // ── Case B: paymentId se seedha payment lo ────────────────────────────
    const { paymentId, amount, method, razorpayPaymentId } = body;
    const paid = Number(amount);
    if (!paid || paid <= 0)
      return Response.json({ success: false, message: "Invalid amount ❌" });

    const payment = await Payment.findById(paymentId);
    if (!payment)
      return Response.json({ success: false, message: "Payment not found ❌" });

    const extra = await applyPayment(payment, paid, method || "cash", razorpayPaymentId);

    // Extra amount → agle mahine ke payments mein apply karo
    if (extra > 0) {
      const futurePayments = await Payment.find({
        tenant: payment.tenant,
        status: { $in: ["unpaid", "partial"] },
        monthIndex: { $gt: payment.monthIndex },
      }).sort({ monthIndex: 1 });

      let remaining = extra;
      for (const fp of futurePayments) {
        if (remaining <= 0) break;
        if (remaining >= fp.remainingAmount) {
          remaining -= fp.remainingAmount;
          fp.paidAmount = fp.totalRent;
          fp.remainingAmount = 0;
          fp.status = "paid";
          fp.paidBy = method || "cash";
          fp.paidAt = new Date();
        } else {
          fp.paidAmount += remaining;
          fp.remainingAmount -= remaining;
          fp.status = "partial";
          remaining = 0;
        }
        await fp.save();
      }
    }

    // Updated payments return karo
    const allPayments = await Payment.find({ tenant: payment.tenant })
      .populate("tenant", "name phone roomNumber rentAmount startDate")
      .sort({ monthIndex: 1 })
      .lean();

    return Response.json({ success: true, payments: allPayments });
  } catch (err) {
    console.error("Payment POST error:", err);
    return Response.json(
      { success: false, message: "Server error ❌" },
      { status: 500 }
    );
  }
}

// ─── Helper: payment object pe amount apply karo, extra return karo ──────────
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

// ─── PUT — start date se aaj tak sab months generate karo ────────────────────
export async function PUT(req) {
  try {
    await connectDB();
    if (!verifyToken(req))
      return Response.json(
        { success: false, message: "Unauthorized ❌" },
        { status: 401 }
      );

    const { tenantId } = await req.json();
    const tenant = await Tenant.findById(tenantId);
    if (!tenant)
      return Response.json({ success: false, message: "Tenant not found ❌" });

    const start = new Date(tenant.startDate || new Date());
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

    return Response.json({
      success: true,
      message: `${created} months generate ho gaye ✅`,
    });
  } catch (err) {
    console.error("PUT error:", err);
    return Response.json(
      { success: false, message: "Server error ❌" },
      { status: 500 }
    );
  }
}
