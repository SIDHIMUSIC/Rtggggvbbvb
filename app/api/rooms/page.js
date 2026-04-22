import { connectDB } from "../../../lib/mongodb";
import Room from "../../../models/Room";
import jwt from "jsonwebtoken";

// ✅ GET - Public (sab dekh sakte hain)
export async function GET() {
  try {
    await connectDB();
    const rooms = await Room.find().sort({ roomNumber: 1 }).lean();
    return Response.json(rooms);
  } catch (err) {
    return Response.json([]);
  }
}

// ✅ POST - Admin only (naya room create)
export async function POST(req) {
  try {
    await connectDB();

    const token = req.headers.get("authorization");
    try {
      jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return Response.json({ success: false, message: "Unauthorized ❌" });
    }

    const body = await req.json();

    const exists = await Room.findOne({ roomNumber: body.roomNumber });
    if (exists) {
      return Response.json({ success: false, message: "Room already exists ❌" });
    }

    const room = await Room.create({
      roomNumber: body.roomNumber,
      rent: Number(body.rent) || 3000,
      status: "vacant",
      tenantName: "",
    });

    return Response.json({ success: true, room });
  } catch (err) {
    return Response.json({ success: false, message: "Server error ❌" });
  }
}

// ✅ PUT - Admin only (room update)
export async function PUT(req) {
  try {
    await connectDB();

    const token = req.headers.get("authorization");
    try {
      jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return Response.json({ success: false, message: "Unauthorized ❌" });
    }

    const body = await req.json();
    const room = await Room.findByIdAndUpdate(body.id, body, { new: true });
    return Response.json({ success: true, room });
  } catch (err) {
    return Response.json({ success: false, message: "Server error ❌" });
  }
}
