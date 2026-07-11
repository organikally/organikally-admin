// Typed STORE-admin API client (STORE_CONTRACT.md §6 + §6.9 DTOs).
// Mounted under /admin/store/**; reuses the same request()/newIdempotencyKey()
// helpers + Paginated<T> envelope as the Field-Sales client (§7.4).
import { request, newIdempotencyKey } from './http';
import type {
  Coupon,
  CouponInput,
  CustomerAdmin,
  CustomerStatus,
  MembershipAdmin,
  MembershipAnalytics,
  MembershipPlanAdmin,
  MembershipPlanInput,
  MembershipStatus,
  Paginated,
  PaymentStatus,
  PushCampaignAdmin,
  PushCampaignInput,
  PushDeviceAdmin,
  RecipeAdmin,
  RecipeInput,
  RecipeStatus,
  ReviewStatus,
  StockAlertAdmin,
  StockAlertStatus,
  StoreAnalyticsSummary,
  StoreConfig,
  StoreConfigInput,
  StoreOrderAdmin,
  StoreOrderStatus,
  StoreProductAdmin,
  StoreProductFlagsInput,
  StoreProductInput,
  StoreProductStatus,
  StoreReviewAdmin,
  WalletAdmin,
} from './types';

const P = '/admin/store';

// ---------- Products (store_products_manage, §6.1) ----------
export interface StoreProductListQuery {
  status?: StoreProductStatus;
  q?: string;
  category?: string;
  featured?: boolean;
  page?: number;
  page_size?: number;
  [k: string]: string | number | boolean | undefined;
}

export const storeProducts = {
  list: (q?: StoreProductListQuery) =>
    request<Paginated<StoreProductAdmin>>(`${P}/products`, { query: q }),
  get: (id: string) => request<StoreProductAdmin>(`${P}/products/${id}`),
  create: (body: StoreProductInput) =>
    request<StoreProductAdmin>(`${P}/products`, {
      method: 'POST',
      body,
      idempotencyKey: newIdempotencyKey(),
    }),
  update: (id: string, body: Partial<StoreProductInput>) =>
    request<StoreProductAdmin>(`${P}/products/${id}`, { method: 'PATCH', body }),
  publish: (id: string) =>
    request<StoreProductAdmin>(`${P}/products/${id}/publish`, { method: 'POST' }),
  unpublish: (id: string) =>
    request<StoreProductAdmin>(`${P}/products/${id}/unpublish`, { method: 'POST' }),
  archive: (id: string) =>
    request<StoreProductAdmin>(`${P}/products/${id}`, { method: 'DELETE' }),
  flags: (id: string, body: StoreProductFlagsInput) =>
    request<StoreProductAdmin>(`${P}/products/${id}/flags`, { method: 'POST', body }),
};

// ---------- Recipes (store_products_manage, RECIPES_CONTRACT §3) ----------
export interface StoreRecipeListQuery {
  status?: RecipeStatus;
  type?: string;
  q?: string;
  page?: number;
  page_size?: number;
  [k: string]: string | number | boolean | undefined;
}

export const storeRecipes = {
  list: (q?: StoreRecipeListQuery) =>
    request<Paginated<RecipeAdmin>>(`${P}/recipes`, { query: q }),
  get: (id: string) => request<RecipeAdmin>(`${P}/recipes/${id}`),
  create: (body: RecipeInput) =>
    request<RecipeAdmin>(`${P}/recipes`, {
      method: 'POST',
      body,
      idempotencyKey: newIdempotencyKey(),
    }),
  update: (id: string, body: Partial<RecipeInput>) =>
    request<RecipeAdmin>(`${P}/recipes/${id}`, { method: 'PATCH', body }),
  publish: (id: string) =>
    request<RecipeAdmin>(`${P}/recipes/${id}/publish`, { method: 'POST' }),
  unpublish: (id: string) =>
    request<RecipeAdmin>(`${P}/recipes/${id}/unpublish`, { method: 'POST' }),
  remove: (id: string) => request<RecipeAdmin>(`${P}/recipes/${id}`, { method: 'DELETE' }),
};

// ---------- Reviews (store_products_manage, REVIEWS_CONTRACT §4) ----------
export interface StoreReviewListQuery {
  status?: ReviewStatus;
  q?: string;
  page?: number;
  page_size?: number;
  [k: string]: string | number | boolean | undefined;
}

export const storeReviews = {
  list: (q?: StoreReviewListQuery) =>
    request<Paginated<StoreReviewAdmin>>(`${P}/reviews`, { query: q }),
  approve: (id: string) =>
    request<StoreReviewAdmin>(`${P}/reviews/${id}/approve`, {
      method: 'POST',
      idempotencyKey: newIdempotencyKey(),
    }),
  reject: (id: string, note?: string) =>
    request<StoreReviewAdmin>(`${P}/reviews/${id}/reject`, {
      method: 'POST',
      body: { note },
      idempotencyKey: newIdempotencyKey(),
    }),
  remove: (id: string) => request<StoreReviewAdmin>(`${P}/reviews/${id}`, { method: 'DELETE' }),
};

