import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Wrench, Search, FileText, DollarSign, BookOpen, CheckCircle2, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { QBO_EXPENSE_CATEGORIES, DEPOSIT_DECISIONS } from "@shared/schema";

const STATUS_OPTIONS = ["open", "in_progress", "resolved", "closed"];
const STATUS_LABELS: Record<string, string> = { open: "Open", in_progress: "In Progress", resolved: "Resolved", closed: "Closed" };
const DEPOSIT_DECISION_LABELS: Record<string, string> = {
  Tenant: "Charged to Tenant (Deposit)",
  Landlord: "Landlord's Responsibility",
  Pending: "Pending Decision",
  NA: "Not Applicable",
};
const DEPOSIT_DECISION_COLORS: Record<string, string> = {
  Tenant: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  Landlord: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  Pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  NA: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

interface LeaseClause {
  state: string;
  section: string;
  sectionTitle: string;
  page: string;
  relevantText: string;
  responsibilityGuide: "Tenant" | "Landlord" | "Depends";
  keywords: string[];
}

export default function Maintenance() {
  const { toast } = useToast();
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterUrgency, setFilterUrgency] = useState<string>("all");
  const [selectedReq, setSelectedReq] = useState<any>(null);

  // Basic update fields
  const [newStatus, setNewStatus] = useState("");
  const [landlordNotes, setLandlordNotes] = useState("");

  // Resolution section (Phase 2)
  const [showResolution, setShowResolution] = useState(false);
  const [completionCost, setCompletionCost] = useState("");
  const [contractState, setContractState] = useState("TX");
  const [contractPage, setContractPage] = useState("");
  const [contractSection, setContractSection] = useState("");
  const [contractSubsection, setContractSubsection] = useState("");
  const [contractRelevantText, setContractRelevantText] = useState("");
  const [depositDecision, setDepositDecision] = useState("Pending");
  const [depositAmount, setDepositAmount] = useState("");
  const [qboCategory, setQboCategory] = useState("Repairs & Maintenance");
  const [resolutionNotes, setResolutionNotes] = useState("");

  // Lease search
  const [leaseSearchQuery, setLeaseSearchQuery] = useState("");
  const [leaseResults, setLeaseResults] = useState<LeaseClause[]>([]);
  const [leaseLoading, setLeaseLoading] = useState(false);
  const [suggestedClauses, setSuggestedClauses] = useState<LeaseClause[]>([]);
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);

  const { data: requests = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/maintenance"] });
  const { data: tenants = [] } = useQuery<any[]>({ queryKey: ["/api/tenants"] });
  const { data: properties = [] } = useQuery<any[]>({ queryKey: ["/api/properties"] });
  const { data: reqPhotos = [] } = useQuery<any[]>({
    queryKey: ["/api/maintenance", selectedReq?.id, "photos"],
    queryFn: async () => {
      if (!selectedReq?.id) return [];
      const r = await fetch(`/api/maintenance/${selectedReq.id}/photos`);
      return r.json();
    },
    enabled: !!selectedReq?.id,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: any) => apiRequest("PATCH", `/api/maintenance/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/maintenance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setSelectedReq(null);
      toast({ title: "Request updated successfully" });
    },
  });

  const filtered = requests.filter((r: any) => {
    if (filterStatus !== "all" && r.status !== filterStatus) return false;
    if (filterUrgency !== "all" && r.urgency !== filterUrgency) return false;
    return true;
  });

  // When opening a request, pre-load category suggestions and existing values
  async function openReq(r: any) {
    setSelectedReq(r);
    setNewStatus(r.status);
    setLandlordNotes(r.landlordNotes || "");
    setCompletionCost(r.completionCost != null ? String(r.completionCost) : "");
    setContractState(r.contractState || "TX");
    setContractPage(r.contractPage || "");
    setContractSection(r.contractSection || "");
    setContractSubsection(r.contractSubsection || "");
    setContractRelevantText(r.contractRelevantText || "");
    setDepositDecision(r.depositDecision || "Pending");
    setDepositAmount(r.depositAmount != null ? String(r.depositAmount) : "");
    setQboCategory(r.qboCategory || "Repairs & Maintenance");
    setResolutionNotes(r.resolutionNotes || "");
    setLeaseResults([]);
    setLeaseSearchQuery("");
    const isResolved = r.status === "resolved" || r.status === "closed";
    setShowResolution(isResolved || !!r.depositDecision);

    // Auto-fetch category suggestions
    if (r.category) {
      try {
        const resp = await fetch(`/api/lease/category/${encodeURIComponent(r.category)}?state=TX`);
        const data = await resp.json();
        setSuggestedClauses(Array.isArray(data) ? data : []);
      } catch {
        setSuggestedClauses([]);
      }
    }
  }

  async function handleLeaseSearch() {
    if (!leaseSearchQuery.trim()) return;
    setLeaseLoading(true);
    try {
      const resp = await apiRequest("GET", `/api/lease/search?q=${encodeURIComponent(leaseSearchQuery)}&state=${contractState}`);
      const data = await resp.json();
      setLeaseResults(Array.isArray(data) ? data : []);
    } catch {
      setLeaseResults([]);
    } finally {
      setLeaseLoading(false);
    }
  }

  function applyClause(clause: LeaseClause) {
    setContractPage(clause.page);
    setContractSection(clause.section);
    setContractRelevantText(clause.relevantText);
    // Auto-suggest deposit decision based on guide
    if (clause.responsibilityGuide === "Tenant") setDepositDecision("Tenant");
    else if (clause.responsibilityGuide === "Landlord") setDepositDecision("Landlord");
    else setDepositDecision("Pending");
    toast({ title: `Section ${clause.section} applied`, description: clause.sectionTitle });
  }

  function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = {
      status: newStatus,
      landlordNotes,
    };
    if (showResolution) {
      payload.completionCost = completionCost ? Number(completionCost) : null;
      payload.contractState = contractState || null;
      payload.contractPage = contractPage || null;
      payload.contractSection = contractSection || null;
      payload.contractSubsection = contractSubsection || null;
      payload.contractRelevantText = contractRelevantText || null;
      payload.depositDecision = depositDecision || null;
      payload.depositAmount = depositAmount ? Number(depositAmount) : null;
      payload.qboCategory = qboCategory || null;
      payload.resolutionNotes = resolutionNotes || null;
    }
    updateMutation.mutate({ id: selectedReq.id, data: payload });
  }

  function tenantName(id: number) { return tenants.find((t: any) => t.id === id)?.name || "Unknown"; }
  function propertyAddr(id: number) { const p = properties.find((p: any) => p.id === id); return p ? p.address : "—"; }
  function getProperty(id: number) { return properties.find((p: any) => p.id === id); }

  const openCount = requests.filter((r: any) => r.status === "open").length;
  const emergencyCount = requests.filter((r: any) => r.urgency === "Emergency" && r.status === "open").length;
  const resolvedCount = requests.filter((r: any) => r.status === "resolved" || r.status === "closed").length;
  const pendingDecision = requests.filter((r: any) => (r.status === "resolved" || r.status === "closed") && (!r.depositDecision || r.depositDecision === "Pending")).length;

  const isResolved = selectedReq && (selectedReq.status === "resolved" || selectedReq.status === "closed" || newStatus === "resolved" || newStatus === "closed");

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">Maintenance Requests</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {openCount} open{emergencyCount > 0 ? ` · ${emergencyCount} emergency` : ""} · {resolvedCount} resolved
            {pendingDecision > 0 && <span className="ml-1 text-yellow-600 dark:text-yellow-400">· {pendingDecision} awaiting deposit decision</span>}
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Open", value: openCount, color: "text-blue-600" },
          { label: "Emergency", value: emergencyCount, color: "text-red-600" },
          { label: "Resolved", value: resolvedCount, color: "text-green-600" },
          { label: "Pending Decision", value: pendingDecision, color: "text-yellow-600" },
        ].map(card => (
          <Card key={card.label} className="border">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">{card.label}</p>
              <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36" data-testid="filter-status"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterUrgency} onValueChange={setFilterUrgency}>
          <SelectTrigger className="w-36" data-testid="filter-urgency"><SelectValue placeholder="Urgency" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Urgency</SelectItem>
            {["Emergency", "High", "Normal", "Low"].map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-14 text-center"><Wrench size={38} className="mx-auto text-muted-foreground mb-3" /><p className="font-medium">No maintenance requests</p><p className="text-sm text-muted-foreground">Tenants submit requests via their portal link.</p></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((r: any) => (
            <Card
              key={r.id}
              className={`cursor-pointer hover:border-primary/40 transition-colors ${r.urgency === "Emergency" ? "border-red-300 dark:border-red-800" : ""}`}
              onClick={() => openReq(r)}
              data-testid={`maint-card-${r.id}`}
            >
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold">{r.title}</p>
                      {r.depositDecision && r.depositDecision !== "Pending" && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${DEPOSIT_DECISION_COLORS[r.depositDecision]}`}>
                          {r.depositDecision === "Tenant" ? "→ Deposit" : r.depositDecision === "Landlord" ? "→ Landlord" : r.depositDecision}
                        </span>
                      )}
                      {(r.status === "resolved" || r.status === "closed") && (!r.depositDecision || r.depositDecision === "Pending") && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300">
                          Needs Decision
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {tenantName(r.tenantId)} · {propertyAddr(r.propertyId)}{r.location ? ` · ${r.location}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {r.category} · Submitted {r.submittedAt ? format(new Date(r.submittedAt), "MMM d, yyyy") : ""}
                      {r.completionCost != null && <span className="ml-2 text-foreground font-medium">${Number(r.completionCost).toFixed(2)}</span>}
                      {r.contractSection && <span className="ml-2 text-primary">§{r.contractSection}</span>}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium urgency-${r.urgency}`}>{r.urgency}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium status-${r.status}`}>{STATUS_LABELS[r.status] || r.status}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Lightbox ── */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxPhoto(null)}
        >
          <button
            className="absolute top-4 right-4 text-white bg-black/50 rounded-full p-2 hover:bg-black/80"
            onClick={() => setLightboxPhoto(null)}
          >
            <X size={20} />
          </button>
          <img
            src={lightboxPhoto}
            alt="Full size photo"
            className="max-w-full max-h-full rounded-lg object-contain"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}

      {/* ── Detail / Resolution Dialog ───────────────────────────────────────────── */}
      <Dialog open={!!selectedReq} onOpenChange={open => !open && setSelectedReq(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench size={18} className="text-primary" />
              {selectedReq?.title}
            </DialogTitle>
          </DialogHeader>

          {selectedReq && (
            <form onSubmit={handleUpdate} className="space-y-5">
              {/* Request info grid */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Tenant</p>
                  <p className="font-medium">{tenantName(selectedReq.tenantId)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Property</p>
                  <p className="font-medium">{propertyAddr(selectedReq.propertyId)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Category</p>
                  <p className="font-medium">{selectedReq.category}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Location</p>
                  <p className="font-medium">{selectedReq.location || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Urgency</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium urgency-${selectedReq.urgency}`}>{selectedReq.urgency}</span>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Submitted</p>
                  <p className="font-medium">{selectedReq.submittedAt ? format(new Date(selectedReq.submittedAt), "MMM d, yyyy h:mm a") : ""}</p>
                </div>
              </div>

              <div>
                <p className="text-muted-foreground text-xs mb-1">Description</p>
                <p className="text-sm bg-muted/50 rounded p-3">{selectedReq.description}</p>
              </div>

              {/* Tenant photos */}
              {reqPhotos.length > 0 && (
                <div>
                  <p className="text-muted-foreground text-xs mb-2 flex items-center gap-1">
                    <Camera size={12} /> Tenant Photos ({reqPhotos.length})
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {reqPhotos.map((photo: any) => (
                      <div
                        key={photo.id}
                        className="relative aspect-square rounded-lg overflow-hidden border border-border cursor-pointer group"
                        onClick={() => setLightboxPhoto(`/uploads/${photo.filename}`)}
                        data-testid={`photo-thumb-${photo.id}`}
                      >
                        <img
                          src={`/uploads/${photo.filename}`}
                          alt={photo.originalName || "Photo"}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                          <ZoomIn size={16} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Status & basic notes */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Status</Label>
                  <Select value={newStatus} onValueChange={(v) => { setNewStatus(v); if (v === "resolved" || v === "closed") setShowResolution(true); }}>
                    <SelectTrigger data-testid="select-new-status"><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Actual Cost ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={completionCost}
                    onChange={e => setCompletionCost(e.target.value)}
                    placeholder="0.00"
                    data-testid="input-completion-cost"
                  />
                </div>
              </div>

              <div>
                <Label>Landlord Notes</Label>
                <Textarea value={landlordNotes} onChange={e => setLandlordNotes(e.target.value)} rows={2} placeholder="Contractor info, work performed, timeline..." data-testid="textarea-landlord-notes" />
              </div>

              {/* ── Resolution Section ── */}
              <div className="border rounded-xl overflow-hidden">
                <button
                  type="button"
                  className={`w-full flex items-center justify-between p-3 text-left transition-colors ${showResolution ? "bg-primary/5 border-b" : "hover:bg-muted/40"}`}
                  onClick={() => setShowResolution(v => !v)}
                  data-testid="btn-toggle-resolution"
                >
                  <div className="flex items-center gap-2">
                    <FileText size={16} className="text-primary" />
                    <span className="font-semibold text-sm">
                      Contract-Linked Resolution
                      {isResolved && <span className="ml-2 text-xs text-muted-foreground">(Required for resolved requests)</span>}
                    </span>
                    {selectedReq.depositDecision && selectedReq.depositDecision !== "Pending" && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ml-2 ${DEPOSIT_DECISION_COLORS[selectedReq.depositDecision]}`}>
                        {selectedReq.depositDecision}
                      </span>
                    )}
                  </div>
                  {showResolution ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>

                {showResolution && (
                  <div className="p-4 space-y-5">
                    {/* Lease Search */}
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <BookOpen size={14} className="text-primary" />
                        <Label className="text-sm font-semibold">Contract Reference Lookup</Label>
                      </div>
                      <p className="text-xs text-muted-foreground mb-3">
                        Search the Texas lease by keyword to find the relevant page, section, and clause — then click Apply to fill in the fields below automatically.
                      </p>

                      {/* Auto-suggestions based on category */}
                      {suggestedClauses.length > 0 && (
                        <div className="mb-3">
                          <p className="text-xs text-muted-foreground mb-2 font-medium">Suggested for "{selectedReq.category}" repairs:</p>
                          <div className="space-y-2">
                            {suggestedClauses.slice(0, 3).map(clause => (
                              <ClauseCard key={clause.section} clause={clause} onApply={applyClause} />
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Input
                          value={leaseSearchQuery}
                          onChange={e => setLeaseSearchQuery(e.target.value)}
                          onKeyDown={e => e.key === "Enter" && (e.preventDefault(), handleLeaseSearch())}
                          placeholder="e.g. clogged drain, broken window, hvac filter..."
                          data-testid="input-lease-search"
                          className="flex-1"
                        />
                        <Button type="button" variant="outline" onClick={handleLeaseSearch} disabled={leaseLoading} data-testid="btn-lease-search">
                          <Search size={15} className="mr-1" />
                          {leaseLoading ? "..." : "Search"}
                        </Button>
                      </div>

                      {leaseResults.length > 0 && (
                        <div className="mt-3 space-y-2">
                          <p className="text-xs text-muted-foreground font-medium">Search results:</p>
                          {leaseResults.map(clause => (
                            <ClauseCard key={clause.section} clause={clause} onApply={applyClause} />
                          ))}
                        </div>
                      )}
                      {leaseResults.length === 0 && leaseSearchQuery && !leaseLoading && (
                        <p className="text-xs text-muted-foreground mt-2 italic">No matching clauses found. Try different keywords.</p>
                      )}
                    </div>

                    <Separator />

                    {/* Manual contract fields */}
                    <div>
                      <div className="flex items-center gap-1.5 mb-3">
                        <FileText size={14} className="text-primary" />
                        <Label className="text-sm font-semibold">Contract Reference</Label>
                        <span className="text-xs text-muted-foreground">(auto-filled or enter manually)</span>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <Label className="text-xs">State</Label>
                          <Select value={contractState} onValueChange={setContractState}>
                            <SelectTrigger data-testid="select-contract-state"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="TX">Texas</SelectItem>
                              <SelectItem value="NJ">New Jersey</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">Page</Label>
                          <Input value={contractPage} onChange={e => setContractPage(e.target.value)} placeholder="e.g. 7" data-testid="input-contract-page" />
                        </div>
                        <div>
                          <Label className="text-xs">Section</Label>
                          <Input value={contractSection} onChange={e => setContractSection(e.target.value)} placeholder="e.g. 8.3" data-testid="input-contract-section" />
                        </div>
                      </div>
                      <div className="mt-3">
                        <Label className="text-xs">Sub-section / Letter</Label>
                        <Input value={contractSubsection} onChange={e => setContractSubsection(e.target.value)} placeholder="e.g. (a), (b), (c)..." data-testid="input-contract-subsection" />
                      </div>
                      <div className="mt-3">
                        <Label className="text-xs">Relevant Contract Text</Label>
                        <Textarea
                          value={contractRelevantText}
                          onChange={e => setContractRelevantText(e.target.value)}
                          rows={3}
                          placeholder="Paste or type the relevant contract language here..."
                          data-testid="textarea-contract-text"
                        />
                      </div>
                    </div>

                    <Separator />

                    {/* Deposit Decision */}
                    <div>
                      <div className="flex items-center gap-1.5 mb-3">
                        <DollarSign size={14} className="text-primary" />
                        <Label className="text-sm font-semibold">Deposit Decision</Label>
                      </div>
                      <p className="text-xs text-muted-foreground mb-3">
                        Based on the contract reference above, make the final determination. Only the landlord can make this decision.
                      </p>
                      <div className="grid grid-cols-2 gap-2 mb-4">
                        {(DEPOSIT_DECISIONS as readonly string[]).map(decision => (
                          <button
                            key={decision}
                            type="button"
                            onClick={() => setDepositDecision(decision)}
                            data-testid={`btn-decision-${decision}`}
                            className={`p-3 rounded-lg border-2 text-left transition-all ${
                              depositDecision === decision
                                ? `border-primary ${DEPOSIT_DECISION_COLORS[decision]}`
                                : "border-border hover:border-primary/40"
                            }`}
                          >
                            <p className="text-sm font-semibold">{decision}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{DEPOSIT_DECISION_LABELS[decision]}</p>
                          </button>
                        ))}
                      </div>

                      {depositDecision === "Tenant" && (
                        <div>
                          <Label className="text-xs">Amount to Deduct from Deposit ($)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={depositAmount}
                            onChange={e => setDepositAmount(e.target.value)}
                            placeholder="0.00"
                            data-testid="input-deposit-amount"
                          />
                          <p className="text-xs text-muted-foreground mt-1">This amount will be deducted from the tenant's security deposit.</p>
                        </div>
                      )}
                    </div>

                    <Separator />

                    {/* QBO Integration */}
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <CheckCircle2 size={14} className="text-primary" />
                        <Label className="text-sm font-semibold">QuickBooks Online Expense</Label>
                      </div>
                      <p className="text-xs text-muted-foreground mb-3">
                        Select the QBO expense category to track this maintenance cost in your books.
                      </p>
                      <Select value={qboCategory} onValueChange={setQboCategory}>
                        <SelectTrigger data-testid="select-qbo-category"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {QBO_EXPENSE_CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {selectedReq.qboExpenseId && (
                        <p className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
                          <CheckCircle2 size={12} /> Synced to QBO · ID: {selectedReq.qboExpenseId}
                        </p>
                      )}
                      {!selectedReq.qboExpenseId && (
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <AlertCircle size={12} /> Connect QBO in settings to sync expenses automatically.
                        </p>
                      )}
                    </div>

                    {/* Resolution Notes */}
                    <div>
                      <Label className="text-xs">Final Resolution Notes</Label>
                      <Textarea
                        value={resolutionNotes}
                        onChange={e => setResolutionNotes(e.target.value)}
                        rows={3}
                        placeholder="Document the basis for your deposit decision, any supporting evidence, photos, or contractor reports..."
                        data-testid="textarea-resolution-notes"
                      />
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setSelectedReq(null)}>Cancel</Button>
                <Button type="submit" disabled={updateMutation.isPending} data-testid="btn-update-request">
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Reusable ClauseCard component ────────────────────────────────────────────
function ClauseCard({ clause, onApply }: { clause: LeaseClause; onApply: (c: LeaseClause) => void }) {
  const [expanded, setExpanded] = useState(false);
  const colorMap: Record<string, string> = {
    Tenant: "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800",
    Landlord: "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800",
    Depends: "bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800",
  };
  const badgeColor: Record<string, string> = {
    Tenant: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    Landlord: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    Depends: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  };
  return (
    <div className={`rounded-lg border p-3 ${colorMap[clause.responsibilityGuide] || ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold">§{clause.section}</span>
            <span className="text-xs text-muted-foreground">(p. {clause.page})</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeColor[clause.responsibilityGuide]}`}>
              {clause.responsibilityGuide}
            </span>
          </div>
          <p className="text-xs font-medium mt-0.5">{clause.sectionTitle}</p>
          {expanded && (
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed italic">"{clause.relevantText}"</p>
          )}
        </div>
        <div className="flex gap-1 shrink-0">
          <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setExpanded(v => !v)}>
            {expanded ? "Less" : "More"}
          </Button>
          <Button type="button" size="sm" variant="default" className="h-7 px-2 text-xs" onClick={() => onApply(clause)} data-testid={`btn-apply-clause-${clause.section}`}>
            Apply
          </Button>
        </div>
      </div>
    </div>
  );
}
