"use client";

import { useState } from "react";

export default function TenantForm() {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    roomNumber: "",
    rentAmount: 3000,
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    const res = await fetch("/api/tenants", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",   // ✅ IMPORTANT FIX
      },
      body: JSON.stringify(form),
    });

    if (res.ok) {
      alert("Tenant Added");
      location.reload(); // refresh UI
    } else {
      alert("Error adding tenant");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
      <input
        className="border p-2"
        placeholder="Name"
        onChange={(e) => setForm({ ...form, name: e.target.value })}
      />
      <input
        className="border p-2"
        placeholder="Phone"
        onChange={(e) => setForm({ ...form, phone: e.target.value })}
      />
      <input
        className="border p-2"
        placeholder="Room (F1-R1)"
        onChange={(e) => setForm({ ...form, roomNumber: e.target.value })}
      />

      <button className="bg-blue-500 text-white px-4">Add</button>
    </form>
  );
}
