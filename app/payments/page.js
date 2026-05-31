"use client";
import { useEffect, useState } from "react";
import RazorpayButton from "@/components/RazorpayButton";

export default function Page() {
  const [tenants, setTenants] = useState([]);
  const [payments, setPayments] = useState([]);
  const [selectedTenant, setSelectedTenant] = useState("");
  const [token, setToken] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [form, setForm] = useState({
    tenant: "",
    month: "",
    paidAmount: 0,
  });

  // 🔐 AUTH
  useEffect(() => {
    const t = localStorage.getItem("token");
    if (!t) {
      localStorage.setItem("redirect", "/payments");
      window.location.href = "/login";
    } else {
      setToken(t);
    }
  }, []);

  // LOAD DATA
  const loadData = async (tkn) => {
    const t = await fetch("/api/tenants", {
      headers: { Authorization: tkn },
    }).then((r) => r.json());

    const p = await fetch("/api/payments", {
      headers: { Authorization: tkn },
    }).then((r) => r.json());

    setTenants(Array.isArray(t) ? t : []);
    setPayments(Array.isArray(p) ? p : []);
  };

  useEffect(() => {
    if (token) loadData(token);
  }, [token]);

  // Auto-clear success message after 3 seconds
  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(""), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  // SAVE PAYMENT
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.tenant || !form.month || form.paidAmount <= 0) {
      alert("Fill all fields ❌");
      return;
    }

    const res = await fetch("/api/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token,
      },
      body: JSON.stringify(form),
    });

    const data = await res.json();

    if (data.success) {
      setSuccessMsg("✅ Payment saved!");
      loadData(token);
      // Reset paidAmount
      setForm((prev) => ({ ...prev, paidAmount: 0 }));
    } else {
      alert("❌ " + (data.message || "Kuch galat hua"));
    }
  };

  // FILTER
  const filtered = payments.filter(
    (p) => String(p.tenant?._id) === String(selectedTenant)
  );

  // SORT by month ascending
  const sorted = [...filtered].sort((a, b) => {
    const parseMonth = (str) => {
      if (!str) return new Date(0);
      const [month, year] = str.split(" ");
      return new Date(`${month} 1, ${year}`);
    };
    return parseMonth(a.month) - parseMonth(b.month);
  });

  const totalPending = sorted.reduce(
    (a, x) => a + (x.remainingAmount || 0),
    0
  );

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <h1 className="text-2xl font-bold mb-4 text-blue-600">
        💳 Payments
      </h1>

      {/* SUCCESS MESSAGE */}
      {successMsg && (
        <div className="mb-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
          {successMsg}
        </div>
      )}

      {/* FORM */}
      <form
        onSubmit={handleSubmit}
        className="flex gap-3 flex-wrap mb-6 bg-white p-4 rounded shadow"
      >
        <select
          className="border p-2"
          value={selectedTenant}
          onChange={(e) => {
            setSelectedTenant(e.target.value);
            setForm({ ...form, tenant: e.target.value });
          }}
        >
          <option value="">Select Tenant</option>
          {tenants.map((t) => (
            <option key={t._id} value={t._id}>
              {t.name} ({t.roomNumber})
            </option>
          ))}
        </select>

        <input
          type="month"
          className="border p-2"
          onChange={(e) => {
            const date = new Date(e.target.value + "-01");
            const month = date.toLocaleString("default", {
              month: "short",
            });
            const year = date.getFullYear();
            setForm({ ...form, month: `${month} ${year}` });
          }}
        />

        <input
          type="number"
          placeholder="Paid Amount"
          className="border p-2"
          value={form.paidAmount || ""}
          onChange={(e) =>
            setForm({
              ...form,
              paidAmount: Number(e.target.value),
            })
          }
        />

        <button
          type="submit"
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 active:scale-95 transition"
        >
          Save
        </button>
      </form>

      {!selectedTenant && (
        <p className="text-gray-500">👆 Select tenant to see payments</p>
      )}

      {selectedTenant && (
        <>
          <div className="bg-red-100 p-3 mb-4 rounded font-bold text-red-700">
            Total Pending: ₹{totalPending}
          </div>

          {sorted.length === 0 && (
            <p className="text-gray-500 text-center py-8">
              Koi payment record nahi hai abhi.
            </p>
          )}

          <div className="grid gap-3">
            {sorted.map((p) => {
              let bg = "bg-red-500";
              if (p.status === "paid") bg = "bg-green-500";
              else if (p.status === "partial") bg = "bg-yellow-500";

              return (
                <div
                  key={p._id}
                  className={`p-4 rounded text-white flex justify-between items-center ${bg}`}
                >
                  {/* LEFT */}
                  <div>
                    <p className="font-bold">{p.month}</p>
                    <p className="text-sm">Total: ₹{p.totalRent}</p>
                    <p className="text-sm">Paid: ₹{p.paidAmount}</p>
                    <p className="text-sm">Remaining: ₹{p.remainingAmount}</p>
                  </div>

                  {/* RIGHT BUTTONS */}
                  <div className="flex gap-2 flex-wrap justify-end">

                    {/* 💳 Razorpay Online Pay */}
                    {p.status !== "paid" && (
                      <RazorpayButton
                        paymentId={p._id}
                        amount={p.remainingAmount}
                        tenantName={p.tenant?.name || "Tenant"}
                        month={p.month}
                        onSuccess={() => {
                          setSuccessMsg("✅ Razorpay payment successful!");
                          loadData(token);
                        }}
                      />
                    )}

                    {/* 💵 Cash Mark Paid */}
                    {p.status !== "paid" && (
                      <button
                        onClick={async () => {
                          try {
                            const res = await fetch("/api/payments/mark-paid", {
                              method: "POST",
                              headers: {
                                "Content-Type": "application/json",
                                Authorization: token,
                              },
                              body: JSON.stringify({ id: p._id }),
                            });
                            const data = await res.json();
                            if (data.success) {
                              setSuccessMsg("✅ Cash payment marked!");
                              loadData(token);
                            } else {
                              alert("❌ " + (data.message || "Error hua"));
                            }
                          } catch (err) {
                            alert("❌ Network error: " + err.message);
                          }
                        }}
                        className="bg-white text-green-600 px-3 py-1 rounded text-sm font-semibold hover:bg-green-50 active:scale-95 transition"
                        title="Cash mila — mark as paid"
                      >
                        💵 Cash
                      </button>
                    )}

                    {/* ✏️ Add partial payment */}
                    {p.status !== "paid" && (
                      <button
                        onClick={async () => {
                          const amt = prompt(
                            `Kitna amount mila? (Remaining: ₹${p.remainingAmount})`
                          );
                          if (!amt || isNaN(Number(amt)) || Number(amt) <= 0) return;

                          try {
                            const res = await fetch("/api/payments", {
                              method: "POST",
                              headers: {
                                "Content-Type": "application/json",
                                Authorization: token,
                              },
                              body: JSON.stringify({
                                tenant: p.tenant._id,
                                month: p.month,
                                paidAmount: Number(amt),
                              }),
                            });
                            const data = await res.json();
                            if (data.success) {
                              setSuccessMsg("✅ Partial payment saved!");
                              loadData(token);
                            } else {
                              alert("❌ " + (data.message || "Error"));
                            }
                          } catch (err) {
                            alert("❌ " + err.message);
                          }
                        }}
                        className="bg-yellow-400 text-black px-2 py-1 rounded hover:bg-yellow-300 active:scale-95 transition"
                        title="Partial amount add karo"
                      >
                        ✏️
                      </button>
                    )}

                    {/* 🧾 RECEIPT */}
                    <button
                      onClick={() => {
                        const html = `
                        <html>
                        <head><title>Receipt - ${p.tenant?.name}</title></head>
                        <body style="font-family:Arial;padding:20px">
                          <div style="border:2px solid black;padding:20px;width:350px;margin:auto">
                            <h2 style="text-align:center;color:#1e40af">
                              HARRY RENT HOUSE
                            </h2>
                            <p style="text-align:center;margin-top:-10px;font-size:13px">
                              Bihar Sharif, 803216
                            </p>
                            <hr/>
                            <p><b>Tenant:</b> ${p.tenant?.name}</p>
                            <p><b>Room:</b> ${p.tenant?.roomNumber}</p>
                            <p><b>Month:</b> ${p.month}</p>
                            <hr/>
                            <p><b>Total Rent:</b> ₹${p.totalRent}</p>
                            <p><b>Paid Amount:</b> ₹${p.paidAmount}</p>
                            <p><b>Remaining:</b> ₹${p.remainingAmount}</p>
                            <p><b>Status:</b> ${p.status?.toUpperCase()}</p>
                            <hr/>
                            <p style="text-align:right;margin-top:30px">
                              Authorized Signature ✍️
                            </p>
                          </div>
                        </body>
                        </html>
                        `;
                        const win = window.open("", "_blank", "width=450,height=650");
                        win.document.write(html);
                        win.document.close();
                        win.print();
                      }}
                      className="bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-400 active:scale-95 transition"
                      title="Print receipt"
                    >
                      🧾
                    </button>

                    {/* ❌ DELETE */}
                    <button
                      onClick={async () => {
                        const ok = confirm(
                          `${p.month} ka payment delete karna chahte ho?`
                        );
                        if (!ok) return;

                        try {
                          await fetch("/api/payments/delete", {
                            method: "POST",
                            headers: {
                              "Content-Type": "application/json",
                              Authorization: token,
                            },
                            body: JSON.stringify({ id: p._id }),
                          });
                          setSuccessMsg("🗑️ Payment deleted");
                          loadData(token);
                        } catch (err) {
                          alert("❌ " + err.message);
                        }
                      }}
                      className="bg-black text-white px-2 py-1 rounded hover:bg-gray-800 active:scale-95 transition"
                      title="Delete payment"
                    >
                      ❌
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
