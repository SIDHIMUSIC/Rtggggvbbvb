"use client";
import { useEffect, useState } from "react";
import RazorpayButton from "@/components/RazorpayButton";

// =============================================
// MAIN ADMIN PAGE
// =============================================
export default function AdminPage() {
  const [tab, setTab] = useState("rooms");
  const [token, setToken] = useState("");
  const [rooms, setRooms] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  // 🔐 AUTH CHECK
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
        fetch("/api/rooms", { headers: { Authorization: token } }).then((x) => x.json()),
        fetch("/api/tenants", { headers: { Authorization: token } }).then((x) => x.json()),
        fetch("/api/payments", { headers: { Authorization: token } }).then((x) => x.json()),
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

  // Stats
  const totalIncome = payments.reduce((a, p) => a + (p.paidAmount || 0), 0);
  const totalPending = payments.reduce((a, p) => a + (p.remainingAmount || 0), 0);
  const occupiedRooms = rooms.filter((r) => r.status === "occupied").length;
  const vacantRooms = rooms.filter((r) => r.status === "vacant").length;

  return (
    <div className="min-h-screen bg-gray-100">

      {/* ── HEADER ── */}
      <div className="bg-black text-white px-6 py-4 flex justify-between items-center border-b border-purple-500">
        <div>
          <h1 className="text-xl font-bold text-purple-400">🔐 Admin Panel</h1>
          <p className="text-xs text-gray-400">Owner Dashboard — Full Control</p>
        </div>
        <div className="flex gap-4 items-center">
          <a href="/" className="text-gray-400 hover:text-white text-sm transition">
            ← Public Site
          </a>
          <button
            onClick={logout}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 rounded text-sm transition"
          >
            Logout
          </button>
        </div>
      </div>

      {/* ── STATS ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 pb-0">
        <StatCard label="Total Rooms" value={rooms.length} color="bg-blue-500" icon="🏠" />
        <StatCard label="Occupied" value={occupiedRooms} color="bg-red-500" icon="🔴" />
        <StatCard label="Vacant" value={vacantRooms} color="bg-green-500" icon="🟢" />
        <StatCard label="Total Income" value={`₹${totalIncome.toLocaleString()}`} color="bg-emerald-600" icon="💰" />
        <StatCard label="Total Pending" value={`₹${totalPending.toLocaleString()}`} color="bg-orange-500" icon="⏳" />
        <StatCard label="Total Tenants" value={tenants.length} color="bg-purple-500" icon="👥" />
      </div>

      {/* ── TABS ── */}
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
                tab === t.key
                  ? "bg-blue-600 text-white shadow"
                  : "bg-white text-gray-600 hover:bg-gray-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── TAB CONTENT ── */}
        {tab === "rooms" && (
          <RoomsTab rooms={rooms} token={token} onRefresh={loadAll} />
        )}
        {tab === "tenants" && (
          <TenantsTab tenants={tenants} rooms={rooms} token={token} onRefresh={loadAll} />
        )}
        {tab === "payments" && (
          <PaymentsTab payments={payments} tenants={tenants} token={token} onRefresh={loadAll} />
        )}
        {tab === "settings" && <SettingsTab />}
      </div>
    </div>
  );
}

// =============================================
// STAT CARD
// =============================================
function StatCard({ label, value, color, icon }) {
  return (
    <div className={`${color} text-white p-4 rounded-xl shadow`}>
      <p className="text-xs opacity-80">{icon} {label}</p>
      <h2 className="text-2xl font-bold mt-1">{value}</h2>
    </div>
  );
}

