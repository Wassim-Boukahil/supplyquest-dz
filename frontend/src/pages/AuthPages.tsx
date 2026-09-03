import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useLocale } from "../lib/i18n";
import { Button, Card, Input } from "../components/ui";

export function LoginPage() {
  const { t } = useLocale();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setError(""); try { await login(email, password); navigate("/dashboard"); } catch (err) { setError(err instanceof Error ? err.message : t("invalidLogin")); } };
  return <AuthLayout><Card className="auth-card"><div className="auth-icon"><LockKeyhole size={20} /></div><p className="eyebrow">SUPPLYQUEST DZ</p><h1>{t("signInPrompt")}</h1><p className="auth-copy">A calm, secure control center for your operations.</p><form onSubmit={submit} className="form-stack"><label>{t("email")}<Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@company.dz" /></label><label>{t("password")}<Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>{error && <div className="form-error">{error}</div>}<Button type="submit">{t("signIn")} <ArrowRight size={17} /></Button></form><p className="auth-switch">{t("needAccount")} <Link to="/register">{t("register")}</Link></p></Card></AuthLayout>;
}

export function RegisterPage() {
  const { t } = useLocale();
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ organizationName: "", organizationSlug: "", firstName: "", lastName: "", email: "", password: "" });
  const [error, setError] = useState("");
  const update = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: event.target.value });
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setError(""); try { await register(form); navigate("/dashboard"); } catch (err) { setError(err instanceof Error ? err.message : "Unable to create account."); } };
  return <AuthLayout><Card className="auth-card register-card"><div className="auth-icon"><ShieldCheck size={20} /></div><p className="eyebrow">PHASE 0 FOUNDATION</p><h1>{t("registerPrompt")}</h1><p className="auth-copy">Your new workspace starts with an organization admin account.</p><form onSubmit={submit} className="form-stack two-column"><label className="full-span">{t("createOrganization")}<Input autoComplete="organization" value={form.organizationName} onChange={update("organizationName")} required placeholder="Atlas Distribution" /></label><label>{t("slug")}<Input autoComplete="off" value={form.organizationSlug} onChange={update("organizationSlug")} required placeholder="atlas-distribution" /></label><label>{t("firstName")}<Input autoComplete="given-name" value={form.firstName} onChange={update("firstName")} required /></label><label>{t("lastName")}<Input autoComplete="family-name" value={form.lastName} onChange={update("lastName")} required /></label><label>{t("email")}<Input type="email" autoComplete="email" value={form.email} onChange={update("email")} required /></label><label className="full-span">{t("password")}<Input type="password" autoComplete="new-password" value={form.password} onChange={update("password")} required minLength={8} /><small>{t("showPassword")}</small></label>{error && <div className="form-error full-span">{error}</div>}<Button className="full-span" type="submit">{t("submit")} <ArrowRight size={17} /></Button></form><p className="auth-switch">{t("alreadyAccount")} <Link to="/login">{t("signIn")}</Link></p></Card></AuthLayout>;
}

function AuthLayout({ children }: { children: React.ReactNode }) {
  const { locale, setLocale, t } = useLocale();
  return <div className="auth-layout"><div className="auth-visual"><div className="brand light"><span className="brand-mark">SQ</span><span>{t("appName")}</span></div><div className="visual-content"><div className="visual-kicker">SUPPLY CHAIN / BUSINESS INTELLIGENCE</div><h2>See the whole operation.<br /><em>Move with clarity.</em></h2><p>Build a resilient, explainable supply chain foundation for every warehouse, supplier, and decision.</p><div className="visual-stat-row"><span><strong>01</strong> Secure by design</span><span><strong>02</strong> Ready to scale</span></div></div><div className="visual-footer">Algeria · DZD · {new Date().getFullYear()}</div></div><div className="auth-panel"><div className="auth-locale"><span>{t("language")}</span><select value={locale} onChange={(e) => setLocale(e.target.value as "en" | "fr" | "ar")}><option value="en">English</option><option value="fr">Français</option><option value="ar">العربية</option></select></div>{children}</div></div>;
}