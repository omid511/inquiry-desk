"use client";
import { useState } from "react";

export default function IntakeForm() {
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  async function submit(form: HTMLFormElement) {
    setState("sending"); setMessage("");
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      const response = await fetch("/api/intake", { method: "POST", headers: { "content-type": "application/json", "x-idempotency-key": crypto.randomUUID() }, body: JSON.stringify({ ...data, consent: data.consent === "on" }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Please check your details.");
      form.reset(); setState("done"); setMessage(payload.duplicate ? "We already have this inquiry and kept the original review." : "Received. A human will review your details and follow up soon.");
    } catch (error) { setState("error"); setMessage(error instanceof Error ? error.message : "Please try again."); }
  }
  return <div className="form-card"><h2>Start an inquiry</h2><form onSubmit={(event) => { event.preventDefault(); void submit(event.currentTarget); }}>
    <div className="field"><label htmlFor="name">Your name</label><input id="name" name="name" required maxLength={80} placeholder="Avery Chen" /></div>
    <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" required maxLength={160} placeholder="avery@example.com" /></div>
    <div className="field"><label htmlFor="phone">Phone <span>(optional)</span></label><input id="phone" name="phone" maxLength={40} placeholder="+1 555 0100" /></div>
    <div className="field"><label htmlFor="request">What can we help with?</label><textarea id="request" name="request" required minLength={20} maxLength={4000} placeholder="Tell us what you need, when you need it, and where you are…" /></div>
    <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ display: "none" }} />
    <label className="consent"><input name="consent" type="checkbox" required /> <span>I agree that the team can use these details to prepare a response.</span></label>
    <button className="button" disabled={state === "sending"}>{state === "sending" ? "Reviewing…" : "Send for review →"}</button>
    {message && <p className={state === "error" ? "error" : "form-note"} role="status">{message}</p>}
  </form></div>;
}
