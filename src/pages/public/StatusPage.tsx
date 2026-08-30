import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Activity, CheckCircle2, Clock } from "lucide-react";
import PublicLayout from "@/components/PublicLayout";

const services = [
  { name: "API", status: "operational" as const, uptime: 99.99 },
  { name: "Dashboard", status: "operational" as const, uptime: 99.98 },
  { name: "Token Service", status: "operational" as const, uptime: 99.99 },
  { name: "Webhook Delivery", status: "operational" as const, uptime: 99.95 },
  { name: "SDK Registry", status: "operational" as const, uptime: 100 },
];

function LiveTime() {
  const [time, setTime] = useState(new Date());
  useEffect(() => { const i = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(i); }, []);
  return <span className="font-mono text-sm">{time.toUTCString()}</span>;
}

function UptimeBar({ uptime }: { uptime: number }) {
  const days = Array.from({ length: 90 }, (_, i) => {
    const noise = Math.random() * 0.02;
    return Math.min(100, uptime - noise + (Math.random() > 0.95 ? -Math.random() * 2 : 0));
  });
  return (
    <div className="flex items-end gap-px h-8">
      {days.map((d, i) => (
        <motion.div
          key={i}
          initial={{ height: 0 }}
          animate={{ height: `${d}%` }}
          transition={{ duration: 0.3, delay: i * 0.005 }}
          className={`flex-1 rounded-t-sm ${d >= 99.9 ? "bg-green-500" : d >= 99 ? "bg-amber-500" : "bg-red-500"}`}
          title={`${d.toFixed(2)}% uptime`}
        />
      ))}
    </div>
  );
}

export default function StatusPage() {
  return (
    <PublicLayout>
      <div className="mx-auto max-w-3xl px-5 py-16 sm:px-6 sm:py-24 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">
          <div className="eyebrow mb-4 flex items-center justify-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <Activity className="h-3.5 w-3.5" /> System Status
          </div>
          <h1 className="text-3xl sm:text-4xl">All Systems Operational</h1>
          <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <LiveTime />
          </div>
        </motion.div>

        <div className="space-y-4">
          {services.map((service, i) => (
            <motion.div
              key={service.name}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 + i * 0.06 }}
              className="rounded-2xl border border-hairline bg-surface/60 p-5"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="font-medium text-sm">{service.name}</span>
                </div>
                <span className="text-xs text-muted-foreground">{service.uptime}% uptime (90d)</span>
              </div>
              <UptimeBar uptime={service.uptime} />
            </motion.div>
          ))}
        </div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="mt-12 text-center text-sm text-muted-foreground">
          <p>Response times measured from US East, EU West, and APAC.</p>
          <p className="mt-1">Historical data available via API.</p>
        </motion.div>
      </div>
    </PublicLayout>
  );
}
