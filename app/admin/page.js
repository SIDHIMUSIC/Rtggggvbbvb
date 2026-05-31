"use client";
import { useEffect, useState } from "react";

export default function AdminPage() {
  const [tab, setTab] = useState("rooms");
  const [token, setToken] = useState("");
  const [rooms, setRooms] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = localStorage.getItem("token");
    if (!t) {
      localStorage.setItem("redirect", "/admin");
      window.location.href = "/login";
    } else {
      setToken(t);
    }
  }, []);

  useEffect(() => {
    if (token) loadAll();
  }, [token]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [r, t, p] = await Promise.all([
        fetch("/api/rooms", { headers: { Authorization: `Bearer ${token}` } }).then((x) => x.json()),
        fetch("/api/tenants", { headers: { Authorization: `Bearer ${token}` } }).then((x) => x.json()),
        fetch("/api/payments", { headers: { Authorization: `Bearer ${token}` } }).then((x) => x.json()),
      ]);
      setRooms(Array.isArray(r) ? r : []);
      setTenants(Array.isArray(t) ? t : []);
      setPayments(Array.isArray(p) ? p : []);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const logout = () => {
    localStorage.removeItem("token");
    window.location.href = "/";
  };

  if (!token) return <div className="p-10 text-center text-gray-500">Redirecting...</div>;
  if (loading) return <div className="p-10 text-center text-lg">⏳ Loading admin data...</div>;

  const totalIncome = payments.reduce((a, p) => a + (p.paidAmount || 0), 0);
  const totalPending = payments.reduce((a, p) => a + (p.remainingAmount || 0), 0);
  const occupiedRooms = rooms.filter((r) => r.status === "occupied").length;
  const vacantRooms = rooms.filter((r) => r.status === "vacant").length;

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-black text-white px-6 py-4 flex justify-between items-center border-b border-purple-500">
        <div>
          <h1 className="text-xl font-bold text-purple-400">🔐 Admin Panel</h1>
          <p className="text-xs text-gray-400">Owner Dashboard — Full Control</p>
        </div>
        <div className="flex gap-4 items-center">
          <a href="/" className="text-gray-400 hover:text-white text-sm transition">← Public Site</a>
          <button onClick={logout} className="bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 rounded text-sm transition">Logout</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 pb-0">
        <StatCard label="Total Rooms" value={rooms.length} color="bg-blue-500" icon="🏠" />
        <StatCard label="Occupied" value={occupiedRooms} color="bg-red-500" icon="🔴" />
        <StatCard label="Vacant" value={vacantRooms} color="bg-green-500" icon="🟢" />
        <StatCard label="Total Income" value={`₹${totalIncome.toLocaleString()}`} color="bg-emerald-600" icon="💰" />
        <StatCard label="Total Pending" value={`₹${totalPending.toLocaleString()}`} color="bg-orange-500" icon="⏳" />
        <StatCard label="Total Tenants" value={tenants.length} color="bg-purple-500" icon="👥" />
      </div>

      <div className="px-6 mt-6">
        <div className="flex gap-2 mb-6 flex-wrap">
          {[
            { key: "rooms", label: "🏠 Rooms" },
            { key: "tenants", label: "👥 Tenants" },
            { key: "payments", label: "💳 Payments" },
            { key: "settings", label: "⚙️ Setup Guide" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-5 py-2 rounded-lg font-semibold text-sm transition ${
                tab === t.key ? "bg-blue-600 text-white shadow" : "bg-white text-gray-600 hover:bg-gray-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "rooms" && <RoomsTab rooms={rooms} token={token} onRefresh={loadAll} />}
        {tab === "tenants" && <TenantsTab tenants={tenants} rooms={rooms} token={token} onRefresh={loadAll} />}
        {tab === "payments" && <PaymentsTab payments={payments} tenants={tenants} token={token} onRefresh={loadAll} />}
        {tab === "settings" && <SettingsTab />}
      </div>
    </div>
  );
}

function StatCard({ label, value, color, icon }) {
  return (
    <div className={`${color} text-white p-4 rounded-xl shadow`}>
      <p className="text-xs opacity-80">{icon} {label}</p>
      <h2 className="text-2xl font-bold mt-1">{value}</h2>
    </div>
  );
}

function RoomsTab({ rooms, token, onRefresh }) {
  const [form, setForm] = useState({ roomNumber: "", rent: 3000 });
  const [editMode, setEditMode] = useState(null);
  const [editRent, setEditRent] = useState("");
  const [msg, setMsg] = useState("");

  const showMsg = (m) => { setMsg(m); setTimeout(() => setMsg(""), 3000); };

  const addRoom = async () => {
    if (!form.roomNumber) return showMsg("Room number dalo ❌");
    const res = await fetch("/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(form),
    }).then((r) => r.json());
    if (res.success) { showMsg("Room add ho gaya ✅"); setForm({ roomNumber: "", rent: 3000 }); onRefresh(); }
    else showMsg(res.message || "Error ❌");
  };

  const updateRent = async (id) => {
    const res = await fetch("/api/rooms", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id, rent: Number(editRent) }),
    }).then((r) => r.json());
    if (res.success) { showMsg("Rent update ho gaya ✅"); setEditMode(null); onRefresh(); }
    else showMsg("Error ❌");
  };

  const deleteRoom = async (id, status) => {
    if (status === "occupied") return showMsg("Pehle tenant hatao, phir room delete karo ❌");
    if (!confirm("Room delete karna chahte ho?")) return;
    const res = await fetch("/api/rooms/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id }),
    }).then((r) => r.json());
    if (res.success) { showMsg("Room delete ho gaya ✅"); onRefresh(); }
    else showMsg(res.message || "Error ❌");
  };

  const floors = {};
  rooms.forEach((room) => {
    const floor = room.roomNumber.split("-")[0];
    if (!floors[floor]) floors[floor] = [];
    floors[floor].push(room);
  });

  return (
    <div>
      {msg && <div className="mb-4 p-3 bg-blue-100 border border-blue-400 rounded text-sm font-semibold">{msg}</div>}

      <div className="bg-white p-5 rounded-xl shadow mb-6">
        <h3 className="font-bold text-gray-700 mb-3">➕ Naya Room Add Karo</h3>
        <div className="flex gap-3 flex-wrap">
          <input
            placeholder="Room Number (e.g. G-1, F1-R10)"
            className="border rounded p-2 flex-1 min-w-40"
            value={form.roomNumber}
            onChange={(e) => setForm({ ...form, roomNumber: e.target.value })}
          />
          <input
            type="number"
            placeholder="Rent Amount"
            className="border rounded p-2 w-40"
            value={form.rent}
            onChange={(e) => setForm({ ...form, rent: Number(e.target.value) })}
          />
          <button onClick={addRoom} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded transition">
            Add Room
          </button>
        </div>
      </div>

      {Object.keys(floors).sort().map((floor) => (
        <div key={floor} className="mb-6">
          <h3 className="font-bold text-blue-600 mb-3 text-lg">{floor} Floor</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {floors[floor].map((room) => (
              <div key={room._id} className={`p-3 rounded-xl shadow text-sm ${
                room.status === "occupied" ? "bg-red-100 border border-red-300" : "bg-green-50 border border-green-300"
              }`}>
                <p className="font-bold text-center text-base">{room.roomNumber}</p>
                <p className={`text-center text-xs mt-1 font-semibold ${room.status === "occupied" ? "text-red-600" : "text-green-600"}`}>
                  {room.status}
                </p>
                {editMode === room._id ? (
                  <div className="mt-2">
                    <input type="number" className="border rounded w-full p-1 text-xs mb-1" value={editRent} onChange={(e) => setEditRent(e.target.value)} />
                    <div className="flex gap-1">
                      <button onClick={() => updateRent(room._id)} className="bg-green-600 text-white px-2 py-0.5 rounded text-xs flex-1">Save</button>
                      <button onClick={() => setEditMode(null)} className="bg-gray-400 text-white px-2 py-0.5 rounded text-xs">✕</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-center text-xs mt-1 text-gray-600">₹{room.rent}/mo</p>
                    {room.tenantName && <p className="text-center text-xs text-purple-700 font-semibold truncate mt-1">👤 {room.tenantName}</p>}
                    <div className="flex gap-1 mt-2 justify-center">
                      <button onClick={() => { setEditMode(room._id); setEditRent(room.rent); }} className="bg-yellow-500 text-white px-2 py-0.5 rounded text-xs">✏️</button>
                      <button onClick={() => deleteRoom(room._id, room.status)} className="bg-red-500 text-white px-2 py-0.5 rounded text-xs">🗑️</button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {rooms.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-2">🏠</p>
          <p>Koi room nahi hai. Upar form se add karo.</p>
        </div>
      )}
    </div>
  );
}

function TenantsTab({ tenants, rooms, token, onRefresh }) {
  const vacantRooms = rooms.filter((r) => r.status === "vacant");
  const [form, setForm] = useState({ name: "", phone: "", roomNumber: "", rentAmount: 3000, startDate: "" });
  const [msg, setMsg] = useState("");

  const showMsg = (m) => { setMsg(m); setTimeout(() => setMsg(""), 3000); };

  const addTenant = async () => {
    if (!form.name || !form.roomNumber) return showMsg("Name aur Room number zaroori hai ❌");
    const res = await fetch("/api/tenants", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(form),
    }).then((r) => r.json());
    if (res.success) { showMsg("Tenant add ho gaya ✅"); setForm({ name: "", phone: "", roomNumber: "", rentAmount: 3000, startDate: "" }); onRefresh(); }
    else showMsg(res.message || "Error ❌");
  };

  const editTenant = async (t) => {
    const name = prompt("Name:", t.name);
    if (!name) return;
    const phone = prompt("Phone:", t.phone);
    const rent = prompt("Rent Amount:", t.rentAmount);
    const room = prompt("Room Number:", t.roomNumber);
    const res = await fetch(`/api/tenants/${t._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name, phone, rentAmount: Number(rent), roomNumber: room }),
    }).then((r) => r.json());
    if (res.success) { showMsg("Updated ✅"); onRefresh(); }
    else showMsg(res.message || "Error ❌");
  };

  const deleteTenant = async (id) => {
    if (!confirm("Tenant delete karna chahte ho?")) return;
    const res = await fetch(`/api/tenants/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json());
    if (res.success) { showMsg("Deleted ✅"); onRefresh(); }
    else showMsg(res.message || "Error ❌");
  };

  return (
    <div>
      {msg && <div className="mb-4 p-3 bg-blue-100 border border-blue-400 rounded text-sm font-semibold">{msg}</div>}

      <div className="bg-white p-5 rounded-xl shadow mb-6">
        <h3 className="font-bold text-gray-700 mb-3">➕ Naya Tenant Add Karo</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <input placeholder="Tenant Name *" className="border rounded p-2" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input placeholder="Phone Number" className="border rounded p-2" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <select className="border rounded p-2" value={form.roomNumber} onChange={(e) => setForm({ ...form, roomNumber: e.target.value })}>
            <option value="">Room Select Karo *</option>
            {vacantRooms.map((r) => (
              <option key={r._id} value={r.roomNumber}>{r.roomNumber} (₹{r.rent})</option>
            ))}
          </select>
          <input type="number" placeholder="Rent Amount" className="border rounded p-2" value={form.rentAmount} onChange={(e) => setForm({ ...form, rentAmount: Number(e.target.value) })} />
          <input type="date" className="border rounded p-2" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
          <button onClick={addTenant} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded transition">Add Tenant</button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tenants.map((t) => (
          <div key={t._id} className="bg-white p-4 rounded-xl shadow">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-bold text-lg">{t.name}</p>
                <p className="text-gray-500 text-sm">📞 {t.phone || "—"}</p>
                <p className="text-gray-500 text-sm">🏠 Room: <strong>{t.roomNumber}</strong></p>
                <p className="text-green-600 font-semibold">💰 ₹{t.rentAmount}/month</p>
                {t.startDate && <p className="text-gray-400 text-xs mt-1">📅 Since {new Date(t.startDate).toLocaleDateString("en-IN")}</p>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => editTenant(t)} className="bg-yellow-500 hover:bg-yellow-600 text-white px-2 py-1 rounded text-xs">✏️</button>
                <button onClick={() => deleteTenant(t._id)} className="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-xs">🗑️</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {tenants.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-2">👥</p>
          <p>Koi tenant nahi hai abhi.</p>
        </div>
      )}
    </div>
  );
}

function PaymentsTab({ payments, tenants, token, onRefresh }) {
  const [selectedTenant, setSelectedTenant] = useState("");
  const [payForm, setPayForm] = useState({ tenant: "", month: "", paidAmount: 0 });
  const [msg, setMsg] = useState("");

  const showMsg = (m) => { setMsg(m); setTimeout(() => setMsg(""), 3000); };

  const filtered = payments.filter((p) => String(p.tenant?._id) === String(selectedTenant));
  const sorted = [...filtered].sort((a, b) => {
    const parse = (s) => { if (!s) return new Date(0); const [month, year] = s.split(" "); return new Date(`${month} 1, ${year}`); };
    return parse(a.month) - parse(b.month);
  });

  const totalPending = sorted.reduce((a, x) => a + (x.remainingAmount || 0), 0);
  const selectedTenantData = tenants.find((t) => t._id === selectedTenant);

  const addPayment = async () => {
    if (!payForm.tenant || payForm.paidAmount <= 0) return showMsg("Amount dalo ❌");
    const res = await fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payForm),
    }).then((r) => r.json());
    if (res.success) { showMsg("Payment save ho gayi ✅"); onRefresh(); }
    else showMsg(res.message || "Error ❌");
  };

  const markPaid = async (id) => {
    await fetch("/api/payments/mark-paid", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id }),
    });
    showMsg("Paid mark ho gaya ✅");
    onRefresh();
  };

  const deletePayment = async (id) => {
    if (!confirm("Delete karna chahte ho?")) return;
    await fetch("/api/payments/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id }),
    });
    showMsg("Deleted ✅");
    onRefresh();
  };

  const printReceipt = (p) => {
    const html = `<html><body style="font-family:Arial;padding:20px">
      <div style="border:2px solid black;padding:20px;width:350px;margin:auto">
        <h2 style="text-align:center">RENT HOUSE</h2><hr/>
        <p>Tenant: ${p.tenant?.name}</p>
        <p>Room: ${p.tenant?.roomNumber}</p>
        <p>Month: ${p.month}</p><hr/>
        <p>Total Rent: ₹${p.totalRent}</p>
        <p>Paid: ₹${p.paidAmount}</p>
        <p style="color:red">Remaining: ₹${p.remainingAmount}</p>
        <p>Status: ${p.status}</p><hr/>
        <p style="text-align:right">Sign ✍️</p>
      </div></body></html>`;
    const win = window.open("", "", "width=400,height=600");
    win.document.write(html);
    win.document.close();
    win.print();
  };

  return (
    <div>
      {msg && <div className="mb-4 p-3 bg-blue-100 border border-blue-400 rounded text-sm font-semibold">{msg}</div>}

      <div className="bg-white p-5 rounded-xl shadow mb-4">
        <h3 className="font-bold text-gray-700 mb-3">💳 Tenant Select Karo</h3>
        <select className="border rounded p-2 w-full md:w-80" value={selectedTenant}
          onChange={(e) => { setSelectedTenant(e.target.value); setPayForm({ ...payForm, tenant: e.target.value }); }}>
          <option value="">-- Tenant Select Karo --</option>
          {tenants.map((t) => (
            <option key={t._id} value={t._id}>{t.name} — Room {t.roomNumber}</option>
          ))}
        </select>
      </div>

      {selectedTenant && (
        <>
          <div className="bg-white p-5 rounded-xl shadow mb-4">
            <h3 className="font-bold text-gray-700 mb-3">➕ Payment Add Karo</h3>
            <div className="flex gap-3 flex-wrap">
              <input type="month" className="border rounded p-2"
                onChange={(e) => {
                  const d = new Date(e.target.value);
                  const month = d.toLocaleString("default", { month: "short", year: "numeric" });
                  setPayForm({ ...payForm, month });
                }} />
              <input type="number" placeholder="Amount" className="border rounded p-2 w-32"
                onChange={(e) => setPayForm({ ...payForm, paidAmount: Number(e.target.value) })} />
              <button onClick={addPayment} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded transition">Save</button>
            </div>
          </div>

          <div className="bg-red-100 border border-red-300 p-4 rounded-xl mb-4 font-bold text-red-700">
            {selectedTenantData?.name} ka Total Pending: ₹{totalPending.toLocaleString()}
          </div>

          <div className="grid gap-3">
            {sorted.map((p) => {
              const bgColor = p.status === "paid" ? "bg-green-500" : p.status === "partial" ? "bg-yellow-500" : "bg-red-500";
              return (
                <div key={p._id} className={`${bgColor} text-white p-4 rounded-xl flex justify-between items-center flex-wrap gap-2`}>
                  <div>
                    <p className="font-bold text-lg">{p.month}</p>
                    <p className="text-sm">Total: ₹{p.totalRent} | Paid: ₹{p.paidAmount}</p>
                    <p className="font-semibold">Remaining: ₹{p.remainingAmount}</p>
                    <span className="text-xs bg-white bg-opacity-20 px-2 py-0.5 rounded">{p.status}</span>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {p.status !== "paid" && (
                      <button onClick={() => markPaid(p._id)} className="bg-white text-green-700 px-3 py-1 rounded text-sm font-semibold hover:bg-gray-100">
                        💵 Cash Paid
                      </button>
                    )}
                    <button onClick={() => printReceipt(p)} className="bg-blue-800 text-white px-3 py-1 rounded text-sm hover:bg-blue-900">🧾</button>
                    <button onClick={() => deletePayment(p._id)} className="bg-black text-white px-3 py-1 rounded text-sm hover:bg-gray-800">🗑️</button>
                  </div>
                </div>
              );
            })}
          </div>

          {sorted.length === 0 && <div className="text-center py-8 text-gray-400">Koi payment record nahi hai.</div>}
        </>
      )}

      {!selectedTenant && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-2">💳</p>
          <p>Upar se tenant select karo.</p>
        </div>
      )}
    </div>
  );
}

function SettingsTab() {
  return (
    <div className="max-w-3xl space-y-6 pb-10">
      <div className="bg-white p-6 rounded-xl shadow">
        <h3 className="font-bold text-xl text-gray-800 mb-4">⚙️ Environment Variables</h3>
        <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-sm overflow-x-auto whitespace-pre-wrap">{`MONGODB_URI=mongodb+srv://...
JWT_SECRET=random_secret
ADMIN_USERNAME=admin
ADMIN_PASSWORD=strong_password
RAZORPAY_KEY_ID=rzp_live_xxx
RAZORPAY_KEY_SECRET=secret
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_live_xxx`}</pre>
      </div>
    </div>
  );
}
