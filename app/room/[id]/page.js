import { connectDB } from "@/lib/mongodb";
import Room from "@/models/Room";
import Tenant from "@/models/Tenant";
import Payment from "@/models/Payment";
import Navbar from "@/components/Navbar";
import RoomPayClient from "@/components/RoomPayClient";

export const dynamic = "force-dynamic";

export default async function Page({ params }) {
  await connectDB();

  const room = await Room.findById(params.id).lean();
  if (!room) return <div className="p-6">Room not found ❌</div>;

  const tenant = await Tenant.findOne({ roomNumber: room.roomNumber }).lean();

  // 🔥 Auto-generate monthly payments
  if (tenant && tenant.rentAmount) {
    const start = new Date(tenant.startDate);
    const now = new Date();
    let current = new Date(start);

    while (current <= now) {
      const month = current.toLocaleString("default", {
        month: "short",
        year: "numeric",
      });

      const exists = await Payment.findOne({ tenant: tenant._id, month });

      if (!exists) {
        await Payment.create({
          tenant: tenant._id,
          month,
          totalRent: tenant.rentAmount,
          paidAmount: 0,
          remainingAmount: tenant.rentAmount,
          status: "unpaid",
        });
      }

      current.setMonth(current.getMonth() + 1);
    }
  }

  // Fetch payments
  let payments = tenant
    ? await Payment.find({ tenant: tenant._id }).sort({ createdAt: 1 }).lean()
    : [];

  // Serialize for client
  const serialized = payments.map((p) => ({
    ...p,
    _id: p._id.toString(),
    tenant: p.tenant?.toString(),
    razorpayOrderId: p.razorpayOrderId || "",
    razorpayPaymentId: p.razorpayPaymentId || "",
  }));

  const tenantSerialized = tenant
    ? { ...tenant, _id: tenant._id.toString() }
    : null;

  const totalPending = payments.reduce(
    (a, x) => a + (x.remainingAmount || 0),
    0
  );

  return (
    <div>
      <Navbar />

      <div className="p-6 bg-gray-100 min-h-screen">

        <h1 className="text-2xl font-bold mb-4">
          🏠 Room {room.roomNumber}
        </h1>

        {/* ROOM INFO */}
        <div className="bg-white p-4 rounded-xl shadow mb-4">
          <p>
            Status:{" "}
            <span className={`font-bold ${room.status === "occupied" ? "text-red-600" : "text-green-600"}`}>
              {room.status}
            </span>
          </p>
          <p className="text-green-600 font-bold">
            Rent: ₹{tenant ? tenant.rentAmount : room.rent}/month
          </p>
        </div>

        {/* TENANT INFO */}
        {tenant && (
          <div className="bg-white p-4 rounded-xl shadow mb-4">
            <p className="font-bold text-blue-600 text-lg">👤 {tenant.name}</p>
            <p className="text-gray-600">📞 {tenant.phone}</p>
            <p className="text-gray-600">
              📅 Since {new Date(tenant.startDate).toLocaleDateString("en-IN")}
            </p>
            <p className="text-purple-600 font-semibold">
              💰 Rent: ₹{tenant.rentAmount}/month
            </p>
          </div>
        )}

        {/* NO TENANT */}
        {!tenant && (
          <div className="bg-yellow-50 border border-yellow-300 p-4 rounded-xl mb-4 text-yellow-700">
            🏚️ Ye room abhi vacant hai.
          </div>
        )}

        {/* PAYMENTS — Client Component with Razorpay */}
        {tenant && serialized.length > 0 && (
          <RoomPayClient
            payments={serialized}
            tenant={tenantSerialized}
          />
        )}

        {tenant && serialized.length === 0 && (
          <div className="bg-black text-white p-4 rounded-xl">
            <p className="text-gray-400 text-center py-4">
              Koi payment record nahi hai abhi.
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
