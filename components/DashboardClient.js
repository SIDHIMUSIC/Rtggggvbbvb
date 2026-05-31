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

  // Tenant form
  const [tenantForm, setTenantForm] = useState({ name: "", phone: "", roomNumber: "", rentAmount: "3000", startDate: "" });
  const [editTenant, setEditTenant] = useState(null);
  const [showTenantForm, setShowTenantForm] = useState(false);

  // Tenant detail modal
  const [selectedTenant, setSelectedTenant] = useState(null);

  // Payment modal
  const [payModal, setPayModal] = useState(null);
  const [payAmount, setPayAmount] = useState("");

  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const H = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  function showMsg(m) { setMsg(m); setTimeout(() => setMsg(""), 3500); }

  const totalIncome = payments.reduce((a, p) => a + (p.paidAmount || 0), 0);
  const totalPending = payments.reduce((a, p) => a + (p.remainingAmount || 0), 0);
  const occupiedRooms = rooms.filter(r => r.status === "occupied").length;
  const vacantRooms = rooms.filter(r => r.status === "vacant").length;

  // ── ROOMS ──
  async function addRoom() {
    if (!roomForm.roomNumber.trim()) return showMsg("Room number daalo ❌");
    setLoading(true);
    const res = await fetch("/api/rooms", { method: "POST", headers: H, body: JSON.stringify({ roomNumber: roomForm.roomNumber.trim(), rent: Number(roomForm.rent) }) });
    const d = await res.json();
    if (d.success) { setRooms(p => [...p, d.room]); setRoomForm({ roomNumber: "", rent: "3000" }); showMsg("Room add ho gaya ✅"); }
    else showMsg(d.message);
    setLoading(false);
  }

  async function deleteRoom(id) {
    if (!confirm("Room delete karna hai?")) return;
    const res = await fetch("/api/rooms", { method: "DELETE", headers: H, body: JSON.stringify({ id }) });
    const d = await res.json();
    if (d.success) setRooms(p => p.filter(r => r._id !== id));
    else showMsg(d.message);
  }

  // ── TENANTS ──
  async function saveTenant() {
    if (!tenantForm.name || !tenantForm.roomNumber) return showMsg("Name aur room required ❌");
    setLoading(true);
    const method = editTenant ? "PUT" : "POST";
    const body = editTenant ? { ...tenantForm, _id: editTenant._id } : tenantForm;
    const res = await fetch("/api/tenants", { method, headers: H, body: JSON.stringify(body) });
    const d = await res.json();
    if (d.success) {
      if (editTenant) setTenants(p => p.map(t => t._id === d.tenant._id ? d.tenant : t));
      else setTenants(p => [...p, d.tenant]);
      setTenantForm({ name: "", phone: "", roomNumber: "", rentAmount: "3000", startDate: "" });
      setEditTenant(null);
      setShowTenantForm(false);
      showMsg(editTenant ? "Update ho gaya ✅" : "Tenant add ho gaya ✅");
      router.refresh();
    } else showMsg(d.message);
    setLoading(false);
  }

  async function deleteTenant(id) {
    if (!confirm("Tenant remove karna hai?")) return;
    const res = await fetch("/api/tenants", { method: "DELETE", headers: H, body: JSON.stringify({ id }) });
    const d = await res.json();
    if (d.success) { setTenants(p => p.filter(t => t._id !== id)); showMsg("Tenant remove ho gaya ✅"); router.refresh(); }
    else showMsg(d.message);
  }

  // Tenant ki payments
  function tenantPayments(tenantId) {
    return payments.filter(p => {
      const tid = p.tenant?._id || p.tenant;
      return String(tid) === String(tenantId);
    }).sort((a, b) => (a.monthIndex || 0) - (b.monthIndex || 0));
  }

  // ── PAYMENTS ──
  async function markPaid(method) {
    if (!payAmount || Number(payAmount) <= 0) return showMsg("Amount daalo ❌");
    setLoading(true);
    const res = await fetch("/api/payments", {
      method: "POST", headers: H,
      body: JSON.stringify({ paymentId: payModal._id, amount: Number(payAmount), method })
    });
    const d = await res.json();
    if (d.success) {
      setPayments(prev => {
        const updated = [...prev];
        d.payments.forEach(np => {
          const idx = updated.findIndex(p => p._id === np._id);
          if (idx !== -1) updated[idx] = np; else updated.push(np);
        });
        return updated;
      });
      setPayModal(null); setPayAmount("");
      showMsg("Payment mark ho gaya ✅");
    } else showMsg(d.message);
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
    <div className="min-h-screen bg-gray-100 pb-10">

      {/* Header */}
      <div className="flex justify-between items-center bg-black text-white p-4 mb-4">
        <h1 className="text-lg font-bold">🏠 Owner Dashboard</h1>
        <button onClick={logout} className="bg-red-500 px-3 py-1 rounded text-sm">Logout</button>
      </div>

      <div className="px-4">
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
              className={`flex-1 py-2 rounded-lg text-sm font-medium ${activeTab === tab ? "bg-blue-600 text-white" : "bg-white text-gray-700"}`}>
              {tab === "rooms" ? "🏠" : tab === "tenants" ? "👥" : "💳"} {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* ══════ ROOMS ══════ */}
        {activeTab === "rooms" && (
          <div>
            <div className="bg-white rounded-xl p-4 mb-4 shadow">
              <h2 className="font-bold mb-3">➕ Naya Room</h2>
              <input className="border w-full p-2 rounded mb-2 text-sm" placeholder="Room Number (F1-R15)"
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

            <div className="grid gap-3">
              {rooms.map(room => (
                <div key={room._id} className="bg-white rounded-xl p-4 shadow flex justify-between items-center">
                  <div>
                    <p className="font-bold text-lg">{room.roomNumber}</p>
                    <p className="text-gray-500 text-sm">₹{room.rent}/month</p>
                    {room.tenantName && <p className="text-blue-600 text-sm">👤 {room.tenantName}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${room.status === "occupied" ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600"}`}>
                      {room.status === "occupied" ? "Occupied" : "Vacant"}
                    </span>
                    {room.status === "vacant" && (
                      <button onClick={() => deleteRoom(room._id)} className="text-xs text-red-500 border border-red-300 px-2 py-1 rounded">Delete</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══════ TENANTS ══════ */}
        {activeTab === "tenants" && (
          <div>
            <button onClick={() => { setShowTenantForm(true); setEditTenant(null); setTenantForm({ name: "", phone: "", roomNumber: "", rentAmount: "3000", startDate: "" }); }}
              className="w-full bg-blue-600 text-white py-3 rounded-xl mb-4 font-medium">
              ➕ Naya Tenant Add Karo
            </button>

            <div className="grid gap-3">
              {tenants.map(t => {
                const tp = tenantPayments(t._id);
                const totalDue = tp.reduce((a, p) => a + (p.remainingAmount || 0), 0);
                const totalPaid = tp.reduce((a, p) => a + (p.paidAmount || 0), 0);
                return (
                  <div key={t._id} className="bg-white rounded-xl p-4 shadow">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-bold text-base">{t.name}</p>
                        <p className="text-sm text-gray-500">🏠 {t.roomNumber} | 📞 {t.phone}</p>
                        <p className="text-sm text-blue-600">₹{t.rentAmount}/month</p>
                        {t.startDate && <p className="text-xs text-gray-400">Since: {new Date(t.startDate).toLocaleDateString("en-IN")}</p>}
                      </div>
                      <div className="flex flex-col gap-1">
                        <button onClick={() => { setEditTenant(t); setTenantForm({ name: t.name, phone: t.phone || "", roomNumber: t.roomNumber, rentAmount: String(t.rentAmount), startDate: t.startDate?.slice(0, 10) || "" }); setShowTenantForm(true); }}
                          className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded">Edit</button>
                        <button onClick={() => deleteTenant(t._id)}
                          className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded">Remove</button>
                      </div>
                    </div>
                    <div className="flex justify-between text-xs mb-2">
                      <span className="text-green-600 font-medium">Paid: ₹{totalPaid}</span>
                      <span className="text-red-500 font-medium">Due: ₹{totalDue}</span>
                    </div>
                    {/* Month-wise payments */}
                    <button onClick={() => setSelectedTenant(selectedTenant?._id === t._id ? null : t)}
                      className="w-full text-xs bg-gray-100 text-gray-600 py-2 rounded-lg">
                      {selectedTenant?._id === t._id ? "▲ Band Karo" : "▼ Mahine Ka Hisaab Dekho"}
                    </button>
                    {selectedTenant?._id === t._id && (
                      <div className="mt-3 grid gap-2">
                        {tp.length === 0 ? (
                          <p className="text-center text-gray-400 text-xs py-2">Koi payment record nahi</p>
                        ) : tp.map(p => (
                          <div key={p._id} className={`rounded-lg p-3 border ${p.status === "paid" ? "border-green-200 bg-green-50" : p.status === "partial" ? "border-yellow-200 bg-yellow-50" : "border-red-200 bg-red-50"}`}>
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-medium text-sm">{p.month}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${p.status === "paid" ? "bg-green-200 text-green-700" : p.status === "partial" ? "bg-yellow-200 text-yellow-700" : "bg-red-200 text-red-700"}`}>
                                {p.status === "paid" ? "Paid ✅" : p.status === "partial" ? "Partial" : "Unpaid"}
                              </span>
                            </div>
                            <div className="flex justify-between text-xs text-gray-600">
                              <span>Paid: ₹{p.paidAmount}</span>
                              <span>Pending: ₹{p.remainingAmount}</span>
                            </div>
                            {p.paidBy && p.paidAt && (
                              <p className="text-xs text-gray-400 mt-1">
                                {p.paidBy === "cash" ? "💵 Cash" : "💳 Razorpay"} — {new Date(p.paidAt).toLocaleDateString("en-IN")}
                              </p>
                            )}
                            {p.status !== "paid" && (
                              <button onClick={() => { setPayModal(p); setPayAmount(String(p.remainingAmount)); }}
                                className="mt-2 w-full bg-blue-600 text-white text-xs py-1.5 rounded-lg">
                                💰 Payment Mark Karo
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ══════ PAYMENTS ══════ */}
        {activeTab === "payments" && (
          <div>
            <div className="grid gap-3">
              {/* Group by room/tenant — only occupied rooms */}
              {rooms.filter(r => r.status === "occupied").map(room => {
                const tenant = tenants.find(t => t.roomNumber === room.roomNumber);
                if (!tenant) return null;
                const tp = tenantPayments(tenant._id);
                const totalDue = tp.reduce((a, p) => a + (p.remainingAmount || 0), 0);
                const latestUnpaid = tp.find(p => p.status !== "paid");
                return (
                  <div key={room._id} className="bg-white rounded-xl p-4 shadow">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-bold">{room.roomNumber}</p>
                        <p className="text-sm text-gray-600">👤 {tenant.name} | 📞 {tenant.phone}</p>
                        <p className="text-xs text-gray-400">Since: {tenant.startDate ? new Date(tenant.startDate).toLocaleDateString("en-IN") : "—"}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-red-500 font-bold text-sm">₹{totalDue} due</p>
                        <p className="text-xs text-gray-400">₹{tenant.rentAmount}/month</p>
                      </div>
                    </div>

                    {/* Month wise summary */}
                    <div className="grid gap-1 mb-2">
                      {tp.map(p => (
                        <div key={p._id} className="flex justify-between items-center text-xs py-1 border-b border-gray-100">
                          <span className="text-gray-600">{p.month}</span>
                          <div className="flex items-center gap-2">
                            {p.paidBy && <span className="text-gray-400">{p.paidBy === "cash" ? "💵" : "💳"}</span>}
                            <span className={p.status === "paid" ? "text-green-600" : p.status === "partial" ? "text-yellow-600" : "text-red-500"}>
                              {p.status === "paid" ? "✅ Paid" : p.status === "partial" ? `₹${p.remainingAmount} baki` : "❌ Unpaid"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {latestUnpaid && (
                      <button onClick={() => { setPayModal(latestUnpaid); setPayAmount(String(latestUnpaid.remainingAmount)); }}
                        className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium">
                        💰 Payment Mark Karo — {latestUnpaid.month}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ══════ TENANT FORM MODAL ══════ */}
      {showTenantForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-2xl p-5 max-h-[90vh] overflow-y-auto">
            <h2 className="font-bold text-lg mb-4">{editTenant ? "✏️ Tenant Edit" : "➕ Naya Tenant"}</h2>
            <input className="border w-full p-3 rounded-lg mb-2 text-sm" placeholder="Naam *"
              value={tenantForm.name} onChange={e => setTenantForm(p => ({ ...p, name: e.target.value }))} />
            <input className="border w-full p-3 rounded-lg mb-2 text-sm" placeholder="Phone Number"
              value={tenantForm.phone} onChange={e => setTenantForm(p => ({ ...p, phone: e.target.value }))} />
            <select className="border w-full p-3 rounded-lg mb-2 text-sm bg-white"
              value={tenantForm.roomNumber} onChange={e => setTenantForm(p => ({ ...p, roomNumber: e.target.value }))}>
              <option value="">🏠 Room Select Karo *</option>
              {rooms.filter(r => r.status === "vacant" || (editTenant && r.roomNumber === editTenant.roomNumber)).map(r => (
                <option key={r._id} value={r.roomNumber}>{r.roomNumber} — ₹{r.rent}</option>
              ))}
            </select>
            <input className="border w-full p-3 rounded-lg mb-2 text-sm" placeholder="Monthly Rent" type="number"
              value={tenantForm.rentAmount} onChange={e => setTenantForm(p => ({ ...p, rentAmount: e.target.value }))} />
            <label className="text-xs text-gray-500 ml-1">Rehne Ki Start Date</label>
            <input className="border w-full p-3 rounded-lg mb-4 text-sm" type="date"
              value={tenantForm.startDate} onChange={e => setTenantForm(p => ({ ...p, startDate: e.target.value }))} />
            <div className="flex gap-2">
              <button onClick={() => { setShowTenantForm(false); setEditTenant(null); }}
                className="flex-1 border py-3 rounded-xl text-sm">Cancel</button>
              <button onClick={saveTenant} disabled={loading}
                className="flex-1 bg-blue-600 text-white py-3 rounded-xl text-sm font-medium disabled:opacity-50">
                {loading ? "..." : editTenant ? "Update Karo" : "Add Karo"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════ PAYMENT MODAL ══════ */}
      {payModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-2xl p-5">
            <h2 className="font-bold text-lg mb-1">💰 Payment Mark Karo</h2>
            <p className="text-sm text-gray-500 mb-1">
              {payModal.tenant?.name || "—"} — Room {payModal.tenant?.roomNumber || payModal.roomNumber}
            </p>
            <p className="text-sm text-gray-500 mb-3">📅 {payModal.month}</p>
            <div className="flex justify-between text-sm mb-3">
              <span className="text-green-600">Paid: ₹{payModal.paidAmount}</span>
              <span className="text-red-500">Pending: ₹{payModal.remainingAmount}</span>
            </div>
            <input className="border w-full p-3 rounded-lg mb-4 text-lg font-bold" type="number"
              placeholder="Amount" value={payAmount} onChange={e => setPayAmount(e.target.value)} />
            <p className="text-xs text-gray-400 mb-3 text-center">
              💡 Zyada amount doge toh agle mahine mein auto adjust ho jayega
            </p>
            <div className="flex gap-2 mb-3">
              <button onClick={() => markPaid("cash")} disabled={loading}
                className="flex-1 bg-green-600 text-white py-3 rounded-xl font-medium disabled:opacity-50">
                💵 Cash
              </button>
              <button onClick={() => markPaid("razorpay")} disabled={loading}
                className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-medium disabled:opacity-50">
                💳 Razorpay
              </button>
            </div>
            <button onClick={() => { setPayModal(null); setPayAmount(""); }}
              className="w-full border py-2 rounded-xl text-sm text-gray-600">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
