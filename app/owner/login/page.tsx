import LoginForm from "./login-form";
import { isDemoMode } from "@/lib/security";

export default function LoginPage() { return <main className="login-wrap"><div className="login-card"><div className="eyebrow">Private owner area</div><h2>Open the review desk</h2><p className="form-note" style={{ marginBottom: 22 }}>{isDemoMode() ? <>Demo mode uses <span className="mono">demo</span> as the access code.</> : "Use the workspace access token configured by your administrator."}</p><LoginForm /></div></main>; }
