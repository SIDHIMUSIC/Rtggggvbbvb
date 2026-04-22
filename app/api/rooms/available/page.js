import { connectDB } from "../../../../lib/mongodb";
import Room from "../../../../models/Room";
import Tenant from "../../../../models/Tenant";

export async function GET() {
  try {
    await connectDB();

    // 🔥 सारे tenants निकाल
    const tenants = await Tenant.find().lean();

    // 🔥 occupied rooms list
    const occupiedRooms = tenants.map(t => t.roomNumber);

    // 🔥 सारे rooms निकाल
    const rooms = await Room.find().lean();

    // 🔥 सिर्फ available filter
    const availableRooms = rooms.filter(
      r => !occupiedRooms.includes(r.roomNumber)
    );

    return Response.json(availableRooms);

  } catch (err) {
    console.log("ROOM ERROR:", err);
    return Response.json([]);
  }
}
