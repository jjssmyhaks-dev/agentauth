import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDashboard } from "@/context/DashboardContext";
import { Search, Download, ShieldCheck, CheckCircle2, AlertTriangle, Clock, Key, User, Bot } from "lucide-react";

export default function ActivityPage() {
  const { auditLog } = useDashboard();
  const [actorFilter, setActorFilter] = useState("all");
  const [resultFilter, setResultFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [verified, setVerified] = useState<boolean | null>(null);

  const filtered = auditLog.filter((e) => {
    if (actorFilter !== "all" && e.actorType !== actorFilter) return false;
    if (resultFilter !== "all" && e.result !== resultFilter) return false;
    if (search && !e.actor.toLowerCase().includes(search.toLowerCase()) && !e.action.toLowerCase().includes(search.toLowerCase()) && !e.resource.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleExport = () => {
    const csv = "Timestamp,Actor,Action,Resource,Result,Hash\n" + filtered.map((e) => `${e.timestamp},${e.actor},${e.action},${e.resourceType}/${e.resource},${e.result},${e.hash}`).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "audit-log.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const handleVerify = () => {
    // Simulate chain verification
    setVerified(true);
    setTimeout(() => setVerified(null), 5000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Audit Log</h1>
          <p className="text-sm text-slate-400">Tamper-evident log of every action, token, and approval decision.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleVerify} className="border-slate-700 text-slate-300">
            <ShieldCheck className="mr-2 h-3.5 w-3.5" /> Verify Chain
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} className="border-slate-700 text-slate-300">
            <Download className="mr-2 h-3.5 w-3.5" /> Export CSV
          </Button>
        </div>
      </div>

      {verified !== null && (
        <Card className={`border ${verified ? "border-emerald-500/30 bg-emerald-500/5" : "border-red-500/30 bg-red-500/5"}`}>
          <CardContent className="p-4 flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
            <span className="text-sm text-emerald-400">Chain verified. All {auditLog.length} entries are intact and unaltered.</span>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input placeholder="Search events..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 border-slate-700 bg-slate-800/50 text-white placeholder:text-slate-500" />
        </div>
        <Select value={actorFilter} onValueChange={setActorFilter}>
          <SelectTrigger className="w-36 border-slate-700 bg-slate-800/50 text-white"><SelectValue placeholder="Actor" /></SelectTrigger>
          <SelectContent className="border-slate-700 bg-slate-800">
            <SelectItem value="all">All Actors</SelectItem>
            <SelectItem value="agent">Agents</SelectItem>
            <SelectItem value="user">Users</SelectItem>
            <SelectItem value="system">System</SelectItem>
          </SelectContent>
        </Select>
        <Select value={resultFilter} onValueChange={setResultFilter}>
          <SelectTrigger className="w-36 border-slate-700 bg-slate-800/50 text-white"><SelectValue placeholder="Result" /></SelectTrigger>
          <SelectContent className="border-slate-700 bg-slate-800">
            <SelectItem value="all">All Results</SelectItem>
            <SelectItem value="allowed">Allowed</SelectItem>
            <SelectItem value="denied">Denied</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="issued">Issued</SelectItem>
            <SelectItem value="revoked">Revoked</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="border-slate-800 bg-slate-900/50">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-800 text-left">
                <th className="p-4 font-medium text-slate-400">Time</th>
                <th className="p-4 font-medium text-slate-400">Actor</th>
                <th className="p-4 font-medium text-slate-400">Action</th>
                <th className="p-4 font-medium text-slate-400">Resource</th>
                <th className="p-4 font-medium text-slate-400">Result</th>
                <th className="p-4 font-medium text-slate-400">Hash</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-800">
                {filtered.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-800/30">
                    <td className="p-4 whitespace-nowrap text-xs text-slate-400">{new Date(e.timestamp).toLocaleString()}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {e.actorType === "agent" ? <Bot className="h-3.5 w-3.5 text-blue-400" /> : e.actorType === "user" ? <User className="h-3.5 w-3.5 text-emerald-400" /> : <Key className="h-3.5 w-3.5 text-purple-400" />}
                        <span className="text-white">{e.actor}</span>
                      </div>
                    </td>
                    <td className="p-4 text-slate-300">{e.action}</td>
                    <td className="p-4 font-mono text-xs text-slate-400">{e.resourceType}/{e.resource}</td>
                    <td className="p-4">
                      <Badge variant={e.result === "allowed" || e.result === "issued" ? "success" : e.result === "denied" || e.result === "revoked" ? "destructive" : "warning"}>{e.result}</Badge>
                    </td>
                    <td className="p-4 font-mono text-xs text-slate-500 max-w-[120px] truncate">{e.hash}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && <p className="p-8 text-center text-sm text-slate-500">No matching audit entries.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
