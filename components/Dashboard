import { connectDB } from "@/lib/mongodb";
import Room from "@/models/Room";
import Tenant from "@/models/Tenant";
import Payment from "@/models/Payment";
import Navbar from "@/components/Navbar";

export default async function Dashboard() {
  await connectDB();

  const rooms = await Room.find();
  const tenants = await Tenant.find();
  const payments = await Payment.find();

  const tenantMap = {};
  tenants.forEach((t) => {
    tenantMap[t.roomNumber] = t;
  });

  const totalIncome = payments.reduce(
    (a, p) => a + (p.paidAmount || 0),
    0
  );

  const totalPending = payments.reduce(
    (a, p) => a + (p.remainingAmount || 0),
    0
  );

  const occupiedRooms = rooms.filter(
    (r) => r.status === "occupied"
  ).length;

  const now = new Date();
  const currentMonth = now.toLocaleString("default", {
    month: "short",
    year: "numeric",
  });

  const currentPayments = payments.filter(
    (p) => p.month === currentMonth
  );

  const currentPaid = currentPayments.reduce(
    (a, p) => a + (p.paidAmount || 0),
    0
  );

  const currentPending = currentPayments.reduce(
    (a, p) => a + (p.remainingAmount || 0),
    0
  );

  const floors = {};
  rooms.forEach((room) => {
    const floor = room.roomNumber.split("-")[0];
    if (!floors[floor]) floors[floor] = [];
    floors[floor].push(room);
  });

  return (
    <div>
      <Navbar />

      <div className="p-6 min-h-screen bg-gradient-to-br from-gray-900 to-black text-white">

        <h1 className="text-3xl font-bold mb-6 text-center text-yellow-400">
          🏢 Smart Rent Dashboard
        </h1>

        {/* STATS */}
        <div className="grid grid-cols-3 gap-4 mb-6">

          <div className="bg-green-500/20 p-4 rounded">
            ₹{totalIncome}
          </div>

          <div className="bg-red-500/20 p-4 rounded">
            ₹{totalPending}
          </div>

          <div className="bg-blue-500/20 p-4 rounded">
            {occupiedRooms}
          </div>

        </div>

        {/* MONTH */}
        <div className="mb-6">
          {currentMonth} → ₹{currentPaid} / ₹{currentPending}
        </div>

        {/* ROOMS */}
        {Object.keys(floors).map((floor) => (
          <div key={floor}>
            <h2>{floor} Floor</h2>

            <div className="flex gap-3 flex-wrap">
              {floors[floor].map((room) => {
                const tenant = tenantMap[room.roomNumber];

                return (
                  <div key={room._id} className="p-3 bg-gray-800 rounded">
                    {room.roomNumber}
                    <br />
                    {tenant?.name}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

      </div>
    </div>
  );
}
