"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DashboardClient({ data }) {
  const router = useRouter();
  const { rooms: initialRooms, tenants: initialTenants, payments: initialPayments, token } = data;

  const [rooms, setRooms] = useState(initialRooms);
  const [tenants, setTenants] = useState(initialTenants);
  const [payments, setPayments] = useState(initialPayments);
  const [activeTab, setActiveTab] = useState("rooms");

  // Room form
  const [roomForm, setRoomForm] = useState({ roomNumber: "", rent: "3000" });
  const [editRoom, setEditRoom] = useState(null);

  // Tenant form
  const [tenantForm, setTenantForm] = useState({ name: "", phone: "", roomNumber: "", rentAmount: "3000", startDate: "" });
  const [editTenant, setEditTenant] = useState(null);
  const [showTenantForm, setShowTenantForm] = useState(false);

  // Payment
  const [payModal, setPayModal] = useState(null); // { payment }
  const [payAmount, setPayAmount] = useState("");

  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const authHeader = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  function showMsg(m) { setMsg(m); setTimeout(() => setMsg(""), 3000); }

  // Stats
  const totalIncome = payments.reduce((a, p) => a + (p.paidAmount || 0), 0);
  const totalPending = payments.reduce((a, p) => a + (p.remainingAmount || 0), 0);
  const occupiedRooms = rooms.filter(r => r.status === "occupied").length;
  const vacantRooms = rooms.filter(r => r.status === "vacant").length;

  // =================== ROOMS ===================
  async function addRoom() {
    if (!roomForm.roomNumber.trim()) return showMsg("Room number daalo ❌");
    setLoading(true);
    const res = await fetch("/api/rooms", { method: "POST", headers: authHeader, body: JSON.stringify({ roomNumber: roomForm.roomNumber.trim(), rent: Number(roomForm.rent) }) });
    const d = await res.json();
    if (d.success) { setRooms(p => [...p, d.room]); setRoomForm({ roomNumber: "", rent: "3000" }); showMsg("Room add ho gaya ✅"); router.refresh(); }
    else showMsg(d.message);
    setLoading(false);
  }

  async function deleteRoom(id) {
    if (!confirm("Room delete karna hai?")) return;
    const res = await fetch("/api/rooms", { method: "DELETE", headers: authHeader, body: JSON.stringify({ id }) });
    const d = await res.json();
    if (d.success) { setRooms(p => p.filter(r => r._id !== id)); showMsg("Room delete ho gaya ✅"); }
    else showMsg(d.message);
  }

  // =================== TENANTS ===================
  async function saveTenant() {
    if (!tenantForm.name || !tenantForm.roomNumber) return showMsg("Name aur room number required ❌");
    setLoading(true);
    const method = editTenant ? "PUT" : "POST";
    const body = editTenant ? { ...tenantForm, _id: editTenant._id } : tenantForm;
    const res = await fetch("/api/tenants", { method, headers: authHeader, body: JSON.stringify(body) });
    const d = await res.json();
    if (d.success) {
      if (editTenant) setTenants(p => p.map(t => t._id === d.tenant._id ? d.tenant : t));
      else setTenants(p => [...p, d.tenant]);
      setTenantForm({ name: "", phone: "", roomNumber: "", rentAmount: "3000", startDate: "" });
      setEditTenant(null);
      setShowTenantForm(false);
      showMsg(editTenant ? "Tenant update ho gaya ✅" : "Tenant add ho gaya ✅");
      router.refresh();
    } else showMsg(d.message);
    setLoading(false);
  }

  async function deleteTenant(id) {
    if (!confirm("Tenant remove karna hai? Uski sab payments bhi delete hongi.")) return;
    const res = await fetch("/api/tenants", { method: "DELETE", headers: authHeader, body: JSON.stringify({ id }) });
    const d = await res.json();
    if (d.success) { setTenants(p => p.filter(t => t._id !== id)); showMsg("Tenant remove ho gaya ✅"); router.refresh(); }
    else showMsg(d.message);
  }

  // =================== PAYMENTS ===================
  async function markPaid(method) {
    if (!payAmount || Number(payAmount) <= 0) return showMsg("Amount daalo ❌");
    setLoading(true);
    const res = await fetch("/api/payments", {
      method: "POST", headers: authHeader,
      body: JSON.stringify({ paymentId: payModal._id, amount: Number(payAmount), method })
    });
    const d = await res.json();
    if (d.success) {
      setPayments(p => p.map(pm => pm._id === d.payment._id ? d.payment : pm));
      setPayModal(null); setPayAmount("");
      showMsg("Payment update ho gaya ✅");
    } else showMsg(d.message);
    setLoading(false);
  }

  async function generateMonthPayments() {
    const month = new Date().toLocaleString("default", { month: "short", year: "numeric" });
    if (!confirm(`${month} ki payments generate karna hai?`)) return;
    const res = await fetch("/api/payments", { method: "PUT", headers: authHeader, body: JSON.stringify({ month }) });
    const d = await res.json();
    showMsg(d.message);
    router.refresh();
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
    <div className="min-h-screen bg-gray-100 p-4 pb-20">

      {/* Header */}
      <div className="flex justify-between items-center mb-4 bg-black text-white p-4 rounded-xl">
        <h1 className="text-lg font-bold">🏠 Owner Dashboard</h1>
        <button onClick={logout} className="bg-red-500 px-3 py-1 rounded text-sm">Logout</button>
      </div>

      {/* Msg */}
      {msg && (
        <div className={`mb-3 p-3 rounded-lg text-sm text-center font-medium ${msg.includes("✅") ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
          {msg}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {statCards.map(c => (
          <div key={c.label} className={`${c.color} text-white p-4 rounded-xl`}>
            <p className="text-xs opacity-80">{c.label}</p>
            <p className="text-2xl font-bold">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {["rooms", "tenants", "payments"].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize ${activeTab === tab ? "bg-blue-600 text-white" : "bg-white text-gray-700"}`}>
            {tab === "rooms" ? "🏠" : tab === "tenants" ? "👥" : "💳"} {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* ===== ROOMS TAB ===== */}
      {activeTab === "rooms" && (
        <div>
          {/* Add Room */}
          <div className="bg-white rounded-xl p-4 mb-4 shadow">
            <h2 className="font-bold mb-3">➕ Naya Room</h2>
            <input className="border w-full p-2 rounded mb-2 text-sm" placeholder="Room Number (e.g. F1-R15)"
              value={roomForm.roomNumber} onChange={e => setRoomForm(p => ({ ...p, roomNumber: e.target.value }))} />
            <div className="flex gap-2">
              <input className="border flex-1 p-2 rounded text-sm" placeholder="Rent" type="number"
                value={roomForm.rent} onChange={e => setRoomForm(p => ({ ...p, rent: e.target.value }))} />
              <button onClick={addRoom} disabled={loading}
                className="bg-blue-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50">
                {loading ? "..." : "Add"}
              </button>
            </div>
          </div>

          {/* Rooms List */}
          <div className="grid gap-3">
            {rooms.map(room => (
              <div key={room._id} className="bg-white rounded-xl p-4 shadow">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-lg">{room.roomNumber}</p>
                    <p className="text-gray-500 text-sm">₹{room.rent}/month</p>
                    {room.tenantName && <p className="text-blue-600 text-sm">{room.tenantName}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${room.status === "occupied" ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600"}`}>
                      {room.status === "occupied" ? "Occupied" : "Vacant"}
                    </span>
                    {room.status === "vacant" && (
                      <button onClick={() => deleteRoom(room._id)}
                        className="text-xs text-red-500 border border-red-300 px-2 py-1 rounded">
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== TENANTS TAB ===== */}
      {activeTab === "tenants" && (
        <div>
          <button onClick={() => { setShowTenantForm(true); setEditTenant(null); setTenantForm({ name: "", phone: "", roomNumber: "", rentAmount: "3000", startDate: "" }); }}
            className="w-full bg-blue-600 text-white py-2 rounded-lg mb-4 font-medium">
            ➕ Naya Tenant Add Karo
          </button>

          {/* Tenant Form Modal */}
          {showTenantForm && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-end">
              <div className="bg-white w-full rounded-t-2xl p-5 max-h-[85vh] overflow-y-auto">
                <h2 className="font-bold text-lg mb-4">{editTenant ? "Tenant Edit Karo" : "Naya Tenant"}</h2>
                <input className="border w-full p-2 rounded mb-2 text-sm" placeholder="Naam *"
                  value={tenantForm.name} onChange={e => setTenantForm(p => ({ ...p, name: e.target.value }))} />
                <input className="border w-full p-2 rounded mb-2 text-sm" placeholder="Phone"
                  value={tenantForm.phone} onChange={e => setTenantForm(p => ({ ...p, phone: e.target.value }))} />
                <select className="border w-full p-2 rounded mb-2 text-sm"
                  value={tenantForm.roomNumber} onChange={e => setTenantForm(p => ({ ...p, roomNumber: e.target.value }))}>
                  <option value="">Room Select Karo *</option>
                  {rooms.filter(r => r.status === "vacant" || (editTenant && r.roomNumber === editTenant.roomNumber)).map(r => (
                    <option key={r._id} value={r.roomNumber}>{r.roomNumber} — ₹{r.rent}</option>
                  ))}
                </select>
                <input className="border w-full p-2 rounded mb-2 text-sm" placeholder="Rent Amount" type="number"
                  value={tenantForm.rentAmount} onChange={e => setTenantForm(p => ({ ...p, rentAmount: e.target.value }))} />
                <input className="border w-full p-2 rounded mb-3 text-sm" type="date"
                  value={tenantForm.startDate} onChange={e => setTenantForm(p => ({ ...p, startDate: e.target.value }))} />
                <div className="flex gap-2">
                  <button onClick={() => setShowTenantForm(false)} className="flex-1 border py-2 rounded-lg text-sm">Cancel</button>
                  <button onClick={saveTenant} disabled={loading} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm disabled:opacity-50">
                    {loading ? "..." : editTenant ? "Update" : "Add Tenant"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Tenants List */}
          <div className="grid gap-3">
            {tenants.map(t => (
              <div key={t._id} className="bg-white rounded-xl p-4 shadow">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold">{t.name}</p>
                    <p className="text-sm text-gray-500">Room: {t.roomNumber}</p>
                    <p className="text-sm text-gray-500">📞 {t.phone}</p>
                    <p className="text-sm text-blue-600">₹{t.rentAmount}/month</p>
                    {t.startDate && <p className="text-xs text-gray-400">Since: {new Date(t.startDate).toLocaleDateString()}</p>}
                  </div>
                  <div className="flex flex-col gap-2">
                    <button onClick={() => { setEditTenant(t); setTenantForm({ name: t.name, phone: t.phone, roomNumber: t.roomNumber, rentAmount: t.rentAmount, startDate: t.startDate?.slice(0, 10) || "" }); setShowTenantForm(true); }}
                      className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded">Edit</button>
                    <button onClick={() => deleteTenant(t._id)}
                      className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded">Remove</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== PAYMENTS TAB ===== */}
      {activeTab === "payments" && (
        <div>
          <button onClick={generateMonthPayments}
            className="w-full bg-emerald-600 text-white py-2 rounded-lg mb-4 font-medium text-sm">
            🗓️ Is Month Ki Payments Generate Karo
          </button>

          <div className="grid gap-3">
            {payments.map(p => {
              const tenant = p.tenant;
              return (
                <div key={p._id} className="bg-white rounded-xl p-4 shadow">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-bold">{tenant?.name || "—"}</p>
                      <p className="text-xs text-gray-500">Room: {tenant?.roomNumber || "—"} | {p.month}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${p.status === "paid" ? "bg-green-100 text-green-600" : p.status === "partial" ? "bg-yellow-100 text-yellow-600" : "bg-red-100 text-red-600"}`}>
                      {p.status === "paid" ? "Paid ✅" : p.status === "partial" ? "Partial" : "Unpaid"}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm mb-3">
                    <span className="text-green-600">Paid: ₹{p.paidAmount}</span>
                    <span className="text-red-500">Pending: ₹{p.remainingAmount}</span>
                    <span className="text-gray-500">Total: ₹{p.totalRent}</span>
                  </div>
                  {p.status !== "paid" && (
                    <button onClick={() => { setPayModal(p); setPayAmount(String(p.remainingAmount)); }}
                      className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium">
                      💰 Payment Mark Karo
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===== PAYMENT MODAL ===== */}
      {payModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-2xl p-5">
            <h2 className="font-bold text-lg mb-1">💰 Payment</h2>
            <p className="text-sm text-gray-500 mb-4">
              {payModal.tenant?.name} — Room {payModal.tenant?.roomNumber} — {payModal.month}
            </p>
            <p className="text-sm mb-1">Pending: <span className="text-red-500 font-bold">₹{payModal.remainingAmount}</span></p>
            <input className="border w-full p-3 rounded-lg mb-4 text-lg" type="number"
              placeholder="Amount" value={payAmount} onChange={e => setPayAmount(e.target.value)} />
            <div className="flex gap-2 mb-3">
              <button onClick={() => markPaid("cash")} disabled={loading}
                className="flex-1 bg-green-600 text-white py-3 rounded-lg font-medium disabled:opacity-50">
                💵 Cash
              </button>
              <button onClick={() => markPaid("razorpay")} disabled={loading}
                className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-medium disabled:opacity-50">
                💳 Razorpay
              </button>
            </div>
            <button onClick={() => { setPayModal(null); setPayAmount(""); }}
              className="w-full border py-2 rounded-lg text-sm text-gray-600">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
