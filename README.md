# Organikaly Admin Portal

Desktop-first web console for Organikaly's door-to-door field-sales platform. Managers, finance,
warehouse and admin staff use it to run coverage, sales, receivables, inventory and the pre-sales
order lifecycle. Role- and territory-scoped (RBAC).

Built against the cross-repo `CONTRACT.md` — field names, enums, endpoints, RBAC matrix and brand
tokens all come from there. This repo is independent (no shared package with the field app); the
design tokens are reproduced locally in `tailwind.config.js`.

## Stack

- Vite + React 18 + TypeScript
- Tailwind CSS (Organikaly brand tokens)
- TanStack Query (server state) + React Router
- Recharts (analytics)
- No map-tile dependency — a lightweight dependency-free `MiniMap` projects GeoJSON points for the
  outlets map and live-ops view.

## Getting started

```bash
npm install
cp .env.example .env       # point VITE_API_BASE at your backend
npm run dev                # http://localhost:5174
```

`VITE_API_BASE` defaults to `http://localhost:8000/api/v1` (contract §10).
`VITE_STORE_ENABLED` (optional, default `true`) hides the Store workspace when set to `false`.

## Workspaces

The portal hosts two RBAC-separated workspaces in one app, switched from a pill at the top of the
sidebar:

- **Field Sales** — the SFA console (dashboard, live ops, outlets, orders, receivables, catalog,
  inventory, admin). Gated by the §5 field-sales capabilities.
- **Store** — the D2C store admin (STORE_CONTRACT §6/§7) under the `/store/*` route prefix. Gated by
  the seven store capabilities (`store_products_manage`, `store_orders_manage`, `store_coupons_manage`,
  `store_customers_view`, `store_customers_manage`, `store_settings_manage`, `store_analytics_view`)
  carried by the `store_manager` role (plus `admin`/`super_admin`).

A role only sees the workspaces it has caps in: `store_manager` sees only Store, field roles see only
Field Sales, `admin`/`super_admin` see both. The landing route is workspace-aware (a store-only user
lands on `/store/dashboard`, never a field analytics page), and the previously-ungated field routes
(`/dashboard`, `/outlets`, `/orders`) are now cap-guarded so a store-only role gets the access screen
instead of firing field APIs. Money in the Store workspace is integer paise on the wire (STORE
§0.1) — displayed as INR via `formatPaise`, product price entered in INR and sent in INR (backend
converts), all other amounts converted to paise via `inrToPaise` before send.

### Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Type-check (`tsc -b`) then production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run preview` | Serve the production build |
| `npm run lint` | ESLint |

## Demo accounts (from the seed plan, §9)

Password for all: `Organikaly@123`

| Email | Role | Sees |
|---|---|---|
| `admin@organikaly.in` | Admin | Everything |
| `asm.delhi@organikaly.in` | ASM | Approvals, routes, team performance, territory-scoped |
| `head@organikaly.in` | Regional Head | Multi-territory performance, catalog (view) |
| `wh@organikaly.in` | Warehouse Manager | Inventory, order transitions/dispatch |
| `finance@organikaly.in` | Finance | Receivables, reconciliation, credit override |

The login screen lists these and one-click fills them.

## RBAC

The §5 capability matrix lives in `src/auth/rbac.ts`. The UI hides/disables actions a role can't
perform (defense-in-depth) and route guards (`RequireCap`) block direct navigation. The backend is
the authoritative enforcer; territory scoping is server-side — the portal surfaces the caller's
scope but never widens it.

## Screens

- **Login** — credentialed sign-in, demo account shortcuts.
- **Dashboard** — coverage %, strike rate, sales MTD, outstanding (with prior-period growth);
  sales by SKU/rep/region/category vs. prior period; receivables aging; coverage trend + by-rep.
- **Live Ops** — per-rep visits today, route progress %, last-known location (auto-refreshing).
- **Outlets** — list/map/search, detail with profile, commercials, location, dedupe and visit
  history.
- **Approval Queue** — approve (sets geofence + credit limit + class) / reject field-onboarded outlets.
- **SKUs / Catalog** — CRUD with MRP/PTR/PTD pricing, GST, HSN, MOQ.
- **Inventory** — per-warehouse available/reserved/reorder with low-stock filter and adjustments.
- **Orders** — list + detail with the pre-sales state machine (draft → … → invoiced, + cancelled),
  stock/credit semantics, status history, credit override.
- **Payments & Receivables** — aging buckets (0–30 / 31–60 / 60+), reconciliation (record collections).
- **Users & Roles** — staff accounts, roles, territory scope.
- **Territories & Beats** — Region → Area → Beat hierarchy.
- **Config** — geofence radius, GPS accuracy, credit policy, reason codes, custom outlet fields.
- **Audit Log** — who-changed-what with before/after diff.

### Store workspace (`/store/*`)

- **Store Dashboard** — revenue / paid orders / AOV / pending-fulfilment KPIs, top products, low
  stock, recent orders (analytics summary §6.8).
- **Products** — list + create/edit with SEO (slug / seo_title / seo_description / og_image /
  canonical), INR pricing, image upload via `/media`, merchandising flags (featured / hero / badges /
  sort order) and publish/unpublish/archive (triggers storefront revalidation).
- **Orders** — list + filters (status / payment / date / needs-reconciliation) and detail with the
  fulfillment state machine: pack, ship (courier + AWB + tracking), deliver, cancel (refund-gated),
  refund, mark-returned (with restock). Shows payment status, Razorpay refs, refund + webhook events.
- **Coupons** — CRUD with type (percent / fixed / free-shipping), value, min spend, scope, validity
  window and usage caps.
- **Customers** — list + detail (profile, addresses, lifetime value, orders) with block/unblock
  (manage cap only).
- **Promotions** — set the storefront hero and curate the featured rail.
- **Stock Alerts** — back-in-stock subscriber list.
- **Store Settings** — shipping flat fee + free-shipping threshold, pincode serviceability,
  fulfillment warehouse, store config (Razorpay key, support contacts, kill switch).

## API client

`src/api/` holds the typed client:

- `types.ts` — domain types mirroring both contracts (CONTRACT §2/§3 + STORE_CONTRACT §3 enums,
  §4 model, §6.9 admin DTOs).
- `http.ts` — fetch core: base URL, bearer auth, error envelope, idempotency keys, 401 handling.
- `client.ts` — one typed method per Field-Sales endpoint (§4), grouped by module.
- `storeClient.ts` — `storeApi.{products,orders,coupons,customers,promotions,settings,stockAlerts,
  analytics,media}` mirroring STORE_CONTRACT §6, reusing the same `request()`/`newIdempotencyKey()`
  helpers and `Paginated<T>` envelope.

## Project layout

```
src/
  api/         typed client + types + http core
  auth/        AuthContext + RBAC matrix
  components/
    ui/        primitives, table, modal, pills, toast, map, filters, logo
    charts/    KPI card + Recharts wrappers
    layout/    AppShell (side nav), PageHeader, route guards, nav config
  lib/         formatters, order lifecycle, debounce, error helper
  pages/       one file per screen
```
