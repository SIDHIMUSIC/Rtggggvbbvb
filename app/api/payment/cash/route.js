import { connectDB } from "@/lib/mongodb";
import Payment from "@/models/Payment";
import Tenant from "@/models/Tenant";
import jwt from "jsonwebtoken";

export async function POST(req) {
  await connectDB();

  // Auth check
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return Response.json({ success: false, message: "No token ❌" }, { status: 401 });
  }
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
  try {
    jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return Response.json({ success: false, message: "Invalid token ❌" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { tenantId, amount, month, year } = body;

    if (!tenantId || !amount || !month || !year) {
      return Response.json({ success: false, message: "Missing fields ❌" }, { status: 400 });
    }

    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      return Response.json({ success: false, message: "Tenant not found ❌" }, { status: 404 });
    }

    const paid = Number(amount);

    // ✅ Month string banao — "Jun 2025" format
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const monthIndex = Number(year) * 100 + (monthNames.indexOf(month) + 1);
    const monthFull = `${month} ${year}`;

    // ✅ Pehle check karo — already paid to nahi?
    const existingPayment = await Payment.findOne({ tenant: tenantId, monthIndex });

    if (existingPayment && existingPayment.status === 'paid') {
      return Response.json({ success: false, message: `${monthFull} ka rent already paid hai ✅` }, { status: 409 });
    }

    const transactionId = `CASH${Date.now()}`;

    if (existingPayment) {
      // ✅ Update existing payment
      existingPayment.paidAmount = existingPayment.totalRent;
      existingPayment.remainingAmount = 0;
      existingPayment.status = "paid";
      existingPayment.paidBy = "cash";
      existingPayment.paidAt = new Date();
      existingPayment.transactionId = transactionId;
      await existingPayment.save();
    } else {
      // ✅ Naya Payment record banao
      await Payment.create({
        tenant: tenantId,
        roomNumber: tenant.roomNumber,
        month: monthFull,
        monthIndex,
        totalRent: tenant.rentAmount,
        paidAmount: paid,
        remainingAmount: paid >= tenant.rentAmount ? 0 : tenant.rentAmount - paid,
        status: paid >= tenant.rentAmount ? "paid" : "partial",
        paidBy: "cash",
        paidAt: new Date(),
        transactionId,
      });
    }

    return Response.json({ success: true, transactionId, message: "Cash payment record ho gaya ✅" });

  } catch (err) {
    console.error("Cash payment error:", err);
    return Response.json({ success: false, message: err.message || "Server error ❌" }, { status: 500 });
  }
}
