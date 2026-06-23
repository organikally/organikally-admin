# Organikally Admin Portal

Desktop-first web console for Organikally's door-to-door field-sales platform. Managers, finance,
warehouse and admin staff use it to run coverage, sales, receivables, inventory and the pre-sales
order lifecycle. Role- and territory-scoped (RBAC).

Built against the cross-repo `CONTRACT.md` — field names, enums, endpoints, RBAC matrix and brand
tokens all come from there. This repo is independent (no shared package with the field app); the
design tokens are reproduced locally in `tailwind.config.js`.

## Stack

- Vite + React 18 + TypeScript
- Tailwind CSS (Organikally brand tokens)
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

### Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Type-check (`tsc -b`) then production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run preview` | Serve the production build |
| `npm run lint` | ESLint |

## Demo accounts (from the seed plan, §9)

Password for all: `Organikally@123`

| Email | Role | Sees |
|---|---|---|
| `admin@organikally.in` | Admin | Everything |
| `asm.delhi@organikally.in` | ASM | Approvals, routes, team performance, territory-scoped |
| `head@organikally.in` | Regional Head | Multi-territory performance, catalog (view) |
| `wh@organikally.in` | Warehouse Manager | Inventory, order transitions/dispatch |
| `finance@organikally.in` | Finance | Receivables, reconciliation, credit override |

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

## API client

`src/api/` holds the typed client:

- `types.ts` — domain types mirroring the contract (§2 enums, §3 data model).
- `http.ts` — fetch core: base URL, bearer auth, error envelope, idempotency keys, 401 handling.
- `client.ts` — one typed method per endpoint (§4), grouped by module.

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
