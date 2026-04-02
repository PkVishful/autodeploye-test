import {
  LayoutDashboard,
  Building2,
  UserCircle,
  Users,
  Package,
  Wrench,
  Receipt,
  Zap,
  BarChart3,
  Settings,
  LogOut,
  Moon,
  Sun,
  Palette,
  ScrollText,
  Shield,
  Check,
  UserCog,
  Megaphone,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme, paletteOptions } from "@/contexts/ThemeContext";
import { useRBAC } from "@/hooks/useRBAC";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import vishfulLogo from "@/assets/vishful-logo.png";

const navItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Properties", url: "/properties", icon: Building2 },
  { title: "Owners", url: "/owners", icon: UserCircle },
  { title: "Tenants", url: "/tenants", icon: Users },
  { title: "Tenant Lifecycle", url: "/tenant-lifecycle", icon: UserCog },
  { title: "Assets", url: "/assets", icon: Package },
  { title: "Tickets", url: "/tickets", icon: Wrench },
  { title: "Accounting", url: "/accounting", icon: Receipt },
  { title: "Electricity", url: "/electricity", icon: Zap },
  { title: "Reports", url: "/reports", icon: BarChart3 },
  { title: "Announcements", url: "/announcements", icon: Megaphone },
  { title: "Team", url: "/team", icon: Users },
  { title: "Audit Logs", url: "/audit-logs", icon: ScrollText },
  { title: "Settings", url: "/settings", icon: Settings },
];

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  org_admin: "Admin",
  property_manager: "Manager",
  technician: "Technician",
  tenant: "Tenant",
};

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { signOut, profile } = useAuth();
  const { theme, toggleTheme, palette, setPalette } = useTheme();
  const { getAccessibleNavItems, highestRole } = useRBAC();
  const isMobile = useIsMobile();

  const visibleItems = getAccessibleNavItems(navItems);

  /* ─── Mobile: Bottom navigation bar ─── */
  if (isMobile) {
    const mobileItems = visibleItems.slice(0, 5);
    return (
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around bg-card border-t border-border safe-bottom h-14">
        {mobileItems.map((item) => (
          <NavLink
            key={item.title}
            to={item.url}
            end
            className="flex flex-col items-center gap-0.5 px-2 py-1 text-muted-foreground"
            activeClassName="text-primary"
          >
            <item.icon className="h-5 w-5" />
            <span className="text-[10px]">{item.title}</span>
          </NavLink>
        ))}
        <Popover>
          <PopoverTrigger asChild>
            <button className="flex flex-col items-center gap-0.5 px-2 py-1 text-muted-foreground">
              <Settings className="h-5 w-5" />
              <span className="text-[10px]">More</span>
            </button>
          </PopoverTrigger>
          <PopoverContent side="top" align="end" className="w-56 p-2">
            {visibleItems.slice(5).map((item) => (
              <NavLink
                key={item.title}
                to={item.url}
                end
                className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-accent"
                activeClassName="text-primary bg-primary/10"
              >
                <item.icon className="h-4 w-4" />
                <span>{item.title}</span>
              </NavLink>
            ))}
            <div className="border-t border-border my-1" />
            <div className="flex items-center gap-1 px-2 py-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleTheme}>
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 ml-auto" onClick={signOut}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </nav>
    );
  }

  /* ─── Desktop: Sidebar ─── */
  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <div className="p-4 flex items-center gap-3">
        <img src={vishfulLogo} alt="Vishful" className="h-8 w-8 shrink-0 object-contain" width={512} height={512} />
        {!collapsed && (
          <div className="animate-slide-in">
            <h1 className="font-semibold text-sm tracking-tight text-sidebar-foreground">Vishful OS</h1>
            <p className="text-[10px] text-muted-foreground">Property Management</p>
          </div>
        )}
      </div>

      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/60 px-3">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end
                      className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-200"
                      activeClassName="bg-primary/10 text-primary font-medium"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 space-y-2">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleTheme}>
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          {/* Palette picker */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Palette className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent side="right" className="w-56 p-3">
              <p className="text-xs font-semibold mb-3 text-muted-foreground uppercase tracking-wider">Color Mood</p>
              <div className="space-y-2">
                {paletteOptions.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPalette(p.id)}
                    className={`w-full flex items-center gap-3 p-2 rounded-lg border transition-all text-left ${
                      palette === p.id ? "border-primary bg-primary/5" : "border-transparent hover:bg-accent"
                    }`}
                  >
                    <div className="flex -space-x-1.5">
                      {p.previewColors.map((c, i) => (
                        <div
                          key={i}
                          className="h-5 w-5 rounded-full border-2 border-card"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{p.label}</p>
                      <p className="text-[10px] text-muted-foreground">{p.description}</p>
                    </div>
                    {palette === p.id && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {!collapsed && (
            <Button variant="ghost" size="icon" className="h-8 w-8 ml-auto" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
