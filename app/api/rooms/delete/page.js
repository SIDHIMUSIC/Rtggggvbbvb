import { connectDB } from "../../../../lib/mongodb";
import Room from "../../../../models/Room";
import Tenant from "../../../../models/Tenant";
import jwt from "jsonwebtoken";

// ✅ DELETE Room (Admin only)
export async function POST(req) {
  try {
    await connectDB();

    const token = req.headers.get("authorization");
    try {
      jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return Response.json({ success: false, message: "Unauthorized ❌" });
    }

    const { id } = await req.json();

    const room = await Room.findById(id);
    if (!room) {
      return Response.json({ success: false, message: "Room not found ❌" });
    }

    // Check if occupied
    if (room.status === "occupied") {
      return Response.json({
        success: false,
        message: "Pehle tenant hatao, phir room delete karo ❌",
      });
    }

    await Room.findByIdAndDelete(id);
    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ success: false, message: "Server error ❌" });
  }
}
