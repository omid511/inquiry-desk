"use client";

import { useState } from "react";

export default function LoginForm({ demo }: { demo: boolean }) {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  return <form onSubmit={async (event) => {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    const form = new FormData(event.currentTarget);
    const body = demo ? { password: form.get("password") } : { mode, email: form.get("email"), password: form.get("password") };
    const response = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json().catch(() => ({}));
    if (response.ok && result.confirmationRequired) { setNotice(result.message); setBusy(false); return; }
    if (response.ok) { window.location.href = "/owner"; return; }
    setError(result.error || "Authentication failed."); setBusy(false);
  }}>
    {demo ? <div className="field"><label htmlFor="password">Access code</label><input autoFocus id="password" name="password" type="password" required /></div> : <><div className="filter-row" role="tablist" aria-label="Authentication mode"><button type="button" className={mode === "sign-in" ? "button" : "button secondary"} onClick={() => setMode("sign-in")}>Sign in</button><button type="button" className={mode === "sign-up" ? "button" : "button secondary"} onClick={() => setMode("sign-up")}>Sign up</button></div><div className="field"><label htmlFor="email">Email</label><input autoFocus id="email" name="email" type="email" autoComplete="email" required /></div><div className="field"><label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete={mode === "sign-in" ? "current-password" : "new-password"} minLength={8} required /></div></>}
    <button className="button" disabled={busy}>{busy ? "Working…" : demo ? "Enter desk →" : mode === "sign-in" ? "Sign in →" : "Create account →"}</button>
    {notice && <p className="form-note" role="status">{notice}</p>}
    {error && <p className="error" role="alert">{error}</p>}
  </form>;
}
