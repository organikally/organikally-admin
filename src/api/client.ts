// Typed API client. One method per endpoint in CONTRACT.md §4.
// Grouped by module. All return typed promises.
import { request, newIdempotencyKey } from './http';
import type {
  AgingBucket,
  AnalyticsSummary,
  AuditLog,
  CatalogSku,
  CoverageAnalytics,
  GeoPoint,
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
  // Backend returns { route, outlet_ids, day_of_week }, not { outlets, route }.
  today: async (): Promise<{ route: Route | null; outlet_ids: string[]; day_of_week: number }> => {
    const r = await request<{ route?: Route | null; outlet_ids?: string[]; day_of_week?: number }>(
      '/routes/today',
    );
    return {
      route: r.route ?? null,
      outlet_ids: Array.isArray(r.outlet_ids) ? r.outlet_ids : [],
      day_of_week: r.day_of_week ?? 0,
    };
  },
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
  // Backend returns { items, total }; guarantee items is always an array.
  dedupe: async (id: string, near?: string): Promise<{ items: Outlet[] }> => {
    const r = await request<{ items?: Outlet[] }>(`/outlets/${id}/dedupe`, { query: { near } });
    return { items: Array.isArray(r.items) ? r.items : [] };
  },
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

// ---------- Media (upload → S3, returns a public URL) ----------
// One endpoint for every admin media touchpoint. Images always allowed; video
// allowed for admin content kinds. Reused via the <MediaField> component.
export const media = {
  upload: (file: File, kind = 'admin') => {
    const form = new FormData();
    form.append('file', file);
    form.append('kind', kind);
    return request<{ url: string }>('/media/upload', { method: 'POST', form });
  },
};

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
// Opening-stock row for a sku+warehouse pair. Backend returns 409 if a row
// already exists for that pair (use inventory.update to adjust it instead).
export interface InventoryCreateInput {
  sku_id: string;
  warehouse_id: string;
  qty_available: number;
  reorder_point: number | null;
}

export const inventory = {
  list: (q?: { warehouse_id?: string; low_stock?: boolean; page?: number; page_size?: number }) =>
    request<Paginated<Inventory>>('/inventory', { query: q }),
  create: (body: InventoryCreateInput) =>
    request<Inventory>('/inventory', { method: 'POST', body }),
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
  aging: () => agingFromRaw(request<RawAging>('/receivables/aging')),
};

// ---------- Analytics ----------
// The backend analytics endpoints return different field names/shapes than the
// admin's view types; normalize here so the dashboard components stay stable.
interface RawSalesRow {
  key: string;
  name: string;
  total: number;
  qty: number;
  growth_pct: number;
  prior_total: number;
}
interface RawSales {
  group_by: SalesAnalytics['group_by'];
  rows: RawSalesRow[];
  grand_total: number;
  prior_grand_total: number;
}
interface RawAgingBucket {
  total: number;
  outlet_count: number;
  outlets: string[];
}
interface RawAging {
  buckets: Record<string, RawAgingBucket>;
}
interface RawSummary {
  coverage_pct: number;
  strike_rate_pct: number;
  sales_total_mtd: number;
  outstanding: number;
  total_outlets: number;
  active_outlets: number;
  visits_mtd: number;
  orders_mtd: number;
}
interface RawCoverage {
  total_outlets: number;
  active_outlets: number;
  outlets_visited_mtd: number;
  coverage_pct: number;
}
interface RawLiveOpsRep {
  rep_id: string;
  rep_name: string;
  visits_today: number;
  planned_outlets: number;
  route_progress_pct: number;
  last_location?: GeoPoint | null;
  last_seen_at?: string | null;
}
interface RawLiveOps {
  items: RawLiveOpsRep[];
}
interface RawStrikeRate {
  visits: number;
  productive: number;
  strike_rate_pct: number;
}

const AGING_ORDER: AgingBucket['bucket'][] = ['0-30', '31-60', '60+'];

async function agingFromRaw(p: Promise<RawAging>): Promise<ReceivablesAging> {
  const r = await p;
  const buckets: AgingBucket[] = AGING_ORDER.map((bucket) => {
    const raw = r.buckets?.[bucket] ?? { total: 0, outlet_count: 0, outlets: [] };
    return {
      bucket,
      total: raw.total ?? 0,
      count: raw.outlet_count ?? 0,
      outlets: (Array.isArray(raw.outlets) ? raw.outlets : []).map((id) => ({
        outlet_id: id,
        outlet_name: '',
        amount: 0,
        days: 0,
      })),
    };
  });
  return { buckets, total_outstanding: buckets.reduce((s, b) => s + b.total, 0) };
}

export const analytics = {
  summary: async (): Promise<AnalyticsSummary> => {
    const r = await request<RawSummary>('/analytics/summary');
    return {
      coverage_pct: r.coverage_pct,
      strike_rate_pct: r.strike_rate_pct,
      sales_mtd: r.sales_total_mtd,
      outstanding_total: r.outstanding,
      active_outlets: r.active_outlets,
    };
  },
  sales: async (q: {
    group_by: SalesAnalytics['group_by'];
    from?: string;
    to?: string;
  }): Promise<SalesAnalytics> => {
    const r = await request<RawSales>('/analytics/sales', { query: q });
    const current_total = r.grand_total ?? 0;
    const prior_total = r.prior_grand_total ?? 0;
    return {
      group_by: r.group_by ?? q.group_by,
      rows: (Array.isArray(r.rows) ? r.rows : []).map((row) => ({
        key: row.key,
        label: row.name,
        current: row.total,
        prior: row.prior_total,
        growth_pct: row.growth_pct,
      })),
      current_total,
      prior_total,
      growth_pct: prior_total ? ((current_total - prior_total) / prior_total) * 100 : 0,
    };
  },
  coverage: async (): Promise<CoverageAnalytics> => {
    const r = await request<RawCoverage>('/analytics/coverage');
    return {
      overall_coverage_pct: r.coverage_pct,
      outlet_coverage_pct: r.total_outlets ? (r.outlets_visited_mtd / r.total_outlets) * 100 : 0,
      series: [],
      by_rep: [],
    };
  },
  // Backend returns { visits, productive, strike_rate_pct } (tenant-wide, no per-rep
  // breakdown); normalize to the view type with an empty by_rep list.
  strikeRate: async (): Promise<StrikeRateAnalytics> => {
    const r = await request<RawStrikeRate>('/analytics/strike-rate');
    return {
      overall_pct: r.strike_rate_pct ?? 0,
      by_rep: [],
    };
  },
  receivablesAging: () => agingFromRaw(request<RawAging>('/analytics/receivables-aging')),
  liveOps: async (): Promise<LiveOps> => {
    const r = await request<RawLiveOps>('/analytics/live-ops');
    return {
      reps: (Array.isArray(r.items) ? r.items : []).map((it) => ({
        rep_id: it.rep_id,
        rep_name: it.rep_name,
        visits_today: it.visits_today,
        planned_today: it.planned_outlets,
        route_progress_pct: it.route_progress_pct,
        last_location: it.last_location ?? null,
        last_seen_at: it.last_seen_at ?? null,
        status: it.last_seen_at ? (it.visits_today > 0 ? 'active' : 'idle') : 'offline',
      })),
      server_time: new Date().toISOString(),
    };
  },
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
