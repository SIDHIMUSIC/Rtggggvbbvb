import { connectDB } from "@/lib/mongodb";
import Payment from "@/models/Payment";
import Razorpay from "razorpay";

// ✅ Razorpay Order Create karo (Public — tenant pay kar sake)
export async function POST(req) {
  try {
    await connectDB();

    const { paymentId } = await req.json();

    if (!paymentId) {
      return Response.json({ success: false, message: "paymentId required ❌" });
    }

    // DB se payment lo
    const payment = await Payment.findById(paymentId).populate("tenant");

    if (!payment) {
      return Response.json({ success: false, message: "Payment not found ❌" });
    }

    if (payment.status === "paid") {
      return Response.json({ success: false, message: "Payment already paid ✅" });
    }

    const amountToPay = payment.remainingAmount;

    if (!amountToPay || amountToPay <= 0) {
      return Response.json({ success: false, message: "Kuch bhi pending nahi hai ✅" });
    }

    // 🔑 Razorpay instance
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    // 💰 Order create karo (amount in paise — multiply by 100)
    const order = await razorpay.orders.create({
      amount: amountToPay * 100,
      currency: "INR",
      receipt: `receipt_${paymentId}`,
      notes: {
        paymentId: paymentId.toString(),
        month: payment.month,
        tenantName: payment.tenant?.name || "",
        roomNumber: payment.tenant?.roomNumber || "",
      },
    });

    // Order ID save karo
    payment.razorpayOrderId = order.id;
    await payment.save();

    return Response.json({
      success: true,
      orderId: order.id,
      amount: amountToPay * 100,
      currency: "INR",
      tenantName: payment.tenant?.name || "Tenant",
      month: payment.month,
    });

  } catch (err) {
    console.error("CREATE ORDER ERROR:", err);
    return Response.json({ success: false, message: "Server error ❌" });
  }
}
