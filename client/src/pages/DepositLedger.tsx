import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useParams, Link } from "wouter";
import { ArrowLeft, Plus, Download, Info, DollarSign, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

const ENTRY_TYPES = ["Deduction", "Addition", "Interest Accrued", "Replenishment"];

export default function DepositLedger() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const { toast } = useToast();
  const [setupOpen, setSetupOpen] = useState(false);
  const [entryOpen, setEntryOpen] = useState(false);
  const [setupForm, setSetupForm] = useState({ amount: "", dateReceived: new Date().toISOString().split("T")[0], bankName: "", interestRate: "0.01", state: "TX" });
  const [entryForm, setEntryForm] = useState({ entryType: "Deduction", description: "", location: "", deduction: "", addition: "", receiptNotes: "", date: new Date().toISOString().split("T")[0] });

  const { data: tenant } = useQuery<any>({ queryKey: ["/api/tenants", Number(tenantId)], queryFn: async () => { const r = await fetch(`/api/tenants/${tenantId}`); return r.json(); } });
  const { data: property } = useQuery<any>({ queryKey: ["/api/properties", tenant?.propertyId], queryFn: async () => { if (!tenant?.propertyId) return null; const r = await fetch(`/api/properties/${tenant.propertyId}`); return r.json(); }, enabled: !!tenant?.propertyId });
  const { data: deposit } = useQuery<any>({
    queryKey: ["/api/tenants", tenantId, "deposit"],
    queryFn: async () => { const r = await fetch(`/api/tenants/${tenantId}/deposit`); if (!r.ok) return null; return r.json(); },
  });
  const { data: entries = [] } = useQuery<any[]>({
    queryKey: ["/api/deposits", deposit?.id, "entries"],
    queryFn: async () => { if (!deposit?.id) return []; const r = await fetch(`/api/deposits/${deposit.id}/entries`); return r.json(); },
    enabled: !!deposit?.id,
  });

  const createDeposit = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/deposits", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/tenants", tenantId, "deposit"] }); setSetupOpen(false); toast({ title: "Deposit set up" }); },
  });
  const addEntry = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/deposits/${deposit?.id}/entries`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/deposits", deposit?.id, "entries"] }); setEntryOpen(false); setEntryForm(f => ({ ...f, description: "", location: "", deduction: "", addition: "", receiptNotes: "" })); toast({ title: "Entry added" }); },
  });
  const deleteEntry = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/deposit-entries/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/deposits", deposit?.id, "entries"] }); toast({ title: "Entry removed" }); },
  });

  function handleSetup(e: React.FormEvent) {
    e.preventDefault();
    createDeposit.mutate({ tenantId: Number(tenantId), propertyId: tenant?.propertyId, amount: Number(setupForm.amount), dateReceived: setupForm.dateReceived, bankName: setupForm.bankName, interestRate: Number(setupForm.interestRate), state: setupForm.state || property?.state || "TX" });
  }

  function handleAddEntry(e: React.FormEvent) {
    e.preventDefault();
    addEntry.mutate({ ...entryForm, deduction: entryForm.deduction ? Number(entryForm.deduction) : 0, addition: entryForm.addition ? Number(entryForm.addition) : 0 });
  }

  async function downloadExcel() {
    const url = `/api/export/deposit/${tenantId}`;
    const response = await fetch(url);
    if (!response.ok) { toast({ title: "Export failed", variant: "destructive" }); return; }
    const blob = await response.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `deposit-tracker-${tenant?.name?.replace(/\s+/g, "-") || tenantId}.xlsx`;
    a.click();
    toast({ title: "Excel file downloaded" });
  }

  const finalBalance = entries.length > 0 ? (entries[entries.length - 1].runningBalance ?? deposit?.amount ?? 0) : (deposit?.amount ?? 0);
  const totalDeductions = entries.filter((e: any) => e.entryType === "Deduction").reduce((sum: number, e: any) => sum + (e.deduction || 0), 0);

  // State compliance deadlines
  const deadlines = deposit?.state === "NJ"
    ? ["Notify tenant of bank within 30 days of move-in", "Send annual notice by certified mail", "Return deposit within 30 days of move-out", "Penalty: 2× amount if missed (N.J.S.A. 46:8-21.1)"]
    : ["Return deposit within 30 days of move-out (certified mail)", "No annual notice required", "Penalty: 3× + $100 + attorney's fees (Tex. §92.109)"];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/tenants"><Button variant="ghost" size="sm"><ArrowLeft size={16} className="mr-1" />Back</Button></Link>
      </div>

      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Security Deposit Ledger</h1>
          <p className="text-muted-foreground text-sm">{tenant?.name}{property ? ` · ${property.address}, ${property.city}` : ""}</p>
        </div>
        {deposit && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEntryOpen(true)} data-testid="btn-add-entry"><Plus size={14} className="mr-1.5" />Add Entry</Button>
            <Button size="sm" onClick={downloadExcel} data-testid="btn-export-excel"><Download size={14} className="mr-1.5" />Export Excel</Button>
          </div>
        )}
      </div>

      {!deposit ? (
        <Card>
          <CardContent className="py-12 text-center">
            <DollarSign size={38} className="mx-auto text-muted-foreground mb-3" />
            <p className="font-medium">No deposit on file</p>
            <p className="text-sm text-muted-foreground mb-4">Set up the initial security deposit to start the ledger.</p>
            <Button onClick={() => setSetupOpen(true)} data-testid="btn-setup-deposit">Set Up Deposit</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Original Deposit</p><p className="text-xl font-bold mt-1">${Number(deposit.amount).toFixed(2)}</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total Deductions</p><p className="text-xl font-bold text-destructive mt-1">-${totalDeductions.toFixed(2)}</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Current Balance</p><p className={`text-xl font-bold mt-1 ${finalBalance < 0 ? "text-destructive" : "text-emerald-600"}`}>${finalBalance.toFixed(2)}</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">State</p><p className="text-xl font-bold mt-1">{deposit.state}</p><p className="text-xs text-muted-foreground">{deposit.bankName || "—"}</p></CardContent></Card>
          </div>

          {/* Compliance reminder */}
          <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-900/10 dark:border-blue-900/40">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start gap-2">
                <Info size={16} className="text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">{deposit.state === "NJ" ? "New Jersey" : "Texas"} Compliance Reminders</p>
                  <ul className="text-xs text-blue-700 dark:text-blue-400 mt-1 space-y-0.5">
                    {deadlines.map((d, i) => <li key={i}>• {d}</li>)}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Ledger table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Running Balance Ledger</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Date</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Type</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Description / Location</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">Deduction</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">Addition</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">Balance</th>
                      <th className="px-4 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {entries.map((e: any) => (
                      <tr key={e.id} className="hover:bg-muted/30" data-testid={`entry-row-${e.id}`}>
                        <td className="px-4 py-2.5 whitespace-nowrap">{e.date}</td>
                        <td className="px-4 py-2.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${e.entryType === "Deduction" ? "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400" : e.entryType === "Deposit Received" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>{e.entryType}</span>
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground max-w-xs truncate">{e.description}{e.location ? ` — ${e.location}` : ""}</td>
                        <td className="px-4 py-2.5 text-right text-destructive font-medium">{e.deduction ? `-$${Number(e.deduction).toFixed(2)}` : ""}</td>
                        <td className="px-4 py-2.5 text-right text-emerald-600 font-medium">{e.addition ? `+$${Number(e.addition).toFixed(2)}` : ""}</td>
                        <td className="px-4 py-2.5 text-right font-semibold">${Number(e.runningBalance || 0).toFixed(2)}</td>
                        <td className="px-4 py-2.5">
                          {e.entryType !== "Deposit Received" && (
                            <button onClick={() => deleteEntry.mutate(e.id)} className="text-muted-foreground hover:text-destructive transition-colors" data-testid={`btn-delete-entry-${e.id}`}>
                              <Trash2 size={13} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border bg-muted/30">
                      <td colSpan={5} className="px-4 py-3 text-sm font-semibold">FINAL BALANCE</td>
                      <td className={`px-4 py-3 text-right text-base font-bold ${finalBalance < 0 ? "text-destructive" : "text-emerald-600"}`}>${finalBalance.toFixed(2)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Setup deposit dialog */}
      <Dialog open={setupOpen} onOpenChange={setSetupOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Set Up Security Deposit</DialogTitle></DialogHeader>
          <form onSubmit={handleSetup} className="space-y-4">
            <div>
              <Label>Deposit Amount ($)</Label>
              <Input type="number" min={0} step={0.01} value={setupForm.amount} onChange={e => setSetupForm(f => ({ ...f, amount: e.target.value }))} required data-testid="input-deposit-amount" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Date Received</Label>
                <Input type="date" value={setupForm.dateReceived} onChange={e => setSetupForm(f => ({ ...f, dateReceived: e.target.value }))} required data-testid="input-deposit-date" />
              </div>
              <div>
                <Label>State</Label>
                <Select value={setupForm.state} onValueChange={v => setSetupForm(f => ({ ...f, state: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TX">Texas</SelectItem>
                    <SelectItem value="NJ">New Jersey</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Bank / Account Name</Label>
              <Input value={setupForm.bankName} onChange={e => setSetupForm(f => ({ ...f, bankName: e.target.value }))} data-testid="input-bank-name" />
            </div>
            {setupForm.state === "NJ" && (
              <div>
                <Label>Interest Rate (APY %)</Label>
                <Input type="number" step={0.001} value={setupForm.interestRate} onChange={e => setSetupForm(f => ({ ...f, interestRate: e.target.value }))} data-testid="input-interest" />
                <p className="text-xs text-muted-foreground mt-1">NJ requires interest to accrue. Typical: 0.01%</p>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSetupOpen(false)}>Cancel</Button>
              <Button type="submit" data-testid="btn-confirm-setup">Set Up Deposit</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add entry dialog */}
      <Dialog open={entryOpen} onOpenChange={setEntryOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Ledger Entry</DialogTitle></DialogHeader>
          <form onSubmit={handleAddEntry} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Entry Type</Label>
                <Select value={entryForm.entryType} onValueChange={v => setEntryForm(f => ({ ...f, entryType: v }))}>
                  <SelectTrigger data-testid="select-entry-type"><SelectValue /></SelectTrigger>
                  <SelectContent>{ENTRY_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Date</Label>
                <Input type="date" value={entryForm.date} onChange={e => setEntryForm(f => ({ ...f, date: e.target.value }))} required data-testid="input-entry-date" />
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Input value={entryForm.description} onChange={e => setEntryForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Carpet replacement" data-testid="input-entry-description" />
            </div>
            <div>
              <Label>Location / Room</Label>
              <Input value={entryForm.location} onChange={e => setEntryForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. Master bedroom" data-testid="input-entry-location" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Deduction Amount ($)</Label>
                <Input type="number" min={0} step={0.01} value={entryForm.deduction} onChange={e => setEntryForm(f => ({ ...f, deduction: e.target.value }))} data-testid="input-deduction" />
              </div>
              <div>
                <Label>Addition Amount ($)</Label>
                <Input type="number" min={0} step={0.01} value={entryForm.addition} onChange={e => setEntryForm(f => ({ ...f, addition: e.target.value }))} data-testid="input-addition" />
              </div>
            </div>
            <div>
              <Label>Receipt / Notes</Label>
              <Input value={entryForm.receiptNotes} onChange={e => setEntryForm(f => ({ ...f, receiptNotes: e.target.value }))} placeholder="Invoice #, receipt, notes..." data-testid="input-receipt-notes" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEntryOpen(false)}>Cancel</Button>
              <Button type="submit" data-testid="btn-confirm-entry">Add Entry</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
