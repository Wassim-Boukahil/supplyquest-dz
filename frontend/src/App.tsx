import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage, RegisterPage } from "./pages/AuthPages";
import { LoadingState } from "./components/ui";
import { EntityDetailPage, EntityListPage } from "./pages/EntityPages";
import { InventoryPage, MovementsPage, TransfersPage } from "./pages/InventoryPages";
import { OrderDetailPage, OrdersPage } from "./pages/OrderPages";

export function App() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingState />;
  return <Routes>
    <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
    <Route path="/register" element={user ? <Navigate to="/dashboard" replace /> : <RegisterPage />} />
    <Route path="/dashboard" element={user ? <DashboardPage /> : <Navigate to="/login" replace />} />
    {(["products", "categories", "suppliers", "customers", "warehouses"] as const).map((kind) => <Route key={kind} path={`/${kind}`} element={user ? <EntityListPage kind={kind} /> : <Navigate to="/login" replace />} />)}
    {(["products", "categories", "suppliers", "customers", "warehouses"] as const).map((kind) => <Route key={`${kind}-detail`} path={`/${kind}/:id`} element={user ? <EntityDetailPage kind={kind} /> : <Navigate to="/login" replace />} />)}
    <Route path="/inventory" element={user ? <InventoryPage /> : <Navigate to="/login" replace />} />
    <Route path="/inventory/movements" element={user ? <MovementsPage /> : <Navigate to="/login" replace />} />
    <Route path="/inventory/transfers" element={user ? <TransfersPage /> : <Navigate to="/login" replace />} />
    <Route path="/purchases" element={user ? <OrdersPage kind="purchases" /> : <Navigate to="/login" replace />} />
    <Route path="/purchases/:id" element={user ? <OrderDetailPage kind="purchases" /> : <Navigate to="/login" replace />} />
    <Route path="/sales" element={user ? <OrdersPage kind="sales" /> : <Navigate to="/login" replace />} />
    <Route path="/sales/:id" element={user ? <OrderDetailPage kind="sales" /> : <Navigate to="/login" replace />} />
    <Route path="*" element={<Navigate to={user ? "/dashboard" : "/login"} replace />} />
  </Routes>;
}