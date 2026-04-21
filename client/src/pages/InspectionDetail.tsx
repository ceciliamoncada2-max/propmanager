import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useParams, Link } from "wouter";
import { ArrowLeft, Save, DollarSign, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";

const CONDITIONS = ["E", "G", "F", "P", "N/A"];
const COND_LABELS: Record<string, string> = { E: "Excellent", G: "Good", F: "Fair", P: "Poor", "N/A": "N/A" };

type ItemEdit = { condition: string; notes: string; hasDamage: boolean; estimatedRepairCost: number; };

export default function InspectionDetail() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [edits, setEdits] = useState<Record<number, ItemEdit>>({});
  const [saving, setSaving] = useState<Set<number>>(new Set());

  const { data: inspection } = useQuery<any>({ queryKey: ["/api/inspections", Number(id)], queryFn: async () => { const r = await fetch(`/api/inspections/${id}`); return r.json(); } });
  const { data: items = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/inspections", Number(id), "items"], queryFn: async () => { const r = await fetch(`/api/inspections/${id}/items`); return r.json(); } });
  const { data: tenant } = useQuery<any>({ queryKey: ["/api/tenants", inspection?.tenantId], queryFn: async () => { if (!inspection?.tenantId) return null; const r = await fetch(`/api/tenants/${inspection.tenantId}`); return r.json(); }, enabled: !!inspection?.tenantId });

  useEffect(() => {
    if (items.length && Object.keys(edits).length === 0) {
      const initial: Record<number, ItemEdit> = {};
      items.forEach((item: any) => {
        initial[item.id] = { condition: item.condition || "", notes: item.notes || "", hasDamage: !!item.hasDamage, estimatedRepairCost: item.estimatedRepairCost || 0 };
      });
      setEdits(initial);
    }
  }, [items]);

  const updateMutation = useMutation({
    mutationFn: ({ itemId, data }: any) => apiRequest("PATCH", `/api/inspection-items/${itemId}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/inspections"] }); },
  });

  function updateEdit(itemId: number, field: keyof ItemEdit, value: any) {
    setEdits(prev => {
      const cur = prev[itemId] || {};
      const updated = { ...cur, [field]: value };
      // Auto-mark damage if P condition or cost > 0
      if (field === "condition" && value === "P") updated.hasDamage = true;
      if (field === "estimatedRepairCost" && Number(value) > 0) updated.hasDamage = true;
      return { ...prev, [itemId]: updated };
    });
  }

  async function saveItem(itemId: number) {
    const edit = edits[itemId];
    if (!edit) return;
    setSaving(s => new Set(s).add(itemId));
    await updateMutation.mutateAsync({ itemId, data: { ...edit, hasDamage: edit.hasDamage ? 1 : 0 } });
    setSaving(s => { const n = new Set(s); n.delete(itemId); return n; });
  }

  async function saveAll() {
    const ids = Object.keys(edits).map(Number);
    for (const id of ids) { await saveItem(id); }
    toast({ title: "Inspection saved", description: "All items updated." });
  }

  // Group items by area
  const grouped: Record<string, any[]> = {};
  items.forEach((item: any) => {
    if (!grouped[item.area]) grouped[item.area] = [];
    grouped[item.area].push(item);
  });

  const totalDamage = Object.entries(edits).reduce((sum, [_, e]) => sum + (e.hasDamage ? e.estimatedRepairCost : 0), 0);
  const damagedCount = Object.values(edits).filter(e => e.hasDamage).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/inspections"><Button variant="ghost" size="sm"><ArrowLeft size={16} className="mr-1" />Back</Button></Link>
      </div>

      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${inspection?.type === "move_in" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
              {inspection?.type === "move_in" ? "Move-In" : "Move-Out"} Inspection
            </span>
            {inspection?.importedFrom === "rentcheck" && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">From RentCheck</span>}
          </div>
          <h1 className="text-2xl font-bold">{tenant?.name || "Loading..."}</h1>
          <p className="text-muted-foreground text-sm">{inspection?.inspectionDate}{inspection?.inspectorName ? ` · ${inspection.inspectorName}` : ""}</p>
        </div>
        <div className="flex gap-2">
          {tenant && <Link href={`/deposits/${tenant.id}`}><Button variant="outline" size="sm"><DollarSign size={14} className="mr-1.5" />Deposit Ledger</Button></Link>}
          <Button onClick={saveAll} data-testid="btn-save-all"><Save size={14} className="mr-1.5" />Save All</Button>
        </div>
      </div>

      {/* Summary bar */}
      {(damagedCount > 0 || totalDamage > 0) && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="pt-4 pb-4 flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-destructive" />
              <span className="text-sm font-semibold">{damagedCount} damaged item{damagedCount !== 1 ? "s" : ""}</span>
            </div>
            <div>
              <span className="text-sm font-bold text-destructive">Total estimated: ${totalDamage.toFixed(2)}</span>
            </div>
            {tenant && <Link href={`/deposits/${tenant.id}`}><Button size="sm" variant="destructive">Push to Deposit Ledger →</Button></Link>}
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-4">{[...Array(4)].map((_, i) => <div key={i} className="h-40 bg-muted animate-pulse rounded-xl" />)}</div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([area, areaItems]) => (
            <Card key={area}>
              <CardHeader className="py-3 px-5 border-b border-border">
                <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{area}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {areaItems.map((item: any) => {
                    const edit = edits[item.id] || { condition: "", notes: "", hasDamage: false, estimatedRepairCost: 0 };
                    const isDamaged = edit.hasDamage;
                    return (
                      <div key={item.id} className={`px-5 py-3 ${isDamaged ? "bg-red-50/50 dark:bg-red-900/10" : ""}`} data-testid={`insp-item-${item.id}`}>
                        <div className="flex items-start gap-3 flex-wrap">
                          <div className="flex-1 min-w-40">
                            <p className="text-sm font-medium">{item.item}</p>
                          </div>
                          {/* Condition selector */}
                          <div className="w-28">
                            <Select value={edit.condition} onValueChange={v => { updateEdit(item.id, "condition", v); saveItem(item.id); }}>
                              <SelectTrigger className="h-8 text-xs" data-testid={`select-cond-${item.id}`}>
                                <SelectValue placeholder="Condition" />
                              </SelectTrigger>
                              <SelectContent>
                                {CONDITIONS.map(c => (
                                  <SelectItem key={c} value={c}>
                                    <span className={`cond-${c === "N/A" ? "NA" : c}`}>{c} — {COND_LABELS[c]}</span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          {/* Damage cost */}
                          <div className="w-28">
                            <Input
                              type="number"
                              min={0}
                              step={0.01}
                              placeholder="Cost $"
                              className="h-8 text-xs"
                              value={edit.estimatedRepairCost || ""}
                              onChange={e => updateEdit(item.id, "estimatedRepairCost", Number(e.target.value))}
                              onBlur={() => saveItem(item.id)}
                              data-testid={`input-cost-${item.id}`}
                            />
                          </div>
                          {/* Damage flag */}
                          <button
                            type="button"
                            onClick={() => { updateEdit(item.id, "hasDamage", !isDamaged); saveItem(item.id); }}
                            className={`px-3 py-1 rounded text-xs font-medium border transition-colors ${isDamaged ? "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-300" : "bg-muted text-muted-foreground border-border hover:bg-secondary"}`}
                            data-testid={`btn-damage-${item.id}`}
                          >
                            {isDamaged ? "⚠ Damage" : "No Damage"}
                          </button>
                        </div>
                        {/* Notes */}
                        <div className="mt-2">
                          <Input
                            placeholder="Notes / photos description..."
                            className="h-8 text-xs"
                            value={edit.notes}
                            onChange={e => updateEdit(item.id, "notes", e.target.value)}
                            onBlur={() => saveItem(item.id)}
                            data-testid={`input-notes-${item.id}`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
