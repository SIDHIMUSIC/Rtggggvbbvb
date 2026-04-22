"use client";
import { useEffect, useState } from "react";

export default function Navbar() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    setIsAdmin(!!token);
  }, []);

  const logout = () => {
    localStorage.removeItem("token");
    window.location.href = "/";
  };

  return (
    <div className="bg-black px-8 py-4 flex justify-between items-center shadow-lg border-b border-blue-500">

      {/* LOGO */}
      <a href="/" className="text-xl font-bold text-blue-400 tracking-wide hover:text-blue-300 transition">
        🏠 Rent App
      </a>

      {/* NAV LINKS */}
      <div className="flex gap-6 text-sm font-semibold items-center">

        <a href="/" className="text-gray-300 hover:text-blue-400 transition duration-300">
          Dashboard
        </a>

        {isAdmin ? (
          <>
            <a href="/admin" className="text-gray-300 hover:text-purple-400 transition duration-300">
              🔐 Admin Panel
            </a>
            <a href="/tenants" className="text-gray-300 hover:text-green-400 transition duration-300">
              Tenants
            </a>
            <a href="/payments" className="text-gray-300 hover:text-yellow-400 transition duration-300">
              Payments
            </a>
            <button
              onClick={logout}
              className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-xs transition"
            >
              Logout
            </button>
          </>
        ) : (
          <a
            href="/login"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded text-xs transition"
          >
            🔐 Admin Login
          </a>
        )}

      </div>
    </div>
  );
}
