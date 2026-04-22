import mongoose from "mongoose";

const PaymentSchema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant" },
  month: String,
  totalRent: { type: Number, default: 3000 },
  paidAmount: { type: Number, default: 0 },
  remainingAmount: Number,
  status: { type: String, default: "unpaid" },
  // 💳 Razorpay fields
  razorpayOrderId: { type: String, default: "" },
  razorpayPaymentId: { type: String, default: "" },
  paidAt: { type: Date },
}, { timestamps: true });

export default mongoose.models.Payment ||
  mongoose.model("Payment", PaymentSchema);
