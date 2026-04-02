import React from 'react';
import { Outlet } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/contexts/AuthContext';
import { useRBAC } from '@/hooks/useRBAC';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Shield, Phone, User } from 'lucide-react';

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin', org_admin: 'Admin',
  property_manager: 'Manager', employee: 'Employee',
  technician: 'Technician', tenant: 'Tenant',
};

export function AppLayout() {
  const isMobile = useIsMobile();
  const { profile } = useAuth();
  const { highestRole } = useRBAC();

  const initials = (profile?.full_name || 'U')
    .split(' ')
    .map((n: string) => n.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 flex items-center justify-between border-b px-4 sticky top-0 z-30 bg-background">
            <div className="flex items-center gap-2">
              {!isMobile && <SidebarTrigger className="shrink-0" />}
            </div>
            {/* Profile avatar in top-right */}
            <Popover>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                  <Avatar className="h-8 w-8 border-2 border-primary/20">
                    <AvatarImage src={profile?.avatar_url} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </PopoverTrigger>
              <PopoverContent side="bottom" align="end" className="w-64 p-4">
                <div className="flex items-center gap-3 mb-3">
                  <Avatar className="h-12 w-12 border-2 border-primary/20">
                    <AvatarImage src={profile?.avatar_url} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-sm font-bold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{profile?.full_name || 'User'}</p>
                    {highestRole && (
                      <Badge variant="outline" className="text-[10px] mt-0.5">
                        <Shield className="h-2.5 w-2.5 mr-1" />
                        {ROLE_LABELS[highestRole] || highestRole}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  {profile?.phone && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" />
                      <span>{profile.phone}</span>
                    </div>
                  )}
                  {profile?.email && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <User className="h-3.5 w-3.5" />
                      <span className="truncate">{profile.email}</span>
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </header>
          <main className={`flex-1 p-4 sm:p-6 overflow-auto ${isMobile ? 'pb-20' : ''}`}>
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
