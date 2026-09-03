import { useState, type ReactNode } from "react";
import { ArrowRightLeft, BarChart3, Boxes, ChevronDown, CircleHelp, ClipboardList, LayoutDashboard, LogOut, Menu, Package, Settings, ShoppingCart, Truck, Users, Warehouse } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLocale, type Locale } from "../lib/i18n";
import { Button, Select } from "./ui";

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { t, locale, setLocale } = useLocale();
  const [mobileOpen, setMobileOpen] = useState(false);
  const catalogItems = [
    [Boxes, t("products"), "/products"], [Package, t("categories"), "/categories"], [Truck, t("suppliers"), "/suppliers"],
    [Users, t("customers"), "/customers"], [Warehouse, t("warehouses"), "/warehouses"],
  ] as const;
  const operationsItems = [
    [ClipboardList, "Inventory", "/inventory"], [ArrowRightLeft, "Transfers", "/inventory/transfers"],
    [ShoppingCart, "Purchases", "/purchases"], [ShoppingCart, "Sales", "/sales"],
  ] as const;
  return <div className="app-shell">
    <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
      <div className="brand"><span className="brand-mark">SQ</span><span>{t("appName")}</span></div>
      <div className="workspace-switcher"><span className="eyebrow">WORKSPACE</span><strong>{user?.organization.name}</strong><ChevronDown size={15} /></div>
      <nav className="sidebar-nav">
        <p className="nav-label">{t("overview")}</p>
        <NavLink className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`} to="/dashboard" onClick={() => setMobileOpen(false)}><LayoutDashboard size={18} />{t("overview")}</NavLink>
        <p className="nav-label section-gap">Catalog</p>
        {catalogItems.map(([Icon, label, path]) => <NavLink className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`} to={path} key={path} onClick={() => setMobileOpen(false)}><Icon size={18} />{label}</NavLink>)}
        <p className="nav-label section-gap">Operations</p>
        {operationsItems.map(([Icon, label, path]) => <NavLink className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`} to={path} key={path} onClick={() => setMobileOpen(false)}><Icon size={18} />{label}</NavLink>)}
        <NavLink className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`} to="/settings"><Settings size={18} />{t("settings")}</NavLink>
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