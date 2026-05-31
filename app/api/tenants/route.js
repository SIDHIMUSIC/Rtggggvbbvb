import { connectDB } from "../../../lib/mongodb";
import Tenant from "../../../models/Tenant";
import Room from "../../../models/Room";
import Payment from "../../../models/Payment";
import jwt from "jsonwebtoken";

function verifyToken(req) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return null;
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

// GET - Sab tenants
export async function GET() {
  try {
    await connectDB();
    const tenants = await Tenant.find().lean();
    return Response.json(tenants);
  } catch (err) {
    return Response.json([]);
  }
}

// POST - Naya tenant add
export async function POST(req) {
  try {
    await connectDB();
    if (!verifyToken(req)) return Response.json({ success: false, message: "Unauthorized ❌" }, { status: 401 });

    const body = await req.json();
    if (!body.name || !body.roomNumber) return Response.json({ success: false, message: "Name aur room number required ❌" });

    const tenant = await Tenant.create({
      name: body.name,
      phone: body.phone || "",
      roomNumber: body.roomNumber,
      rentAmount: Number(body.rentAmount) || 3000,
      startDate: body.startDate || new Date(),
    });

    // Room occupied mark karo
    await Room.findOneAndUpdate(
      { roomNumber: body.roomNumber },
      { status: "occupied", tenantName: body.name }
    );

    // Is month ki payment entry banao
    const now = new Date();
    const month = now.toLocaleString("default", { month: "short", year: "numeric" });
    await Payment.create({
      tenant: tenant._id,
      month,
      totalRent: tenant.rentAmount,
      paidAmount: 0,
      remainingAmount: tenant.rentAmount,
      status: "unpaid",
    });

    return Response.json({ success: true, tenant });
  } catch (err) {
    console.error(err);
    return Response.json({ success: false, message: "Server error ❌" }, { status: 500 });
  }
}

// PUT - Tenant edit
export async function PUT(req) {
  try {
    await connectDB();
    if (!verifyToken(req)) return Response.json({ success: false, message: "Unauthorized ❌" }, { status: 401 });

    const body = await req.json();
    if (!body._id) return Response.json({ success: false, message: "ID required ❌" });

    const old = await Tenant.findById(body._id);

    // Agar room change hua toh purana vacant karo
    if (old && old.roomNumber !== body.roomNumber) {
      await Room.findOneAndUpdate({ roomNumber: old.roomNumber }, { status: "vacant", tenantName: "" });
      await Room.findOneAndUpdate({ roomNumber: body.roomNumber }, { status: "occupied", tenantName: body.name });
    } else if (old) {
      await Room.findOneAndUpdate({ roomNumber: body.roomNumber }, { tenantName: body.name });
    }

    const tenant = await Tenant.findByIdAndUpdate(body._id, body, { new: true });
    return Response.json({ success: true, tenant });
  } catch (err) {
    return Response.json({ success: false, message: "Server error ❌" }, { status: 500 });
  }
}

// DELETE - Tenant remove
export async function DELETE(req) {
  try {
    await connectDB();
    if (!verifyToken(req)) return Response.json({ success: false, message: "Unauthorized ❌" }, { status: 401 });

    const { id } = await req.json();
    const tenant = await Tenant.findById(id);
    if (!tenant) return Response.json({ success: false, message: "Tenant not found ❌" });

    // Room vacant karo
    await Room.findOneAndUpdate({ roomNumber: tenant.roomNumber }, { status: "vacant", tenantName: "" });
    // Payments delete karo
    await Payment.deleteMany({ tenant: id });
    await Tenant.findByIdAndDelete(id);

    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ success: false, message: "Server error ❌" }, { status: 500 });
  }
}
