import { connectDB } from "../../../lib/mongodb";
import Tenant from "../../../models/Tenant";
import Room from "../../../models/Room";
import Payment from "../../../models/Payment";
import jwt from "jsonwebtoken";

function verifyToken(req) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return null;
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
  try { return jwt.verify(token, process.env.JWT_SECRET); }
  catch { return null; }
}

function monthIndex(d) { return d.getFullYear() * 100 + (d.getMonth() + 1); }
function monthLabel(d) { return d.toLocaleString("default", { month: "short", year: "numeric" }); }

export async function GET() {
  try {
    await connectDB();
    const tenants = await Tenant.find().lean();
    return Response.json(tenants);
  } catch { return Response.json([]); }
}

export async function POST(req) {
  try {
    await connectDB();
    if (!verifyToken(req)) return Response.json({ success: false, message: "Unauthorized ❌" }, { status: 401 });

    const body = await req.json();
    if (!body.name || !body.roomNumber) return Response.json({ success: false, message: "Name aur room required ❌" });

    const tenant = await Tenant.create({
      name: body.name,
      phone: body.phone || "",
      roomNumber: body.roomNumber,
      rentAmount: Number(body.rentAmount) || 3000,
      startDate: body.startDate ? new Date(body.startDate) : new Date(),
    });

    await Room.findOneAndUpdate({ roomNumber: body.roomNumber }, { status: "occupied", tenantName: body.name });

    // Start date se aaj tak sab months auto generate karo
    const start = new Date(tenant.startDate);
    start.setDate(1);
    const now = new Date();
    now.setDate(1);
    let current = new Date(start);

    while (current <= now) {
      await Payment.create({
        tenant: tenant._id,
        roomNumber: tenant.roomNumber,
        month: monthLabel(current),
        monthIndex: monthIndex(current),
        totalRent: tenant.rentAmount,
        paidAmount: 0,
        remainingAmount: tenant.rentAmount,
        status: "unpaid",
      });
      current.setMonth(current.getMonth() + 1);
    }

    return Response.json({ success: true, tenant });
  } catch (err) {
    console.error(err);
    return Response.json({ success: false, message: "Server error ❌" }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    await connectDB();
    if (!verifyToken(req)) return Response.json({ success: false, message: "Unauthorized ❌" }, { status: 401 });

    const body = await req.json();
    const old = await Tenant.findById(body._id);

    if (old && old.roomNumber !== body.roomNumber) {
      await Room.findOneAndUpdate({ roomNumber: old.roomNumber }, { status: "vacant", tenantName: "" });
      await Room.findOneAndUpdate({ roomNumber: body.roomNumber }, { status: "occupied", tenantName: body.name });
    } else {
      await Room.findOneAndUpdate({ roomNumber: body.roomNumber }, { tenantName: body.name });
    }

    const tenant = await Tenant.findByIdAndUpdate(body._id, body, { new: true });
    return Response.json({ success: true, tenant });
  } catch { return Response.json({ success: false, message: "Server error ❌" }, { status: 500 }); }
}

export async function DELETE(req) {
  try {
    await connectDB();
    if (!verifyToken(req)) return Response.json({ success: false, message: "Unauthorized ❌" }, { status: 401 });

    const { id } = await req.json();
    const tenant = await Tenant.findById(id);
    if (!tenant) return Response.json({ success: false, message: "Not found ❌" });

    await Room.findOneAndUpdate({ roomNumber: tenant.roomNumber }, { status: "vacant", tenantName: "" });
    await Payment.deleteMany({ tenant: id });
    await Tenant.findByIdAndDelete(id);

    return Response.json({ success: true });
  } catch { return Response.json({ success: false, message: "Server error ❌" }, { status: 500 }); }
}
