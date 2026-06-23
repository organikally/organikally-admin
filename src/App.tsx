import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { RequireAuth, RequireCap } from '@/components/layout/Guards';
import { LoadingState } from '@/components/ui/primitives';
import { LoginPage } from '@/pages/Login';

// Lazy-load the authenticated screens so the login bundle stays small and
// chart-heavy pages (Recharts) are only fetched when visited.
const DashboardPage = lazy(() => import('@/pages/Dashboard').then((m) => ({ default: m.DashboardPage })));
const LiveOpsPage = lazy(() => import('@/pages/LiveOps').then((m) => ({ default: m.LiveOpsPage })));
const OutletsPage = lazy(() => import('@/pages/Outlets').then((m) => ({ default: m.OutletsPage })));
const OutletDetailPage = lazy(() => import('@/pages/OutletDetail').then((m) => ({ default: m.OutletDetailPage })));
const ApprovalsPage = lazy(() => import('@/pages/Approvals').then((m) => ({ default: m.ApprovalsPage })));
const CatalogPage = lazy(() => import('@/pages/Catalog').then((m) => ({ default: m.CatalogPage })));
const InventoryPage = lazy(() => import('@/pages/Inventory').then((m) => ({ default: m.InventoryPage })));
const OrdersPage = lazy(() => import('@/pages/Orders').then((m) => ({ default: m.OrdersPage })));
const OrderDetailPage = lazy(() => import('@/pages/OrderDetail').then((m) => ({ default: m.OrderDetailPage })));
const ReceivablesPage = lazy(() => import('@/pages/Receivables').then((m) => ({ default: m.ReceivablesPage })));
const UsersPage = lazy(() => import('@/pages/Users').then((m) => ({ default: m.UsersPage })));
const TerritoriesPage = lazy(() => import('@/pages/Territories').then((m) => ({ default: m.TerritoriesPage })));
const ConfigPage = lazy(() => import('@/pages/Config').then((m) => ({ default: m.ConfigPage })));
const AuditPage = lazy(() => import('@/pages/Audit').then((m) => ({ default: m.AuditPage })));

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route
          path="*"
          element={
            <Suspense fallback={<LoadingState />}>
              <AuthedRoutes />
            </Suspense>
          }
        />
      </Route>
    </Routes>
  );
}

function AuthedRoutes() {
  return (
    <Routes>
      <Route index element={<Navigate to="/dashboard" replace />} />
      <Route path="dashboard" element={<DashboardPage />} />
      <Route
        path="live-ops"
        element={
          <RequireCap caps={['live_ops_view']}>
            <LiveOpsPage />
          </RequireCap>
        }
      />

      <Route path="outlets" element={<OutletsPage />} />
      <Route path="outlets/:id" element={<OutletDetailPage />} />
      <Route
        path="approvals"
        element={
          <RequireCap caps={['approve_outlets']}>
            <ApprovalsPage />
          </RequireCap>
        }
      />

      <Route path="orders" element={<OrdersPage />} />
      <Route path="orders/:id" element={<OrderDetailPage />} />

      <Route
        path="receivables"
        element={
          <RequireCap caps={['receivables_view']}>
            <ReceivablesPage />
          </RequireCap>
        }
      />

      <Route
        path="catalog"
        element={
          <RequireCap caps={['catalog_view']}>
            <CatalogPage />
          </RequireCap>
        }
      />
      <Route
        path="inventory"
        element={
          <RequireCap caps={['inventory_view']}>
            <InventoryPage />
          </RequireCap>
        }
      />

      <Route
        path="users"
        element={
          <RequireCap caps={['users_roles_config_audit']}>
            <UsersPage />
          </RequireCap>
        }
      />
      <Route
        path="territories"
        element={
          <RequireCap caps={['manage_routes', 'users_roles_config_audit']}>
            <TerritoriesPage />
          </RequireCap>
        }
      />
      <Route
        path="config"
        element={
          <RequireCap caps={['users_roles_config_audit']}>
            <ConfigPage />
          </RequireCap>
        }
      />
      <Route
        path="audit"
        element={
          <RequireCap caps={['users_roles_config_audit']}>
            <AuditPage />
          </RequireCap>
        }
      />

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
