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
    setBusy(true);
    try {
      if (mode === "login") await login(email, password);
      else await signup(email, password, name || email.split("@")[0]);
    } catch (e: any) {
      setErr(e?.message ?? "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid h-full place-items-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4">
        <div className="text-center">
          <div className="text-4xl mb-2">ॐ</div>
          <h1 className="text-2xl font-bold text-primary">Utsav Mitra</h1>
          <p className="text-sm text-text-dim">
            {mode === "login" ? "Login to your events" : "Create your account"}
          </p>
        </div>

        {mode === "signup" && (
          <input
            className="w-full rounded-xl bg-surface-2 border border-border p-3 text-text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        )}
        <input
          className="w-full rounded-xl bg-surface-2 border border-border p-3 text-text"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="w-full rounded-xl bg-surface-2 border border-border p-3 text-text"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {err && <p className="text-sm text-danger">{err}</p>}

        <button
          className="w-full rounded-xl bg-primary p-3 font-semibold text-black disabled:opacity-50"
          disabled={busy}
        >
          {busy ? "Please wait…" : mode === "login" ? "Login" : "Sign up"}
        </button>

        <button
          type="button"
          className="w-full text-sm text-text-dim"
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
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
