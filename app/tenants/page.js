"use client";
import { useEffect, useState } from "react";

export default function Page() {
  const [tenants, setTenants] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    roomNumber: "",
    rentAmount: 3000,
    startDate: "",
  });

  // 🔐 AUTH
  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      localStorage.setItem("redirect", "/tenants");
      window.location.href = "/login";
    } else {
      init(token);
    }
  }, []);

  // 🔥 INIT
  const init = async (token) => {
    await Promise.all([loadData(token), loadRooms()]);
    setLoading(false);
  };

  // ✅ LOAD TENANTS (🔥 FIXED)
  const loadData = async (token) => {
    try {
      const res = await fetch("/api/tenants", {
        headers: { Authorization: token },
        cache: "no-store", // 🔥 FIX
      });

      const data = await res.json();

      setTenants([...data]); // 🔥 FORCE UPDATE
    } catch (err) {
      console.log("TENANT LOAD ERROR:", err);
    }
  };

  // ✅ LOAD ROOMS
  const loadRooms = async () => {
    try {
      const res = await fetch("/api/rooms/available");
      const data = await res.json();

      setRooms(Array.isArray(data) ? data : []);
    } catch (err) {
      console.log("ROOM LOAD ERROR:", err);
    }
  };

  // ✅ ADD
  const handleSubmit = async (e) => {
    e.preventDefault();

    const token = localStorage.getItem("token");

    if (!form.name || !form.roomNumber) {
      alert("Fill required fields ❌");
      return;
    }

    try {
      const res = await fetch("/api/tenants", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token,
        },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (data.success) {
        alert("Added ✅");

        setForm({
          name: "",
          phone: "",
          roomNumber: "",
          rentAmount: 3000,
          startDate: "",
        });

        await init(token);
      } else {
        alert(data.message || "Error ❌");
      }
    } catch (err) {
      console.log("ADD ERROR:", err);
    }
  };

  // ✅ DELETE
  const deleteTenant = async (id) => {
    const token = localStorage.getItem("token");

    const ok = confirm("Delete?");
    if (!ok) return;

    try {
      const res = await fetch(`/api/tenants/${id}`, {
        method: "DELETE",
        headers: { Authorization: token },
      });

      const data = await res.json();

      if (data.success) {
        alert("Deleted ✅");
        await init(token);
      }
    } catch (err) {
      console.log("DELETE ERROR:", err);
    }
  };

  // ✅ EDIT (🔥 FINAL FIX)
  const editTenant = async (t) => {
    const token = localStorage.getItem("token");

    const name = prompt("Name", t.name);
    const phone = prompt("Phone", t.phone);
    const rent = prompt("Rent", t.rentAmount);
    const room = prompt("Room Number", t.roomNumber);

    if (!name || !room) {
      alert("Required ❌");
      return;
    }

    try {
      const res = await fetch(`/api/tenants/${t._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: token,
        },
        body: JSON.stringify({
          name,
          phone,
          rentAmount: Number(rent),
          roomNumber: room,
        }),
      });

      const data = await res.json();

      console.log("EDIT RESPONSE:", data);

      if (data.success) {
        alert("Updated ✅");

        await init(token);

        window.location.reload(); // 🔥 FINAL FORCE FIX
      } else {
        alert(data.message || "Error ❌");
      }
    } catch (err) {
      console.log("EDIT ERROR:", err);
    }
  };

  // 🔥 LOADING
  if (loading) {
    return <div className="p-6 text-lg">Loading...</div>;
  }

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <h1 className="text-2xl font-bold mb-6 text-blue-600">
        👥 Tenants
      </h1>

      {/* FORM */}
      <form
        onSubmit={handleSubmit}
        className="flex flex-wrap gap-3 mb-6 bg-white p-4 rounded shadow"
      >
        <input
          placeholder="Name"
          className="border p-2"
          value={form.name}
          onChange={(e) =>
            setForm({ ...form, name: e.target.value })
          }
        />

        <input
          placeholder="Phone"
          className="border p-2"
          value={form.phone}
          onChange={(e) =>
            setForm({ ...form, phone: e.target.value })
          }
        />

        <select
          className="border p-2"
          value={form.roomNumber}
          onChange={(e) =>
            setForm({ ...form, roomNumber: e.target.value })
          }
        >
          <option value="">Select Room</option>
          {rooms.map((r) => (
            <option key={r._id} value={r.roomNumber}>
              {r.roomNumber}
            </option>
          ))}
        </select>

        <input
          type="number"
          className="border p-2"
          value={form.rentAmount}
          onChange={(e) =>
            setForm({
              ...form,
              rentAmount: Number(e.target.value),
            })
          }
        />

        <input
          type="date"
          className="border p-2"
          value={form.startDate}
          onChange={(e) =>
            setForm({ ...form, startDate: e.target.value })
          }
        />

        <button className="bg-blue-500 text-white px-4 py-2 rounded">
          Add
        </button>
      </form>

      {/* LIST */}
      <div className="grid md:grid-cols-3 gap-4">
        {tenants.map((t) => (
          <div key={t._id} className="bg-white p-4 rounded shadow">
            <p className="font-bold">{t.name}</p>
            <p>{t.roomNumber}</p>
            <p>₹{t.rentAmount}</p>

            <div className="flex gap-2 mt-2">
              <button
                onClick={() => editTenant(t)}
                className="bg-yellow-500 text-white px-2"
              >
                Edit
              </button>

              <button
                onClick={() => deleteTenant(t._id)}
                className="bg-red-500 text-white px-2"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
