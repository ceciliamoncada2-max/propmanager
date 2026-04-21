import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { useState, useEffect } from "react";
import Dashboard from "@/pages/Dashboard";
import Properties from "@/pages/Properties";
import Tenants from "@/pages/Tenants";
import TenantDetail from "@/pages/TenantDetail";
import Inspections from "@/pages/Inspections";
import InspectionDetail from "@/pages/InspectionDetail";
import DepositLedger from "@/pages/DepositLedger";
import Maintenance from "@/pages/Maintenance";
import TenantPortal from "@/pages/TenantPortal";
import LandlordLogin from "@/pages/LandlordLogin";
import NotFound from "@/pages/not-found";
import Layout from "@/components/Layout";

function AuthGate({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/auth/check", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setAuthed(d.authed))
      .catch(() => setAuthed(false));
  }, []);

  if (authed === null) {
    // Loading — show blank screen briefly
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  if (!authed) {
    return <LandlordLogin onAuthed={() => setAuthed(true)} />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router hook={useHashLocation}>
        <Switch>
          {/* Tenant portal — always accessible, no auth required */}
          <Route path="/portal/:code" component={TenantPortal} />
          {/* All other routes — protected by auth gate */}
          <Route>
            <AuthGate>
              <Layout>
                <Switch>
                  <Route path="/" component={Dashboard} />
                  <Route path="/properties" component={Properties} />
                  <Route path="/tenants" component={Tenants} />
                  <Route path="/tenants/:id" component={TenantDetail} />
                  <Route path="/inspections" component={Inspections} />
                  <Route path="/inspections/:id" component={InspectionDetail} />
                  <Route path="/deposits/:tenantId" component={DepositLedger} />
                  <Route path="/maintenance" component={Maintenance} />
                  <Route component={NotFound} />
                </Switch>
              </Layout>
            </AuthGate>
          </Route>
        </Switch>
      </Router>
      <Toaster />
    </QueryClientProvider>
  );
}
