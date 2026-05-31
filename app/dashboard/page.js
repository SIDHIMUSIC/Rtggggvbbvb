import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import jwt from "jsonwebtoken";
import { connectDB } from "@/lib/mongodb";
import Room from "@/models/Room";
import Tenant from "@/models/Tenant";
import Payment from "@/models/Payment";
import DashboardClient from "@/components/DashboardClient";

export default async function DashboardPage() {
  // ✅ Token verify karo server side
  const cookieStore = cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) redirect("/login");

  try {
    jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    redirect("/login");
  }

  // ✅ DB se data fetch karo
  await connectDB();
  const rooms = await Room.find().sort({ roomNumber: 1 }).lean();
  const tenants = await Tenant.find().lean();
  const payments = await Payment.find().lean();

  // Serialize (MongoDB objects → plain JS)
  const data = {
    rooms: JSON.parse(JSON.stringify(rooms)),
    tenants: JSON.parse(JSON.stringify(tenants)),
    payments: JSON.parse(JSON.stringify(payments)),
    token,
  };

  return <DashboardClient data={data} />;
}
