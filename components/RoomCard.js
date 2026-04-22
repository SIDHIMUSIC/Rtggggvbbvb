"use client";

import { useState } from "react";

export default function RoomCard({ room }) {
  const [name, setName] = useState(room.tenantName);

  const updateRoom = async () => {
    await fetch("/api/rooms", {
      method: "POST",
      body: JSON.stringify({
        id: room._id,
        tenantName: name,
        status: name ? "occupied" : "vacant"
      })
    });

    location.reload();
  };

  return (
    <div
      className={`p-4 rounded shadow text-white ${
        room.status === "occupied"
          ? "bg-red-500"
          : "bg-green-500"
      }`}
    >
      <h2>{room.roomNumber}</h2>

      <input
        className="text-black p-1 mt-2"
        placeholder="Tenant name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <button
        onClick={updateRoom}
        className="bg-black text-white px-2 py-1 mt-2"
      >
        Save
      </button>
    </div>
  );
}
