"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DashboardClient({ data }) {
  const router = useRouter();
  const { rooms: initialRooms, tenants, payments, token } = data;
  const [rooms, setRooms] = useState(initialRooms);
  const [activeTab, setActiveTab] = useState("rooms");
  const [roomNumber, setRoomNumber] = useState("");
  const [rent, setRent] = useState("3000");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  // Stats calculate karo
  const totalIncome = payments.reduce((a, p) => a + (p.paidAmount || 0), 0);
  const totalPending = payments.reduce((a, p) => a + (p.remainingAmount || 0), 0);
  const occupiedRooms = rooms.filter((r) => r.status === "occupied").length;
  const vacantRooms = rooms.filter((r) => r.status === "vacant").length;

  async function addRoom() {
    if (!roomNumber.trim()) return setMsg("Room number daalo ❌");
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ roomNumber: roomNumber.trim(), rent: Number(rent) }),
      });
      const result = await res.json();
      if (result.success) {
        setRooms((prev) => [...prev, result.room]);
        setRoomNumber("");
        setRent("3000");
        setMsg("Room add ho gaya ✅");
        router.refresh();
      } else {
        setMsg(result.message || "Error ❌");
      }
    } catch {
      setMsg("Network error ❌");
    }
    setLoading(false);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const statCards = [
    { label: "Total Rooms", value: rooms.length, color: "bg-blue-500" },
    { label: "Occupied", value: occupiedRooms, color: "bg-red-500" },
    { label: "Vacant", value: vacantRooms, color: "bg-green-500" },
    { label: "Total Income", value: `₹${totalIncome}`, color: "bg-emerald-600" },
    { label: "Total Pending", value: `₹${totalPending}`, color: "bg-orange-500" },
    { label: "Total Tenants", value: tenants.length, color: "bg-purple-500" },
  ];

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 bg-black text-white p-4 rounded-xl">
        <h1 className="text-xl font-bold">🏠 Owner Dashboard</h1>
        <button onClick={logout} className="bg-red-500 px-3 py-1 rounded text-sm">
          Logout
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {statCards.map((card) => (
          <div key={card.label} className={`${card.color} text-white p-4 rounded-xl`}>
            <p className="text-sm opacity-80">{card.label}</p>
            <p className="text-2xl font-bold">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {["rooms", "tenants", "payments"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${
              activeTab === tab ? "bg-blue-600 text-white" : "bg-white text-gray-700"
            }`}
          >
            {tab === "rooms" ? "🏠" : tab === "tenants" ? "👥" : "💳"} {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Rooms Tab */}
      {activeTab === "rooms" && (
        <div>
          {/* Add Room Form */}
          <div className="bg-white rounded-xl p-4 mb-4 shadow">
            <h2 className="font-bold mb-3">➕ Naya Room Add Karo</h2>
            <input
              className="border w-full p-2 rounded mb-2"
              placeholder="Room Number (e.g. F1-R15)"
              value={roomNumber}
              onChange={(e) => setRoomNumber(e.target.value)}
            />
            <div className="flex gap-2">
              <input
                className="border flex-1 p-2 rounded"
                placeholder="Rent (e.g. 3000)"
                type="number"
                value={rent}
                onChange={(e) => setRent(e.target.value)}
              />
              <button
                onClick={addRoom}
                disabled={loading}
                className="bg-blue-600 text-white px-4 py-2 rounded font-medium disabled:opacity-50"
              >
                {loading ? "..." : "Add Room"}
              </button>
            </div>
            {msg && (
              <p className={`mt-2 text-sm ${msg.includes("✅") ? "text-green-600" : "text-red-500"}`}>
                {msg}
              </p>
            )}
          </div>

          {/* Rooms List */}
          {rooms.length === 0 ? (
            <p className="text-center text-gray-500 py-8">Koi room nahi hai abhi</p>
          ) : (
            <div className="grid gap-3">
              {rooms.map((room) => (
                <div key={room._id} className="bg-white rounded-xl p-4 shadow flex justify-between items-center">
                  <div>
                    <p className="font-bold text-lg">{room.roomNumber}</p>
                    <p className="text-gray-500 text-sm">₹{room.rent}/month</p>
                    {room.tenantName && <p className="text-sm text-blue-600">{room.tenantName}</p>}
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    room.status === "occupied" ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600"
                  }`}>
                    {room.status === "occupied" ? "Occupied" : "Vacant"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tenants Tab */}
      {activeTab === "tenants" && (
        <div className="bg-white rounded-xl p-4 shadow">
          {tenants.length === 0 ? (
            <p className="text-center text-gray-500 py-8">Koi tenant nahi hai abhi</p>
          ) : (
            <div className="grid gap-3">
              {tenants.map((t) => (
                <div key={t._id} className="border-b pb-3">
                  <p className="font-bold">{t.name}</p>
                  <p className="text-sm text-gray-500">Room: {t.roomNumber} | {t.phone}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Payments Tab */}
      {activeTab === "payments" && (
        <div className="bg-white rounded-xl p-4 shadow">
          {payments.length === 0 ? (
            <p className="text-center text-gray-500 py-8">Koi payment nahi hai abhi</p>
          ) : (
            <div className="grid gap-3">
              {payments.map((p) => (
                <div key={p._id} className="border-b pb-3">
                  <p className="font-bold">Room {p.roomNumber}</p>
                  <p className="text-sm text-green-600">Paid: ₹{p.paidAmount}</p>
                  <p className="text-sm text-red-500">Pending: ₹{p.remainingAmount}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
