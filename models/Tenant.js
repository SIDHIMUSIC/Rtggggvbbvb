import mongoose from "mongoose";

const PaymentSchema = new mongoose.Schema({
  month: String,        // "Jun 2025"
  year: Number,         // 2025
  monthIndex: Number,   // 202506
  amount: Number,       // kitna pay kiya
  paidAmount: Number,
  totalRent: Number,
  remainingAmount: Number,
  status: {
    type: String,
    enum: ["unpaid", "partial", "paid", "pending"],
    default: "unpaid",
  },
  paidBy: String,       // "cash" ya "razorpay"
  paidAt: Date,
  transactionId: String,
  razorpayPaymentId: String,
}, { _id: true });

const TenantSchema = new mongoose.Schema({
  name: String,
  phone: String,
  roomNumber: String,
  rentAmount: Number,
  startDate: Date,
  email: String,
  address: String,
  notes: String,
  depositAmount: Number,
  isActive: { type: Boolean, default: true },
  // ✅ YEH MISSING THA — isliye payments dikh nahi rahe the
  payments: [PaymentSchema],
}, { timestamps: true });

export default mongoose.models.Tenant ||
  mongoose.model("Tenant", TenantSchema);
