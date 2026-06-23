// Typed API client. One method per endpoint in CONTRACT.md §4.
// Grouped by module. All return typed promises.
import { request, newIdempotencyKey } from './http';
import type {
  AnalyticsSummary,
  AuditLog,
  CatalogSku,
  CoverageAnalytics,
  Inventory,
  LiveOps,
  LoginResponse,
  Notification,
  Order,
  OrderStatus,
  Outlet,
  OutletStatus,
  Paginated,
  Payment,
  PaymentMethod,
  PaymentType,
  ReceivablesAging,
  Route,
  SalesAnalytics,
  Sku,
  StrikeRateAnalytics,
  TenantConfig,
  Territory,
  User,
  Visit,
} from './types';

// ---------- Auth ----------
export const auth = {
  login: (email: string, password: string) =>
    request<LoginResponse>('/auth/login', { method: 'POST', body: { email, password } }),
  me: () => request<User>('/auth/me'),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
};

// ---------- Users / Org ----------
export interface UserInput {
  name: string;
  email: string;
  phone?: string;
  role: User['role'];
  territory_ids: string[];
  manager_id?: string | null;
  status?: 'active' | 'disabled';
  password?: string;
}

export const users = {
  list: (q?: { role?: string; q?: string; page?: number; page_size?: number }) =>
    request<Paginated<User>>('/users', { query: q }),
  get: (id: string) => request<User>(`/users/${id}`),
  create: (body: UserInput) => request<User>('/users', { method: 'POST', body }),
  update: (id: string, body: Partial<UserInput>) =>
    request<User>(`/users/${id}`, { method: 'PATCH', body }),
};

export interface TerritoryInput {
  name: string;
  parent_id?: string | null;
  type: Territory['type'];
  assigned_user_ids?: string[];
}

export const territories = {
  list: (q?: { type?: string; parent_id?: string }) =>
    request<Paginated<Territory>>('/territories', { query: q }),
  create: (body: TerritoryInput) =>
    request<Territory>('/territories', { method: 'POST', body }),
  update: (id: string, body: Partial<TerritoryInput>) =>
    request<Territory>(`/territories/${id}`, { method: 'PATCH', body }),
};

export interface RouteInput {
  name: string;
  rep_id: string;
  asm_id?: string;
  territory_id: string;
  outlet_ids: string[];
  day_of_week?: number;
  cycle?: string;
  active?: boolean;
}

export const routes = {
  list: (q?: { rep_id?: string; day?: number }) =>
    request<Paginated<Route>>('/routes', { query: q }),
  today: () => request<{ outlets: Outlet[]; route?: Route }>('/routes/today'),
  create: (body: RouteInput) => request<Route>('/routes', { method: 'POST', body }),
  update: (id: string, body: Partial<RouteInput>) =>
    request<Route>(`/routes/${id}`, { method: 'PATCH', body }),
};

// ---------- Outlets ----------
export interface OutletListQuery {
  status?: OutletStatus;
  q?: string;
  assigned_rep?: string;
  territory?: string;
  near?: string; // "lng,lat"
  radius?: number;
  page?: number;
  page_size?: number;
  [k: string]: string | number | boolean | undefined;
}

export const outlets = {
  list: (q?: OutletListQuery) => request<Paginated<Outlet>>('/outlets', { query: q }),
  get: (id: string) => request<Outlet>(`/outlets/${id}`),
  update: (id: string, body: Partial<Outlet>) =>
    request<Outlet>(`/outlets/${id}`, { method: 'PATCH', body }),
  pending: (q?: { page?: number; page_size?: number }) =>
    request<Paginated<Outlet>>('/outlets/pending', { query: q }),
  approve: (id: string, body?: { credit_limit?: number; outlet_class?: string; geofence_radius_m?: number }) =>
    request<Outlet>(`/outlets/${id}/approve`, { method: 'POST', body: body ?? {} }),
  reject: (id: string, reason: string) =>
    request<Outlet>(`/outlets/${id}/reject`, { method: 'POST', body: { reason } }),
  visits: (id: string, q?: { page?: number; page_size?: number }) =>
    request<Paginated<Visit>>(`/outlets/${id}/visits`, { query: q }),
  dedupe: (id: string, near?: string) =>
    request<{ items: Outlet[] }>(`/outlets/${id}/dedupe`, { query: { near } }),
};

// ---------- Visits ----------
export const visits = {
  list: (q?: { rep_id?: string; date?: string; outlet_id?: string; page?: number; page_size?: number }) =>
    request<Paginated<Visit>>('/visits', { query: q }),
  get: (id: string) => request<Visit>(`/visits/${id}`),
};

// ---------- Catalog / SKU ----------
export interface SkuInput {
  name: string;
  code: string;
  category: string;
  pack_size: string;
  unit: string;
  mrp: number;
  ptr: number;
  ptd: number;
  moq: number;
  hsn: string;
  gst_rate: number;
  image_url?: string;
  active?: boolean;
}

