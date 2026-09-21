import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useDashboard } from "@/context/DashboardContext";
import { Plus, Trash2, Users } from "lucide-react";

export default function GroupsPage() {
  const { agentGroups, agents, addAgentGroup, deleteAgentGroup } = useDashboard();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);

  const canSubmit = !creating && name.trim() !== "";

  const toggleMember = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreate = async () => {
    if (!canSubmit) return;
    setCreating(true);
    try {
      await addAgentGroup(name.trim(), description.trim() || null, [...selected]);
      setShowCreate(false);
      setName("");
      setDescription("");
      setSelected(new Set());
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif">Agent Groups</h1>
          <p className="text-sm text-muted-foreground">
            Organize agents into groups — then write one policy that governs them all.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="rounded-full bg-primary text-primary-foreground hover:opacity-90">
          <Plus className="mr-2 h-4 w-4" /> New Group
        </Button>
      </div>

      {agentGroups.length === 0 ? (
        <Card className="border-hairline bg-surface/60">
          <CardContent className="py-12 text-center">
            <Users className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
            <p className="mt-3 text-sm text-muted-foreground">
              No groups yet. Group-scoped policies apply to every member — create one to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {agentGroups.map((g) => (
            <Card key={g.id} className="border-hairline bg-surface/60">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">{g.name}</p>
                    {g.description && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{g.description}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => deleteAgentGroup(g.id)}
                    aria-label={`Delete group: ${g.name}`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    <span className="sr-only">Delete</span>
                  </Button>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-1.5">
                  {g.memberIds.length === 0 ? (
                    <span className="text-xs text-muted-foreground">No members</span>
                  ) : (
                    g.memberIds.map((id) => {
                      const agent = agents.find((a) => a.id === id);
                      return (
                        <Badge key={id} variant="outline" className="gap-1.5">
                          {agent?.name ?? id.slice(0, 8)}
                        </Badge>
                      );
                    })
                  )}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  {g.memberIds.length} member{g.memberIds.length === 1 ? "" : "s"}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-h-[85vh] overflow-y-auto border-hairline bg-surface">
          <DialogHeader>
            <DialogTitle>New Group</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Policies scoped to this group apply to every member.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="group-name">Name</Label>
              <Input
                id="group-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Database Admins"
                className="rounded-xl border-hairline bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="group-description">Description</Label>
              <Input
                id="group-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What belongs in this group?"
                className="rounded-xl border-hairline bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label>Members</Label>
              {agents.length === 0 ? (
                <p className="text-xs text-muted-foreground">No agents yet — create one first.</p>
              ) : (
                <div className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-hairline p-3">
                  {agents.map((a) => (
                    <div key={a.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`member-${a.id}`}
                        checked={selected.has(a.id)}
                        onCheckedChange={() => toggleMember(a.id)}
                      />
                      <Label htmlFor={`member-${a.id}`} className="cursor-pointer text-sm font-normal">
                        {a.name}
                      </Label>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)} className="rounded-full border-hairline">Cancel</Button>
            <Button onClick={handleCreate} disabled={!canSubmit} className="rounded-full bg-primary text-primary-foreground hover:opacity-90">
              {creating ? "Creating…" : "Create Group"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
