import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useParams, Link } from "wouter";
import { ArrowLeft, Save, DollarSign, AlertTriangle, CheckCircle2, Wrench, Camera, Trash2, ImagePlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";

const CONDITIONS = ["E", "G", "F", "P", "N/A"];
const COND_LABELS: Record<string, string> = { E: "Excellent", G: "Good", F: "Fair", P: "Poor", "N/A": "N/A" };

const MAINT_CATEGORIES = ["Plumbing", "Electrical", "HVAC", "Appliance", "Flooring", "Walls/Paint", "Windows/Doors", "Roof/Exterior", "Pest Control", "General"];
const MAINT_URGENCY = ["low", "medium", "high", "emergency"];

type ItemEdit = { condition: string; notes: string; hasDamage: boolean; estimatedRepairCost: number; };
type MaintPrefill = { item: any; area: string; } | null;

export default function InspectionDetail() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [edits, setEdits] = useState<Record<number, ItemEdit>>({});
  const [saving, setSaving] = useState<Set<number>>(new Set());
  const [maintDialog, setMaintDialog] = useState<MaintPrefill>(null);
  const [maintForm, setMaintForm] = useState({ category: "General", urgency: "medium", title: "", description: "" });
  const [uploadingItemId, setUploadingItemId] = useState<number | null>(null);
  const [itemPhotos, setItemPhotos] = useState<Record<number, any[]>>({});
  const [expandedPhotos, setExpandedPhotos] = useState<Set<number>>(new Set());

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

  const maintMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/maintenance", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/maintenance"] });
      setMaintDialog(null);
      toast({ title: "Maintenance request created", description: "Added to the maintenance queue." });
    },
  });

  function openMaintDialog(item: any) {
    setMaintForm({
      category: "General",
      urgency: "medium",
      title: `${item.area} — ${item.item}`,
      description: edits[item.id]?.notes || item.notes || "",
    });
    setMaintDialog({ item, area: item.area });
  }

  function submitMaint(e: React.FormEvent) {
    e.preventDefault();
    if (!maintDialog || !inspection) return;
    maintMutation.mutate({
      tenantId: inspection.tenantId,
      propertyId: inspection.propertyId,
      category: maintForm.category,
      urgency: maintForm.urgency,
      title: maintForm.title,
      description: maintForm.description,
      location: maintDialog.area,
      submittedAt: new Date().toISOString(),
      status: "open",
    });
  }

  async function loadPhotos(itemId: number) {
    const r = await fetch(`/api/inspection-items/${itemId}/photos`);
    const photos = await r.json();
    setItemPhotos(prev => ({ ...prev, [itemId]: photos }));
  }

  async function handlePhotoUpload(itemId: number, files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploadingItemId(itemId);
    const fd = new FormData();
    Array.from(files).forEach(f => fd.append("photos", f));
    await fetch(`/api/inspection-items/${itemId}/photos`, { method: "POST", body: fd });
    await loadPhotos(itemId);
    setUploadingItemId(null);
    setExpandedPhotos(prev => new Set(prev).add(itemId));
  }

  async function deletePhoto(itemId: number, photoId: number) {
    await fetch(`/api/inspection-items/photos/${photoId}`, { method: "DELETE" });
    await loadPhotos(itemId);
  }

  function togglePhotos(itemId: number) {
    setExpandedPhotos(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) { next.delete(itemId); } else { next.add(itemId); loadPhotos(itemId); }
      return next;
    });
  }

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
                          {/* Create maintenance request */}
                          {(isDamaged || edit.condition === "F" || edit.condition === "P") && (
                            <button
                              type="button"
                              onClick={() => openMaintDialog(item)}
                              className="px-3 py-1 rounded text-xs font-medium border border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-700 transition-colors flex items-center gap-1"
                              data-testid={`btn-maint-${item.id}`}
                            >
                              <Wrench size={11} /> Maintenance
                            </button>
                          )}
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
                        {/* Photo upload row */}
                        <div className="mt-2 flex items-center gap-2">
                          <label className="cursor-pointer flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border border-border bg-muted hover:bg-secondary transition-colors">
                            {uploadingItemId === item.id ? (
                              <span className="text-xs text-muted-foreground">Uploading...</span>
                            ) : (
                              <><ImagePlus size={12} /> Add Photos</>
                            )}
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              capture="environment"
                              className="hidden"
                              onChange={e => handlePhotoUpload(item.id, e.target.files)}
                              data-testid={`input-photo-${item.id}`}
                            />
                          </label>
                          <label className="cursor-pointer flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border border-border bg-muted hover:bg-secondary transition-colors">
                            <Camera size={12} /> Camera
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              className="hidden"
                              onChange={e => handlePhotoUpload(item.id, e.target.files)}
                            />
                          </label>
                          {(itemPhotos[item.id]?.length > 0) && (
                            <button
                              type="button"
                              onClick={() => togglePhotos(item.id)}
                              className="text-xs text-primary underline"
                            >
                              {expandedPhotos.has(item.id) ? "Hide" : `View ${itemPhotos[item.id].length} photo${itemPhotos[item.id].length !== 1 ? "s" : ""}`}
                            </button>
                          )}
                        </div>
                        {/* Photo thumbnails */}
                        {expandedPhotos.has(item.id) && itemPhotos[item.id]?.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {itemPhotos[item.id].map((photo: any) => (
                              <div key={photo.id} className="relative group">
                                <img
                                  src={`/uploads/${photo.filename}`}
                                  alt={photo.originalName || "Inspection photo"}
                                  className="w-20 h-20 object-cover rounded border border-border"
                                />
                                <button
                                  type="button"
                                  onClick={() => deletePhoto(item.id, photo.id)}
                                  className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <Trash2 size={10} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {/* Create Maintenance Request dialog */}
      <Dialog open={!!maintDialog} onOpenChange={open => !open && setMaintDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Wrench size={16} /> Create Maintenance Request</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitMaint} className="space-y-3">
            <div>
              <Label>Title</Label>
              <Input value={maintForm.title} onChange={e => setMaintForm(f => ({ ...f, title: e.target.value }))} data-testid="input-maint-title" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Category</Label>
                <Select value={maintForm.category} onValueChange={v => setMaintForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{MAINT_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Urgency</Label>
                <Select value={maintForm.urgency} onValueChange={v => setMaintForm(f => ({ ...f, urgency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="emergency">Emergency</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={maintForm.description} onChange={e => setMaintForm(f => ({ ...f, description: e.target.value }))} rows={3} placeholder="Describe the issue..." data-testid="input-maint-desc" />
            </div>
            <p className="text-xs text-muted-foreground">Location: <span className="font-medium">{maintDialog?.area}</span> · Tenant and property pre-filled from this inspection.</p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setMaintDialog(null)}>Cancel</Button>
              <Button type="submit" disabled={maintMutation.isPending} data-testid="btn-submit-maint">Create Request</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
