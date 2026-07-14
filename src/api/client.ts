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
  NotificationList,
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
  // Prior-period companions + review/overdue counters. Optional on the wire: an
  // older backend omits them and the UI then hides the growth chips instead of
  // showing a fabricated 0%.
  coverage_pct_prev?: number;
  strike_rate_pct_prev?: number;
  sales_total_prev?: number;
  orders_prev?: number;
  visits_prev?: number;
  outstanding_overdue?: number;
  pending_approvals?: number;
}
interface RawCoveragePoint {
  date: string;
  visited: number;
  active_outlets: number;
  coverage_pct: number;
}
interface RawCoverageRep {
  rep_id: string;
  rep_name: string;
  assigned_outlets: number;
  visited: number;
  coverage_pct: number;
}
interface RawCoverage {
  total_outlets: number;
  active_outlets: number;
  outlets_visited_mtd: number;
  coverage_pct: number;
  series?: RawCoveragePoint[];
  by_rep?: RawCoverageRep[];
}
interface RawLiveOpsRep {
  rep_id: string;
  rep_name: string;
  visits_today: number;
  planned_outlets: number;
  route_progress_pct: number;
  last_location?: GeoPoint | null;
  last_seen_at?: string | null;
  last_outlet_id?: string | null;
  last_outlet_name?: string | null;
}
interface RawLiveOps {
  items: RawLiveOpsRep[];
}
interface RawStrikeRatePoint {
  date: string;
  visits: number;
  productive: number;
  strike_rate_pct: number;
}
interface RawStrikeRateRep {
  rep_id: string;
  rep_name: string;
  visits: number;
  productive: number;
  strike_rate_pct: number;
}
interface RawStrikeRate {
  visits: number;
  productive: number;
  strike_rate_pct: number;
  series?: RawStrikeRatePoint[];
  by_rep?: RawStrikeRateRep[];
}

// Analytics numbers must never render as NaN in a KPI tile or a chart axis.
const n = (v: unknown, fallback = 0): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;

// `undefined` (field absent) is meaningfully different from 0 (real zero): the
// first hides a growth chip, the second draws a flat one.
const optN = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined;

const arr = <T,>(v: T[] | undefined | null): T[] => (Array.isArray(v) ? v : []);

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
      coverage_pct: n(r.coverage_pct),
      coverage_pct_prev: optN(r.coverage_pct_prev),
      strike_rate_pct: n(r.strike_rate_pct),
      strike_rate_pct_prev: optN(r.strike_rate_pct_prev),
      sales_mtd: n(r.sales_total_mtd),
      sales_prev: optN(r.sales_total_prev),
      outstanding_total: n(r.outstanding),
      outstanding_overdue: optN(r.outstanding_overdue),
      active_outlets: n(r.active_outlets),
      pending_approvals: optN(r.pending_approvals),
      visits_mtd: optN(r.visits_mtd),
      visits_prev: optN(r.visits_prev),
      orders_mtd: optN(r.orders_mtd),
      orders_prev: optN(r.orders_prev),
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
  // `series` is the month-to-date CUMULATIVE coverage trend; `by_rep` is every rep
  // in the caller's territory scope. Both are absent on an un-upgraded backend, in
  // which case the dashboard shows its empty state rather than a blank chart.
  coverage: async (): Promise<CoverageAnalytics> => {
    const r = await request<RawCoverage>('/analytics/coverage');
    return {
      overall_coverage_pct: n(r.coverage_pct),
      outlet_coverage_pct: r.total_outlets ? (n(r.outlets_visited_mtd) / r.total_outlets) * 100 : 0,
      series: arr(r.series).map((p) => ({
        date: p.date,
        visited: n(p.visited),
        active_outlets: n(p.active_outlets),
        coverage_pct: n(p.coverage_pct),
      })),
      by_rep: arr(r.by_rep)
        .map((rep) => ({
          rep_id: rep.rep_id,
          rep_name: rep.rep_name,
          assigned_outlets: n(rep.assigned_outlets),
          visited: n(rep.visited),
          coverage_pct: n(rep.coverage_pct),
        }))
        .sort((a, b) => b.coverage_pct - a.coverage_pct),
    };
  },
  // `series` here is PER-DAY (a daily conversion rate, not a running total).
  strikeRate: async (): Promise<StrikeRateAnalytics> => {
    const r = await request<RawStrikeRate>('/analytics/strike-rate');
    return {
      overall_pct: n(r.strike_rate_pct),
      visits: n(r.visits),
      productive: n(r.productive),
      series: arr(r.series).map((p) => ({
        date: p.date,
        visits: n(p.visits),
        productive: n(p.productive),
        strike_rate_pct: n(p.strike_rate_pct),
      })),
      by_rep: arr(r.by_rep)
        .map((rep) => ({
          rep_id: rep.rep_id,
          rep_name: rep.rep_name,
          visits: n(rep.visits),
          productive: n(rep.productive),
          strike_rate_pct: n(rep.strike_rate_pct),
        }))
        .sort((a, b) => b.strike_rate_pct - a.strike_rate_pct),
    };
  },
  receivablesAging: () => agingFromRaw(request<RawAging>('/analytics/receivables-aging')),
  liveOps: async (): Promise<LiveOps> => {
    const r = await request<RawLiveOps>('/analytics/live-ops');
    return {
      reps: arr(r.items).map((it) => ({
        rep_id: it.rep_id,
        rep_name: it.rep_name,
        visits_today: n(it.visits_today),
        planned_today: n(it.planned_outlets),
        route_progress_pct: n(it.route_progress_pct),
        last_location: it.last_location ?? null,
        last_seen_at: it.last_seen_at ?? null,
        last_outlet_id: it.last_outlet_id ?? null,
        last_outlet_name: it.last_outlet_name ?? null,
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

// ---------- Notifications (§3) ----------
// Role-agnostic: every authenticated staff user reads their OWN feed (the
// backend scopes by user_id + tenant). This is the only delivery surface for
// the `inventory.low_stock` / `receivable.overdue` events, whose recipients
// (warehouse_manager, finance) are not field-app roles.
//
// Wire shape is `{ items, unread_count }` with a `limit` (1..200) — there is no
// page/page_size on this endpoint, so the UI pages by growing the limit.
export const NOTIFICATIONS_MAX_LIMIT = 200;

export const notifications = {
  list: async (q?: { unread_only?: boolean; limit?: number }): Promise<NotificationList> => {
    const r = await request<{ items?: Notification[]; unread_count?: number }>('/notifications', {
      query: {
        unread_only: q?.unread_only ? true : undefined,
        limit: q?.limit ? Math.min(q.limit, NOTIFICATIONS_MAX_LIMIT) : undefined,
      },
    });
    return {
      items: Array.isArray(r.items) ? r.items : [],
      unread_count: typeof r.unread_count === 'number' ? r.unread_count : 0,
    };
  },
  markRead: (id: string) =>
    request<{ detail: string }>(`/notifications/${id}/read`, { method: 'POST' }),
  markAllRead: () =>
    request<{ detail: string; updated: number | null }>('/notifications/read-all', {
      method: 'POST',
    }),
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
