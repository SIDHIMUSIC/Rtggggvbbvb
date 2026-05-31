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

// GET - Sab payments with tenant info
export async function GET() {
  try {
    await connectDB();
    const payments = await Payment.find()
      .populate("tenant", "name phone roomNumber")
      .sort({ createdAt: -1 })
      .lean();
    return Response.json(payments);
  } catch (err) {
    return Response.json([]);
  }
}

// POST - Payment mark karo (cash ya razorpay)
export async function POST(req) {
  try {
    await connectDB();
    if (!verifyToken(req)) return Response.json({ success: false, message: "Unauthorized ❌" }, { status: 401 });

    const body = await req.json();
    // body: { paymentId, amount, method }

    const payment = await Payment.findById(body.paymentId);
    if (!payment) return Response.json({ success: false, message: "Payment not found ❌" });

    const amount = Number(body.amount);
    if (!amount || amount <= 0) return Response.json({ success: false, message: "Invalid amount ❌" });

    payment.paidAmount = Math.min(payment.paidAmount + amount, payment.totalRent);
    payment.remainingAmount = payment.totalRent - payment.paidAmount;
    payment.status = payment.remainingAmount === 0 ? "paid" : "partial";
    payment.paidAt = new Date();
    if (body.method === "razorpay") {
      payment.razorpayPaymentId = body.razorpayPaymentId || "";
    }

    await payment.save();
    return Response.json({ success: true, payment });
  } catch (err) {
    return Response.json({ success: false, message: "Server error ❌" }, { status: 500 });
  }
}

// PUT - New month ki payment generate karo sab tenants ke liye
export async function PUT(req) {
  try {
    await connectDB();
    if (!verifyToken(req)) return Response.json({ success: false, message: "Unauthorized ❌" }, { status: 401 });

    const { month } = await req.json();
    const tenants = await Tenant.find().lean();

    for (const t of tenants) {
      const exists = await Payment.findOne({ tenant: t._id, month });
      if (!exists) {
        await Payment.create({
          tenant: t._id,
          month,
          totalRent: t.rentAmount || 3000,
          paidAmount: 0,
          remainingAmount: t.rentAmount || 3000,
          status: "unpaid",
        });
      }
    }

    return Response.json({ success: true, message: `${month} payments generate ho gayi ✅` });
  } catch (err) {
    return Response.json({ success: false, message: "Server error ❌" }, { status: 500 });
  }
}
