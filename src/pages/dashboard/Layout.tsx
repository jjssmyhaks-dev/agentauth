import { Outlet, Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Shield, KeyRound, CheckSquare, Activity, BarChart3,
  Webhook, Key, Settings, BookOpen, LogOut, ChevronLeft, Menu,
  Bell, Search, BellRing,
} from "lucide-react"
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/context/AuthContext";
import { useDashboard } from "@/context/DashboardContext";
import { useNotifications } from "@/context/NotificationContext";
import { useNotificationSimulator } from "@/hooks/useNotificationSimulator";
import NotificationPanel from "@/components/NotificationPanel";
import ToastContainer from "@/components/ToastContainer";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, useCallback } from "react";
import OnboardingWizard from "./OnboardingWizard"

const navItems = [
  { icon: LayoutDashboard, label: "Overview", path: "/dashboard" },
  { icon: Shield, label: "Agents", path: "/dashboard/agents" },
  { icon: KeyRound, label: "Grants", path: "/dashboard/grants" },
  { icon: CheckSquare, label: "Approvals", path: "/dashboard/approvals" },
  { icon: Activity, label: "Audit Log", path: "/dashboard/activity" },
  { icon: BarChart3, label: "Analytics", path: "/dashboard/analytics" },
  { icon: BellRing, label: "Notifications", path: "/dashboard/notifications" },
  { icon: Webhook, label: "Webhooks", path: "/dashboard/webhooks" },
  { icon: Key, label: "API Keys", path: "/dashboard/api-keys" },
  { icon: Settings, label: "Settings", path: "/dashboard/settings" },
  { icon: BookOpen, label: "SDK Docs", path: "/dashboard/docs" },
];

export default function DashboardLayout() {
  const { user, signOut } = useAuth();
  const { pendingApprovals } = useDashboard();
  const { unreadCount } = useNotifications();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return !localStorage.getItem("aa_onboarding_complete");
  });
  const [notifPanelOpen, setNotifPanelOpen] = useState(false);
  const bellRef = useRef<HTMLButtonElement>(null);

  useNotificationSimulator(15000);

  const handleOnboardingComplete = () => {
    localStorage.setItem("aa_onboarding_complete", "true");
    setShowOnboarding(false);
  };

  const toggleNotifPanel = useCallback(() => {
    setNotifPanelOpen((prev) => !prev);
  }, []);

  if (showOnboarding) {
    return <OnboardingWizard onComplete={handleOnboardingComplete} />;
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? "w-60" : "w-14"} flex shrink-0 flex-col border-r border-hairline bg-surface/50 transition-all duration-200`}>
        <div className="flex h-14 items-center justify-between border-b border-hairline px-4">
          {sidebarOpen && (
            <Link to="/" className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-foreground" />
              <span className="text-sm font-medium">AgentAuth</span>
            </Link>
          )}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="rounded-md p-1 text-muted-foreground hover:text-foreground transition-colors">
            {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
        <ScrollArea className="flex-1 py-3">
          <nav className="space-y-0.5 px-2">
            {navItems.map((item) => {
              const isActive = item.path === "/dashboard" ? location.pathname === "/dashboard" : location.pathname.startsWith(item.path);
              return (
                <Link key={item.path} to={item.path} title={item.label}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${isActive ? "bg-foreground/5 text-foreground font-medium" : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"} ${!sidebarOpen ? "justify-center" : ""}`}>
                  <item.icon className="h-4 w-4 shrink-0" />
                  {sidebarOpen && <span>{item.label}</span>}
                  {item.path === "/dashboard/approvals" && pendingApprovals > 0 && (
                    <Badge variant="destructive" className={`ml-auto ${!sidebarOpen ? "absolute -top-1 -right-1 h-4 w-4 p-0 text-[10px]" : ""}`}>{pendingApprovals}</Badge>
                  )}
                  {item.path === "/dashboard/notifications" && unreadCount > 0 && (
                    <Badge variant="destructive" className={`ml-auto ${!sidebarOpen ? "absolute -top-1 -right-1 h-4 w-4 p-0 text-[10px]" : ""}`}>{unreadCount > 99 ? "99+" : unreadCount}</Badge>
                  )}
                </Link>
              );
            })}
          </nav>
        </ScrollArea>
        <div className="border-t border-hairline p-3">
          <button onClick={signOut} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-destructive hover:bg-foreground/5 ${!sidebarOpen ? "justify-center" : ""}`}>
            <LogOut className="h-4 w-4" />
            {sidebarOpen && <span>Sign out</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-hairline bg-surface/30 px-6 backdrop-blur-sm">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input type="text" placeholder="Search agents, grants, logs..."
              className="h-9 w-80 rounded-full border border-hairline bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="relative flex items-center gap-3">
            <button ref={bellRef} onClick={toggleNotifPanel} className="relative rounded-full p-2 text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors">
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>
            <NotificationPanel open={notifPanelOpen} onClose={() => setNotifPanelOpen(false)} triggerRef={bellRef} />
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-muted text-xs">{user?.name?.charAt(0).toUpperCase() || "U"}</AvatarFallback>
              </Avatar>
              <span className="text-sm">{user?.name || "User"}</span>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <ToastContainer />
    </div>
  );
}
