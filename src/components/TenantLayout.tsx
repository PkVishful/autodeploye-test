import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Home, Wrench, Receipt, Bell, LogOut, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';

const tenantNav = [
  { title: 'Home', url: '/tenant-home', icon: Home },
  { title: 'Tickets', url: '/tickets', icon: Wrench },
  { title: 'Payments', url: '/accounting', icon: Receipt },
  { title: 'Notices', url: '/tenant-lifecycle', icon: Bell },
];

export function TenantLayout() {
  const { profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col w-full bg-background">
      {/* Top Nav */}
      <header className="h-14 flex items-center gap-4 border-b px-4 glass-strong sticky top-0 z-30">
        <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
          <span className="text-primary-foreground font-bold text-sm">V</span>
        </div>
        <nav className="flex items-center gap-1 flex-1">
          {tenantNav.map(item => (
            <NavLink
              key={item.url}
              to={item.url}
              end={item.url === '/tenant-home'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
              activeClassName="bg-primary/10 text-primary font-medium"
            >
              <item.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{item.title}</span>
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium">{profile?.full_name || 'Tenant'}</p>
            <p className="text-[10px] text-muted-foreground">{profile?.phone}</p>
          </div>
          <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-xs font-semibold text-primary">
              {(profile?.full_name || 'T').charAt(0).toUpperCase()}
            </span>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleTheme}>
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={signOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>
      <main className="flex-1 p-4 sm:p-6 overflow-auto pb-20 sm:pb-6">
        <Outlet />
      </main>
      {/* Mobile bottom nav */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around bg-card border-t border-border safe-bottom h-14">
        {tenantNav.map(item => (
          <NavLink
            key={item.url}
            to={item.url}
            end={item.url === '/tenant-home'}
            className="flex flex-col items-center gap-0.5 px-2 py-1 text-muted-foreground"
            activeClassName="text-primary"
          >
            <item.icon className="h-5 w-5" />
            <span className="text-[10px]">{item.title}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
