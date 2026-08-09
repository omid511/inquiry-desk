import Link from "next/link";
import IntakeForm from "./intake-form";

export default function HomePage() {
  return <main className="shell">
    <nav className="nav"><Link href="/" className="brand">inquiry<span>•</span>desk</Link><Link href="/owner" className="nav-link">Owner sign in ↗</Link></nav>
    <section className="hero"><div><div className="eyebrow">A calmer front door for service businesses</div><h1>Messy questions.<br /><em>Clear next steps.</em></h1><p className="lede">Share what you need and a real person will review the details before responding. No automated promises, no lost context.</p><div className="proof-row"><span className="proof">01 / submit</span><span className="proof">02 / review</span><span className="proof">03 / respond</span></div></div><IntakeForm /></section>
    <p className="form-note">Your inquiry is only used to prepare a response. A human reviews every draft.</p>
  </main>;
}
