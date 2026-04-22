"use client";
import { useState } from "react";

// ============================================
// 💳 RAZORPAY PAY BUTTON — Kahi bhi use karo
// Props:
//   paymentId   — MongoDB Payment _id
//   amount      — Remaining amount (₹)
//   tenantName  — Tenant ka naam
//   month       — "Apr 2025" etc
//   onSuccess   — Callback after payment
// ============================================
export default function RazorpayButton({
  paymentId,
  amount,
  tenantName,
  month,
  onSuccess,
  className = "",
}) {
  const [loading, setLoading] = useState(false);

  const loadRazorpayScript = () =>
    new Promise((resolve) => {
      if (document.getElementById("razorpay-script")) {
        resolve(true);
        return;
      }
      const script = document.createElement("script");
      script.id = "razorpay-script";
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });

  const handlePay = async () => {
    setLoading(true);

    try {
      // 1️⃣ Razorpay script load karo
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        alert("Razorpay load nahi hua. Internet check karo ❌");
        setLoading(false);
        return;
      }

      // 2️⃣ Server se order create karo
      const orderRes = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId }),
      }).then((r) => r.json());

      if (!orderRes.success) {
        alert(orderRes.message || "Order create nahi hua ❌");
        setLoading(false);
        return;
      }

      // 3️⃣ Razorpay Checkout open karo
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: orderRes.amount,
        currency: orderRes.currency,
        name: "🏠 Rent Payment",
        description: `${tenantName} — ${month}`,
        order_id: orderRes.orderId,

        // ✅ Payment success callback
        handler: async function (response) {
          const verifyRes = await fetch("/api/payments/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              paymentId,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            }),
          }).then((r) => r.json());

          if (verifyRes.success) {
            alert(`✅ Payment successful!\nID: ${response.razorpay_payment_id}`);
            if (onSuccess) onSuccess();
          } else {
            alert("Payment verify nahi hua ❌ Support se contact karo.");
          }
        },

        prefill: {
          name: tenantName,
        },

        theme: {
          color: "#6d28d9", // Purple
        },

        modal: {
          ondismiss: function () {
            setLoading(false);
          },
        },
      };

      const rzp = new window.Razorpay(options);

      rzp.on("payment.failed", function (response) {
        alert(`Payment failed ❌\n${response.error.description}`);
        setLoading(false);
      });

      rzp.open();
    } catch (err) {
      console.error("PAY ERROR:", err);
      alert("Something went wrong ❌");
    }

    setLoading(false);
  };

  if (amount <= 0) {
    return (
      <span className="inline-block bg-green-100 text-green-700 text-xs px-3 py-1 rounded-full font-semibold">
        ✅ Paid
      </span>
    );
  }

  return (
    <button
      onClick={handlePay}
      disabled={loading}
      className={`inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white font-semibold px-4 py-2 rounded-lg transition text-sm ${className}`}
    >
      {loading ? (
        <>
          <span className="animate-spin">⏳</span> Processing...
        </>
      ) : (
        <>💳 Pay ₹{amount.toLocaleString("en-IN")}</>
      )}
    </button>
  );
}
