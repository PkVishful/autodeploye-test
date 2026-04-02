import React from 'react';
import { useRBAC } from '@/hooks/useRBAC';
import { Shield, Clock } from 'lucide-react';

interface RoleGuardProps {
  children: React.ReactNode;
  path: string;
}

export function RoleGuard({ children, path }: RoleGuardProps) {
  const { canAccessPage, hasNoRoles, loading } = useRBAC();

  if (loading) return null;

  if (hasNoRoles()) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
          <Clock className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold">No Role Assigned</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          Your account doesn't have a role yet. Please contact your administrator to get access.
        </p>
      </div>
    );
  }

  if (!canAccessPage(path)) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center">
        <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
          <Shield className="h-8 w-8 text-destructive" />
        </div>
        <h2 className="text-xl font-semibold">Access Denied</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          You don't have permission to access this page. Contact your administrator to request access.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
