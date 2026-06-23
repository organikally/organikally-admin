import type { Capability } from '@/auth/rbac';

export interface NavItem {
  to: string;
  label: string;
  icon: string; // simple glyph; keeps deps lean
  caps?: Capability[]; // visible if the role has ANY of these (undefined = always)
}

export interface NavGroup {
  heading: string;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  {
    heading: 'Overview',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: '◧', caps: ['analytics_view'] },
      { to: '/live-ops', label: 'Live Ops', icon: '◉', caps: ['live_ops_view'] },
    ],
  },
  {
    heading: 'Sales',
    items: [
      { to: '/outlets', label: 'Outlets', icon: '⌂' },
      {
        to: '/approvals',
        label: 'Approval Queue',
        icon: '✓',
        caps: ['approve_outlets'],
      },
      { to: '/orders', label: 'Orders', icon: '▤' },
      {
        to: '/receivables',
        label: 'Payments & Receivables',
        icon: '₹',
        caps: ['receivables_view'],
      },
    ],
  },
  {
    heading: 'Supply',
    items: [
      { to: '/catalog', label: 'SKUs / Catalog', icon: '◫', caps: ['catalog_view'] },
      { to: '/inventory', label: 'Inventory', icon: '▣', caps: ['inventory_view'] },
    ],
  },
  {
    heading: 'Administration',
    items: [
      {
        to: '/users',
        label: 'Users & Roles',
        icon: '☰',
        caps: ['users_roles_config_audit'],
      },
      {
        to: '/territories',
        label: 'Territories & Beats',
        icon: '◈',
        caps: ['manage_routes', 'users_roles_config_audit'],
      },
      { to: '/config', label: 'Config', icon: '⚙', caps: ['users_roles_config_audit'] },
      { to: '/audit', label: 'Audit Log', icon: '⎙', caps: ['users_roles_config_audit'] },
    ],
  },
];
