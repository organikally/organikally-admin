import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Radio,
  Store,
  CheckSquare,
  ClipboardList,
  IndianRupee,
  PackageSearch,
  Boxes,
  Users,
  Map as MapIcon,
  Settings,
  ScrollText,
} from 'lucide-react';
import type { Capability } from '@/auth/rbac';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
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
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, caps: ['analytics_view'] },
      { to: '/live-ops', label: 'Live Ops', icon: Radio, caps: ['live_ops_view'] },
    ],
  },
  {
    heading: 'Sales',
    items: [
      { to: '/outlets', label: 'Outlets', icon: Store },
      {
        to: '/approvals',
        label: 'Approval Queue',
        icon: CheckSquare,
        caps: ['approve_outlets'],
      },
      { to: '/orders', label: 'Orders', icon: ClipboardList },
      {
        to: '/receivables',
        label: 'Payments & Receivables',
        icon: IndianRupee,
        caps: ['receivables_view'],
      },
    ],
  },
  {
    heading: 'Supply',
    items: [
      { to: '/catalog', label: 'SKUs / Catalog', icon: PackageSearch, caps: ['catalog_view'] },
      { to: '/inventory', label: 'Inventory', icon: Boxes, caps: ['inventory_view'] },
    ],
  },
  {
    heading: 'Administration',
    items: [
      {
        to: '/users',
        label: 'Users & Roles',
        icon: Users,
        caps: ['users_roles_config_audit'],
      },
      {
        to: '/territories',
        label: 'Territories & Beats',
        icon: MapIcon,
        caps: ['manage_routes', 'users_roles_config_audit'],
      },
      { to: '/config', label: 'Config', icon: Settings, caps: ['users_roles_config_audit'] },
      { to: '/audit', label: 'Audit Log', icon: ScrollText, caps: ['users_roles_config_audit'] },
    ],
  },
];
