import { motion } from "framer-motion";
import { GitCommit, Tag } from "lucide-react";
import PublicLayout from "@/components/PublicLayout";
import { useState, useEffect } from "react";

const entries = [
  { version: "0.4.0", date: "2026-08-30", title: "Dark Mode & Command Palette", type: "minor", items: ["Dark mode with system preference detection", "Cmd+K command palette for navigation", "Keyboard shortcuts help overlay", "Mobile responsive sidebar with hamburger menu"] },
  { version: "0.3.0", date: "2026-08-29", title: "Dashboard Depth & Interactive Tables", type: "minor", items: ["Sparklines on stat cards", "Trust score gauge with animation", "Sortable, bulk-selectable data tables", "Empty state illustrations and onboarding checklist"] },
  { version: "0.2.0", date: "2026-08-28", title: "Notification System & Landing Polish", type: "minor", items: ["Real-time notification system with bell icon and panel", "Toast notifications for urgent events", "Landing page scroll animations", "Redesigned auth flow diagram with traveling dots"] },
  { version: "0.1.0", date: "2026-08-27", title: "Initial Platform Launch", type: "major", items: ["Agent identity management with Ed25519 keys", "Grant/permission system with scoped access", "Human-in-the-loop approval workflows", "Tamper-evident audit log", "Dashboard with 14 pages", "TypeScript and Python SDKs", "Landing page with interactive demo"] },
];

function TimeAgo({ date }: { date: string }) {
  const [text, setText] = useState("");
  useEffect(() => {
    const update = () => {
      const diff = Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
      setText(diff === 0 ? "today" : diff === 1 ? "yesterday" : `${diff} days ago`);
    };
    update();
    const i = setInterval(update, 60000);
    return () => clearInterval(i);
  }, [date]);
  return <span>{text}</span>;
}

export default function ChangelogPage() {
  return (
    <PublicLayout>
      <div className="mx-auto max-w-3xl px-5 py-16 sm:px-6 sm:py-24 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="eyebrow mb-4 flex items-center gap-2"><Tag className="h-3.5 w-3.5" /> Changelog</div>
          <h1 className="text-3xl sm:text-4xl">What's new in AgentAuth.</h1>
          <p className="mt-4 text-muted-foreground">Updates, improvements, and new features.</p>
        </motion.div>

        <div className="mt-12 space-y-0">
          {entries.map((entry, i) => (
            <motion.div
              key={entry.version}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 + i * 0.08 }}
              className="relative border-l border-hairline pl-8 pb-12 last:pb-0"
            >
              <div className="absolute -left-[5px] top-1 flex h-[10px] w-[10px] items-center justify-center rounded-full bg-foreground" />
              <div className="flex items-center gap-3 mb-2">
                <span className="font-mono text-sm text-muted-foreground">v{entry.version}</span>
                <span className="text-xs text-muted-foreground"><TimeAgo date={entry.date} /></span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${entry.type === "major" ? "bg-foreground/10 text-foreground" : "bg-muted text-muted-foreground"}`}>
                  {entry.type}
                </span>
              </div>
              <h2 className="text-xl font-medium">{entry.title}</h2>
              <ul className="mt-3 space-y-1.5">
                {entry.items.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <GitCommit className="mt-1 h-3 w-3 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </PublicLayout>
  );
}
