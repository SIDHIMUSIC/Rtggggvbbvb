"use client";
import { useState } from "react";

export default function Login() {
  const [form, setForm] = useState({ username: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!form.username || !form.password) {
      setError("Username aur password dono dalo ❌");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (data.success) {
        localStorage.setItem("token", data.token);
        const redirect = localStorage.getItem("redirect") || "/admin";
        localStorage.removeItem("redirect");
        window.location.href = redirect;
      } else {
        setError(data.message || "Wrong credentials ❌");
      }
    } catch (err) {
      setError("Server error ❌");
    }

    setLoading(false);
  };

  return (
    <div className="h-screen flex items-center justify-center bg-gray-950 text-white">
      <div className="w-full max-w-sm mx-4">

        {/* CARD */}
        <div className="bg-gray-900 border border-purple-500 rounded-2xl p-8 shadow-[0_0_40px_rgba(168,85,247,0.3)]">

          {/* LOGO */}
          <div className="text-center mb-8">
            <div className="text-5xl mb-3">🏠</div>
            <h1 className="text-2xl font-bold text-purple-400">Admin Login</h1>
            <p className="text-gray-400 text-sm mt-1">Rent Management System</p>
          </div>

          {/* ERROR */}
          {error && (
            <div className="bg-red-900 border border-red-500 text-red-200 text-sm p-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          {/* FORM */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Username</label>
              <input
                placeholder="Enter username"
                className="w-full bg-gray-800 border border-gray-600 focus:border-purple-500 rounded-lg p-3 text-white outline-none transition"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Password</label>
              <input
                type="password"
                placeholder="Enter password"
                className="w-full bg-gray-800 border border-gray-600 focus:border-purple-500 rounded-lg p-3 text-white outline-none transition"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              />
            </div>

            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-900 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition mt-2"
            >
              {loading ? "Logging in..." : "🔐 Login"}
            </button>
          </div>

          {/* BACK */}
          <div className="text-center mt-6">
            <a href="/" className="text-gray-500 hover:text-gray-300 text-sm transition">
              ← Back to Dashboard
            </a>
          </div>

        </div>
      </div>
    </div>
  );
}
