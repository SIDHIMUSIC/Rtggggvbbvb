import { createFileRoute, Link, Navigate, useNavigate, useRouter } from "@tanstack/react-router";
import { Building2, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errMsg } from "@/lib/utils";

export const Route = createFileRoute("/login")({ component: Login });

const BEARER_KEY = "grok-auth.bearer-token";

function stashAuthToken(response: Response) {
  const token = response.headers.get("set-auth-token");
  if (!token || typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(BEARER_KEY, token);
  } catch {
    /* storage unavailable */
  }
}

function mapAuthError(raw: string, mode: "in" | "up"): string {
  const m = raw.toLowerCase();
  if (m.includes("already") || m.includes("exists") || m.includes("registered")) {
    return "An account with this email already exists. Sign in instead.";
  }
  if (m.includes("invalid") || m.includes("credential") || m.includes("incorrect")) {
    return "Email or password is incorrect.";
  }
  if (m.includes("8") && m.includes("password")) {
    return "Password must be at least 8 characters.";
  }
  if (m.includes("disabled")) {
    return "Sign-in is currently disabled.";
  }
  if (m.includes("origin")) {
    return "Could not reach the sign-in server. Refresh and try again.";
  }
  return raw || (mode === "up" ? "Could not create the owner account." : "Could not sign in.");
}

function Login() {
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const router = useRouter();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (isPending) {
    return (
      <main className="grid min-h-dvh place-items-center bg-bg">
        <div className="h-8 w-40 animate-pulse rounded-full bg-surface-2" />
      </main>
    );
  }
  if (user) {
    return <Navigate to="/" />;
  }

  async function finishAuth() {
    await authClient.getSession();
    await router.invalidate();
    await navigate({ to: "/" });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const fetchOptions = {
      onSuccess: (ctx: { response: Response }) => {
        stashAuthToken(ctx.response);
      },
    };
    try {
      if (mode === "up") {
        const res = await authClient.signUp.email({ email, password, name, fetchOptions });
        if (res.error) throw new Error(mapAuthError(res.error.message || "", "up"));
      } else {
        const res = await authClient.signIn.email({ email, password, fetchOptions });
        if (res.error) throw new Error(mapAuthError(res.error.message || "", "in"));
      }
      await finishAuth();
    } catch (err) {
      setError(mapAuthError(errMsg(err), mode));
    } finally {
      setBusy(false);
    }
  }

  async function onProvider(providerId: string) {
    setError("");
    setBusy(true);
    try {
      await signIn(providerId, { callbackURL: "/" });
      await finishAuth();
    } catch (err) {
      setError(mapAuthError(errMsg(err), "in"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-dvh bg-bg lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden lg:block">
        <img
          src="/login-hero.jpg"
          alt=""
          className="absolute inset-0 size-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/55 to-bg/20" />
        <div className="relative flex h-full flex-col justify-between p-10">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-lg border border-border bg-bg/70 backdrop-blur-sm">
              <Building2 className="size-4 text-accent" />
            </span>
            <span className="font-display text-xl tracking-tight">Rentweb</span>
          </Link>
          <div className="max-w-md">
            <p className="text-xs font-medium tracking-[0.2em] text-accent uppercase">
              Owner portal
            </p>
            <h2 className="mt-3 font-display text-4xl leading-[1.15] tracking-tight">
              Your building, on one quiet ledger.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-fg/75">
              Sign in as the landlord. Occupancy, tenant files, cash and UPI — private
              to this account.
            </p>
            <ul className="mt-8 space-y-3 text-sm text-fg/80">
              {[
                "Add floors and rooms",
                "Add, edit, or remove tenants",
                "Collect rent with UPI QR or cash",
              ].map((line) => (
                <li key={line} className="flex items-center gap-2.5">
                  <ShieldCheck className="size-4 text-accent" />
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </aside>

      <section className="flex flex-col px-4 py-8 sm:px-8">
        <div className="mb-10 flex items-center justify-between lg:hidden">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-lg border border-border bg-surface">
              <Building2 className="size-4 text-accent" />
            </span>
            <span className="font-display text-xl tracking-tight">Rentweb</span>
          </Link>
        </div>

        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center">
          <p className="text-xs font-medium tracking-[0.18em] text-muted uppercase">
            Property owner
          </p>
          <h1 className="mt-2 font-display text-3xl tracking-tight">
            {mode === "in" ? "Owner sign in" : "Create owner account"}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {mode === "in"
              ? "Email and password, or Google / X. New here? create an account below."
              : "One account per owner. Then add floors, rooms, tenants, and payments."}
          </p>

          {authEnabled ? (
            <div className="mt-6 space-y-2">
              {GROK_PROVIDERS.map((p) => (
                <Button
                  key={p.providerId}
                  type="button"
                  variant="secondary"
                  className="w-full justify-center"
                  disabled={busy}
                  onClick={() => void onProvider(p.providerId)}
                >
                  {p.label === "Google" ? <GoogleMark /> : <XMark />}
                  Continue with {p.label}
                </Button>
              ))}
            </div>
          ) : (
            <p className="mt-6 text-sm text-muted">Sign-in is disabled.</p>
          )}

          <div className="my-5 flex items-center gap-3 text-[11px] tracking-wide text-faint uppercase">
            <span className="h-px flex-1 bg-border" />
            or email
            <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={onSubmit} className="space-y-3">
            {mode === "up" && (
              <div>
                <Label htmlFor="name">Owner name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  placeholder="Ashu Kumar"
                  required
                />
              </div>
            )}
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="owner@email.com"
                required
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === "up" ? "new-password" : "current-password"}
                  minLength={8}
                  placeholder={mode === "up" ? "At least 8 characters" : "Your password"}
                  className="pr-11"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute top-1/2 right-1.5 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted hover:text-fg"
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            {error && (
              <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Please wait…" : mode === "in" ? "Sign in as owner" : "Create owner account"}
            </Button>
          </form>

          <button
            type="button"
            className="mt-5 w-full text-center text-sm text-muted hover:text-fg"
            onClick={() => {
              setMode(mode === "in" ? "up" : "in");
              setError("");
            }}
          >
            {mode === "in" ? "New owner? Create an account" : "Already an owner? Sign in"}
          </button>
        </div>
      </section>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function XMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden fill="currentColor">
      <path d="M18.244 2H21.5l-7.5 8.57L22.5 22h-6.59l-5.16-6.74L5.2 22H1.94l8.03-9.17L1.5 2h6.76l4.66 6.18L18.244 2Zm-1.16 18.06h1.81L6.99 3.86H5.05l12.03 16.2Z" />
    </svg>
  );
}
