import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

export function Button({ variant = "primary", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" }) {
  return <button className={`button button-${variant} ${className}`} {...props} />;
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="input" {...props} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className="input" {...props} />;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{children}</section>;
}

export function Modal({ open, title, children, onClose }: { open: boolean; title: string; children: ReactNode; onClose: () => void }) {
  if (!open) return null;
  return <div className="modal-backdrop" role="presentation" onClick={onClose}><div className="modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}><div className="modal-header"><h2>{title}</h2><Button variant="ghost" onClick={onClose} aria-label="Close">×</Button></div>{children}</div></div>;
}

export function TableShell({ children }: { children: ReactNode }) {
  return <div className="table-shell"><table>{children}</table></div>;
}

export function LoadingState() {
  return <div className="state-message"><span className="spinner" />Loading…</div>;
}

export function ErrorState({ message }: { message: string }) {
  return <div className="state-message error-message">{message}</div>;
}

export function EmptyState({ message = "No data available yet." }: { message?: string }) {
  return <div className="state-message">{message}</div>;
}