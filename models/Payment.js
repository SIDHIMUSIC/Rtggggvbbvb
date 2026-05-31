import mongoose from "mongoose";

const PaymentSchema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true },
  roomNumber: { type: String, default: "" },
  month: { type: String }, // "Jun 2025" format
  monthIndex: { type: Number }, // sorting ke liye — 202506
  totalRent: { type: Number, default: 3000 },
  paidAmount: { type: Number, default: 0 },
  remainingAmount: { type: Number, default: 3000 },
  advanceAmount: { type: Number, default: 0 }, // extra paid
  status: { type: String, default: "unpaid" }, // unpaid/partial/paid
  paidBy: { type: String, default: "" }, // "cash" ya "razorpay"
  paidAt: { type: Date },
  razorpayPaymentId: { type: String, default: "" },
}, { timestamps: true });

export default mongoose.models.Payment || mongoose.model("Payment", PaymentSchema);
