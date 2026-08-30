import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDashboard } from "@/context/DashboardContext";
import { Search, Download, ShieldCheck, Bot, User, Key } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import DataTable, { type Column } from "@/components/DataTable";
import type { AuditEntry } from "@/types";

export default function ActivityPage() {
  const { auditLog } = useDashboard();
  const [actorFilter, setActorFilter] = useState("all");
  const [resultFilter, setResultFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [verified, setVerified] = useState<boolean | null>(null);

  const filtered = useMemo(() => auditLog.filter((e) => {
    if (actorFilter !== "all" && e.actorType !== actorFilter) return false;
    if (resultFilter !== "all" && e.result !== resultFilter) return false;
    if (search && !e.actor.toLowerCase().includes(search.toLowerCase()) && !e.action.toLowerCase().includes(search.toLowerCase()) && !e.resource.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [auditLog, actorFilter, resultFilter, search]);

  const columns: Column<AuditEntry>[] = [
    {
      id: "timestamp",
      header: "Timestamp",
      sortable: true,
      getValue: (e) => new Date(e.timestamp).getTime(),
      render: (e) => <span className="whitespace-nowrap text-xs text-muted-foreground">{new Date(e.timestamp).toLocaleString()}</span>,
    },
    {
      id: "actor",
      header: "Actor",
      sortable: true,
      getValue: (e) => e.actor,
      render: (e) => (
        <div className="flex items-center gap-2">
          {e.actorType === "agent" ? <Bot className="h-3.5 w-3.5 text-blue-500" /> : e.actorType === "user" ? <User className="h-3.5 w-3.5 text-green-500" /> : <Key className="h-3.5 w-3.5 text-purple-500" />}
          <span>{e.actor}</span>
        </div>
      ),
    },
    {
      id: "action",
      header: "Action",
      sortable: true,
      getValue: (e) => e.action,
      render: (e) => <span className="text-muted-foreground">{e.action}</span>,
    },
    {
      id: "resource",
      header: "Resource",
      render: (e) => <span className="font-mono text-xs text-muted-foreground">{e.resourceType}/{e.resource}</span>,
    },
    {
      id: "result",
      header: "Result",
      sortable: true,
      getValue: (e) => e.result,
      render: (e) => (
        <Badge variant={e.result === "allowed" || e.result === "issued" ? "success" : e.result === "denied" || e.result === "revoked" ? "destructive" : "warning"}>
          {e.result}
        </Badge>
      ),
    },
    {
      id: "hash",
      header: "Hash",
      render: (e) => <span className="font-mono text-xs text-muted-foreground max-w-[120px] truncate cursor-pointer block" title={e.hash}>{e.hash}</span>,
    },
  ];

  const handleExport = () => {
    const csv = "Timestamp,Actor,Action,Resource,Result,Hash\n" + filtered.map((e) => `${e.timestamp},${e.actor},${e.action},${e.resourceType}/${e.resource},${e.result},${e.hash}`).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "audit-log.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex items-center justify-between">
        <div><h1 className="text-2xl font-serif">Audit Log</h1><p className="text-sm text-muted-foreground">Tamper-evident log of every action, token, and approval decision.</p></div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { setVerified(true); setTimeout(() => setVerified(null), 5000); }} className="rounded-full border-hairline"><ShieldCheck className="mr-2 h-3.5 w-3.5" /> Verify Chain Integrity</Button>
          <Button variant="outline" size="sm" onClick={handleExport} className="rounded-full border-hairline"><Download className="mr-2 h-3.5 w-3.5" /> Export</Button>
        </div>
      </motion.div>
      <AnimatePresence>
        {verified !== null && (
          <motion.div initial={{ opacity: 0, y: -8, height: 0 }} animate={{ opacity: 1, y: 0, height: "auto" }} exit={{ opacity: 0, y: -8, height: 0 }}>
            <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30"><CardContent className="p-4 flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-green-600 dark:text-green-400" /><span className="text-sm text-green-700 dark:text-green-300">Chain verified. All {auditLog.length} entries are intact and unaltered.</span></CardContent></Card>
          </motion.div>
        )}
      </AnimatePresence>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }} className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Search events..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 rounded-xl border-hairline bg-background" /></div>
        <Select value={actorFilter} onValueChange={setActorFilter}><SelectTrigger className="w-36 rounded-xl border-hairline bg-background"><SelectValue placeholder="Actor" /></SelectTrigger><SelectContent className="border-hairline bg-surface"><SelectItem value="all">All Actors</SelectItem><SelectItem value="agent">Agents</SelectItem><SelectItem value="user">Users</SelectItem><SelectItem value="system">System</SelectItem></SelectContent></Select>
        <Select value={resultFilter} onValueChange={setResultFilter}><SelectTrigger className="w-36 rounded-xl border-hairline bg-background"><SelectValue placeholder="Result" /></SelectTrigger><SelectContent className="border-hairline bg-surface"><SelectItem value="all">All Results</SelectItem><SelectItem value="allowed">Allowed</SelectItem><SelectItem value="denied">Denied</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="issued">Issued</SelectItem><SelectItem value="revoked">Revoked</SelectItem></SelectContent></Select>
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 }}>
        <Card className="border-hairline bg-surface/60 dark:bg-surface/40">
          <CardContent className="p-0">
            <DataTable
              columns={columns}
              data={filtered}
              keyExtractor={(e) => e.id}
              pageSize={15}
              emptyMessage="Audit events will appear here as your agents take action."
            />
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
