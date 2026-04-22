"use client";
import RazorpayButton from "@/components/RazorpayButton";

// =====================================================
// Public room page pe payments + Pay Now buttons
// =====================================================
export default function RoomPayClient({ payments, tenant }) {
  const totalPending = payments.reduce(
    (a, p) => a + (p.remainingAmount || 0),
    0
  );

  return (
    <div className="bg-black text-white p-4 rounded-xl">
      <h2 className="text-yellow-400 mb-3 text-lg font-bold">
        💳 Payments
      </h2>

      {payments.map((p) => (
        <div key={p._id} className="border-b border-gray-700 py-3">
          <div className="flex justify-between items-start flex-wrap gap-2">

            {/* LEFT — info */}
            <div>
              <p className="font-bold text-base">{p.month}</p>
              <p className="text-gray-300 text-sm">
                Total: ₹{p.totalRent?.toLocaleString("en-IN")}
              </p>
              <p className="text-green-400 text-sm">
                Paid: ₹{p.paidAmount?.toLocaleString("en-IN")}
              </p>
              {p.remainingAmount > 0 && (
                <p className="text-red-400 text-sm font-semibold">
                  Remaining: ₹{p.remainingAmount?.toLocaleString("en-IN")}
                </p>
              )}
              <span
                className={`text-xs px-2 py-0.5 rounded-full mt-1 inline-block ${
                  p.status === "paid"
                    ? "bg-green-700 text-green-200"
                    : p.status === "partial"
                    ? "bg-yellow-700 text-yellow-200"
                    : "bg-red-800 text-red-200"
                }`}
              >
                {p.status}
              </span>

              {/* Razorpay payment ID show karo */}
              {p.razorpayPaymentId && (
                <p className="text-gray-500 text-xs mt-1">
                  🧾 ID: {p.razorpayPaymentId}
                </p>
              )}
            </div>

            {/* RIGHT — Pay Now button */}
            {p.remainingAmount > 0 && (
              <RazorpayButton
                paymentId={p._id.toString()}
                amount={p.remainingAmount}
                tenantName={tenant?.name || "Tenant"}
                month={p.month}
                onSuccess={() => window.location.reload()}
              />
            )}

            {p.status === "paid" && (
              <span className="text-green-400 text-sm font-semibold">✅ Paid</span>
            )}
          </div>
        </div>
      ))}

      {/* Total pending */}
      <div className="mt-4 flex justify-between items-center border-t border-gray-700 pt-3">
        <p className="text-red-400 font-bold text-lg">
          Total Pending: ₹{totalPending.toLocaleString("en-IN")}
        </p>
        {totalPending > 0 && (
          <span className="text-xs text-gray-400">
            ↑ Upar "Pay" button se har mahine ka payment karo
          </span>
        )}
      </div>
    </div>
  );
}
