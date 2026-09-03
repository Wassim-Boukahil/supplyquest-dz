import { useEffect, useState } from "react";
import { ArrowRight, ArrowUpRight, Database, ShieldCheck } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { Card, EmptyState, ErrorState, LoadingState } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { apiRequest } from "../lib/api";
import { useLocale } from "../lib/i18n";

type Summary = { organization: { name: string }; counts: Record<string, number> };
export function DashboardPage() {
  const { user } = useAuth();
  const { t } = useLocale();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { apiRequest<Summary>("/api/v1/foundation/summary").then(setSummary).catch((err) => setError(err instanceof Error ? err.message : "Unable to load workspace.")); }, []);
  return <AppShell><div className="page-heading"><div><p className="eyebrow">WORKSPACE OVERVIEW</p><h1>{t("welcome")}, {user?.firstName}.</h1><p>{t("foundationSubtitle")}</p></div><div className="status-pill"><span className="status-dot" /> Phase 1 online</div></div>{error ? <ErrorState message={error} /> : !summary ? <LoadingState /> : <><div className="metric-grid">{[["users", t("users")], ["warehouses", t("warehouses")], ["products", t("products")], ["suppliers", t("suppliers")], ["customers", t("customers")], ["categories", t("categories")]].map(([key, label]) => <Card className="metric-card" key={key}><div className="metric-top"><span>{label}</span><ArrowUpRight size={16} /></div><strong>{summary.counts[key] ?? 0}</strong><small>Organization-scoped</small></Card>)}</div><div className="dashboard-grid"><Card className="welcome-card"><div className="card-icon"><Database size={19} /></div><p className="eyebrow">PHASE 1</p><h2>Core supply chain is live</h2><p>Manage your catalog, warehouses, inventory, purchasing, sales, and stock movements from one secure workspace. Every operation is scoped to your organization.</p><div className="progress-line"><span style={{ width: "68%" }} /></div><div className="progress-meta"><span>Core operations coverage</span><strong>Ready for daily use</strong></div></Card><Card className="access-card"><div className="card-icon green"><ShieldCheck size={19} /></div><h3>{t("adminAccess")}</h3><p>{t("adminReady")}</p><div className="role-list">{user?.roles.map((role) => <span key={role} className="role-chip">{role}</span>)}</div><a className="dashboard-link" href="/inventory">Open inventory <ArrowRight size={14} /></a></Card></div></>}</AppShell>;
}