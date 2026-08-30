import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Command } from "lucide-react";

const shortcuts = [
  { category: "Navigation", items: [
    { keys: ["G", "D"], description: "Go to Dashboard" },
    { keys: ["G", "A"], description: "Go to Agents" },
    { keys: ["G", "R"], description: "Go to Grants" },
    { keys: ["G", "P"], description: "Go to Approvals" },
    { keys: ["G", "L"], description: "Go to Audit Log" },
    { keys: ["G", "N"], description: "Go to Notifications" },
  ]},
  { category: "Actions", items: [
    { keys: ["⌘", "K"], description: "Open command palette" },
    { keys: ["?"], description: "Show this help" },
    { keys: ["Esc"], description: "Close modal/palette" },
    { keys: ["N"], description: "New agent (on agents page)" },
  ]},
];

export default function ShortcutsHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "?" && !e.metaKey && !e.ctrlKey && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[100] flex items-center justify-center"
          onClick={() => setOpen(false)}
        >
          <div className="absolute inset-0 bg-foreground/20 backdrop-blur-sm dark:bg-foreground/30" />
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 8 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md overflow-hidden rounded-2xl border border-hairline bg-surface shadow-2xl shadow-foreground/10"
          >
            <div className="flex items-center justify-between border-b border-hairline px-5 py-4">
              <div className="flex items-center gap-2">
                <Command className="h-4 w-4" />
                <span className="font-medium text-sm">Keyboard Shortcuts</span>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-md p-1 text-muted-foreground hover:text-foreground transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-5">
              {shortcuts.map((group) => (
                <div key={group.category}>
                  <div className="eyebrow mb-3">{group.category}</div>
                  <div className="space-y-2">
                    {group.items.map((shortcut) => (
                      <div key={shortcut.description} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{shortcut.description}</span>
                        <div className="flex items-center gap-1">
                          {shortcut.keys.map((key, i) => (
                            <span key={i} className="flex items-center gap-1">
                              {i > 0 && <span className="text-[10px] text-muted-foreground">+</span>}
                              <kbd className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-md border border-hairline bg-background px-1.5 text-[11px] font-mono text-muted-foreground">{key}</kbd>
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-hairline px-5 py-3 text-center text-[10px] text-muted-foreground">
              Press <kbd className="mx-0.5 rounded border border-hairline bg-background px-1 py-0.5">?</kbd> anytime to toggle this panel
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
