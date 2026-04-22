export const dynamic = "force-dynamic"; // 🔥 ADD THIS

import { connectDB } from "../../../../lib/mongodb";
import Room from "../../../../models/Room";

export async function GET() {
  await connectDB();

  await Room.deleteMany();

  const rooms = [];

  for (let f = 1; f <= 3; f++) {
    for (let r = 1; r <= 10; r++) {
      rooms.push({
        roomNumber: `F${f}-R${r}`,
        status: "vacant",
        rent: 3000,
      });
    }
  }

  await Room.insertMany(rooms);

  return Response.json({ message: "Rooms created ✅" });
}
