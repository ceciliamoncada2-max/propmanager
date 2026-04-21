import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { ClipboardList, Plus, Upload, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Link, useLocation } from "wouter";

export default function Inspections() {
  const { toast } = useToast();
  const [newOpen, setNewOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [location] = useLocation();
  const params = new URLSearchParams(location.split("?")[1] || "");
  const filterTenantId = params.get("tenantId");

  const [newForm, setNewForm] = useState({ tenantId: filterTenantId || "", propertyId: "", type: "move_out", inspectionDate: new Date().toISOString().split("T")[0], inspectorName: "" });
  const [importText, setImportText] = useState("");
  const [importTenantId, setImportTenantId] = useState(filterTenantId || "");
  const [importType, setImportType] = useState("move_out");
  const [importDate, setImportDate] = useState(new Date().toISOString().split("T")[0]);

  const { data: inspections = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/inspections", filterTenantId],
    queryFn: async () => {
      const url = filterTenantId ? `/api/inspections?tenantId=${filterTenantId}` : "/api/inspections";
      const r = await fetch(url); return r.json();
    },
  });
  const { data: tenants = [] } = useQuery<any[]>({ queryKey: ["/api/tenants"] });
  const { data: properties = [] } = useQuery<any[]>({ queryKey: ["/api/properties"] });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/inspections", data),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/inspections"] });
      setNewOpen(false);
      toast({ title: "Inspection created", description: "Complete the room-by-room checklist." });
    },
  });

  const importMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/inspections/import-rentcheck", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inspections"] });
      setImportOpen(false);
      setImportText("");
      toast({ title: "RentCheck report imported", description: "Inspection and items loaded." });
    },
  });

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const tenant = tenants.find((t: any) => String(t.id) === newForm.tenantId);
    createMutation.mutate({
      ...newForm,
      tenantId: Number(newForm.tenantId),
      propertyId: tenant ? tenant.propertyId : Number(newForm.propertyId),
    });
  }

  function handleImport(e: React.FormEvent) {
    e.preventDefault();
    let items: any[] = [];
    try {
      // Try to parse as JSON first
      const parsed = JSON.parse(importText);
      items = Array.isArray(parsed) ? parsed : parsed.items || [];
    } catch {
      // Try to parse as CSV-like text from RentCheck
      items = parseRentCheckText(importText);
    }
    if (!items.length) { toast({ title: "No items found", description: "Check your paste format.", variant: "destructive" }); return; }
    const tenant = tenants.find((t: any) => String(t.id) === importTenantId);
    importMutation.mutate({
      tenantId: Number(importTenantId),
      propertyId: tenant?.propertyId,
      type: importType,
      inspectionDate: importDate,
      items,
    });
  }

  function parseRentCheckText(text: string): any[] {
    // Parse typical RentCheck export text: lines like "Kitchen - Cabinets: Good - No issues"
    const items: any[] = [];
    const lines = text.split("\n").filter(l => l.trim());
    let currentArea = "General";
    lines.forEach(line => {
      const trimmed = line.trim();
      // Detect area headers (all caps or title case standalone lines)
      if (/^[A-Z][A-Z\s/]+$/.test(trimmed) && !trimmed.includes(":")) {
        currentArea = trimmed.charAt(0) + trimmed.slice(1).toLowerCase();
        return;
      }
      // Parse item lines: "Item Name: Condition - Notes" or "Item Name: Condition (cost)"
      const match = trimmed.match(/^(.+?):\s*(Excellent|Good|Fair|Poor|N\/A|E|G|F|P)[\s\-–]*(.*?)(?:\$(\d+(?:\.\d+)?))?$/i);
      if (match) {
        const condMap: Record<string, string> = { excellent: "E", good: "G", fair: "F", poor: "P", "n/a": "N/A", e: "E", g: "G", f: "F", p: "P" };
        const cond = condMap[match[2].toLowerCase()] || match[2];
        const notes = match[3].trim();
        const cost = match[4] ? Number(match[4]) : 0;
        items.push({ area: currentArea, item: match[1].trim(), condition: cond, notes, hasDamage: cost > 0 || cond === "P", estimatedRepairCost: cost });
      } else if (trimmed.includes("-") || trimmed.includes(":")) {
        // Fallback: try to extract area - item format
        const parts = trimmed.split(/[-:]/);
        if (parts.length >= 2) {
          items.push({ area: currentArea, item: parts[0].trim(), condition: null, notes: parts.slice(1).join(" - ").trim(), hasDamage: false, estimatedRepairCost: 0 });
        }
      }
    });
    return items;
  }

  function tenantName(id: number) { return tenants.find((t: any) => t.id === id)?.name || "Unknown"; }
  function propertyAddr(id: number) { const p = properties.find((p: any) => p.id === id); return p ? `${p.address}` : "—"; }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Inspections</h1>
          <p className="text-muted-foreground text-sm mt-1">{inspections.length} inspection{inspections.length !== 1 ? "s" : ""} on file</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)} data-testid="btn-import-rentcheck">
            <Upload size={15} className="mr-1.5" /> Import RentCheck
          </Button>
          <Button onClick={() => setNewOpen(true)} disabled={tenants.length === 0} data-testid="btn-new-inspection">
            <Plus size={15} className="mr-1.5" /> New Inspection
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />)}</div>
      ) : inspections.length === 0 ? (
        <Card><CardContent className="py-14 text-center"><ClipboardList size={38} className="mx-auto text-muted-foreground mb-3" /><p className="font-medium">No inspections yet</p><p className="text-sm text-muted-foreground mb-4">Create a new inspection or import from RentCheck.</p></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {inspections.map((insp: any) => (
            <Link key={insp.id} href={`/inspections/${insp.id}`}>
              <Card className="cursor-pointer hover:border-primary/40 transition-colors" data-testid={`insp-card-${insp.id}`}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${insp.type === "move_in" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"}`}>
                          {insp.type === "move_in" ? "Move-In" : "Move-Out"}
                        </span>
                        {insp.importedFrom === "rentcheck" && <span className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 px-2 py-0.5 rounded-full">RentCheck</span>}
                      </div>
                      <p className="font-semibold mt-1">{tenantName(insp.tenantId)}</p>
                      <p className="text-sm text-muted-foreground">{propertyAddr(insp.propertyId)} · {insp.inspectionDate}</p>
                    </div>
                    <div className="text-right">
                      {insp.totalEstimatedCost > 0 && <p className="text-base font-bold text-destructive">${Number(insp.totalEstimatedCost).toFixed(2)}</p>}
                      <p className="text-xs text-muted-foreground">Est. damage</p>
                      <ArrowRight size={14} className="ml-auto mt-1 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* New Inspection dialog */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Inspection</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <Label>Tenant</Label>
              <Select value={newForm.tenantId} onValueChange={v => setNewForm(f => ({ ...f, tenantId: v }))}>
                <SelectTrigger data-testid="select-insp-tenant"><SelectValue placeholder="Select tenant" /></SelectTrigger>
                <SelectContent>{tenants.map((t: any) => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select value={newForm.type} onValueChange={v => setNewForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger data-testid="select-insp-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="move_in">Move-In</SelectItem>
                    <SelectItem value="move_out">Move-Out</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Date</Label>
                <Input type="date" value={newForm.inspectionDate} onChange={e => setNewForm(f => ({ ...f, inspectionDate: e.target.value }))} data-testid="input-insp-date" />
              </div>
            </div>
            <div>
              <Label>Inspector Name</Label>
              <Input value={newForm.inspectorName} onChange={e => setNewForm(f => ({ ...f, inspectorName: e.target.value }))} data-testid="input-inspector" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setNewOpen(false)}>Cancel</Button>
              <Button type="submit" data-testid="btn-create-inspection">Create & Open Checklist</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Import RentCheck dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Import RentCheck Report</DialogTitle></DialogHeader>
          <form onSubmit={handleImport} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tenant</Label>
                <Select value={importTenantId} onValueChange={setImportTenantId}>
                  <SelectTrigger data-testid="select-import-tenant"><SelectValue placeholder="Select tenant" /></SelectTrigger>
                  <SelectContent>{tenants.map((t: any) => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Inspection Type</Label>
                <Select value={importType} onValueChange={setImportType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="move_in">Move-In</SelectItem>
                    <SelectItem value="move_out">Move-Out</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Inspection Date</Label>
              <Input type="date" value={importDate} onChange={e => setImportDate(e.target.value)} />
            </div>
            <div>
              <Label>Paste RentCheck Report Data</Label>
              <p className="text-xs text-muted-foreground mb-1.5">Paste the exported text or JSON from your RentCheck report. Each line should follow: <code className="bg-muted px-1 rounded">Area - Item: Condition - Notes</code></p>
              <Textarea
                value={importText}
                onChange={e => setImportText(e.target.value)}
                rows={12}
                placeholder={`KITCHEN\nKitchen - Appliances: Good - All working\nKitchen - Sink/Plumbing: Fair - Slow drain $75\n\nBATHROOM\nBathroom 1 - Tile: Poor - Cracked tile $200`}
                className="font-mono text-xs"
                data-testid="textarea-import"
              />
              <p className="text-xs text-muted-foreground mt-1">You can also paste raw JSON from a RentCheck export.</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setImportOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={!importText || !importTenantId} data-testid="btn-run-import">Import Report</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
