import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { ArrowLeft, Copy, DollarSign, ClipboardList, Wrench, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function TenantDetail() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();

  const { data: tenant, isLoading: tLoading } = useQuery<any>({ queryKey: ["/api/tenants", Number(id)], queryFn: async () => { const r = await fetch(`/api/tenants/${id}`); return r.json(); } });
  const { data: property } = useQuery<any>({ queryKey: ["/api/properties", tenant?.propertyId], queryFn: async () => { if (!tenant?.propertyId) return null; const r = await fetch(`/api/properties/${tenant.propertyId}`); return r.json(); }, enabled: !!tenant?.propertyId });
  const { data: inspections = [] } = useQuery<any[]>({ queryKey: ["/api/inspections", { tenantId: Number(id) }], queryFn: async () => { const r = await fetch(`/api/inspections?tenantId=${id}`); return r.json(); } });
  const { data: maintenance = [] } = useQuery<any[]>({ queryKey: ["/api/maintenance", { tenantId: Number(id) }], queryFn: async () => { const r = await fetch(`/api/maintenance?tenantId=${id}`); return r.json(); } });

  function copyPortalLink() {
    if (!tenant) return;
    const url = `${window.location.origin}${window.location.pathname}#/portal/${tenant.portalCode}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Portal link copied", description: "Send this to your tenant." });
  }

  if (tLoading) return <div className="h-64 bg-muted animate-pulse rounded-xl" />;
  if (!tenant) return <p className="text-muted-foreground">Tenant not found.</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/tenants"><Button variant="ghost" size="sm"><ArrowLeft size={16} className="mr-1" />Back</Button></Link>
      </div>

      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">{tenant.name}</h1>
          <p className="text-muted-foreground text-sm">{property ? `${property.address}, ${property.city}, ${property.state}` : "—"}{tenant.unitNumber ? ` · Unit ${tenant.unitNumber}` : ""}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={copyPortalLink}><Copy size={13} className="mr-1.5" />Portal Link</Button>
          <Link href={`/deposits/${tenant.id}`}><Button size="sm"><DollarSign size={13} className="mr-1.5" />Deposit Ledger</Button></Link>
        </div>
      </div>

      {/* Info grid */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Contact</p><p className="text-sm">{tenant.email || "—"}</p><p className="text-sm">{tenant.phone || "—"}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Lease Dates</p><p className="text-sm">Start: {tenant.leaseStart || "—"}</p><p className="text-sm">End: {tenant.leaseEnd || "—"}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Status</p><span className={`text-xs px-2 py-0.5 rounded-full font-medium status-${tenant.status}`}>{tenant.status === "active" ? "Active" : "Moved Out"}</span>{tenant.moveOutDate && <p className="text-sm mt-1">Moved out: {tenant.moveOutDate}</p>}</CardContent></Card>
      </div>

      {/* Portal Code */}
      <Card>
        <CardContent className="pt-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Tenant Portal Code</p>
          <div className="flex items-center gap-3">
            <code className="bg-muted px-3 py-1.5 rounded font-mono text-sm tracking-widest">{tenant.portalCode}</code>
            <Button variant="outline" size="sm" onClick={copyPortalLink}><Copy size={12} className="mr-1.5" />Copy Link</Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Share this link with the tenant so they can submit maintenance requests.</p>
        </CardContent>
      </Card>

      {/* Inspections */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Inspections</CardTitle>
            <Link href={`/inspections?tenantId=${tenant.id}`}><Button variant="outline" size="sm"><ClipboardList size={13} className="mr-1.5" />Manage</Button></Link>
          </div>
        </CardHeader>
        <CardContent>
          {inspections.length === 0 ? <p className="text-sm text-muted-foreground">No inspections on file.</p> : (
            <div className="space-y-2">
              {inspections.map((insp: any) => (
                <Link key={insp.id} href={`/inspections/${insp.id}`}>
                  <div className="flex items-center justify-between p-3 rounded-lg border hover:border-primary/40 cursor-pointer transition-colors">
                    <div>
                      <p className="text-sm font-medium capitalize">{insp.type.replace("_", "-")} Inspection</p>
                      <p className="text-xs text-muted-foreground">{insp.inspectionDate}</p>
                    </div>
                    <p className="text-sm font-semibold text-destructive">{insp.totalEstimatedCost > 0 ? `$${insp.totalEstimatedCost.toFixed(2)}` : ""}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Maintenance requests */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Maintenance Requests ({maintenance.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {maintenance.length === 0 ? <p className="text-sm text-muted-foreground">No requests submitted.</p> : (
            <div className="divide-y divide-border">
              {maintenance.map((r: any) => (
                <div key={r.id} className="py-2.5 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{r.title}</p>
                    <p className="text-xs text-muted-foreground">{r.category} · {r.submittedAt ? format(new Date(r.submittedAt), "MMM d, yyyy") : ""}</p>
                  </div>
                  <div className="flex gap-1.5 items-center">
                    <span className={`text-xs px-1.5 py-0.5 rounded urgency-${r.urgency}`}>{r.urgency}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded status-${r.status}`}>{r.status.replace("_", " ")}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
