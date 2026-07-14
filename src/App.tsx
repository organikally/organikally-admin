import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { RequireAuth, RequireCap } from '@/components/layout/Guards';
import { LoadingState } from '@/components/ui/primitives';
import { LoginPage } from '@/pages/Login';
import { useAuth } from '@/auth/AuthContext';
import { defaultWorkspacePath, FIELD_SALES_CAPS } from '@/auth/rbac';

// Lazy-load the authenticated screens so the login bundle stays small and
// chart-heavy pages (Recharts) are only fetched when visited.
const DashboardPage = lazy(() => import('@/pages/Dashboard').then((m) => ({ default: m.DashboardPage })));
const LiveOpsPage = lazy(() => import('@/pages/LiveOps').then((m) => ({ default: m.LiveOpsPage })));
const OutletsPage = lazy(() => import('@/pages/Outlets').then((m) => ({ default: m.OutletsPage })));
const OutletDetailPage = lazy(() => import('@/pages/OutletDetail').then((m) => ({ default: m.OutletDetailPage })));
const ApprovalsPage = lazy(() => import('@/pages/Approvals').then((m) => ({ default: m.ApprovalsPage })));
const CatalogPage = lazy(() => import('@/pages/Catalog').then((m) => ({ default: m.CatalogPage })));
const InventoryPage = lazy(() => import('@/pages/Inventory').then((m) => ({ default: m.InventoryPage })));
const WarehousesPage = lazy(() => import('@/pages/Warehouses').then((m) => ({ default: m.WarehousesPage })));
const RoutesPage = lazy(() => import('@/pages/Routes').then((m) => ({ default: m.RoutesPage })));
const OrdersPage = lazy(() => import('@/pages/Orders').then((m) => ({ default: m.OrdersPage })));
const OrderDetailPage = lazy(() => import('@/pages/OrderDetail').then((m) => ({ default: m.OrderDetailPage })));
const ReceivablesPage = lazy(() => import('@/pages/Receivables').then((m) => ({ default: m.ReceivablesPage })));
const UsersPage = lazy(() => import('@/pages/Users').then((m) => ({ default: m.UsersPage })));
const TerritoriesPage = lazy(() => import('@/pages/Territories').then((m) => ({ default: m.TerritoriesPage })));
const ConfigPage = lazy(() => import('@/pages/Config').then((m) => ({ default: m.ConfigPage })));
const AuditPage = lazy(() => import('@/pages/Audit').then((m) => ({ default: m.AuditPage })));

// Notifications — the only delivery surface for staff alerts. Deliberately NOT
// capability-gated: every authenticated role (incl. warehouse_manager & finance,
// who cannot log into the field app) receives its own feed.
const NotificationsPage = lazy(() =>
  import('@/pages/Notifications').then((m) => ({ default: m.NotificationsPage })),
);

// Guides — admin video learning (LEARN_CONTRACT §4).
const GuidesPage = lazy(() => import('@/pages/Guides').then((m) => ({ default: m.GuidesPage })));
const GuidePlayerPage = lazy(() => import('@/pages/GuidePlayer').then((m) => ({ default: m.GuidePlayerPage })));

