import { useQuery } from "@tanstack/react-query";
import { Building2, Users, Wrench, AlertTriangle, DollarSign, ClipboardList } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { format } from "date-fns";

function StatCard({ title, value, icon: Icon, color }: { title: string; value: number; icon: any; color: string }) {
  return (
    <Card data-testid={`stat-${title.toLowerCase().replace(/\s/g, "-")}`}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
          </div>
          <div className={`p-3 rounded-xl ${color}`}>
            <Icon size={22} className="text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function urgencyBadge(urgency: string) {
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium urgency-${urgency}`}>{urgency}</span>;
}

function statusBadge(status: string) {
  const labels: Record<string, string> = { open: "Open", in_progress: "In Progress", resolved: "Resolved", closed: "Closed" };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium status-${status}`}>{labels[status] || status}</span>;
}

export default function Dashboard() {
  const { data: summary, isLoading } = useQuery({
    queryKey: ["/api/dashboard"],
  });

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-muted rounded w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-muted rounded-xl" />)}
        </div>
      </div>
    );
  }

  const stats = summary as any;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Overview of your properties and activity</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Properties" value={stats?.propertyCount ?? 0} icon={Building2} color="bg-blue-500" />
        <StatCard title="Active Tenants" value={stats?.tenantCount ?? 0} icon={Users} color="bg-emerald-500" />
        <StatCard title="Open Requests" value={stats?.openMaintenanceCount ?? 0} icon={Wrench} color="bg-amber-500" />
        <StatCard title="Emergencies" value={stats?.emergencyCount ?? 0} icon={AlertTriangle} color="bg-red-500" />
      </div>

      {/* Recent maintenance */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Recent Maintenance Requests</CardTitle>
            <Link href="/maintenance">
              <span className="text-sm text-primary hover:underline cursor-pointer">View all</span>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {!stats?.recentMaintenance?.length ? (
            <p className="text-muted-foreground text-sm py-4 text-center">No maintenance requests yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {stats.recentMaintenance.map((req: any) => (
                <div key={req.id} className="py-3 flex items-start justify-between gap-4" data-testid={`maint-row-${req.id}`}>
                  <div>
                    <p className="font-medium text-sm">{req.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{req.category} · {req.location || "—"}</p>
                    <p className="text-xs text-muted-foreground">
                      {req.submittedAt ? format(new Date(req.submittedAt), "MMM d, yyyy") : ""}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {urgencyBadge(req.urgency)}
                    {statusBadge(req.status)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/tenants">
          <Card className="cursor-pointer hover:border-primary/50 transition-colors" data-testid="quick-link-tenants">
            <CardContent className="pt-5 pb-5 flex items-center gap-4">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <Users size={20} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="font-semibold text-sm">Manage Tenants</p>
                <p className="text-xs text-muted-foreground">Add, edit, view portal codes</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/inspections">
          <Card className="cursor-pointer hover:border-primary/50 transition-colors" data-testid="quick-link-inspections">
            <CardContent className="pt-5 pb-5 flex items-center gap-4">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                <ClipboardList size={20} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="font-semibold text-sm">Inspections</p>
                <p className="text-xs text-muted-foreground">Move-in, move-out, RentCheck import</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/maintenance">
          <Card className="cursor-pointer hover:border-primary/50 transition-colors" data-testid="quick-link-maintenance">
            <CardContent className="pt-5 pb-5 flex items-center gap-4">
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                <Wrench size={20} className="text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="font-semibold text-sm">Maintenance Queue</p>
                <p className="text-xs text-muted-foreground">Review and update requests</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