export const skus = {
  list: (q?: { q?: string; category?: string; active?: boolean; page?: number; page_size?: number }) =>
    request<Paginated<Sku>>('/skus', { query: q }),
  catalog: (warehouse_id?: string) =>
    request<Paginated<CatalogSku>>('/skus/catalog', { query: { warehouse_id } }),
  get: (id: string) => request<Sku>(`/skus/${id}`),
  create: (body: SkuInput) => request<Sku>('/skus', { method: 'POST', body }),
  update: (id: string, body: Partial<SkuInput>) =>
    request<Sku>(`/skus/${id}`, { method: 'PATCH', body }),
};

// ---------- Inventory / Warehouses ----------
export const inventory = {
  list: (q?: { warehouse_id?: string; low_stock?: boolean; page?: number; page_size?: number }) =>
    request<Paginated<Inventory>>('/inventory', { query: q }),
  update: (id: string, body: { qty_available?: number; reorder_level?: number }) =>
    request<Inventory>(`/inventory/${id}`, { method: 'PATCH', body }),
  lowStock: () => request<Paginated<Inventory>>('/inventory/low-stock'),
};

export const warehouses = {
  list: () => request<Paginated<import('./types').Warehouse>>('/warehouses'),
  create: (body: { name: string; code: string; territory_id?: string }) =>
    request<import('./types').Warehouse>('/warehouses', { method: 'POST', body }),
};

// ---------- Orders ----------
export interface OrderListQuery {
  status?: OrderStatus;
  rep?: string;
  outlet?: string;
  from?: string;
  to?: string;
  q?: string;
  page?: number;
  page_size?: number;
  [k: string]: string | number | boolean | undefined;
}

export const orders = {
  list: (q?: OrderListQuery) => request<Paginated<Order>>('/orders', { query: q }),
  get: (id: string) => request<Order>(`/orders/${id}`),
  transition: (id: string, to_status: OrderStatus, note?: string) =>
    request<Order>(`/orders/${id}/transition`, {
      method: 'POST',
      body: { to_status, note },
      idempotencyKey: newIdempotencyKey(),
    }),
  cancel: (id: string, reason: string) =>
    request<Order>(`/orders/${id}/cancel`, { method: 'POST', body: { reason } }),
  creditOverride: (id: string, approve: boolean, note?: string) =>
    request<Order>(`/orders/${id}/credit-override`, {
      method: 'POST',
      body: { approve, note },
    }),
};

// ---------- Payments / Receivables ----------
export interface PaymentInput {
  order_id: string;
  type: PaymentType;
  method: PaymentMethod;
  amount_collected: number;
  credit_days: number;
  reference?: string;
}

export const payments = {
  list: (q?: { outlet_id?: string; status?: string; page?: number; page_size?: number }) =>
    request<Paginated<Payment>>('/payments', { query: q }),
  create: (body: PaymentInput) =>
    request<Payment>('/payments', { method: 'POST', body, idempotencyKey: newIdempotencyKey() }),
  collect: (id: string, body: { amount: number; method: PaymentMethod; reference?: string }) =>
    request<Payment>(`/payments/${id}/collect`, {
      method: 'POST',
      body,
      idempotencyKey: newIdempotencyKey(),
    }),
  aging: () => request<ReceivablesAging>('/receivables/aging'),
};

// ---------- Analytics ----------
export const analytics = {
  summary: () => request<AnalyticsSummary>('/analytics/summary'),
  sales: (q: { group_by: 'sku' | 'rep' | 'region' | 'category'; from?: string; to?: string }) =>
    request<SalesAnalytics>('/analytics/sales', { query: q }),
  coverage: () => request<CoverageAnalytics>('/analytics/coverage'),
  strikeRate: () => request<StrikeRateAnalytics>('/analytics/strike-rate'),
  receivablesAging: () => request<ReceivablesAging>('/analytics/receivables-aging'),
  liveOps: () => request<LiveOps>('/analytics/live-ops'),
};

// ---------- Config / Admin ----------
export const config = {
  get: () => request<TenantConfig>('/config'),
  update: (body: Partial<TenantConfig>) =>
    request<TenantConfig>('/config', { method: 'PATCH', body }),
  auditLogs: (q?: { entity?: string; actor?: string; page?: number; page_size?: number }) =>
    request<Paginated<AuditLog>>('/audit-logs', { query: q }),
};

export const notifications = {
  list: () => request<Paginated<Notification>>('/notifications'),
  read: (id: string) => request<void>(`/notifications/${id}/read`, { method: 'POST' }),
};

export const api = {
  auth,
  users,
  territories,
  routes,
  outlets,
  visits,
  skus,
  inventory,
  warehouses,
  orders,
  payments,
  analytics,
  config,
  notifications,
};

export type Api = typeof api;
