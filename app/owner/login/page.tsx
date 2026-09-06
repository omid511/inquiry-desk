import LoginForm from "./login-form";
import { isDemoMode } from "@/lib/security";

export default function LoginPage() { const demo = isDemoMode(); return <main className="login-wrap"><div className="login-card"><div className="eyebrow">Private owner area</div><h2>Open the review desk</h2><p className="form-note" style={{ marginBottom: 22 }}>{demo ? <>Demo mode uses <span className="mono">demo</span> as the access code.</> : "Sign in with your workspace account, or create one to request access."}</p><LoginForm demo={demo} /></div></main>; }
