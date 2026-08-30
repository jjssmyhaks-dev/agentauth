import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { DashboardProvider } from "@/context/DashboardContext";
import { NotificationProvider } from "@/context/NotificationContext";
import LandingPage from "@/pages/LandingPage";
import AuthPage from "@/pages/AuthPage";
import DashboardLayout from "@/pages/dashboard/Layout";
import OverviewPage from "@/pages/dashboard/OverviewPage";
import AgentsPage from "@/pages/dashboard/AgentsPage";
import AgentDetailPage from "@/pages/dashboard/AgentDetailPage";
import GrantsPage from "@/pages/dashboard/GrantsPage";
import ApprovalsPage from "@/pages/dashboard/ApprovalsPage";
import ActivityPage from "@/pages/dashboard/ActivityPage";
import AnalyticsPage from "@/pages/dashboard/AnalyticsPage";
import WebhooksPage from "@/pages/dashboard/WebhooksPage";
import ApiKeysPage from "@/pages/dashboard/ApiKeysPage";
import SettingsPage from "@/pages/dashboard/SettingsPage";
import DocsPage from "@/pages/dashboard/DocsPage";
import NotificationsPage from "@/pages/dashboard/NotificationsPage"

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function AuthRoute() {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <AuthPage />;
}

function AppRoutes() {
  return (
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
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
