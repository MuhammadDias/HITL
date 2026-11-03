"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ErrorBox } from "@/components/ui";
import { homeFor, useAuth } from "@/lib/auth";

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace(homeFor(user));
  }, [user, loading, router]);

  return (
    <div className="login-wrap">
      <form
        className="card login-card stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            const u = await login(email, password);
            router.replace(homeFor(u));
          } catch (err) {
            setError(err instanceof Error ? err.message : "Login gagal.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <div>
          <span className="brand-mark" aria-hidden="true" />
          <h1>Masuk Dashboard</h1>
          <p className="muted" style={{ margin: 0 }}>Sketchbook Universe — guru & superadmin</p>
        </div>
        <ErrorBox error={error} />
        <label className="field">
          Email
          <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          Password
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button type="submit" className="btn btn-primary" disabled={busy} style={{ justifyContent: "center" }}>
          {busy ? "Memeriksa…" : "Masuk"}
        </button>
        <p className="muted small" style={{ margin: 0 }}>
          Akun guru dibuat oleh superadmin. Hubungi superadmin jika lupa password.
        </p>
      </form>
    </div>
  );
}
