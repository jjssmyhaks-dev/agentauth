import React, { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import type { Notification, NotificationType, NotificationPriority } from "@/types";
import { mockNotifications } from "@/data/mock";

interface Toast {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  duration?: number;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  toasts: Toast[];
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  dismissNotification: (id: string) => void;
  dismissToast: (id: string) => void;
  addNotification: (n: Omit<Notification, "id" | "read" | "createdAt">) => void;
  pushToast: (t: Omit<Toast, "id">) => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

let notifCounter = 100;
let toastCounter = 100;

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastTimer = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = toastTimer.current.get(id);
    if (timer) {
      clearTimeout(timer);
      toastTimer.current.delete(id);
    }
  }, []);

  const pushToast = useCallback((t: Omit<Toast, "id">) => {
    const id = `toast_${++toastCounter}`;
    const toast: Toast = { ...t, id };
    setToasts((prev) => [...prev.slice(-4), toast]);

    const duration = t.duration ?? (t.priority === "urgent" ? 8000 : t.priority === "high" ? 6000 : 4000);
    const timer = setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
      toastTimer.current.delete(id);
    }, duration);
    toastTimer.current.set(id, timer);
  }, []);

  const addNotification = useCallback((n: Omit<Notification, "id" | "read" | "createdAt">) => {
    const notif: Notification = {
      ...n,
      id: `notif_${++notifCounter}`,
      read: false,
      createdAt: new Date().toISOString(),
    };
    setNotifications((prev) => [notif, ...prev].slice(0, 50));

    if (n.priority === "urgent" || n.priority === "high") {
      pushToast({ type: n.type, priority: n.priority, title: n.title, message: n.message });
    }
  }, [pushToast]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      toastTimer.current.forEach((t) => clearTimeout(t));
    };
  }, []);

  return (
    <NotificationContext.Provider
      value={{ notifications, unreadCount, toasts, markAsRead, markAllAsRead, dismissNotification, dismissToast, addNotification, pushToast }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationProvider");
  return ctx;
}