// Store workspace screens (STORE_CONTRACT §7.4), under the /store/* prefix.
const StoreDashboardPage = lazy(() => import('@/pages/store/StoreDashboard').then((m) => ({ default: m.StoreDashboardPage })));
const StoreProductsPage = lazy(() => import('@/pages/store/StoreProducts').then((m) => ({ default: m.StoreProductsPage })));
const StoreProductEditorPage = lazy(() => import('@/pages/store/StoreProductEditor').then((m) => ({ default: m.StoreProductEditorPage })));
const StoreRecipesPage = lazy(() => import('@/pages/store/StoreRecipes').then((m) => ({ default: m.StoreRecipesPage })));
const StoreRecipeEditorPage = lazy(() => import('@/pages/store/StoreRecipeEditor').then((m) => ({ default: m.StoreRecipeEditorPage })));
const StoreReviewsPage = lazy(() => import('@/pages/store/StoreReviews').then((m) => ({ default: m.StoreReviewsPage })));
const StoreOrdersPage = lazy(() => import('@/pages/store/StoreOrders').then((m) => ({ default: m.StoreOrdersPage })));
const StoreOrderDetailPage = lazy(() => import('@/pages/store/StoreOrderDetail').then((m) => ({ default: m.StoreOrderDetailPage })));
const StoreCouponsPage = lazy(() => import('@/pages/store/StoreCoupons').then((m) => ({ default: m.StoreCouponsPage })));
const StoreCustomersPage = lazy(() => import('@/pages/store/StoreCustomers').then((m) => ({ default: m.StoreCustomersPage })));
const StoreCustomerDetailPage = lazy(() => import('@/pages/store/StoreCustomerDetail').then((m) => ({ default: m.StoreCustomerDetailPage })));
const StorePromotionsPage = lazy(() => import('@/pages/store/StorePromotions').then((m) => ({ default: m.StorePromotionsPage })));
const StoreSettingsPage = lazy(() => import('@/pages/store/StoreSettings').then((m) => ({ default: m.StoreSettingsPage })));
const StoreStockAlertsPage = lazy(() => import('@/pages/store/StoreStockAlerts').then((m) => ({ default: m.StoreStockAlertsPage })));
const StoreMembersPage = lazy(() => import('@/pages/store/StoreMembers').then((m) => ({ default: m.StoreMembersPage })));
const StoreMemberDetailPage = lazy(() => import('@/pages/store/StoreMemberDetail').then((m) => ({ default: m.StoreMemberDetailPage })));
const StoreMembershipSettingsPage = lazy(() => import('@/pages/store/StoreMembershipSettings').then((m) => ({ default: m.StoreMembershipSettingsPage })));
const StorePushCampaignsPage = lazy(() => import('@/pages/store/StorePushCampaigns').then((m) => ({ default: m.StorePushCampaignsPage })));

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
  const { user } = useAuth();
  // Workspace-aware landing so a store-only role never hits a field page (§7.4).
  const home = defaultWorkspacePath(user?.role);

  return (
    <Routes>
      <Route index element={<Navigate to={home} replace />} />

      {/* -------- Notifications (every role, no cap gate) -------- */}
      <Route path="notifications" element={<NotificationsPage />} />

      {/* -------- Field Sales workspace -------- */}
      <Route
        path="dashboard"
        element={
          <RequireCap caps={['analytics_view']}>
            <DashboardPage />
          </RequireCap>
        }
      />
      <Route
        path="live-ops"
        element={
          <RequireCap caps={['live_ops_view']}>
            <LiveOpsPage />
          </RequireCap>
        }
      />
      <Route
        path="outlets"
        element={
          <RequireCap caps={FIELD_SALES_CAPS}>
            <OutletsPage />
          </RequireCap>
        }
      />
      <Route
        path="outlets/:id"
        element={
          <RequireCap caps={FIELD_SALES_CAPS}>
            <OutletDetailPage />
          </RequireCap>
        }
      />
      <Route
        path="approvals"
        element={
          <RequireCap caps={['approve_outlets']}>
            <ApprovalsPage />
          </RequireCap>
        }
      />
      <Route
        path="orders"
        element={
          <RequireCap caps={FIELD_SALES_CAPS}>
            <OrdersPage />
          </RequireCap>
        }
      />
      <Route
        path="orders/:id"
        element={
          <RequireCap caps={FIELD_SALES_CAPS}>
            <OrderDetailPage />
          </RequireCap>
        }
      />
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
        path="warehouses"
        element={
          <RequireCap caps={['inventory_view']}>
            <WarehousesPage />
          </RequireCap>
        }
      />
      <Route
        path="routes"
        element={
          <RequireCap caps={['manage_routes']}>
            <RoutesPage />
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

      {/* -------- Guides (video learning, LEARN_CONTRACT §4) -------- */}
      <Route
        path="guides"
        element={
          <RequireCap caps={['learn_admin_view']}>
            <GuidesPage />
          </RequireCap>
        }
      />
      <Route
        path="guides/:slug"
        element={
          <RequireCap caps={['learn_admin_view']}>
            <GuidePlayerPage />
          </RequireCap>
        }
      />

      {/* -------- Store workspace (/store/*) -------- */}
      <Route
        path="store/dashboard"
        element={
          <RequireCap caps={['store_analytics_view']}>
            <StoreDashboardPage />
          </RequireCap>
        }
      />
      <Route
        path="store/products"
        element={
          <RequireCap caps={['store_products_manage']}>
            <StoreProductsPage />
          </RequireCap>
        }
      />
      <Route
        path="store/products/:id"
        element={
          <RequireCap caps={['store_products_manage']}>
            <StoreProductEditorPage />
          </RequireCap>
        }
      />
      <Route
        path="store/recipes"
        element={
          <RequireCap caps={['store_products_manage']}>
            <StoreRecipesPage />
          </RequireCap>
        }
      />
      <Route
        path="store/recipes/:id"
        element={
          <RequireCap caps={['store_products_manage']}>
            <StoreRecipeEditorPage />
          </RequireCap>
        }
      />
      <Route
        path="store/reviews"
        element={
          <RequireCap caps={['store_products_manage']}>
            <StoreReviewsPage />
          </RequireCap>
        }
      />
      <Route
        path="store/orders"
        element={
          <RequireCap caps={['store_orders_manage']}>
            <StoreOrdersPage />
          </RequireCap>
        }
      />
      <Route
        path="store/orders/:id"
        element={
          <RequireCap caps={['store_orders_manage']}>
            <StoreOrderDetailPage />
          </RequireCap>
        }
      />
      <Route
        path="store/coupons"
        element={
          <RequireCap caps={['store_coupons_manage']}>
            <StoreCouponsPage />
          </RequireCap>
        }
      />
      <Route
        path="store/customers"
        element={
          <RequireCap caps={['store_customers_view']}>
            <StoreCustomersPage />
          </RequireCap>
        }
      />
      <Route
        path="store/customers/:id"
        element={
          <RequireCap caps={['store_customers_view']}>
            <StoreCustomerDetailPage />
          </RequireCap>
        }
      />
      <Route
        path="store/promotions"
        element={
          <RequireCap caps={['store_products_manage']}>
            <StorePromotionsPage />
          </RequireCap>
        }
      />
      <Route
        path="store/stock-alerts"
        element={
          <RequireCap caps={['store_products_manage']}>
            <StoreStockAlertsPage />
          </RequireCap>
        }
      />
      <Route
        path="store/settings"
        element={
          <RequireCap caps={['store_settings_manage']}>
            <StoreSettingsPage />
          </RequireCap>
        }
      />
      <Route
        path="store/members"
        element={
          <RequireCap caps={['store_customers_view']}>
            <StoreMembersPage />
          </RequireCap>
        }
      />
      <Route
        path="store/members/:id"
        element={
          <RequireCap caps={['store_customers_view']}>
            <StoreMemberDetailPage />
          </RequireCap>
        }
      />
      <Route
        path="store/membership-settings"
        element={
          <RequireCap caps={['store_settings_manage']}>
            <StoreMembershipSettingsPage />
          </RequireCap>
        }
      />
      <Route
        path="store/push"
        element={
          <RequireCap caps={['store_customers_manage']}>
            <StorePushCampaignsPage />
          </RequireCap>
        }
      />

      <Route path="*" element={<Navigate to={home} replace />} />
    </Routes>
  );
}
