import mongoose from "mongoose";

const RoomSchema = new mongoose.Schema({
  roomNumber: String,
  status: {
    type: String,
    enum: ["vacant", "occupied"],
    default: "vacant"
  },
  rent: { type: Number, default: 3000 },
  tenantName: { type: String, default: "" }
});

export default mongoose.models.Room || mongoose.model("Room", RoomSchema);
