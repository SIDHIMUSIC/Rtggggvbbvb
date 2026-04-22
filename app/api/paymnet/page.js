import { connectDB } from "../../../lib/mongodb";
import Payment from "../../../models/Payment";
import Tenant from "../../../models/Tenant";
import jwt from "jsonwebtoken";

// ===============================
// GET
// ===============================
export async function GET() {
  await connectDB();
  const data = await Payment.find().populate("tenant");
  return Response.json(data);
}

// ===============================
// POST (🔥 SMART PAYMENT SYSTEM)
// ===============================
export async function POST(req) {
  try {
    await connectDB();

    // 🔐 JWT CHECK
    const token = req.headers.get("authorization");

    if (!token) {
      return Response.json({
        success: false,
        message: "No token ❌",
      });
    }

    try {
      jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return Response.json({
        success: false,
        message: "Invalid token ❌",
      });
    }

    const body = await req.json();

    const tenant = await Tenant.findById(body.tenant);

    if (!tenant) {
      return Response.json({
        success: false,
        message: "Tenant not found ❌",
      });
    }

    let remaining = body.paidAmount;

    if (!remaining || remaining <= 0) {
      return Response.json({
        success: false,
        message: "Invalid amount ❌",
      });
    }

    // 🔥 ALL PAYMENTS SORTED (OLD → NEW)
    const payments = await Payment.find({
      tenant: body.tenant,
    }).sort({ createdAt: 1 });

    // ===============================
    // 🔥 STEP 1: CLEAR OLD DUES FIRST
    // ===============================
    for (let p of payments) {
      if (remaining <= 0) break;

      if (p.remainingAmount > 0) {
        if (remaining >= p.remainingAmount) {
          // FULL CLEAR
          remaining -= p.remainingAmount;
          p.paidAmount = p.totalRent;
          p.remainingAmount = 0;
          p.status = "paid";
        } else {
          // PARTIAL
          p.paidAmount += remaining;
          p.remainingAmount -= remaining;
          p.status = "partial";
          remaining = 0;
        }

        await p.save();
      }
    }

    // ===============================
    // 🔥 STEP 2: अगर अभी भी पैसा बचा → ADVANCE
    // ===============================
    if (remaining > 0) {
      // future payments खोज
      const futurePayments = await Payment.find({
        tenant: body.tenant,
        remainingAmount: { $gt: 0 },
      }).sort({ createdAt: 1 });

      for (let p of futurePayments) {
        if (remaining <= 0) break;

        if (remaining >= p.remainingAmount) {
          remaining -= p.remainingAmount;
          p.paidAmount = p.totalRent;
          p.remainingAmount = 0;
          p.status = "paid";
        } else {
          p.paidAmount += remaining;
          p.remainingAmount -= remaining;
          p.status = "partial";
          remaining = 0;
        }

        await p.save();
      }
    }

    return Response.json({
      success: true,
      advanceLeft: remaining, // 🔥 extra पैसा (optional use)
    });

  } catch (err) {
    console.log("PAYMENT ERROR:", err);
    return Response.json({
      success: false,
      message: "Server error ❌",
    });
  }
}
