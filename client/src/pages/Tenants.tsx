import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Users, Plus, Pencil, Copy, ExternalLink, DollarSign, ClipboardList } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Link, useLocation } from "wouter";

const emptyForm = {
  propertyId: "",
  name: "", email: "", phone: "", unitNumber: "",
  leaseStart: "", leaseEnd: "", status: "active",
  moveOutDate: "", forwardingAddress: "",
};

export default function Tenants() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const [location] = useLocation();
  const params = new URLSearchParams(location.split("?")[1] || "");
  const filterPropId = params.get("propertyId");

  const { data: tenants = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/tenants"] });
  const { data: properties = [] } = useQuery<any[]>({ queryKey: ["/api/properties"] });

  const displayed = filterPropId ? tenants.filter((t: any) => String(t.propertyId) === filterPropId) : tenants;

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/tenants", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/tenants"] }); closeDialog(); toast({ title: "Tenant added" }); },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: any) => apiRequest("PATCH", `/api/tenants/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/tenants"] }); closeDialog(); toast({ title: "Tenant updated" }); },
  });

  function openAdd() { setEditing(null); setForm({ ...emptyForm, propertyId: filterPropId || "" }); setOpen(true); }
  function openEdit(t: any) {
    setEditing(t);
    setForm({ propertyId: String(t.propertyId), name: t.name, email: t.email || "", phone: t.phone || "", unitNumber: t.unitNumber || "", leaseStart: t.leaseStart || "", leaseEnd: t.leaseEnd || "", status: t.status, moveOutDate: t.moveOutDate || "", forwardingAddress: t.forwardingAddress || "" });
    setOpen(true);
  }
  function closeDialog() { setOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data = { ...form, propertyId: Number(form.propertyId) };
    if (editing) updateMutation.mutate({ id: editing.id, data });
    else createMutation.mutate(data);
  }

  function copyPortalLink(code: string) {
    const url = `${window.location.origin}${window.location.pathname}#/portal/${code}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Portal link copied", description: "Send this to your tenant." });
  }

  function propName(id: number) {
    const p = properties.find((p: any) => p.id === id);
    return p ? `${p.address}, ${p.city}` : "—";
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tenants</h1>
          <p className="text-muted-foreground text-sm mt-1">{displayed.length} tenant{displayed.length !== 1 ? "s" : ""}</p>
        </div>
        <Button onClick={openAdd} disabled={properties.length === 0} data-testid="btn-add-tenant">
          <Plus size={16} className="mr-1.5" /> Add Tenant
        </Button>
      </div>

      {properties.length === 0 && (
        <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Add a property first before adding tenants.</CardContent></Card>
      )}

      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />)}</div>
      ) : displayed.length === 0 ? (
        <Card><CardContent className="py-12 text-center"><Users size={36} className="mx-auto text-muted-foreground mb-3" /><p className="font-medium">No tenants yet</p><p className="text-sm text-muted-foreground mb-4">Add your first tenant to get started.</p><Button onClick={openAdd}>Add Tenant</Button></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {displayed.map((t: any) => (
            <Card key={t.id} data-testid={`tenant-card-${t.id}`}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2">
                      <Link href={`/tenants/${t.id}`}><span className="font-semibold hover:text-primary cursor-pointer">{t.name}</span></Link>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium status-${t.status}`}>{t.status === "active" ? "Active" : "Moved Out"}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{propName(t.propertyId)}{t.unitNumber ? ` · Unit ${t.unitNumber}` : ""}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t.email}{t.phone ? ` · ${t.phone}` : ""}</p>
                    {t.leaseStart && <p className="text-xs text-muted-foreground mt-0.5">Lease: {t.leaseStart} → {t.leaseEnd || "ongoing"}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2 items-center">
                    <Button variant="outline" size="sm" onClick={() => copyPortalLink(t.portalCode)} data-testid={`btn-copy-portal-${t.id}`}>
                      <Copy size={13} className="mr-1.5" /> Portal Link
                    </Button>
                    <Link href={`/deposits/${t.id}`}>
                      <Button variant="outline" size="sm" data-testid={`btn-deposit-${t.id}`}>
                        <DollarSign size={13} className="mr-1.5" /> Deposit
                      </Button>
                    </Link>
                    <Link href={`/inspections?tenantId=${t.id}`}>
                      <Button variant="outline" size="sm" data-testid={`btn-inspect-${t.id}`}>
                        <ClipboardList size={13} className="mr-1.5" /> Inspections
                      </Button>
                    </Link>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(t)} data-testid={`btn-edit-tenant-${t.id}`}><Pencil size={14} /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Edit Tenant" : "Add Tenant"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Property</Label>
              <Select value={form.propertyId} onValueChange={v => setForm((f: any) => ({ ...f, propertyId: v }))}>
                <SelectTrigger data-testid="select-property"><SelectValue placeholder="Select property" /></SelectTrigger>
                <SelectContent>
                  {properties.map((p: any) => <SelectItem key={p.id} value={String(p.id)}>{p.address}, {p.city}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Full Name</Label>
                <Input value={form.name} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))} required data-testid="input-tenant-name" />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={e => setForm((f: any) => ({ ...f, email: e.target.value }))} data-testid="input-tenant-email" />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={form.phone} onChange={e => setForm((f: any) => ({ ...f, phone: e.target.value }))} data-testid="input-tenant-phone" />
              </div>
              <div>
                <Label>Unit #</Label>
                <Input value={form.unitNumber} onChange={e => setForm((f: any) => ({ ...f, unitNumber: e.target.value }))} data-testid="input-unit" />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm((f: any) => ({ ...f, status: v }))}>
                  <SelectTrigger data-testid="select-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="moved_out">Moved Out</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Lease Start</Label>
                <Input type="date" value={form.leaseStart} onChange={e => setForm((f: any) => ({ ...f, leaseStart: e.target.value }))} data-testid="input-lease-start" />
              </div>
              <div>
                <Label>Lease End</Label>
                <Input type="date" value={form.leaseEnd} onChange={e => setForm((f: any) => ({ ...f, leaseEnd: e.target.value }))} data-testid="input-lease-end" />
              </div>
              <div>
                <Label>Move-Out Date</Label>
                <Input type="date" value={form.moveOutDate} onChange={e => setForm((f: any) => ({ ...f, moveOutDate: e.target.value }))} data-testid="input-move-out" />
              </div>
              <div>
                <Label>Forwarding Address</Label>
                <Input value={form.forwardingAddress} onChange={e => setForm((f: any) => ({ ...f, forwardingAddress: e.target.value }))} data-testid="input-forwarding" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>Cancel</Button>
              <Button type="submit" data-testid="btn-save-tenant">{editing ? "Save Changes" : "Add Tenant"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
