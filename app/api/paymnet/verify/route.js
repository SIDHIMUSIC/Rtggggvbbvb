import { connectDB } from "@/lib/mongodb";
import Payment from "@/models/Payment";
import crypto from "crypto";

// ✅ Razorpay Payment Verify karo
export async function POST(req) {
  try {
    await connectDB();

    const {
      paymentId,           // MongoDB payment _id
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    } = await req.json();

    if (!paymentId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return Response.json({ success: false, message: "Incomplete data ❌" });
    }

    // 🔐 Signature verify karo
    const body = razorpayOrderId + "|" + razorpayPaymentId;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpaySignature) {
      return Response.json({ success: false, message: "Payment verification failed ❌" });
    }

    // ✅ Signature match — payment genuine hai
    const payment = await Payment.findById(paymentId);

    if (!payment) {
      return Response.json({ success: false, message: "Payment not found ❌" });
    }

    // DB update karo — mark as paid
    payment.paidAmount = payment.totalRent;
    payment.remainingAmount = 0;
    payment.status = "paid";
    payment.razorpayPaymentId = razorpayPaymentId;
    payment.paidAt = new Date();

    await payment.save();

    return Response.json({
      success: true,
      message: "Payment verified ✅",
      razorpayPaymentId,
    });

  } catch (err) {
    console.error("VERIFY ERROR:", err);
    return Response.json({ success: false, message: "Server error ❌" });
  }
}
