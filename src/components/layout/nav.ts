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
  ShoppingBag,
  TicketPercent,
  Sparkles,
  BellRing,
  CookingPot,
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

// Store workspace nav (STORE_CONTRACT §7.4). Rendered when the Store workspace
// is active; gated by the seven store caps so a field-only role never sees it.
export const STORE_NAV: NavGroup[] = [
  {
    heading: 'Store',
    items: [
      {
        to: '/store/dashboard',
        label: 'Dashboard',
        icon: LayoutDashboard,
        caps: ['store_analytics_view'],
      },
      { to: '/store/orders', label: 'Orders', icon: ClipboardList, caps: ['store_orders_manage'] },
      { to: '/store/products', label: 'Products', icon: ShoppingBag, caps: ['store_products_manage'] },
    ],
  },
  {
    heading: 'Merchandising',
    items: [
      { to: '/store/promotions', label: 'Promotions', icon: Sparkles, caps: ['store_products_manage'] },
      { to: '/store/recipes', label: 'Recipes', icon: CookingPot, caps: ['store_products_manage'] },
      { to: '/store/coupons', label: 'Coupons', icon: TicketPercent, caps: ['store_coupons_manage'] },
      {
        to: '/store/stock-alerts',
        label: 'Stock Alerts',
        icon: BellRing,
        caps: ['store_products_manage'],
      },
    ],
  },
  {
    heading: 'Customers',
    items: [
      { to: '/store/customers', label: 'Customers', icon: Users, caps: ['store_customers_view'] },
    ],
  },
  {
    heading: 'Administration',
    items: [
      { to: '/store/settings', label: 'Settings', icon: Settings, caps: ['store_settings_manage'] },
    ],
  },
];
