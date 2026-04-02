import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AppLayout } from "@/components/AppLayout";
import { RoleGuard } from "@/components/RoleGuard";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Properties from "@/pages/Properties";
import Owners from "@/pages/Owners";
import Tenants from "@/pages/Tenants";
import Assets from "@/pages/Assets";
import Tickets from "@/pages/Tickets";
import Accounting from "@/pages/Accounting";
import Electricity from "@/pages/Electricity";
import Reports from "@/pages/Reports";
import Settings from "@/pages/Settings";
import Team from "@/pages/Team";
import AuditLogs from "@/pages/AuditLogs";
import AssetDetail from "@/pages/AssetDetail";
import NotFound from "@/pages/NotFound";
import TenantLifecycle from "@/pages/TenantLifecycle";
import Announcements from "@/pages/Announcements";
import KYCForm from "@/pages/KYCForm";
import { useTicketNotifications } from "@/hooks/useTicketNotifications";
import { queryClient } from "@/lib/query-client";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return null;
  if (session) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function AppWithNotifications() {
  useTicketNotifications();
  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppWithNotifications />
            <Routes>
              {/* Public routes */}
              <Route
                path="/login"
                element={
                  <PublicRoute>
                    <Login />
                  </PublicRoute>
                }
              />
              <Route path="/kyc" element={<KYCForm />} />
              <Route path="/" element={<Navigate to="/login" replace />} />

              {/* All authenticated routes through unified AppLayout */}
              <Route
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route
                  path="/dashboard"
                  element={
                    <RoleGuard path="/dashboard">
                      <Dashboard />
                    </RoleGuard>
                  }
                />
                <Route
                  path="/properties"
                  element={
                    <RoleGuard path="/properties">
                      <Properties />
                    </RoleGuard>
                  }
                />
                <Route
                  path="/owners"
                  element={
                    <RoleGuard path="/owners">
                      <Owners />
                    </RoleGuard>
                  }
                />
                <Route
                  path="/tenants"
                  element={
                    <RoleGuard path="/tenants">
                      <Tenants />
                    </RoleGuard>
                  }
                />
                <Route
                  path="/assets"
                  element={
                    <RoleGuard path="/assets">
                      <Assets />
                    </RoleGuard>
                  }
                />
                <Route
                  path="/tickets"
                  element={
                    <RoleGuard path="/tickets">
                      <Tickets />
                    </RoleGuard>
                  }
                />
                <Route
                  path="/accounting"
                  element={
                    <RoleGuard path="/accounting">
                      <Accounting />
                    </RoleGuard>
                  }
                />
                <Route
                  path="/electricity"
                  element={
                    <RoleGuard path="/electricity">
                      <Electricity />
                    </RoleGuard>
                  }
                />
                <Route
                  path="/reports"
                  element={
                    <RoleGuard path="/reports">
                      <Reports />
                    </RoleGuard>
                  }
                />
                <Route
                  path="/team"
                  element={
                    <RoleGuard path="/team">
                      <Team />
                    </RoleGuard>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <RoleGuard path="/settings">
                      <Settings />
                    </RoleGuard>
                  }
                />
                <Route
                  path="/audit-logs"
                  element={
                    <RoleGuard path="/audit-logs">
                      <AuditLogs />
                    </RoleGuard>
                  }
                />
                <Route path="/announcements" element={<Announcements />} />
                <Route
                  path="/tenant-lifecycle"
                  element={
                    <RoleGuard path="/tenant-lifecycle">
                      <TenantLifecycle />
                    </RoleGuard>
                  }
                />
              </Route>

              <Route path="/asset/:id" element={<AssetDetail />} />
              {/* Redirect old tenant routes */}
              <Route path="/tenant-home" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
