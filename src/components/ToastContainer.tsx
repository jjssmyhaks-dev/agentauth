import { useNotifications } from "@/context/NotificationContext";
import type { NotificationType, NotificationPriority } from "@/types";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, ShieldAlert, Bell, KeyRound, Settings, X } from "lucide-react";

const typeConfig: Record<NotificationType, { icon: React.ElementType; color: string; border: string }> = {
  approval: { icon: CheckCircle2, color: "text-amber-600 dark:text-amber-400", border: "border-l-amber-500" },
  security: { icon: ShieldAlert, color: "text-red-600 dark:text-red-400", border: "border-l-red-500" },
  agent: { icon: Bell, color: "text-blue-600 dark:text-blue-400", border: "border-l-blue-500" },
  grant: { icon: KeyRound, color: "text-emerald-600 dark:text-emerald-400", border: "border-l-emerald-500" },
  system: { icon: Settings, color: "text-purple-600 dark:text-purple-400", border: "border-l-purple-500" },
};

const priorityBg: Record<NotificationPriority, string> = {
  urgent: "bg-red-500/10 border-red-500/20",
  high: "bg-amber-500/10 border-amber-500/20",
  medium: "bg-background border-hairline",
  low: "bg-background border-hairline",
};

export default function ToastContainer() {
  const { toasts, dismissToast } = useNotifications();

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => {
          const cfg = typeConfig[t.type];
          const Icon = cfg.icon;
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 60, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 60, scale: 0.95 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className={`pointer-events-auto flex items-start gap-3 rounded-xl border-l-4 ${cfg.border} ${priorityBg[t.priority]} p-4 pr-3 shadow-lg min-w-[320px] max-w-[400px]`}
            >
              <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-background`}>
                <Icon className={`h-4 w-4 ${cfg.color}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-tight">{t.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{t.message}</p>
              </div>
              <button
                onClick={() => dismissToast(t.id)}
                className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
