import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNotifications } from "@/context/NotificationContext";
import type { NotificationType } from "@/types";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, CheckCircle2, ShieldAlert, KeyRound, Settings, Check,
  Trash2, CheckCheck, Filter,
} from "lucide-react";

const typeConfig: Record<NotificationType, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  approval: { icon: CheckCircle2, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/15", label: "Approval" },
  security: { icon: ShieldAlert, color: "text-red-600 dark:text-red-400", bg: "bg-red-500/15", label: "Security" },
  agent: { icon: Bell, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/15", label: "Agent" },
  grant: { icon: KeyRound, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/15", label: "Grant" },
  system: { icon: Settings, color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-500/15", label: "System" },
};

const priorityBadge: Record<string, string> = {
  urgent: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/20",
  high: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20",
  medium: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  low: "bg-muted text-muted-foreground border-hairline",
};

function timeAgo(date: string): string {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (diff < 1) return "just now";
  if (diff < 60) return `${diff}m ago`;
  const h = Math.floor(diff / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function NotificationsPage() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, dismissNotification } = useNotifications();
  const [typeFilter, setTypeFilter] = useState<NotificationType | "all">("all");
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  const filtered = notifications.filter((n) => {
    if (typeFilter !== "all" && n.type !== typeFilter) return false;
    if (showUnreadOnly && n.read) return false;
    if (search && !n.title.toLowerCase().includes(search.toLowerCase()) && !n.message.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            Stay informed about agent activity, approvals, and security events.
            {unreadCount > 0 && <span className="ml-1 font-medium text-foreground">{unreadCount} unread</span>}
          </p>
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllAsRead} className="rounded-full border-hairline">
              <CheckCheck className="mr-2 h-3.5 w-3.5" /> Mark all read
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search notifications..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 rounded-xl border-hairline bg-background"
          />
        </div>
        <div className="flex gap-1">
          {(["all", "approval", "security", "agent", "grant", "system"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                typeFilter === t ? "bg-foreground text-background" : "text-muted-foreground border border-hairline hover:bg-foreground/5"
              }`}
            >
              {t === "all" ? "All" : typeConfig[t].label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowUnreadOnly(!showUnreadOnly)}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors border ${
            showUnreadOnly ? "bg-foreground text-background border-foreground" : "text-muted-foreground border-hairline hover:bg-foreground/5"
          }`}
        >
          Unread only
        </button>
      </div>

      {/* Notification list */}
      <Card className="border-hairline bg-surface/60">
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="py-16 text-center">
              <Bell className="mx-auto mb-3 h-10 w-10 text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground">
                {showUnreadOnly ? "All caught up — no unread notifications." : "No notifications match your filters."}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-hairline/50">
              <AnimatePresence initial={false}>
                {filtered.map((n) => {
                  const cfg = typeConfig[n.type];
                  const Icon = cfg.icon;
                  return (
                    <motion.div
                      key={n.id}
                      layout
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      <div
                        className={`group flex items-start gap-4 px-5 py-4 cursor-pointer transition-colors hover:bg-foreground/[0.02] ${
                          !n.read ? "bg-foreground/[0.015]" : ""
                        }`}
                        onClick={() => {
                          markAsRead(n.id);
                          if (n.actionUrl) navigate(n.actionUrl);
                        }}
                      >
                        {/* Unread dot */}
                        <div className="pt-2">
                          {!n.read && <span className="block h-2 w-2 rounded-full bg-foreground" />}
                        </div>

                        {/* Icon */}
                        <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${cfg.bg}`}>
                          <Icon className={`h-5 w-5 ${cfg.color}`} />
                        </div>

                        {/* Content */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className={`text-sm leading-tight ${!n.read ? "font-medium" : ""}`}>{n.title}</h3>
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${priorityBadge[n.priority]}`}>
                              {n.priority}
                            </Badge>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {cfg.label}
                            </Badge>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">{n.message}</p>
                          <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground/70">
                            <span>{timeAgo(n.createdAt)}</span>
                            {n.agentName && <span>· {n.agentName}</span>}
                            {n.actionUrl && <span className="text-foreground/40">→ view details</span>}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex shrink-0 gap-1 pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {!n.read && (
                            <button
                              onClick={(e) => { e.stopPropagation(); markAsRead(n.id); }}
                              className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                              title="Mark as read"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); dismissNotification(n.id); }}
                            className="rounded-md p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/5"
                            title="Dismiss"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
