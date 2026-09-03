import { useState, type ReactNode } from "react";
import { BarChart3, Boxes, ChevronDown, CircleHelp, LayoutDashboard, LogOut, Menu, Settings, Truck, Users, Warehouse } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useLocale, type Locale } from "../lib/i18n";
import { Button, Select } from "./ui";

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { t, locale, setLocale } = useLocale();
  const [mobileOpen, setMobileOpen] = useState(false);
  const plannedItems = [
    [Boxes, t("products")], [Warehouse, t("warehouses")], [Truck, t("suppliers")], [BarChart3, "Analytics"],
  ] as const;
  return <div className="app-shell">
    <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
      <div className="brand"><span className="brand-mark">SQ</span><span>{t("appName")}</span></div>
      <div className="workspace-switcher"><span className="eyebrow">WORKSPACE</span><strong>{user?.organization.name}</strong><ChevronDown size={15} /></div>
      <nav className="sidebar-nav">
        <p className="nav-label">{t("overview")}</p>
        <a className="nav-item active" href="#dashboard"><LayoutDashboard size={18} />{t("foundation")}</a>
        <p className="nav-label section-gap">{t("planned")}</p>
        {plannedItems.map(([Icon, label]) => <div className="nav-item disabled" key={label}><Icon size={18} />{label}<span className="nav-dot" /></div>)}
        <a className="nav-item" href="#settings"><Settings size={18} />{t("settings")}</a>
      </nav>
      <div className="sidebar-help"><CircleHelp size={17} /><div><strong>Need a hand?</strong><span>Read the foundation guide</span></div></div>
    </aside>
    <main className="main-content">
      <header className="topbar"><Button variant="ghost" className="mobile-menu" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Open menu"><Menu size={20} /></Button><div className="breadcrumb">SupplyQuest <span>/</span> {t("foundation")}</div><div className="topbar-actions">
        <label className="locale-control"><span>{t("language")}</span><Select value={locale} onChange={(e) => setLocale(e.target.value as Locale)}><option value="en">{t("english")}</option><option value="fr">{t("french")}</option><option value="ar">{t("arabic")}</option></Select></label>
        <div className="user-menu"><div className="avatar">{user?.firstName[0]}{user?.lastName[0]}</div><div className="user-summary"><strong>{user?.firstName} {user?.lastName}</strong><span>{user?.roles.join(" · ")}</span></div><Button variant="ghost" onClick={logout} aria-label={t("logout")}><LogOut size={17} /></Button></div>
      </div></header>
      <div className="page-content">{children}</div>
    </main>
  </div>;
}