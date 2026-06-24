// RBAC matrix from CONTRACT.md §5. Defense-in-depth: hide/disable what a role
// cannot do (backend also enforces). Territory scoping is server-side; the UI
// surfaces the caller's scope but never widens it.
import type { Role } from '@/api/types';

// Capabilities mirror the §5 capability rows, split into view vs. act where the
// matrix distinguishes "view" from full access.
export type Capability =
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
  | 'live_ops_view';

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
  admin: 'Admin',
  super_admin: 'Super Admin',
};

export function roleLabel(role: Role): string {
  return ROLE_LABELS[role] ?? role;
}
