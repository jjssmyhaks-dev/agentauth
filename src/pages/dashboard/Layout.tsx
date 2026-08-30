import { Outlet, Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  LayoutDashboard, Shield, KeyRound, CheckSquare, Activity, BarChart3,
  Webhook, Key, Settings, BookOpen, LogOut, ChevronLeft, Menu,
  Bell, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/context/AuthContext";
import { useDashboard } from "@/context/DashboardContext";
import { useState, useEffect } from "react";
import OnboardingWizard from "./OnboardingWizard";

const navItems = [
  { icon: LayoutDashboard, label: "Overview", path: "/dashboard" },
  { icon: Shield, label: "Agents", path: "/dashboard/agents" },
  { icon: KeyRound, label: "Grants", path: "/dashboard/grants" },
  { icon: CheckSquare, label: "Approvals", path: "/dashboard/approvals" },
  { icon: Activity, label: "Audit Log", path: "/dashboard/activity" },
  { icon: BarChart3, label: "Analytics", path: "/dashboard/analytics" },
  { icon: Webhook, label: "Webhooks", path: "/dashboard/webhooks" },
  { icon: Key, label: "API Keys", path: "/dashboard/api-keys" },
  { icon: Settings, label: "Settings", path: "/dashboard/settings" },
  { icon: BookOpen, label: "SDK Docs", path: "/dashboard/docs" },
];

export default function DashboardLayout() {
  const { user, signOut } = useAuth();
  const { pendingApprovals } = useDashboard();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return !localStorage.getItem("aa_onboarding_complete");
  });

  const handleOnboardingComplete = () => {
    localStorage.setItem("aa_onboarding_complete", "true");
    setShowOnboarding(false);
  };

  if (showOnboarding) {
    return <OnboardingWizard onComplete={handleOnboardingComplete} />;
  }

  return (
    <div className="flex h-screen bg-slate-950">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? "w-64" : "w-16"
        } flex shrink-0 flex-col border-r border-slate-800 bg-slate-900/50 transition-all duration-300`}
      >
        <div className="flex h-14 items-center justify-between border-b border-slate-800 px-4">
          {sidebarOpen && (
            <Link to="/" className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600">
                <Shield className="h-4 w-4 text-white" />
              </div>
              <span className="text-sm font-bold text-white">AgentAuth</span>
            </Link>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>

        <ScrollArea className="flex-1 py-3">
          <nav className="space-y-1 px-2">
            {navItems.map((item) => {
              const isActive =
                item.path === "/dashboard"
                  ? location.pathname === "/dashboard"
                  : location.pathname.startsWith(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-blue-600/10 text-blue-400"
                      : "text-slate-400 hover:bg-slate-800/50 hover:text-white"
                  } ${!sidebarOpen ? "justify-center" : ""}`}
                  title={item.label}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {sidebarOpen && <span>{item.label}</span>}
                  {item.path === "/dashboard/approvals" && pendingApprovals > 0 && (
                    <Badge variant="destructive" className={`ml-auto ${!sidebarOpen ? "absolute -top-1 -right-1 h-4 w-4 p-0 text-[10px]" : ""}`}>
                      {pendingApprovals}
                    </Badge>
                  )}
                </Link>
              );
            })}
          </nav>
        </ScrollArea>

        <div className="border-t border-slate-800 p-3">
          <button
            onClick={signOut}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-400 transition-colors hover:bg-slate-800/50 hover:text-red-400 ${!sidebarOpen ? "justify-center" : ""}`}
          >
            <LogOut className="h-4 w-4" />
            {sidebarOpen && <span>Sign out</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-800 bg-slate-900/30 px-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search agents, grants, logs..."
                className="h-9 w-80 rounded-lg border border-slate-800 bg-slate-800/50 pl-9 pr-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="relative rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white">
              <Bell className="h-4 w-4" />
              {pendingApprovals > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">
                  {pendingApprovals}
                </span>
              )}
            </button>
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-blue-600/20 text-xs text-blue-400">
                  {user?.name?.charAt(0).toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm text-slate-300">{user?.name || "User"}</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="p-6"
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  );
}
