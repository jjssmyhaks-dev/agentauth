import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import {
  Search, Shield, KeyRound, CheckSquare, Activity, BarChart3,
  Webhook, Key, Settings, BookOpen, BellRing, LayoutDashboard,
  Sun, Moon, LogOut, ArrowRight, Command, CornerDownLeft,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ElementType;
  action: () => void;
  keywords: string[];
  section: string;
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();

  const commands: CommandItem[] = [
    { id: "nav-overview", label: "Overview", description: "Dashboard overview", icon: LayoutDashboard, action: () => navigate("/dashboard"), keywords: ["home", "dashboard", "overview"], section: "Navigation" },
    { id: "nav-agents", label: "Agents", description: "Manage agent identities", icon: Shield, action: () => navigate("/dashboard/agents"), keywords: ["agents", "identity", "key"], section: "Navigation" },
    { id: "nav-grants", label: "Grants", description: "Permission grants", icon: KeyRound, action: () => navigate("/dashboard/grants"), keywords: ["grants", "permissions", "access"], section: "Navigation" },
    { id: "nav-approvals", label: "Approvals", description: "Pending approval queue", icon: CheckSquare, action: () => navigate("/dashboard/approvals"), keywords: ["approvals", "approve", "deny", "pending"], section: "Navigation" },
    { id: "nav-activity", label: "Audit Log", description: "Tamper-evident activity log", icon: Activity, action: () => navigate("/dashboard/activity"), keywords: ["audit", "log", "activity", "history"], section: "Navigation" },
    { id: "nav-analytics", label: "Analytics", description: "Token usage and performance", icon: BarChart3, action: () => navigate("/dashboard/analytics"), keywords: ["analytics", "charts", "stats", "usage"], section: "Navigation" },
    { id: "nav-notifications", label: "Notifications", description: "Notification center", icon: BellRing, action: () => navigate("/dashboard/notifications"), keywords: ["notifications", "alerts", "bell"], section: "Navigation" },
    { id: "nav-webhooks", label: "Webhooks", description: "Webhook configuration", icon: Webhook, action: () => navigate("/dashboard/webhooks"), keywords: ["webhooks", "events", "hooks"], section: "Navigation" },
    { id: "nav-api-keys", label: "API Keys", description: "Manage dashboard API keys", icon: Key, action: () => navigate("/dashboard/api-keys"), keywords: ["api", "keys", "tokens"], section: "Navigation" },
    { id: "nav-settings", label: "Settings", description: "Organization settings", icon: Settings, action: () => navigate("/dashboard/settings"), keywords: ["settings", "config", "org"], section: "Navigation" },
    { id: "nav-docs", label: "SDK Docs", description: "SDK documentation", icon: BookOpen, action: () => navigate("/dashboard/docs"), keywords: ["docs", "documentation", "sdk", "reference"], section: "Navigation" },
    { id: "action-theme", label: `Switch to ${resolvedTheme === "dark" ? "Light" : "Dark"} Mode`, description: "Toggle color theme", icon: resolvedTheme === "dark" ? Sun : Moon, action: () => setTheme(resolvedTheme === "dark" ? "light" : "dark"), keywords: ["theme", "dark", "light", "mode", "toggle"], section: "Actions" },
    { id: "action-signout", label: "Sign Out", description: "End your session", icon: LogOut, action: () => { signOut(); navigate("/"); }, keywords: ["signout", "logout", "exit"], section: "Actions" },
    { id: "action-landing", label: "Go to Landing Page", description: "View the marketing site", icon: ArrowRight, action: () => navigate("/"), keywords: ["home", "landing", "marketing"], section: "Actions" },
  ];

  const filtered = commands.filter((cmd) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return cmd.label.toLowerCase().includes(q) || cmd.keywords.some((k) => k.includes(q)) || (cmd.description || "").toLowerCase().includes(q);
  });

  // Group by section
  const grouped = filtered.reduce<Record<string, CommandItem[]>>((acc, cmd) => {
    (acc[cmd.section] = acc[cmd.section] || []).push(cmd);
    return acc;
  }, {});

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const executeCommand = useCallback((cmd: CommandItem) => {
    cmd.action();
    setOpen(false);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filtered[selectedIndex]) {
      e.preventDefault();
      executeCommand(filtered[selectedIndex]);
    }
  }, [filtered, selectedIndex, executeCommand]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const item = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh]"
        onClick={() => setOpen(false)}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-foreground/20 backdrop-blur-sm dark:bg-foreground/30" />

        {/* Palette */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: -8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: -8 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-hairline bg-surface shadow-2xl shadow-foreground/10"
        >
          {/* Search input */}
          <div className="flex items-center gap-3 border-b border-hairline px-4">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Type a command or search..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <kbd className="hidden shrink-0 rounded-md border border-hairline bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline-block">ESC</kbd>
          </div>

          {/* Results */}
          <div ref={listRef} className="max-h-80 overflow-y-auto p-2">
            {filtered.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">No results found.</div>
            ) : (
              Object.entries(grouped).map(([section, items]) => (
                <div key={section}>
                  <div className="px-2 py-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{section}</div>
                  {items.map((cmd) => {
                    const globalIndex = filtered.indexOf(cmd);
                    const Icon = cmd.icon;
                    return (
                      <button
                        key={cmd.id}
                        data-index={globalIndex}
                        onClick={() => executeCommand(cmd)}
                        onMouseEnter={() => setSelectedIndex(globalIndex)}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                          globalIndex === selectedIndex ? "bg-foreground/5 text-foreground" : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="font-medium">{cmd.label}</div>
                          {cmd.description && <div className="text-xs text-muted-foreground">{cmd.description}</div>}
                        </div>
                        {globalIndex === selectedIndex && (
                          <CornerDownLeft className="h-3 w-3 shrink-0 text-muted-foreground" />
                        )}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-hairline px-4 py-2 text-[10px] text-muted-foreground">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1"><kbd className="rounded border border-hairline bg-background px-1 py-0.5">↑↓</kbd> navigate</span>
              <span className="flex items-center gap-1"><kbd className="rounded border border-hairline bg-background px-1 py-0.5">↵</kbd> select</span>
              <span className="flex items-center gap-1"><kbd className="rounded border border-hairline bg-background px-1 py-0.5">esc</kbd> close</span>
            </div>
            <span className="flex items-center gap-1"><Command className="h-3 w-3" />K</span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
