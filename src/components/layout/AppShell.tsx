import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { Wordmark, Mark } from '@/components/ui/Logo';
import { NAV } from './nav';
import { useAuth } from '@/auth/AuthContext';
import { roleLabel } from '@/auth/rbac';

export function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const visibleGroups = NAV.map((g) => ({
    ...g,
    items: g.items.filter((i) => !i.caps || i.caps.some((c) => user && roleHasCap(user.role, c))),
  })).filter((g) => g.items.length > 0);

  function onLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="flex h-screen overflow-hidden bg-surface-2">
      {/* Sidebar */}
      <aside
        className={clsx(
          'flex shrink-0 flex-col border-r border-line bg-surface transition-all',
          collapsed ? 'w-16' : 'w-60',
        )}
      >
        <div className="flex h-14 items-center justify-between border-b border-line px-3">
          {collapsed ? <Mark size={26} /> : <Wordmark />}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="hidden h-7 w-7 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-ink lg:grid"
            aria-label="Toggle sidebar"
          >
            {collapsed ? '»' : '«'}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {visibleGroups.map((group) => (
            <div key={group.heading} className="mb-4">
              {!collapsed && (
                <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted">
                  {group.heading}
                </div>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    title={item.label}
                    className={({ isActive }) =>
                      clsx(
                        'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-brand/10 text-brand'
                          : 'text-ink/80 hover:bg-surface-2 hover:text-ink',
                      )
                    }
                  >
                    <span className="w-4 text-center text-base leading-none">{item.icon}</span>
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-line bg-surface px-4">
          <div className="text-sm text-muted">
            <span className="font-medium text-ink">{user?.name}</span>
            <span className="mx-2 text-line">·</span>
            <span>{user ? roleLabel(user.role) : ''}</span>
            {user && user.territory_ids.length > 0 && (
              <span className="ml-2 rounded-pill bg-surface-2 px-2 py-0.5 text-[11px] text-muted">
                {user.territory_ids.length} territory scope
              </span>
            )}
          </div>
          <div className="relative">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="flex h-9 items-center gap-2 rounded-pill border border-line bg-surface px-2.5 text-sm hover:bg-surface-2"
            >
              <span className="grid h-6 w-6 place-items-center rounded-full bg-brand text-[11px] font-semibold text-cream">
                {initials(user?.name)}
              </span>
              <span className="hidden sm:inline">{user?.name?.split(' ')[0]}</span>
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 z-20 mt-1 w-48 rounded-card border border-line bg-surface p-1 shadow-pop">
                  <div className="px-3 py-2 text-xs text-muted">
                    <div className="truncate font-medium text-ink">{user?.email}</div>
                    <div>{user ? roleLabel(user.role) : ''}</div>
                  </div>
                  <button
                    onClick={onLogout}
                    className="w-full rounded-md px-3 py-2 text-left text-sm text-danger hover:bg-surface-2"
                  >
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

function initials(name?: string): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

// local import avoids circular dep with rbac module typing
import { can } from '@/auth/rbac';
import type { Role } from '@/api/types';
import type { Capability } from '@/auth/rbac';
function roleHasCap(role: Role, cap: Capability): boolean {
  return can(role, cap);
}
