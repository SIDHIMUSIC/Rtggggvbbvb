import { connectDB } from "../../../lib/mongodb";
import Room from "../../../models/Room";
import jwt from "jsonwebtoken";

function verifyToken(req) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return null;
  // "Bearer TOKEN" ya sirf "TOKEN" dono handle karo
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : authHeader;
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

// ✅ GET - Public
export async function GET() {
  try {
    await connectDB();
    const rooms = await Room.find().sort({ roomNumber: 1 }).lean();
    return Response.json(rooms);
  } catch (err) {
    console.error("GET /api/rooms error:", err);
    return Response.json([]);
  }
}

// ✅ POST - Admin only
export async function POST(req) {
  try {
    await connectDB();

    const user = verifyToken(req);
    if (!user) {
      return Response.json(
        { success: false, message: "Unauthorized ❌" },
        { status: 401 }
      );
    }

    const body = await req.json();

    if (!body.roomNumber) {
      return Response.json(
        { success: false, message: "Room number required ❌" },
        { status: 400 }
      );
    }

    const exists = await Room.findOne({ roomNumber: body.roomNumber });
    if (exists) {
      return Response.json(
        { success: false, message: "Room already exists ❌" },
        { status: 409 }
      );
    }

    const room = await Room.create({
      roomNumber: body.roomNumber,
      rent: Number(body.rent) || 3000,
      status: "vacant",
      tenantName: "",
    });

    return Response.json({ success: true, room }, { status: 201 });
  } catch (err) {
    console.error("POST /api/rooms error:", err);
    return Response.json(
      { success: false, message: "Server error ❌" },
      { status: 500 }
    );
  }
}

// ✅ PUT - Admin only
export async function PUT(req) {
  try {
    await connectDB();

    const user = verifyToken(req);
    if (!user) {
      return Response.json(
        { success: false, message: "Unauthorized ❌" },
        { status: 401 }
      );
    }

    const body = await req.json();

    if (!body.id) {
      return Response.json(
        { success: false, message: "Room ID required ❌" },
        { status: 400 }
      );
    }

    const room = await Room.findByIdAndUpdate(body.id, body, { new: true });
    return Response.json({ success: true, room });
  } catch (err) {
    console.error("PUT /api/rooms error:", err);
    return Response.json(
      { success: false, message: "Server error ❌" },
      { status: 500 }
    );
  }
}

// ✅ DELETE - Admin only
export async function DELETE(req) {
  try {
    await connectDB();

    const user = verifyToken(req);
    if (!user) {
      return Response.json(
        { success: false, message: "Unauthorized ❌" },
        { status: 401 }
      );
    }

    const { id } = await req.json();
    if (!id) {
      return Response.json(
        { success: false, message: "Room ID required ❌" },
        { status: 400 }
      );
    }

    await Room.findByIdAndDelete(id);
    return Response.json({ success: true, message: "Room deleted ✅" });
  } catch (err) {
    console.error("DELETE /api/rooms error:", err);
    return Response.json(
      { success: false, message: "Server error ❌" },
      { status: 500 }
    );
  }
}
