import mongoose from "mongoose";

const TenantSchema = new mongoose.Schema({
  name: String,
  phone: String,
  roomNumber: String,
  rentAmount: Number, // 🔥 custom rent
  startDate: Date,
});

export default mongoose.models.Tenant ||
  mongoose.model("Tenant", TenantSchema);
