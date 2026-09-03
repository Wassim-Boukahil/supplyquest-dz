import { Link, useLocation } from "react-router-dom";
import { ArrowLeft, ChevronRight, Plus, Search } from "lucide-react";
import { Button, Card, Input, Select } from "./ui";

export function PageHeader({ eyebrow, title, description, action, back }: {
  eyebrow: string; title: string; description?: string; action?: React.ReactNode; back?: string;
}) {
  return <div className="page-heading">
    <div>{back && <Link className="back-link" to={back}><ArrowLeft size={14} /> Back</Link>}<p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{description && <p>{description}</p>}</div>
    {action}
  </div>;
}

export function Toolbar({ search, onSearch, placeholder = "Search...", children }: { search?: string; onSearch?: (value: string) => void; placeholder?: string; children?: React.ReactNode }) {
  return <div className="toolbar"><div className="search-box">{onSearch && <Search size={16} />} {onSearch && <Input value={search} onChange={(event) => onSearch(event.target.value)} placeholder={placeholder} />}</div><div className="toolbar-actions">{children}</div></div>;
}

export function StatusBadge({ status }: { status: string }) {
  const tone = status.toLowerCase().replaceAll("_", "-");
  return <span className={`status-badge status-${tone}`}>{status.replaceAll("_", " ")}</span>;
}

export function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return <div className="table-shell"><table><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{children}</tbody></table></div>;
}

export function RowLink({ to, children }: { to: string; children: React.ReactNode }) {
  return <Link className="row-link" to={to}>{children}<ChevronRight size={15} /></Link>;
}

export function EmptyPanel({ title, message, onAdd }: { title: string; message: string; onAdd?: () => void }) {
  return <Card className="empty-panel"><div className="empty-mark">+</div><h3>{title}</h3><p>{message}</p>{onAdd && <Button onClick={onAdd}><Plus size={15} /> Add first record</Button>}</Card>;
}

export function DetailCard({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return <Card className={`detail-card ${className}`}><div className="card-title"><h3>{title}</h3></div>{children}</Card>;
}

export function useIsActive(path: string) {
  const location = useLocation();
  return location.pathname === path || location.pathname.startsWith(`${path}/`);
}

export function FormField({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return <label className="field-label"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

export function PaginationBar({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (page: number) => void }) {
  if (totalPages <= 1) return null;
  return <div className="pagination"><Button variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</Button><span>Page {page} of {totalPages}</span><Button variant="secondary" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>Next</Button></div>;
}