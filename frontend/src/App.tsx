import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage, RegisterPage } from "./pages/AuthPages";
import { LoadingState } from "./components/ui";

export function App() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingState />;
  return <Routes><Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} /><Route path="/register" element={user ? <Navigate to="/dashboard" replace /> : <RegisterPage />} /><Route path="/dashboard" element={user ? <DashboardPage /> : <Navigate to="/login" replace />} /><Route path="*" element={<Navigate to={user ? "/dashboard" : "/login"} replace />} /></Routes>;
}