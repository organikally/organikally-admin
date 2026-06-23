import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '@/auth/AuthContext';
import type { Capability } from '@/auth/rbac';
import { LoadingState } from '@/components/ui/primitives';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <LoadingState label="Restoring session…" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

export function RequireCap({
  caps,
  children,
}: {
  caps: Capability[];
  children: ReactNode;
}) {
  const { can } = useAuth();
  const allowed = caps.some((c) => can(c));
  if (!allowed) return <Forbidden />;
  return <>{children}</>;
}

export function Forbidden() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-24 text-center">
      <div className="font-serif text-xl font-semibold text-forest">Access restricted</div>
      <p className="max-w-md text-sm text-muted">
        Your role does not have permission to view this section. Contact an administrator if you
        believe this is an error.
      </p>
    </div>
  );
}
