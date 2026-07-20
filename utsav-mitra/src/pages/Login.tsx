import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

export default function Login() {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");

    if (password.length < 6) {
      setErr("Password must be at least 6 characters long.");
      return;
    }

    setBusy(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await signup(email, password, name.trim() || email.split("@")[0]);
      }
    } catch (e: any) {
      let msg = e?.message ?? "Something went wrong";
      if (msg.includes("auth/invalid-credential") || msg.includes("auth/wrong-password")) {
        msg = "Invalid email or password.";
      } else if (msg.includes("auth/email-already-in-use")) {
        msg = "An account with this email already exists.";
      }
      setErr(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid h-screen place-items-center bg-background p-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-surface p-6 shadow-xl">
        <div className="text-center">
          <div className="text-4xl mb-2">ॐ</div>
          <h1 className="text-2xl font-bold text-primary">Utsav Mitra</h1>
          <p className="text-sm text-text-dim">
            {mode === "login" ? "Login to your events" : "Create your account"}
          </p>
        </div>

        {mode === "signup" && (
          <div className="space-y-1">
            <label htmlFor="name-input" className="text-xs text-text-dim font-medium">Your Name</label>
            <input
              id="name-input"
              className="w-full rounded-xl bg-surface-2 border border-border p-3 text-text text-sm"
              placeholder="e.g. Rahul Sharma"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
            />
          </div>
        )}

        <div className="space-y-1">
          <label htmlFor="email-input" className="text-xs text-text-dim font-medium">Email Address</label>
          <input
            id="email-input"
            className="w-full rounded-xl bg-surface-2 border border-border p-3 text-text text-sm"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="password-input" className="text-xs text-text-dim font-medium">Password (min 6 chars)</label>
          <input
            id="password-input"
            className="w-full rounded-xl bg-surface-2 border border-border p-3 text-text text-sm"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />
        </div>

        {err && <p className="text-sm text-danger">{err}</p>}

        <button
          className="w-full rounded-xl bg-primary p-3 font-semibold text-black hover:opacity-90 disabled:opacity-50"
          disabled={busy}
        >
          {busy ? "Please wait…" : mode === "login" ? "Login" : "Sign up"}
        </button>

        <button
          type="button"
          disabled={busy}
          className="w-full text-sm text-text-dim hover:text-text disabled:opacity-50"
          onClick={() => {
            setErr("");
            setMode(mode === "login" ? "signup" : "login");
          }}
        >
          {mode === "login" ? "Need an account? Sign up" : "Have an account? Login"}
        </button>

        {mode === "signup" && (
          <p className="text-xs text-text-dim text-center">
            First account becomes Super Admin. Others sign up, then get added to events.
          </p>
        )}
      </form>
    </div>
  );
}
