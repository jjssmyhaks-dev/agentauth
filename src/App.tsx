import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { DashboardProvider } from "@/context/DashboardContext";
import { NotificationProvider } from "@/context/NotificationContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { motion } from "framer-motion";

const LandingPage = lazy(() => import("@/pages/LandingPage"));
const AuthPage = lazy(() => import("@/pages/AuthPage"));
const DashboardLayout = lazy(() => import("@/pages/dashboard/Layout"));
const OverviewPage = lazy(() => import("@/pages/dashboard/OverviewPage"));
const AgentsPage = lazy(() => import("@/pages/dashboard/AgentsPage"));
const AgentDetailPage = lazy(() => import("@/pages/dashboard/AgentDetailPage"));
const GrantsPage = lazy(() => import("@/pages/dashboard/GrantsPage"));
const ApprovalsPage = lazy(() => import("@/pages/dashboard/ApprovalsPage"));
const ActivityPage = lazy(() => import("@/pages/dashboard/ActivityPage"));
const AnalyticsPage = lazy(() => import("@/pages/dashboard/AnalyticsPage"));
const WebhooksPage = lazy(() => import("@/pages/dashboard/WebhooksPage"));
const ApiKeysPage = lazy(() => import("@/pages/dashboard/ApiKeysPage"));
const SettingsPage = lazy(() => import("@/pages/dashboard/SettingsPage"));
const DocsPage = lazy(() => import("@/pages/dashboard/DocsPage"));
const NotificationsPage = lazy(() => import("@/pages/dashboard/NotificationsPage"));

function PageLoader() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <motion.div
        className="flex flex-col items-center gap-4"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
        <span className="text-sm text-muted-foreground">Loading…</span>
      </motion.div>
    </div>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function AuthRoute() {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <Suspense fallback={<PageLoader />}><AuthPage /></Suspense>;
}

function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/auth" element={<AuthRoute />} />
      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <NotificationProvider>
              <DashboardProvider>
                <DashboardLayout />
              </DashboardProvider>
            </NotificationProvider>
          </RequireAuth>
        }
      >
        <Route index element={<OverviewPage />} />
        <Route path="agents" element={<AgentsPage />} />
        <Route path="agents/:id" element={<AgentDetailPage />} />
        <Route path="grants" element={<GrantsPage />} />
        <Route path="approvals" element={<ApprovalsPage />} />
        <Route path="activity" element={<ActivityPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="webhooks" element={<WebhooksPage />} />
        <Route path="api-keys" element={<ApiKeysPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="docs" element={<DocsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </ThemeProvider>
  );
}