// ---------- Orders & fulfillment (store_orders_manage, §6.2) ----------
export interface StoreOrderListQuery {
  status?: StoreOrderStatus;
  payment_status?: PaymentStatus;
  q?: string;
  customer_id?: string;
  from?: string;
  to?: string;
  needs_reconciliation?: boolean;
  page?: number;
  page_size?: number;
  [k: string]: string | number | boolean | undefined;
}

export interface ShipInput {
  courier: string;
  awb: string;
  tracking_url?: string;
}

export const storeOrders = {
  list: (q?: StoreOrderListQuery) =>
    request<Paginated<StoreOrderAdmin>>(`${P}/orders`, { query: q }),
  get: (id: string) => request<StoreOrderAdmin>(`${P}/orders/${id}`),
  pack: (id: string) =>
    request<StoreOrderAdmin>(`${P}/orders/${id}/pack`, {
      method: 'POST',
      idempotencyKey: newIdempotencyKey(),
    }),
  ship: (id: string, body: ShipInput) =>
    request<StoreOrderAdmin>(`${P}/orders/${id}/ship`, {
      method: 'POST',
      body,
      idempotencyKey: newIdempotencyKey(),
    }),
  deliver: (id: string) =>
    request<StoreOrderAdmin>(`${P}/orders/${id}/deliver`, {
      method: 'POST',
      idempotencyKey: newIdempotencyKey(),
    }),
  cancel: (id: string, reason: string) =>
    request<StoreOrderAdmin>(`${P}/orders/${id}/cancel`, {
      method: 'POST',
      body: { reason },
      idempotencyKey: newIdempotencyKey(),
    }),
  refund: (id: string, body: { amount_paise?: number; reason: string }) =>
    request<StoreOrderAdmin>(`${P}/orders/${id}/refund`, {
      method: 'POST',
      body,
      idempotencyKey: newIdempotencyKey(),
    }),
  markReturned: (id: string, restock: boolean) =>
    request<StoreOrderAdmin>(`${P}/orders/${id}/mark-returned`, {
      method: 'POST',
      body: { restock },
      idempotencyKey: newIdempotencyKey(),
    }),
};

// ---------- Coupons (store_coupons_manage, §6.3) ----------
export const storeCoupons = {
  list: (q?: { active?: boolean; q?: string; page?: number; page_size?: number }) =>
    request<Paginated<Coupon>>(`${P}/coupons`, { query: q }),
  get: (id: string) => request<Coupon>(`${P}/coupons/${id}`),
  create: (body: CouponInput) =>
    request<Coupon>(`${P}/coupons`, { method: 'POST', body, idempotencyKey: newIdempotencyKey() }),
  update: (id: string, body: Partial<CouponInput>) =>
    request<Coupon>(`${P}/coupons/${id}`, { method: 'PATCH', body }),
  remove: (id: string) => request<Coupon>(`${P}/coupons/${id}`, { method: 'DELETE' }),
};

// ---------- Customers (view to read, manage to mutate, §6.4) ----------
export const storeCustomers = {
  list: (q?: { q?: string; status?: CustomerStatus; page?: number; page_size?: number }) =>
    request<Paginated<CustomerAdmin>>(`${P}/customers`, { query: q }),
  get: (id: string) => request<CustomerAdmin>(`${P}/customers/${id}`),
  setStatus: (id: string, status: CustomerStatus) =>
    request<CustomerAdmin>(`${P}/customers/${id}`, { method: 'PATCH', body: { status } }),
};

// ---------- Promotions (store_products_manage, §6.5) ----------
export const storePromotions = {
  setHero: (store_product_id: string) =>
    request<StoreProductAdmin>(`${P}/promotions/hero`, {
      method: 'POST',
      body: { store_product_id },
    }),
};

// ---------- Settings (store_settings_manage, §6.6) ----------
export const storeSettings = {
  get: () => request<StoreConfig>(`${P}/settings`),
  update: (body: StoreConfigInput) =>
    request<StoreConfig>(`${P}/settings`, { method: 'PATCH', body }),
};

// ---------- Stock-alert subscribers (store_products_manage, §6.7) ----------
export const storeStockAlerts = {
  list: (q?: { sku_id?: string; status?: StockAlertStatus; page?: number; page_size?: number }) =>
    request<Paginated<StockAlertAdmin>>(`${P}/stock-alerts`, { query: q }),
};

// ---------- Analytics summary (store_analytics_view, §6.8) ----------
export const storeAnalytics = {
  summary: (q?: { from?: string; to?: string }) =>
    request<StoreAnalyticsSummary>(`${P}/analytics/summary`, { query: q }),
};

// ---------- Store-scoped lookups (store-cap gated, so a pure store_manager
//            can pick a SKU / warehouse by name without field-sales caps) ----------
export interface StoreSkuOption {
  id: string;
  name: string;
  code: string;
  category: string;
  pack_size: string;
  unit: string;
  mrp: number;
  active: boolean;
}