// =============================================
// ROOMS TAB
// =============================================
function RoomsTab({ rooms, token, onRefresh }) {
  const [form, setForm] = useState({ roomNumber: "", rent: 3000 });
  const [editMode, setEditMode] = useState(null); // room._id
  const [editRent, setEditRent] = useState("");
  const [msg, setMsg] = useState("");

  const showMsg = (m) => {
    setMsg(m);
    setTimeout(() => setMsg(""), 3000);
  };

  // ADD ROOM
  const addRoom = async () => {
    if (!form.roomNumber) return showMsg("Room number dalo ❌");
    const res = await fetch("/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: token },
      body: JSON.stringify(form),
    }).then((r) => r.json());

    if (res.success) {
      showMsg("Room add ho gaya ✅");
      setForm({ roomNumber: "", rent: 3000 });
      onRefresh();
    } else {
      showMsg(res.message || "Error ❌");
    }
  };

  // UPDATE RENT
  const updateRent = async (id) => {
    const res = await fetch("/api/rooms", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: token },
      body: JSON.stringify({ id, rent: Number(editRent) }),
    }).then((r) => r.json());

    if (res.success) {
      showMsg("Rent update ho gaya ✅");
      setEditMode(null);
      onRefresh();
    } else {
      showMsg("Error ❌");
    }
  };

  // DELETE ROOM
  const deleteRoom = async (id, status) => {
    if (status === "occupied") {
      return showMsg("Pehle tenant hatao, phir room delete karo ❌");
    }
    if (!confirm("Room delete karna chahte ho?")) return;

    const res = await fetch("/api/rooms/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: token },
      body: JSON.stringify({ id }),
    }).then((r) => r.json());

    if (res.success) {
      showMsg("Room delete ho gaya ✅");
      onRefresh();
    } else {
      showMsg(res.message || "Error ❌");
    }
  };

  // Group by floor
  const floors = {};
  rooms.forEach((room) => {
    const floor = room.roomNumber.split("-")[0];
    if (!floors[floor]) floors[floor] = [];
    floors[floor].push(room);
  });

  return (
    <div>
      {msg && (
        <div className="mb-4 p-3 bg-blue-100 border border-blue-400 rounded text-sm font-semibold">
          {msg}
        </div>
      )}

      {/* ADD ROOM FORM */}
      <div className="bg-white p-5 rounded-xl shadow mb-6">
        <h3 className="font-bold text-gray-700 mb-3">➕ Naya Room Add Karo</h3>
        <div className="flex gap-3 flex-wrap">
          <input
            placeholder="Room Number (e.g. G-1, 1-101)"
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
          <button
            onClick={addRoom}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded transition"
          >
            Add Room
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          💡 Room number format: <strong>Floor-RoomNo</strong> jaise G-1, G-2, 1-101, 2-201
        </p>
      </div>

      {/* ROOMS LIST */}
      {Object.keys(floors).sort().map((floor) => (
        <div key={floor} className="mb-6">
          <h3 className="font-bold text-blue-600 mb-3 text-lg">{floor} Floor</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {floors[floor].map((room) => (
              <div
                key={room._id}
                className={`p-3 rounded-xl shadow text-sm ${
                  room.status === "occupied"
                    ? "bg-red-100 border border-red-300"
                    : "bg-green-50 border border-green-300"
                }`}
              >
                <p className="font-bold text-center text-base">{room.roomNumber}</p>
                <p className={`text-center text-xs mt-1 font-semibold ${
                  room.status === "occupied" ? "text-red-600" : "text-green-600"
                }`}>
                  {room.status}
                </p>

                {editMode === room._id ? (
                  <div className="mt-2">
                    <input
                      type="number"
                      className="border rounded w-full p-1 text-xs mb-1"
                      value={editRent}
                      onChange={(e) => setEditRent(e.target.value)}
                    />
                    <div className="flex gap-1">
                      <button
                        onClick={() => updateRent(room._id)}
                        className="bg-green-600 text-white px-2 py-0.5 rounded text-xs flex-1"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditMode(null)}
                        className="bg-gray-400 text-white px-2 py-0.5 rounded text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-center text-xs mt-1 text-gray-600">₹{room.rent}/mo</p>
                    {room.tenantName && (
                      <p className="text-center text-xs text-purple-700 font-semibold truncate mt-1">
                        👤 {room.tenantName}
                      </p>
                    )}
                    <div className="flex gap-1 mt-2 justify-center">
                      <button
                        onClick={() => { setEditMode(room._id); setEditRent(room.rent); }}
                        className="bg-yellow-500 text-white px-2 py-0.5 rounded text-xs"
                        title="Edit Rent"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => deleteRoom(room._id, room.status)}
                        className="bg-red-500 text-white px-2 py-0.5 rounded text-xs"
                        title="Delete Room"
                      >
                        🗑️
                      </button>
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

// =============================================
// TENANTS TAB
// =============================================
function TenantsTab({ tenants, rooms, token, onRefresh }) {
  const vacantRooms = rooms.filter((r) => r.status === "vacant");
  const [form, setForm] = useState({
    name: "", phone: "", roomNumber: "", rentAmount: 3000, startDate: "",
  });
  const [msg, setMsg] = useState("");

  const showMsg = (m) => { setMsg(m); setTimeout(() => setMsg(""), 3000); };

  // ADD
  const addTenant = async () => {
    if (!form.name || !form.roomNumber) return showMsg("Name aur Room number zaroori hai ❌");
    const res = await fetch("/api/tenants", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: token },
      body: JSON.stringify(form),
    }).then((r) => r.json());
    if (res.success) {
      showMsg("Tenant add ho gaya ✅");
      setForm({ name: "", phone: "", roomNumber: "", rentAmount: 3000, startDate: "" });
      onRefresh();
    } else {
      showMsg(res.message || "Error ❌");
    }
  };

  // EDIT
  const editTenant = async (t) => {
    const name = prompt("Name:", t.name);
    if (!name) return;
    const phone = prompt("Phone:", t.phone);
    const rent = prompt("Rent Amount:", t.rentAmount);
    const room = prompt("Room Number:", t.roomNumber);

    const res = await fetch(`/api/tenants/${t._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: token },
      body: JSON.stringify({ name, phone, rentAmount: Number(rent), roomNumber: room }),
    }).then((r) => r.json());

    if (res.success) { showMsg("Updated ✅"); onRefresh(); }
    else showMsg(res.message || "Error ❌");
  };

  // DELETE
  const deleteTenant = async (id) => {
    if (!confirm("Tenant delete karna chahte ho? Iske saath sare payments bhi rahenge.")) return;
    const res = await fetch(`/api/tenants/${id}`, {
      method: "DELETE",
      headers: { Authorization: token },
    }).then((r) => r.json());
    if (res.success) { showMsg("Deleted ✅"); onRefresh(); }
    else showMsg(res.message || "Error ❌");
  };

  return (
    <div>
      {msg && (
        <div className="mb-4 p-3 bg-blue-100 border border-blue-400 rounded text-sm font-semibold">{msg}</div>
      )}

      {/* ADD TENANT FORM */}
      <div className="bg-white p-5 rounded-xl shadow mb-6">
        <h3 className="font-bold text-gray-700 mb-3">➕ Naya Tenant Add Karo</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <input
            placeholder="Tenant Name *"
            className="border rounded p-2"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            placeholder="Phone Number"
            className="border rounded p-2"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <select
            className="border rounded p-2"
            value={form.roomNumber}
            onChange={(e) => setForm({ ...form, roomNumber: e.target.value })}
          >
            <option value="">Room Select Karo *</option>
            {vacantRooms.map((r) => (
              <option key={r._id} value={r.roomNumber}>
                {r.roomNumber} (₹{r.rent})
              </option>
            ))}
          </select>
          <input
            type="number"
            placeholder="Rent Amount"
            className="border rounded p-2"
            value={form.rentAmount}
            onChange={(e) => setForm({ ...form, rentAmount: Number(e.target.value) })}
          />
          <input
            type="date"
            className="border rounded p-2"
            value={form.startDate}
            onChange={(e) => setForm({ ...form, startDate: e.target.value })}
          />
          <button
            onClick={addTenant}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded transition"
          >
            Add Tenant
          </button>
        </div>
      </div>

      {/* TENANT LIST */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tenants.map((t) => (
          <div key={t._id} className="bg-white p-4 rounded-xl shadow">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-bold text-lg">{t.name}</p>
                <p className="text-gray-500 text-sm">📞 {t.phone || "—"}</p>
                <p className="text-gray-500 text-sm">🏠 Room: <strong>{t.roomNumber}</strong></p>
                <p className="text-green-600 font-semibold">💰 ₹{t.rentAmount}/month</p>
                {t.startDate && (
                  <p className="text-gray-400 text-xs mt-1">
                    📅 Since {new Date(t.startDate).toLocaleDateString("en-IN")}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => editTenant(t)}
                  className="bg-yellow-500 hover:bg-yellow-600 text-white px-2 py-1 rounded text-xs"
                >
                  ✏️
                </button>
                <button
                  onClick={() => deleteTenant(t._id)}
                  className="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-xs"
                >
                  🗑️
                </button>
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

// =============================================
// PAYMENTS TAB
// =============================================
function PaymentsTab({ payments, tenants, token, onRefresh }) {
  const [selectedTenant, setSelectedTenant] = useState("");
  const [payForm, setPayForm] = useState({ tenant: "", month: "", paidAmount: 0 });
  const [msg, setMsg] = useState("");

  const showMsg = (m) => { setMsg(m); setTimeout(() => setMsg(""), 3000); };

  const filtered = payments.filter(
    (p) => String(p.tenant?._id) === String(selectedTenant)
  );

  const sorted = [...filtered].sort((a, b) => {
    const parse = (s) => {
      if (!s) return new Date(0);
      const [month, year] = s.split(" ");
      return new Date(`${month} 1, ${year}`);
    };
    return parse(a.month) - parse(b.month);
  });

  const totalPending = sorted.reduce((a, x) => a + (x.remainingAmount || 0), 0);
  const selectedTenantData = tenants.find((t) => t._id === selectedTenant);

  // ADD PAYMENT
  const addPayment = async () => {
    if (!payForm.tenant || payForm.paidAmount <= 0) return showMsg("Amount dalo ❌");
    const res = await fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: token },
      body: JSON.stringify(payForm),
    }).then((r) => r.json());
    if (res.success) { showMsg("Payment save ho gayi ✅"); onRefresh(); }
    else showMsg(res.message || "Error ❌");
  };

  // MARK PAID
  const markPaid = async (id) => {
    await fetch("/api/payments/mark-paid", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: token },
      body: JSON.stringify({ id }),
    });
    showMsg("Paid mark ho gaya ✅");
    onRefresh();
  };

  // DELETE PAYMENT
  const deletePayment = async (id) => {
    if (!confirm("Delete karna chahte ho?")) return;
    await fetch("/api/payments/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: token },
      body: JSON.stringify({ id }),
    });
    showMsg("Deleted ✅");
    onRefresh();
  };

  // RECEIPT PRINT
  const printReceipt = (p) => {
    const ownerName = "RENT HOUSE"; // Apna naam yahan dalo
    const html = `
      <html><body style="font-family:Arial;padding:20px">
        <div style="border:2px solid black;padding:20px;width:350px;margin:auto">
          <h2 style="text-align:center">${ownerName}</h2>
          <hr/>
          <p>Tenant: ${p.tenant?.name}</p>
          <p>Room: ${p.tenant?.roomNumber}</p>
          <p>Month: ${p.month}</p>
          <hr/>
          <p>Total Rent: ₹${p.totalRent}</p>
          <p>Paid: ₹${p.paidAmount}</p>
          <p style="color:red">Remaining: ₹${p.remainingAmount}</p>
          <p>Status: ${p.status}</p>
          <hr/>
          <p style="text-align:right">Sign ✍️</p>
        </div>
      </body></html>
    `;
    const win = window.open("", "", "width=400,height=600");
    win.document.write(html);
    win.document.close();
    win.print();
  };

  return (
    <div>
      {msg && (
        <div className="mb-4 p-3 bg-blue-100 border border-blue-400 rounded text-sm font-semibold">{msg}</div>
      )}

      {/* SELECT TENANT */}
      <div className="bg-white p-5 rounded-xl shadow mb-4">
        <h3 className="font-bold text-gray-700 mb-3">💳 Tenant Select Karo</h3>
        <select
          className="border rounded p-2 w-full md:w-80"
          value={selectedTenant}
          onChange={(e) => {
            setSelectedTenant(e.target.value);
            setPayForm({ ...payForm, tenant: e.target.value });
          }}
        >
          <option value="">-- Tenant Select Karo --</option>
          {tenants.map((t) => (
            <option key={t._id} value={t._id}>
              {t.name} — Room {t.roomNumber}
            </option>
          ))}
        </select>
      </div>

      {selectedTenant && (
        <>
          {/* ADD PAYMENT */}
          <div className="bg-white p-5 rounded-xl shadow mb-4">
            <h3 className="font-bold text-gray-700 mb-3">➕ Payment Add Karo</h3>
            <div className="flex gap-3 flex-wrap">
              <input
                type="month"
                className="border rounded p-2"
                onChange={(e) => {
                  const d = new Date(e.target.value);
                  const month = d.toLocaleString("default", { month: "short", year: "numeric" });
                  setPayForm({ ...payForm, month });
                }}
              />
              <input
                type="number"
                placeholder="Amount"
                className="border rounded p-2 w-32"
                onChange={(e) => setPayForm({ ...payForm, paidAmount: Number(e.target.value) })}
              />
              <button
                onClick={addPayment}
                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded transition"
              >
                Save
              </button>
            </div>
          </div>

          {/* PENDING SUMMARY */}
          <div className="bg-red-100 border border-red-300 p-4 rounded-xl mb-4 font-bold text-red-700">
            {selectedTenantData?.name} ka Total Pending: ₹{totalPending.toLocaleString()}
          </div>

          {/* PAYMENT LIST */}
          <div className="grid gap-3">
            {sorted.map((p) => {
              const bgColor =
                p.status === "paid"
                  ? "bg-green-500"
                  : p.status === "partial"
                  ? "bg-yellow-500"
                  : "bg-red-500";

              return (
                <div
                  key={p._id}
                  className={`${bgColor} text-white p-4 rounded-xl flex justify-between items-center flex-wrap gap-2`}
                >
                  <div>
                    <p className="font-bold text-lg">{p.month}</p>
                    <p className="text-sm">Total: ₹{p.totalRent} | Paid: ₹{p.paidAmount}</p>
                    <p className="font-semibold">Remaining: ₹{p.remainingAmount}</p>
                    <span className="text-xs bg-white bg-opacity-20 px-2 py-0.5 rounded">
                      {p.status}
                    </span>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {p.status !== "paid" && (
                      <>
                        {/* 💳 Razorpay Pay — online payment */}
                        <RazorpayButton
                          paymentId={p._id}
                          amount={p.remainingAmount}
                          tenantName={p.tenant?.name || "Tenant"}
                          month={p.month}
                          onSuccess={() => { showMsg("Payment successful ✅"); onRefresh(); }}
                          className="text-sm px-3 py-1"
                        />
                        {/* ✅ Manual mark paid */}
                        <button
                          onClick={() => markPaid(p._id)}
                          className="bg-white text-green-700 px-3 py-1 rounded text-sm font-semibold hover:bg-gray-100"
                          title="Manually Mark as Paid (cash)"
                        >
                          💵 Cash
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => printReceipt(p)}
                      className="bg-blue-800 text-white px-3 py-1 rounded text-sm hover:bg-blue-900"
                      title="Print Receipt"
                    >
                      🧾
                    </button>
                    <button
                      onClick={() => deletePayment(p._id)}
                      className="bg-black text-white px-3 py-1 rounded text-sm hover:bg-gray-800"
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {sorted.length === 0 && (
            <div className="text-center py-8 text-gray-400">Koi payment record nahi hai.</div>
          )}
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

// =============================================
// SETTINGS TAB (Setup Guide)
// =============================================
function SettingsTab() {
  return (
    <div className="max-w-3xl space-y-6 pb-10">

      {/* ENV SETUP */}
      <div className="bg-white p-6 rounded-xl shadow">
        <h3 className="font-bold text-xl text-gray-800 mb-4">⚙️ .env.local Setup Guide</h3>
        <p className="text-gray-500 text-sm mb-4">
          Apne project ke root folder mein <code className="bg-gray-100 px-1 rounded">.env.local</code> file mein ye sab add karo:
        </p>
        <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-sm overflow-x-auto whitespace-pre-wrap">
{`# ── MongoDB ──────────────────────────────
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/

# ── JWT Secret (koi bhi random string) ───
JWT_SECRET=MyRentApp@2026#SecureKey!

# ── Admin Login Credentials ───────────────
ADMIN_USERNAME=admin
ADMIN_PASSWORD=apna_strong_password_yahan

# ── Razorpay Keys ─────────────────────────
RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=apna_razorpay_secret_yahan
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxx`}
        </pre>
      </div>

      {/* MONGODB SETUP */}
      <div className="bg-white p-6 rounded-xl shadow">
        <h3 className="font-bold text-xl text-gray-800 mb-3">🍃 MongoDB Atlas Setup</h3>
        <ol className="list-decimal list-inside space-y-2 text-gray-600 text-sm">
          <li>
            <a href="https://cloud.mongodb.com" target="_blank" className="text-blue-600 underline">
              mongodb.com/cloud/atlas
            </a> pe jaao — free account banao
          </li>
          <li>New Cluster banao (Free tier — M0)</li>
          <li>Database Access → New User → username/password set karo</li>
          <li>Network Access → Add IP Address → <strong>0.0.0.0/0</strong> (anywhere)</li>
          <li>Connect → Connect your application → Connection string copy karo</li>
          <li>
            String mein <code className="bg-gray-100 px-1">{"<password>"}</code> ko apne real password se replace karo
          </li>
          <li>Ye string <code className="bg-gray-100 px-1">MONGODB_URI=</code> ke baad dalo</li>
        </ol>
      </div>

      {/* RAZORPAY SETUP */}
      <div className="bg-white p-6 rounded-xl shadow">
        <h3 className="font-bold text-xl text-gray-800 mb-3">💳 Razorpay Setup</h3>
        <ol className="list-decimal list-inside space-y-2 text-gray-600 text-sm">
          <li>
            <a href="https://dashboard.razorpay.com/signup" target="_blank" className="text-blue-600 underline">
              razorpay.com
            </a> pe account banao (free)
          </li>
          <li>Dashboard → Settings → API Keys</li>
          <li><strong>Generate Test Key</strong> click karo (testing ke liye)</li>
          <li>
            <code className="bg-gray-100 px-1">Key ID</code> → <code className="bg-gray-100 px-1">RAZORPAY_KEY_ID</code> mein dalo
          </li>
          <li>
            <code className="bg-gray-100 px-1">Key Secret</code> → <code className="bg-gray-100 px-1">RAZORPAY_KEY_SECRET</code> mein dalo
          </li>
          <li>Live payments ke liye KYC complete karo phir Live Keys use karo</li>
        </ol>
        <div className="mt-4 bg-yellow-50 border border-yellow-300 p-3 rounded text-sm">
          <strong>⚠️ Test Mode:</strong> Test keys <code>rzp_test_...</code> se shuru hoti hain,
          Live keys <code>rzp_live_...</code> se. Pehle test karo, phir live karo.
        </div>
      </div>

      {/* ADMIN PASSWORD CHANGE */}
      <div className="bg-white p-6 rounded-xl shadow">
        <h3 className="font-bold text-xl text-gray-800 mb-3">🔑 Admin Password Change Kaise Karein</h3>
        <ol className="list-decimal list-inside space-y-2 text-gray-600 text-sm">
          <li>
            <code className="bg-gray-100 px-1">.env.local</code> file open karo
          </li>
          <li>
            <code className="bg-gray-100 px-1">ADMIN_USERNAME</code> aur{" "}
            <code className="bg-gray-100 px-1">ADMIN_PASSWORD</code> change karo
          </li>
          <li>Server restart karo: <code className="bg-gray-100 px-1">npm run dev</code></li>
          <li>Vercel/server pe deploy hai to Environment Variables update karo</li>
        </ol>
      </div>

      {/* DEPLOY */}
      <div className="bg-white p-6 rounded-xl shadow">
        <h3 className="font-bold text-xl text-gray-800 mb-3">🚀 Vercel Deploy (Free Hosting)</h3>
        <ol className="list-decimal list-inside space-y-2 text-gray-600 text-sm">
          <li>
            <a href="https://vercel.com" target="_blank" className="text-blue-600 underline">
              vercel.com
            </a> pe account banao (GitHub se login karo)
          </li>
          <li>New Project → GitHub repo import karo</li>
          <li>Environment Variables section mein apne sare env vars dalo</li>
          <li>Deploy click karo — 2-3 minute mein live ho jayega!</li>
        </ol>
      </div>

    </div>
  );
}
