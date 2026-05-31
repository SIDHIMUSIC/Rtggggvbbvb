import { NextResponse } from "next/server";

// Build time pe call hone se bachao
export const dynamic = "force-dynamic";

import { connectDB } from "@/lib/mongodb";
import Payment from "@/models/Payment";
import Tenant from "@/models/Tenant";
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

export async function POST(req) {
  try {
    await connectDB();
    if (!verifyToken(req)) {
      return NextResponse.json({ success: false, message: "Unauthorized ❌" }, { status: 401 });
    }

    const tenants = await Tenant.find().lean();
    let created = 0;

    for (const tenant of tenants) {
      if (!tenant._id) continue;
      const start = new Date(tenant.startDate || tenant.joinDate || new Date());
      start.setDate(1);
      const now = new Date();
      now.setDate(1);
      let current = new Date(start);

      while (current <= now) {
        const mi = monthIndex(current);
        const ml = monthLabel(current);
        const exists = await Payment.findOne({ tenant: tenant._id, monthIndex: mi });
        if (!exists) {
          await Payment.create({
            tenant: tenant._id,
            roomNumber: tenant.roomNumber,
            month: ml,
            monthIndex: mi,
            totalRent: tenant.rentAmount || 3000,
            paidAmount: 0,
            remainingAmount: tenant.rentAmount || 3000,
            status: "unpaid",
          });
          created++;
        }
        current.setMonth(current.getMonth() + 1);
      }
    }

    return NextResponse.json({ success: true, message: `${created} payment entries bani ✅` });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, message: "Server error ❌" }, { status: 500 });
  }
}

// GET bhi force-dynamic rakho
export async function GET() {
  return NextResponse.json({ message: "POST request karo" });
}
