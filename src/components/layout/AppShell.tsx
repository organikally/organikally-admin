import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { PanelLeftClose, PanelLeftOpen, LogOut, Store as StoreIcon, Truck } from 'lucide-react';
import { Wordmark, Mark } from '@/components/ui/Logo';
import { NAV, STORE_NAV } from './nav';
import type { NavGroup } from './nav';
import { useAuth } from '@/auth/AuthContext';
import { can, roleLabel, hasFieldAccess, hasStoreAccess } from '@/auth/rbac';
import type { Capability, Workspace } from '@/auth/rbac';
import type { Role } from '@/api/types';

export function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // The route is the single source of truth for the active workspace (§7.4).
  const workspace: Workspace = location.pathname.startsWith('/store') ? 'store' : 'field';
  const groups: NavGroup[] = workspace === 'store' ? STORE_NAV : NAV;

  // Optional UI feature flag (§15.1): default on, "false" hides the Store workspace.
  const storeUiEnabled = (import.meta.env.VITE_STORE_ENABLED ?? 'true') !== 'false';
  const fieldAccess = hasFieldAccess(user?.role);
  const storeAccess = hasStoreAccess(user?.role) && storeUiEnabled;
  const showSwitcher = fieldAccess || storeAccess;

  const visibleGroups = groups
    .map((g) => ({
      ...g,
      items: g.items.filter(
        (i) => !i.caps || i.caps.some((c) => user && roleHasCap(user.role, c)),
      ),
    }))
    .filter((g) => g.items.length > 0);

  function onLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="flex min-h-dvh h-dvh overflow-hidden bg-paper">
      {/* Sidebar */}
      <aside
        className={clsx(
          'flex shrink-0 flex-col border-r border-line bg-paper transition-all duration-300 ease-brand',
          collapsed ? 'w-16' : 'w-60',
        )}
      >
        <div className="flex h-14 items-center justify-between border-b border-line px-3">
          {collapsed ? <Mark size={26} /> : <Wordmark />}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="hidden h-7 w-7 cursor-pointer place-items-center rounded-chip text-ink-faint hover:bg-surface hover:text-ink lg:grid"
            aria-label="Toggle sidebar"
          >
            {collapsed ? (
              <PanelLeftOpen className="h-[18px] w-[18px]" strokeWidth={1.5} />
            ) : (
              <PanelLeftClose className="h-[18px] w-[18px]" strokeWidth={1.5} />
            )}
          </button>
        </div>

        {/* Workspace switcher (§7.4) — each pill visible only if the role has
            caps in that workspace; the route drives the active state. */}
        {showSwitcher && (
          <div className="border-b border-line p-2">
            <div
              className={clsx(
                'flex gap-1 rounded-chip bg-surface p-1',
                collapsed && 'flex-col',
              )}
            >
              {fieldAccess && (
                <WorkspaceTab
                  active={workspace === 'field'}
                  collapsed={collapsed}
                  icon={Truck}
                  label="Field Sales"
                  onClick={() => navigate('/dashboard')}
                />
              )}
              {storeAccess && (
                <WorkspaceTab
                  active={workspace === 'store'}
                  collapsed={collapsed}
                  icon={StoreIcon}
                  label="Store"
                  onClick={() => navigate('/store/dashboard')}
                />
              )}
            </div>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {visibleGroups.map((group) => (
            <div key={group.heading} className="mb-5">
              {!collapsed && (
                <div className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
                  {group.heading}
                </div>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      title={item.label}
                      className={({ isActive }) =>
                        clsx(
                          'group relative flex items-center gap-2.5 rounded-chip px-2.5 py-2 text-sm font-medium transition-colors duration-200',
                          isActive
                            ? 'bg-surface text-ink'
                            : 'text-ink-muted hover:bg-surface hover:text-ink',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {isActive && (
                            <span
                              aria-hidden
                              className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-pill bg-gold-ink"
                            />
                          )}
                          <Icon
                            className={clsx(
                              'h-[18px] w-[18px] shrink-0',
                              isActive ? 'text-gold-ink' : 'text-ink-faint group-hover:text-ink-muted',
                            )}
                            strokeWidth={1.5}
                          />
                          {!collapsed && <span className="truncate">{item.label}</span>}
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-line bg-paper px-4">
          <div className="flex items-center gap-2 text-sm text-ink-faint">
            <span
              className={clsx(
                'inline-flex items-center gap-1 rounded-pill border px-2 py-0.5 text-[11px] font-semibold',
                workspace === 'store'
                  ? 'border-gold-ink/30 bg-yellow/12 text-gold-ink'
                  : 'border-line bg-surface text-ink-muted',
              )}
            >
              {workspace === 'store' ? (
                <StoreIcon className="h-3.5 w-3.5" strokeWidth={1.5} />
              ) : (
                <Truck className="h-3.5 w-3.5" strokeWidth={1.5} />
              )}
              {workspace === 'store' ? 'Store' : 'Field Sales'}
            </span>
            <span aria-hidden className="text-line">/</span>
            <span className="font-medium text-ink">{user?.name}</span>
            <span aria-hidden className="text-line">/</span>
            <span>{user ? roleLabel(user.role) : ''}</span>
            {user && user.territory_ids.length > 0 && (
              <span className="ml-1 rounded-pill bg-surface px-2 py-0.5 text-[11px] text-ink-muted tnum">
                {user.territory_ids.length} territory scope
              </span>
            )}
          </div>
          <div className="relative">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="flex h-9 cursor-pointer items-center gap-2 rounded-pill border border-line bg-paper px-2.5 text-sm hover:bg-surface"
            >
              <span className="grid h-6 w-6 place-items-center rounded-full bg-yellow text-[11px] font-semibold text-ink">
                {initials(user?.name)}
              </span>
              <span className="hidden sm:inline">{user?.name?.split(' ')[0]}</span>
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 z-20 mt-1 w-48 rounded-card border border-line bg-paper p-1 shadow-md">
                  <div className="px-3 py-2 text-xs text-ink-faint">
                    <div className="truncate font-medium text-ink">{user?.email}</div>
                    <div>{user ? roleLabel(user.role) : ''}</div>
                  </div>
                  <button
                    onClick={onLogout}
                    className="flex w-full cursor-pointer items-center gap-2 rounded-chip px-3 py-2 text-left text-sm text-danger hover:bg-surface"
                  >
                    <LogOut className="h-4 w-4" strokeWidth={1.5} />
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1500px] p-4 lg:p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

function WorkspaceTab({
  active,
  collapsed,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  collapsed: boolean;
  icon: typeof StoreIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={clsx(
        'flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-[0.5rem] px-2 py-1.5 text-xs font-semibold transition-colors',
        active ? 'bg-paper text-ink shadow-sm' : 'text-ink-faint hover:text-ink-muted',
      )}
    >
      <Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
      {!collapsed && <span className="truncate">{label}</span>}
    </button>
  );
}

function initials(name?: string): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function roleHasCap(role: Role, cap: Capability): boolean {
  return can(role, cap);
}
