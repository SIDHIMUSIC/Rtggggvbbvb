import { connectDB } from "../../../../lib/mongodb";
import Payment from "../../../../models/Payment";

// ✅ MARK AS FULL PAID
export async function PUT(req, { params }) {
  await connectDB();

  const payment = await Payment.findById(params.id);

  if (!payment) {
    return Response.json({ success: false });
  }

  payment.paidAmount = payment.totalRent;
  payment.remainingAmount = 0;
  payment.status = "paid";

  await payment.save();

  return Response.json({ success: true });
}
