import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import Dashboard from "@/pages/Dashboard";
import Properties from "@/pages/Properties";
import Tenants from "@/pages/Tenants";
import TenantDetail from "@/pages/TenantDetail";
import Inspections from "@/pages/Inspections";
import InspectionDetail from "@/pages/InspectionDetail";
import DepositLedger from "@/pages/DepositLedger";
import Maintenance from "@/pages/Maintenance";
import TenantPortal from "@/pages/TenantPortal";
import NotFound from "@/pages/not-found";
import Layout from "@/components/Layout";

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router hook={useHashLocation}>
        <Switch>
          {/* Tenant portal — no sidebar */}
          <Route path="/portal/:code" component={TenantPortal} />
          {/* All other routes inside layout */}
          <Route>
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
          </Route>
        </Switch>
      </Router>
      <Toaster />
    </QueryClientProvider>
  );
}
