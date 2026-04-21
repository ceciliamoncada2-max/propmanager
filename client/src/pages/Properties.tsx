import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Building2, Plus, Pencil, Trash2, MapPin, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Link } from "wouter";

const emptyForm = { address: "", city: "", state: "TX", zip: "", unitCount: 1, notes: "" };

export default function Properties() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: properties = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/properties"] });
  const { data: tenants = [] } = useQuery<any[]>({ queryKey: ["/api/tenants"] });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/properties", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/properties"] }); closeDialog(); toast({ title: "Property added" }); },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: any) => apiRequest("PATCH", `/api/properties/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/properties"] }); closeDialog(); toast({ title: "Property updated" }); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/properties/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/properties"] }); toast({ title: "Property deleted" }); },
  });

  function openAdd() { setEditing(null); setForm(emptyForm); setOpen(true); }
  function openEdit(p: any) { setEditing(p); setForm({ address: p.address, city: p.city, state: p.state, zip: p.zip, unitCount: p.unitCount || 1, notes: p.notes || "" }); setOpen(true); }
  function closeDialog() { setOpen(false); setEditing(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editing) updateMutation.mutate({ id: editing.id, data: form });
    else createMutation.mutate(form);
  }

  const tenantCountFor = (propId: number) => tenants.filter((t: any) => t.propertyId === propId && t.status === "active").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Properties</h1>
          <p className="text-muted-foreground text-sm mt-1">{properties.length} propert{properties.length !== 1 ? "ies" : "y"} on file</p>
        </div>
        <Button onClick={openAdd} data-testid="btn-add-property">
          <Plus size={16} className="mr-1.5" /> Add Property
        </Button>
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-2 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-36 bg-muted animate-pulse rounded-xl" />)}
        </div>
      ) : properties.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Building2 size={40} className="mx-auto text-muted-foreground mb-3" />
            <p className="font-medium">No properties yet</p>
            <p className="text-sm text-muted-foreground mb-4">Add your first property to get started.</p>
            <Button onClick={openAdd}>Add Property</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {properties.map((p: any) => (
            <Card key={p.id} data-testid={`property-card-${p.id}`}>
              <CardContent className="pt-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Building2 size={16} className="text-primary" />
                      <p className="font-semibold">{p.address}</p>
                    </div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin size={13} />
                      {p.city}, {p.state} {p.zip}
                    </div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                      <Users size={13} />
                      {tenantCountFor(p.id)} active tenant{tenantCountFor(p.id) !== 1 ? "s" : ""}
                    </div>
                    {p.notes && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{p.notes}</p>}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(p)} data-testid={`btn-edit-property-${p.id}`}><Pencil size={15} /></Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(p.id)} data-testid={`btn-delete-property-${p.id}`}><Trash2 size={15} /></Button>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <Link href={`/tenants?propertyId=${p.id}`}>
                    <Button variant="outline" size="sm">View Tenants</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Property" : "Add Property"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="address">Street Address</Label>
              <Input id="address" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} required data-testid="input-address" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="city">City</Label>
                <Input id="city" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} required data-testid="input-city" />
              </div>
              <div>
                <Label htmlFor="state">State</Label>
                <Select value={form.state} onValueChange={v => setForm(f => ({ ...f, state: v }))}>
                  <SelectTrigger data-testid="select-state"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TX">Texas</SelectItem>
                    <SelectItem value="NJ">New Jersey</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="zip">ZIP Code</Label>
                <Input id="zip" value={form.zip} onChange={e => setForm(f => ({ ...f, zip: e.target.value }))} required data-testid="input-zip" />
              </div>
              <div>
                <Label htmlFor="units">Units</Label>
                <Input id="units" type="number" min={1} value={form.unitCount} onChange={e => setForm(f => ({ ...f, unitCount: Number(e.target.value) }))} data-testid="input-units" />
              </div>
            </div>
            <div>
              <Label htmlFor="notes">Notes (optional)</Label>
              <Input id="notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} data-testid="input-notes" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>Cancel</Button>
              <Button type="submit" data-testid="btn-save-property">{editing ? "Save Changes" : "Add Property"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
