// RBAC matrix from CONTRACT.md §5. Defense-in-depth: hide/disable what a role
// cannot do (backend also enforces). Territory scoping is server-side; the UI
// surfaces the caller's scope but never widens it.
import type { Role } from '@/api/types';

// Capabilities mirror the §5 capability rows, split into view vs. act where the
// matrix distinguishes "view" from full access.
export type Capability =
  // ---- Field-Sales workspace (CONTRACT.md §5) ----
  | 'visit_order_collect'
  | 'approve_outlets'
  | 'manage_routes'
  | 'catalog_view'
  | 'catalog_edit'
  | 'inventory_view'
  | 'inventory_edit'
  | 'receivables_view'
  | 'receivables_edit'
  | 'users_roles_config_audit'
  | 'analytics_view'
  | 'live_ops_view'
  // ---- Store workspace (STORE_CONTRACT.md §7.1) ----
  | 'store_products_manage'
  | 'store_orders_manage'
  | 'store_coupons_manage'
  | 'store_customers_view'
  | 'store_customers_manage'
  | 'store_settings_manage'
  | 'store_analytics_view';

// The two workspaces' capability buckets (STORE_CONTRACT §7.4). Used by the
// sidebar switcher, the workspace-aware default route, and the field-route
// guards so a store-only role never lands on a field page (and vice-versa).
export const FIELD_SALES_CAPS: Capability[] = [
  'visit_order_collect',
  'approve_outlets',
  'manage_routes',
  'catalog_view',
  'catalog_edit',
  'inventory_view',
  'inventory_edit',
  'receivables_view',
  'receivables_edit',
  'users_roles_config_audit',
  'analytics_view',
  'live_ops_view',
];

export const STORE_CAPS: Capability[] = [
  'store_products_manage',
  'store_orders_manage',
  'store_coupons_manage',
  'store_customers_view',
  'store_customers_manage',
  'store_settings_manage',
  'store_analytics_view',
];

const MATRIX: Record<Role, Capability[]> = {
  fsr: ['visit_order_collect', 'analytics_view', 'live_ops_view'],
  asm: [
    'visit_order_collect',
    'approve_outlets',
    'manage_routes',
    'receivables_view',
    'analytics_view',
    'live_ops_view',
  ],
  regional_head: [
    'approve_outlets',
    'manage_routes',
    'catalog_view',
    'inventory_view',
    'receivables_view',
    'analytics_view',
    'live_ops_view',
  ],
  warehouse_manager: ['inventory_view', 'inventory_edit', 'analytics_view'],
  finance: [
    'approve_outlets', // credit override (§5: approve outlets / credit override = finance)
    'receivables_view',
    'receivables_edit',
    'analytics_view',
  ],
  // STORE_CONTRACT §7.2/§7.3: store_manager gets the seven store caps and NO
  // field-sales caps (mirrors the backend default-deny in app/core/store_deps.py).
  store_manager: [
    'store_products_manage',
    'store_orders_manage',
    'store_coupons_manage',
    'store_customers_view',
    'store_customers_manage',
    'store_settings_manage',
    'store_analytics_view',
  ],
  // admin / super_admin span both worlds (§7.3).
  admin: [
    'visit_order_collect',
    'approve_outlets',
    'manage_routes',
    'catalog_view',
    'catalog_edit',
    'inventory_view',
    'inventory_edit',
    'receivables_view',
    'receivables_edit',
    'users_roles_config_audit',
    'analytics_view',
    'live_ops_view',
    'store_products_manage',
    'store_orders_manage',
    'store_coupons_manage',
    'store_customers_view',
    'store_customers_manage',
    'store_settings_manage',
    'store_analytics_view',
  ],
  super_admin: [
    'visit_order_collect',
    'approve_outlets',
    'manage_routes',
    'catalog_view',
    'catalog_edit',
    'inventory_view',
    'inventory_edit',
    'receivables_view',
    'receivables_edit',
    'users_roles_config_audit',
    'analytics_view',
    'live_ops_view',
    'store_products_manage',
    'store_orders_manage',
    'store_coupons_manage',
    'store_customers_view',
    'store_customers_manage',
    'store_settings_manage',
    'store_analytics_view',
  ],
};

export function can(role: Role | undefined, cap: Capability): boolean {
  if (!role) return false;
  return MATRIX[role]?.includes(cap) ?? false;
}

export function canAny(role: Role | undefined, caps: Capability[]): boolean {
  return caps.some((c) => can(role, c));
}

export const ROLE_LABELS: Record<Role, string> = {
  fsr: 'Field Sales Rep',
  asm: 'Area Sales Manager',
  regional_head: 'Regional / Sales Head',
  warehouse_manager: 'Warehouse Manager',
  finance: 'Finance / Collections',
  store_manager: 'Store Manager',
  admin: 'Admin',
  super_admin: 'Super Admin',
};

export function roleLabel(role: Role): string {
  return ROLE_LABELS[role] ?? role;
}

// ---------- Workspace helpers (STORE_CONTRACT §7.4) ----------
export type Workspace = 'field' | 'store';

export function hasFieldAccess(role: Role | undefined): boolean {
  return canAny(role, FIELD_SALES_CAPS);
}

export function hasStoreAccess(role: Role | undefined): boolean {
  return canAny(role, STORE_CAPS);
}

/**
 * Workspace-aware landing path. Field roles and admin/super_admin default to the
 * Field-Sales dashboard; a store-only role (store_manager) lands on the store
 * dashboard so it never hits a field analytics 403 storm.
 */
export function defaultWorkspacePath(role: Role | undefined): string {
  if (hasFieldAccess(role)) return '/dashboard';
  if (hasStoreAccess(role)) return '/store/dashboard';
  return '/dashboard';
}
