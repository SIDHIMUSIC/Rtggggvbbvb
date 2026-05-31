import { connectDB } from "@/lib/mongodb";
import Payment from "@/models/Payment";
import jwt from "jsonwebtoken";

export async function POST(req) {
  await connectDB();

  // ✅ FIXED: Bearer prefix strip karo verify se pehle
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return Response.json({ success: false, message: "No token ❌" });
  }

  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : authHeader;

  try {
    jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return Response.json({ success: false, message: "Invalid token ❌" });
  }

  const body = await req.json();

  if (!body.id) {
    return Response.json({ success: false, message: "Payment ID missing ❌" });
  }

  const payment = await Payment.findById(body.id);

  if (!payment) {
    return Response.json({ success: false, message: "Payment not found ❌" });
  }

  // ✅ Mark as fully paid
  payment.paidAmount = payment.totalRent;
  payment.remainingAmount = 0;
  payment.status = "paid";
  payment.paidBy = "cash";
  payment.paidAt = new Date();

  await payment.save();

  return Response.json({ success: true });
}