export interface StoreWarehouseOption {
  id: string;
  name: string;
  code: string;
}

export const storeSkus = (q?: {
  q?: string;
  active?: boolean;
  page?: number;
  page_size?: number;
}) => request<Paginated<StoreSkuOption>>(`${P}/skus`, { query: q });

export const storeWarehouses = () =>
  request<{ items: StoreWarehouseOption[] }>(`${P}/warehouses`);

// ============================================================================
// Organikaly Club — Membership, Coins Wallet & Push (MEMBERSHIP_CONTRACT §8)
// Mounted under /admin/store/**; each op reuses an existing store cap (no new
// capability). Mutations carry an Idempotency-Key exactly like the other store
// clients; list envelopes use the shared Paginated<T> shape.
// ============================================================================

// ---------- Memberships (view to read, manage to mutate, §8) ----------
export interface MembershipListQuery {
  status?: MembershipStatus;
  q?: string;
  page?: number;
  page_size?: number;
  [k: string]: string | number | boolean | undefined;
}

export const storeMemberships = {
  list: (q?: MembershipListQuery) =>
    request<Paginated<MembershipAdmin>>(`${P}/memberships`, { query: q }),
  get: (id: string) => request<MembershipAdmin>(`${P}/memberships/${id}`),
  grant: (body: { customer_id: string; plan_id?: string; duration_days?: number }) =>
    request<MembershipAdmin>(`${P}/memberships/grant`, {
      method: 'POST',
      body,
      idempotencyKey: newIdempotencyKey(),
    }),
  revoke: (id: string) =>
    request<MembershipAdmin>(`${P}/memberships/${id}/revoke`, {
      method: 'POST',
      idempotencyKey: newIdempotencyKey(),
    }),
  extend: (id: string, days: number) =>
    request<MembershipAdmin>(`${P}/memberships/${id}/extend`, {
      method: 'POST',
      body: { days },
      idempotencyKey: newIdempotencyKey(),
    }),
  analytics: (q?: { from?: string; to?: string }) =>
    request<MembershipAnalytics>(`${P}/memberships/analytics`, { query: q }),
};

// ---------- Membership plan / club product config (store_settings_manage, §8) ----------
export const storeMembershipPlans = {
  list: () => request<{ items: MembershipPlanAdmin[] }>(`${P}/membership-plans`),
  create: (body: MembershipPlanInput) =>
    request<MembershipPlanAdmin>(`${P}/membership-plans`, {
      method: 'POST',
      body,
      idempotencyKey: newIdempotencyKey(),
    }),
  update: (id: string, body: Partial<MembershipPlanInput>) =>
    request<MembershipPlanAdmin>(`${P}/membership-plans/${id}`, { method: 'PATCH', body }),
};

// ---------- Coin wallets (view to read, manage to adjust, §8) ----------
export const storeWallets = {
  get: (customerId: string) => request<WalletAdmin>(`${P}/wallets/${customerId}`),
  adjust: (customerId: string, body: { delta_coins: number; note: string }) =>
    request<WalletAdmin>(`${P}/wallets/${customerId}/adjust`, {
      method: 'POST',
      body,
      idempotencyKey: newIdempotencyKey(),
    }),
};

// ---------- Push campaigns + device registry (store_customers_manage/view, §8) ----------
export interface PushCampaignListQuery {
  page?: number;
  page_size?: number;
  [k: string]: string | number | boolean | undefined;
}

export interface PushDeviceListQuery {
  customer_id?: string;
  page?: number;
  page_size?: number;
  [k: string]: string | number | boolean | undefined;
}

export const storePush = {
  campaigns: (q?: PushCampaignListQuery) =>
    request<Paginated<PushCampaignAdmin>>(`${P}/push/campaigns`, { query: q }),
  sendCampaign: (body: PushCampaignInput) =>
    request<PushCampaignAdmin>(`${P}/push/campaigns`, {
      method: 'POST',
      body,
      idempotencyKey: newIdempotencyKey(),
    }),
  devices: (q?: PushDeviceListQuery) =>
    request<Paginated<PushDeviceAdmin>>(`${P}/push/devices`, { query: q }),
};

// ---------- Media upload (reuses existing media endpoints, §6.1) ----------
export const storeMedia = {
  upload: (file: File, kind = 'store_product') => {
    const form = new FormData();
    form.append('file', file);
    form.append('kind', kind);
    return request<{ url: string }>('/media/upload', { method: 'POST', form });
  },
};

export const storeApi = {
  products: storeProducts,
  recipes: storeRecipes,
  reviews: storeReviews,
  orders: storeOrders,
  coupons: storeCoupons,
  customers: storeCustomers,
  promotions: storePromotions,
  settings: storeSettings,
  stockAlerts: storeStockAlerts,
  analytics: storeAnalytics,
  media: storeMedia,
  skus: storeSkus,
  warehouses: storeWarehouses,
  memberships: storeMemberships,
  membershipPlans: storeMembershipPlans,
  wallets: storeWallets,
  push: storePush,
};

export type StoreApi = typeof storeApi;
