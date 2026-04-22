import { connectDB } from "@/lib/mongodb";
import Payment from "@/models/Payment";
import jwt from "jsonwebtoken";

export async function POST(req) {
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
    jwt.verify(token, process.env.JWT_SECRET); // ✅ FIXED
  } catch {
    return Response.json({
      success: false,
      message: "Invalid token ❌",
    });
  }

  const body = await req.json();

  const payment = await Payment.findById(body.id);

  if (!payment) {
    return Response.json({
      success: false,
      message: "Payment not found ❌",
    });
  }

  // ✅ MARK AS PAID
  payment.paidAmount = payment.totalRent;
  payment.remainingAmount = 0;
  payment.status = "paid";

  await payment.save();

  return Response.json({ success: true });
}
