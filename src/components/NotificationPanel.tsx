import { useState, useRef, useEffect } from "react";
import { useNotifications } from "@/context/NotificationContext";
import type { NotificationType } from "@/types";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, CheckCircle2, ShieldAlert, KeyRound, Webhook, Settings, Check, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNavigate } from "react-router-dom";

const typeConfig: Record<NotificationType, { icon: React.ElementType; color: string; bg: string }> = {
  approval: { icon: CheckCircle2, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/15" },
  security: { icon: ShieldAlert, color: "text-red-600 dark:text-red-400", bg: "bg-red-500/15" },
  agent: { icon: Bell, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/15" },
  grant: { icon: KeyRound, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/15" },
  system: { icon: Settings, color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-500/15" },
};

const priorityDot: Record<string, string> = {
  urgent: "bg-red-500",
  high: "bg-amber-500",
  medium: "bg-blue-500",
  low: "bg-muted-foreground/40",
};

function timeAgo(date: string): string {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (diff < 1) return "just now";
  if (diff < 60) return `${diff}m ago`;
  const h = Math.floor(diff / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

interface NotificationPanelProps {
  open: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

export default function NotificationPanel({ open, onClose, triggerRef }: NotificationPanelProps) {
  const { notifications, unreadCount, markAsRead, markAllAsRead, dismissNotification } = useNotifications();
  const [filter, setFilter] = useState<NotificationType | "all">("all");
  const panelRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const filtered = notifications.filter((n) => filter === "all" || n.type === filter);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose, triggerRef]);

  const handleClick = (n: typeof notifications[0]) => {
    markAsRead(n.id);
    if (n.actionUrl) {
      navigate(n.actionUrl);
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={panelRef}
          initial={{ opacity: 0, y: -8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.96 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="absolute right-0 top-full mt-2 z-50 w-[420px] rounded-2xl border border-hairline bg-surface shadow-xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-hairline px-5 py-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium">Notifications</h3>
              {unreadCount > 0 && (
                <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">{unreadCount}</Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={markAllAsRead}>
                  <Check className="mr-1 h-3 w-3" /> Mark all read
                </Button>
              )}
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground" onClick={onClose}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-1 border-b border-hairline px-5 py-2">
            {(["all", "approval", "security", "agent", "grant", "system"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={`rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${
                  filter === t ? "bg-foreground text-background" : "text-muted-foreground hover:bg-foreground/5"
                }`}
              >
                {t === "all" ? "All" : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {/* Notification list */}
          <ScrollArea className="max-h-[400px]">
            {filtered.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                <Bell className="mx-auto mb-2 h-8 w-8 opacity-20" />
                No notifications
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
                          onClick={() => handleClick(n)}
                          className={`group relative flex gap-3 px-5 py-3 cursor-pointer transition-colors hover:bg-foreground/[0.03] ${
                            !n.read ? "bg-foreground/[0.02]" : ""
                          }`}
                        >
                          {/* Priority dot */}
                          <div className="absolute left-1.5 top-5">
                            {!n.read && <span className={`block h-1.5 w-1.5 rounded-full ${priorityDot[n.priority]}`} />}
                          </div>

                          {/* Icon */}
                          <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${cfg.bg}`}>
                            <Icon className={`h-4 w-4 ${cfg.color}`} />
                          </div>

                          {/* Content */}
                          <div className="min-w-0 flex-1">
                            <p className={`text-sm leading-tight ${!n.read ? "font-medium" : "text-muted-foreground"}`}>
                              {n.title}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{n.message}</p>
                            <div className="mt-1 flex items-center gap-2">
                              <span className="text-[10px] text-muted-foreground/70">{timeAgo(n.createdAt)}</span>
                              {n.agentName && (
                                <span className="text-[10px] text-muted-foreground/70">· {n.agentName}</span>
                              )}
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex shrink-0 flex-col items-center gap-1 pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {!n.read && (
                              <button
                                onClick={(e) => { e.stopPropagation(); markAsRead(n.id); }}
                                className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                                title="Mark as read"
                              >
                                <Check className="h-3 w-3" />
                              </button>
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); dismissNotification(n.id); }}
                              className="rounded-md p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/5"
                              title="Dismiss"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </ScrollArea>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
