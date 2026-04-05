"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Login non riuscito.");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="loginWrap">
      <div className="loginCard">
        <div className="title" style={{ fontSize: 26 }}>Ordini Laboratorio</div>
        <div className="subtitle">Accesso multiutente online</div>

        <form onSubmit={handleLogin} style={{ marginTop: 18 }}>
          <div style={{ marginBottom: 14 }}>
            <label>Username</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Inserisci username" />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Inserisci password" />
          </div>

          {error ? <div className="notice" style={{ marginBottom: 14 }}>{error}</div> : null}

          <button className="primary" type="submit" disabled={loading} style={{ width: "100%" }}>
            {loading ? "Accesso in corso..." : "Accedi"}
          </button>
        </form>
      </div>
    </div>
  );
}
