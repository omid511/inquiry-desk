"use client";

export default function LogoutButton() {
  return <button className="nav-link" type="button" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/owner/login"; }}>Sign out ↗</button>;
}
