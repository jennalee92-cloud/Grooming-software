import Link from "next/link";
import { Scissors } from "lucide-react";

export function AuthFrame({
  eyebrow,
  title,
  accent,
  lede,
  children,
}: {
  eyebrow: string;
  title: string;
  accent: string;
  lede: string;
  children: React.ReactNode;
}) {
  return (
    <div className="auth-page">
      <Link className="brand auth-brand" href="/login" aria-label="Grooming Desk">
        <span className="brand-mark"><Scissors size={19} strokeWidth={1.8} /></span>
        <span className="brand-name">grooming<span>desk</span></span>
      </Link>
      <main className="auth-card">
        <span className="overline">{eyebrow}</span>
        <h1>{title}<br /><em>{accent}</em></h1>
        <p className="auth-lede">{lede}</p>
        {children}
      </main>
      <footer className="auth-foot">GROOMING DESK <span className="footer-separator">/</span> A BETTER-RUN DAY</footer>
    </div>
  );
}
