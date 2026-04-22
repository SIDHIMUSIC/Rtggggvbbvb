import { connectDB } from "../../../../lib/mongodb";
import Room from "../../../../models/Room";
import Payment from "../../../../models/Payment";

export async function GET() {
  await connectDB();

  const rooms = await Room.find({ status: "occupied" });

  const month = new Date().toLocaleString("default", { month: "long" });

  for (let room of rooms) {
    await Payment.create({
      tenantName: room.tenantName,
      roomNumber: room.roomNumber,
      month,
      totalRent: room.rent,
      paidAmount: 0,
      remainingAmount: room.rent,
      status: "unpaid"
    });
  }

  return Response.json({ message: "Rent Generated" });
}
