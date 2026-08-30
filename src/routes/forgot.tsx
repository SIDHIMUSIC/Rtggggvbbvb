import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from "react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  requestPasswordOtp,
  resetOwnerPassword,
  verifyPasswordOtp,
  type OtpChannel,
} from "@/lib/auth/password-otp.server";
import { errMsg } from "@/lib/utils";

export const Route = createFileRoute("/forgot")({ component: ForgotPassword });

type Step = "identify" | "otp" | "password" | "done";

function ForgotPassword() {
  const { user, isPending } = useCurrentUserState();
  const [step, setStep] = useState<Step>("identify");
  const [identifier, setIdentifier] = useState("");
  const [channel, setChannel] = useState<OtpChannel>("email");
  const [masked, setMasked] = useState("");
  const [previewCode, setPreviewCode] = useState("");
  const [delivered, setDelivered] = useState(true);
  const [ticket, setTicket] = useState("");
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);
  const [seconds, setSeconds] = useState(30);
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (step !== "otp") return;
    setSeconds(30);
    const t = window.setInterval(() => {
      setSeconds((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => window.clearInterval(t);
  }, [step, masked]);

  if (isPending) {
    return (
      <main className="otp-page">
        <div className="otp-card" />
      </main>
    );
  }
  if (user) return <Navigate to="/" />;

  function flashError(msg: string) {
    setError(msg);
    setShake(true);
    window.setTimeout(() => setShake(false), 380);
  }

  async function sendOtp(nextChannel = channel) {
    setError("");
    setBusy(true);
    try {
      const res = await requestPasswordOtp({
        data: { identifier, channel: nextChannel },
      });
      setChannel(nextChannel);
      setMasked(res.masked);
      setDelivered(res.delivered);
      setPreviewCode(res.previewCode ?? "");
      setDigits(["", "", "", "", "", ""]);
      setStep("otp");
      window.setTimeout(() => inputs.current[0]?.focus(), 50);
    } catch (e) {
      flashError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function onIdentify(e: FormEvent) {
    e.preventDefault();
    await sendOtp(channel);
  }

  function onDigit(index: number, value: string) {
    const v = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = v;
    setDigits(next);
    if (v && index < 5) inputs.current[index + 1]?.focus();
  }

  function onKey(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  }

  function onPaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6).split("");
    const next = ["", "", "", "", "", ""];
    pasted.forEach((ch, i) => {
      next[i] = ch;
    });
    setDigits(next);
    const last = Math.min(pasted.length, 6) - 1;
    inputs.current[Math.max(0, last)]?.focus();
  }

  async function onVerify() {
    const code = digits.join("");
    if (code.length < 6) {
      flashError("Please enter complete 6-digit OTP.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await verifyPasswordOtp({ data: { identifier, channel, code } });
      setTicket(res.ticket);
      setStep("password");
    } catch (e) {
      flashError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function onReset(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      flashError("New password and confirm password do not match.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await resetOwnerPassword({ data: { ticket, password } });
      setStep("done");
    } catch (e) {
      flashError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="otp-page">
      <style>{OTP_CSS}</style>
      <div className="otp-card">
        {step !== "done" ? (
          <div>
            <div className="icon-container">{step === "password" ? "🔑" : "🔒"}</div>
            <h1 className="title">
              {step === "identify" && "Forgot password"}
              {step === "otp" && "Verify Your OTP"}
              {step === "password" && "Set new password"}
            </h1>
            <p className="description">
              {step === "identify" && (
                <>
                  Owner details verify karke OTP email ya number pe jayega.
                  <br />
                  Phir naya password set karo.
                </>
              )}
              {step === "otp" && (
                <>
                  We've sent a 6-digit verification code to
                  <br />
                  <span className="phone-number">{masked}</span>
                </>
              )}
              {step === "password" && "OTP verified. Choose a new owner password (min 8 characters)."}
            </p>

            {step === "identify" && (
              <form onSubmit={onIdentify}>
                <input
                  className="neu-field"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Owner email or 10-digit phone"
                  autoComplete="username"
                  required
                />
                <div className="channel-row">
                  <button
                    type="button"
                    className={channel === "email" ? "chip on" : "chip"}
                    onClick={() => setChannel("email")}
                  >
                    Email OTP
                  </button>
                  <button
                    type="button"
                    className={channel === "phone" ? "chip on" : "chip"}
                    onClick={() => setChannel("phone")}
                  >
                    Phone OTP
                  </button>
                </div>
                <button className="verify-btn" type="submit" disabled={busy}>
                  {busy ? "SENDING…" : "SEND OTP"}
                </button>
              </form>
            )}

            {step === "otp" && (
              <>
                {!delivered && previewCode && (
                  <p className="preview-code">
                    SMS/email key nahi lagi — is code se verify karo: <strong>{previewCode}</strong>
                  </p>
                )}
                <div className={shake ? "otp-inputs shake" : "otp-inputs"}>
                  {digits.map((d, i) => (
                    <input
                      key={i}
                      ref={(el) => {
                        inputs.current[i] = el;
                      }}
                      className="otp-input"
                      inputMode="numeric"
                      maxLength={1}
                      value={d}
                      onChange={(e) => onDigit(i, e.target.value)}
                      onKeyDown={(e) => onKey(i, e)}
                      onPaste={onPaste}
                    />
                  ))}
                </div>
                <button className="verify-btn" type="button" onClick={() => void onVerify()} disabled={busy}>
                  {busy ? "CHECKING…" : "VERIFY OTP"}
                </button>
                <div className="resend-container">
                  {seconds > 0 ? (
                    <span>
                      Resend OTP in <strong>{seconds}</strong> seconds
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="resend-btn"
                      disabled={busy}
                      onClick={() => void sendOtp(channel)}
                    >
                      RESEND OTP
                    </button>
                  )}
                </div>
              </>
            )}

            {step === "password" && (
              <form onSubmit={onReset}>
                <input
                  className="neu-field"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  placeholder="New password"
                  autoComplete="new-password"
                  required
                />
                <input
                  className="neu-field"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  minLength={8}
                  placeholder="Confirm new password"
                  autoComplete="new-password"
                  required
                />
                <button className="verify-btn" type="submit" disabled={busy}>
                  {busy ? "SAVING…" : "SAVE PASSWORD"}
                </button>
              </form>
            )}

            {error && <p className="error-msg">{error}</p>}

            <Link to="/login" className="back-link">
              Back to sign in
            </Link>
          </div>
        ) : (
          <div className="success-card">
            <div className="success-icon">✓</div>
            <h2 className="success-title">Verification Successful</h2>
            <p className="success-desc">
              Naya password set ho gaya.
              <br />
              Ab owner email + new password se login karo.
            </p>
            <Link to="/login" className="verify-btn" style={{ display: "block", textDecoration: "none", marginTop: 22 }}>
              GO TO LOGIN
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}

const OTP_CSS = `
@import url("https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap");
.otp-page {
  min-height: 100dvh;
  display: flex;
  justify-content: center;
  align-items: center;
  background: #e6ecf3;
  padding: 20px;
  font-family: Poppins, sans-serif;
  color-scheme: light;
}
.otp-card {
  position: relative;
  width: 100%;
  max-width: 440px;
  background: #e6ecf3;
  border-radius: 32px;
  padding: 40px 30px;
  box-shadow: 16px 16px 32px #c5cbd2, -16px -16px 32px #ffffff;
  text-align: center;
  animation: fadeIn 0.4s ease;
}
.icon-container {
  width: 70px;
  height: 70px;
  margin: 0 auto 20px;
  border-radius: 50%;
  background: #e6ecf3;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  box-shadow: 6px 6px 12px #c5cbd2, -6px -6px 12px #ffffff;
}
.title { font-size: 24px; font-weight: 700; color: #2b3a4a; margin-bottom: 8px; }
.description { font-size: 13px; color: #7b8a9a; margin-bottom: 25px; line-height: 1.5; }
.phone-number { font-weight: 600; color: #334155; }
.otp-inputs { display: flex; justify-content: space-between; gap: 10px; margin-bottom: 25px; }
.otp-input, .neu-field {
  border: none; outline: none; background: #e6ecf3; color: #2563eb;
  box-shadow: inset 4px 4px 8px #c5cbd2, inset -4px -4px 8px #ffffff;
  font-family: Poppins, sans-serif;
}
.otp-input {
  width: 50px; height: 60px; border-radius: 16px; text-align: center;
  font-size: 24px; font-weight: 700; transition: all 0.2s ease;
}
.neu-field {
  width: 100%; height: 52px; border-radius: 16px; padding: 0 16px;
  font-size: 14px; font-weight: 600; margin-bottom: 12px; color: #1e293b;
}
.otp-input:focus, .neu-field:focus {
  box-shadow: inset 2px 2px 4px #c5cbd2, inset -2px -2px 4px #ffffff, 0 0 0 2px #3b82f6;
}
.verify-btn {
  width: 100%; padding: 15px; border: none; outline: none; border-radius: 18px;
  background: #e6ecf3; color: #2563eb; font-size: 15px; font-weight: 700;
  letter-spacing: 1px; cursor: pointer;
  box-shadow: 6px 6px 14px #c5cbd2, -6px -6px 14px #ffffff;
  transition: all 0.2s ease; margin-bottom: 18px; font-family: Poppins, sans-serif;
}
.verify-btn:hover { color: #1d4ed8; box-shadow: 4px 4px 10px #c5cbd2, -4px -4px 10px #ffffff; }
.verify-btn:active { box-shadow: inset 4px 4px 8px #c5cbd2, inset -4px -4px 8px #ffffff; }
.verify-btn:disabled { opacity: 0.65; cursor: not-allowed; }
.resend-container { font-size: 13px; color: #7b8a9a; min-height: 24px; }
.resend-btn {
  background: none; border: none; color: #2563eb; font-weight: 600;
  font-size: 13px; cursor: pointer; text-transform: uppercase; letter-spacing: 0.5px;
}
.error-msg { color: #ef4444; font-size: 13px; font-weight: 500; margin-top: 12px; }
.shake { animation: shakeEffect 0.35s ease-in-out; }
@keyframes shakeEffect {
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-8px); }
  40%, 80% { transform: translateX(8px); }
}
.success-card { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px 0; animation: fadeIn 0.4s ease; }
@keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
.success-icon {
  width: 80px; height: 80px; border-radius: 50%; background: #e6ecf3;
  display: flex; align-items: center; justify-content: center; font-size: 40px;
  color: #10b981; margin-bottom: 20px;
  box-shadow: 6px 6px 14px #c5cbd2, -6px -6px 14px #ffffff;
}
.success-title { font-size: 22px; font-weight: 700; color: #2b3a4a; margin-bottom: 10px; }
.success-desc { font-size: 13px; color: #64748b; line-height: 1.5; }
.channel-row { display: flex; gap: 10px; margin: 4px 0 18px; }
.chip {
  flex: 1; border: none; background: #e6ecf3; color: #64748b; font-weight: 600;
  font-size: 12px; padding: 10px 8px; border-radius: 14px; cursor: pointer;
  box-shadow: 4px 4px 10px #c5cbd2, -4px -4px 10px #ffffff; font-family: Poppins, sans-serif;
}
.chip.on { color: #2563eb; box-shadow: inset 3px 3px 6px #c5cbd2, inset -3px -3px 6px #ffffff; }
.preview-code {
  font-size: 12px; color: #334155; background: #e6ecf3; border-radius: 14px;
  padding: 10px 12px; margin-bottom: 16px;
  box-shadow: inset 3px 3px 6px #c5cbd2, inset -3px -3px 6px #ffffff;
}
.back-link { display: inline-block; margin-top: 8px; font-size: 13px; color: #2563eb; font-weight: 600; text-decoration: none; }
`;
