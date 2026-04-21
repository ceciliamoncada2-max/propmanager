import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useParams } from "wouter";
import { Wrench, Plus, CheckCircle2, Clock, AlertTriangle, X, Camera, Image, Trash2, Calendar, ThumbsUp, RefreshCw, MessageSquare } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";

const CATEGORIES = ["Plumbing", "HVAC", "Electrical", "Appliance", "Pest", "Structural", "General", "Other"];
const URGENCIES = [
  { value: "Emergency", desc: "Immediate safety risk (no heat, gas leak, flooding)" },
  { value: "High", desc: "Significant inconvenience (broken A/C, hot water issues)" },
  { value: "Normal", desc: "Standard repair (leaky faucet, door/window issues)" },
  { value: "Low", desc: "Minor cosmetic or non-urgent issue" },
];
const STATUS_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  open: { label: "Open", icon: Clock, color: "text-blue-600" },
  in_progress: { label: "In Progress", icon: Wrench, color: "text-amber-600" },
  resolved: { label: "Resolved", icon: CheckCircle2, color: "text-emerald-600" },
  closed: { label: "Closed", icon: X, color: "text-gray-500" },
};

interface PhotoPreview {
  file: File;
  previewUrl: string;
}

export default function TenantPortal() {
  const { code } = useParams<{ code: string }>();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
  const [form, setForm] = useState({ category: "", urgency: "Normal", title: "", description: "", location: "" });
  const [photos, setPhotos] = useState<PhotoPreview[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rescheduleReqId, setRescheduleReqId] = useState<number | null>(null);
  const [rescheduleMsg, setRescheduleMsg] = useState("");

  useEffect(() => { document.documentElement.classList.toggle("dark", dark); }, [dark]);

  const { data: portal, isLoading, isError } = useQuery<any>({
    queryKey: ["/api/portal", code],
    queryFn: async () => {
      const r = await fetch(`/api/portal/${code}`);
      if (!r.ok) throw new Error("Invalid");
      return r.json();
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async (reqId: number) => {
      const r = await apiRequest("POST", `/api/portal/${code}/maintenance/${reqId}/confirm`, {});
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portal", code] });
      toast({ title: "Visit confirmed", description: "Your landlord has been notified. Thank you!" });
    },
    onError: () => toast({ title: "Could not confirm", variant: "destructive" }),
  });

  const rescheduleMutation = useMutation({
    mutationFn: async ({ reqId, message }: { reqId: number; message: string }) => {
      const r = await apiRequest("POST", `/api/portal/${code}/maintenance/${reqId}/reschedule`, { message });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portal", code] });
      setRescheduleReqId(null);
      setRescheduleMsg("");
      toast({ title: "Reschedule requested", description: "Your landlord has been notified and will contact you with a new date." });
    },
    onError: () => toast({ title: "Could not send request", variant: "destructive" }),
  });

  const submitMutation = useMutation({
    mutationFn: async (data: any) => {
      // Step 1: submit the request
      const resp = await apiRequest("POST", `/api/portal/${code}/maintenance`, data);
      const newRequest = await resp.json();

      // Step 2: upload photos if any
      if (photos.length > 0) {
        setUploadingPhotos(true);
        const formData = new FormData();
        photos.forEach(p => formData.append("photos", p.file));
        await fetch(`/api/maintenance/${newRequest.id}/photos`, {
          method: "POST",
          body: formData,
        });
        setUploadingPhotos(false);
      }
      return newRequest;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portal", code] });
      setOpen(false);
      resetForm();
      toast({ title: "Request submitted", description: "Your landlord has been notified." });
    },
    onError: () => {
      setUploadingPhotos(false);
      toast({ title: "Submission failed", variant: "destructive" });
    },
  });

  function resetForm() {
    setForm({ category: "", urgency: "Normal", title: "", description: "", location: "" });
    // Revoke object URLs to avoid memory leaks
    photos.forEach(p => URL.revokeObjectURL(p.previewUrl));
    setPhotos([]);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    const remaining = 5 - photos.length;
    const toAdd = files.slice(0, remaining);

    if (files.length > remaining) {
      toast({ title: `Max 5 photos`, description: `Only the first ${remaining} photo(s) were added.` });
    }

    const newPreviews: PhotoPreview[] = toAdd.map(file => ({
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    setPhotos(prev => [...prev, ...newPreviews]);
    // Reset input so same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removePhoto(index: number) {
    setPhotos(prev => {
      URL.revokeObjectURL(prev[index].previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    submitMutation.mutate(form);
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center"><div className="h-10 w-10 rounded-full border-4 border-primary border-t-transparent animate-spin mx-auto" /></div>
      </div>
    );
  }

  if (isError || !portal) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-sm w-full text-center">
          <CardContent className="py-12">
            <AlertTriangle size={40} className="mx-auto text-destructive mb-3" />
            <h2 className="text-lg font-semibold mb-2">Invalid Portal Link</h2>
            <p className="text-muted-foreground text-sm">This link is expired or invalid. Please contact your landlord for a new link.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { tenant, property, requests = [] } = portal;
  const openCount = requests.filter((r: any) => r.status === "open" || r.status === "in_progress").length;
  const isPending = submitMutation.isPending || uploadingPhotos;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Wrench size={16} className="text-white" />
            </div>
            <div>
              <p className="font-semibold text-sm leading-tight">Tenant Portal</p>
              <p className="text-xs text-muted-foreground leading-tight">{property?.address}</p>
            </div>
          </div>
          <button onClick={() => setDark(d => !d)} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded border border-border">
            {dark ? "☀ Light" : "☾ Dark"}
          </button>
        </div>
      </header>

      <div className="max-w-xl mx-auto px-5 py-8 space-y-6">
        {/* Welcome */}
        <div>
          <h1 className="text-xl font-bold">Hi, {tenant.name.split(" ")[0]}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {property?.address}, {property?.city}{tenant.unitNumber ? ` · Unit ${tenant.unitNumber}` : ""}
          </p>
          {openCount > 0 && (
            <p className="text-sm text-amber-600 mt-1 font-medium">{openCount} active request{openCount !== 1 ? "s" : ""}</p>
          )}
        </div>

        {/* CTA */}
        <Button className="w-full" size="lg" onClick={() => setOpen(true)} data-testid="btn-new-request">
          <Plus size={18} className="mr-2" /> Submit Maintenance Request
        </Button>

        {/* Requests list */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Your Requests</h2>
          {requests.length === 0 ? (
            <Card><CardContent className="py-10 text-center">
              <CheckCircle2 size={32} className="mx-auto text-emerald-500 mb-2" />
              <p className="text-sm font-medium">No requests yet</p>
              <p className="text-xs text-muted-foreground mt-1">Use the button above to submit a maintenance request.</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-3">
              {requests.map((r: any) => {
                const s = STATUS_LABELS[r.status] || STATUS_LABELS.open;
                const Icon = s.icon;
                return (
                  <Card key={r.id} data-testid={`portal-req-${r.id}`}>
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{r.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{r.category}{r.location ? ` · ${r.location}` : ""}</p>
                          {r.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.description}</p>}
                          <p className="text-xs text-muted-foreground mt-1.5">
                            Submitted {r.submittedAt ? format(new Date(r.submittedAt), "MMM d, yyyy") : ""}
                          </p>
                          {r.landlordNotes && (
                            <div className="mt-2 bg-blue-50 dark:bg-blue-900/20 rounded p-2">
                              <p className="text-xs font-medium text-blue-700 dark:text-blue-300">Landlord update:</p>
                              <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">{r.landlordNotes}</p>
                            </div>
                          )}

                          {/* ── Scheduled Visit confirmation block ── */}
                          {r.scheduledVisit && (
                            <div className="mt-3 rounded-lg border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-3">
                              <div className="flex items-center gap-1.5 mb-1">
                                <Calendar size={13} className="text-amber-600 dark:text-amber-400" />
                                <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">Visit Scheduled</p>
                              </div>
                              <p className="text-xs text-amber-700 dark:text-amber-300 mb-2">
                                {(() => {
                                  try { return new Date(r.scheduledVisit).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }); }
                                  catch { return r.scheduledVisit; }
                                })()}
                              </p>

                              {/* Already responded */}
                              {r.visitConfirmed === "confirmed" && (
                                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                                  <CheckCircle2 size={13} />
                                  <p className="text-xs font-medium">You confirmed this visit</p>
                                </div>
                              )}
                              {r.visitConfirmed?.startsWith("reschedule:") && (
                                <div className="flex items-center gap-1.5 text-orange-600 dark:text-orange-400">
                                  <RefreshCw size={13} />
                                  <p className="text-xs font-medium">Reschedule requested — waiting for landlord</p>
                                </div>
                              )}

                              {/* Action buttons — only if not yet responded */}
                              {!r.visitConfirmed && (
                                <div className="flex gap-2 mt-1">
                                  <Button
                                    size="sm"
                                    className="flex-1 h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                                    onClick={() => confirmMutation.mutate(r.id)}
                                    disabled={confirmMutation.isPending}
                                    data-testid={`btn-confirm-visit-${r.id}`}
                                  >
                                    <ThumbsUp size={12} className="mr-1" />
                                    Confirm Visit
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="flex-1 h-8 text-xs border-orange-300 text-orange-600 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-400"
                                    onClick={() => { setRescheduleReqId(r.id); setRescheduleMsg(""); }}
                                    data-testid={`btn-reschedule-visit-${r.id}`}
                                  >
                                    <RefreshCw size={12} className="mr-1" />
                                    Request Reschedule
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Photo count indicator */}
                          {r.photoCount > 0 && (
                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                              <Camera size={11} /> {r.photoCount} photo{r.photoCount !== 1 ? "s" : ""} attached
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium urgency-${r.urgency}`}>{r.urgency}</span>
                          <div className={`flex items-center gap-1 text-xs font-medium ${s.color}`}>
                            <Icon size={12} />
                            {s.label}
                          </div>
                          {r.resolvedAt && <p className="text-xs text-muted-foreground">Resolved {format(new Date(r.resolvedAt), "MMM d")}</p>}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Reschedule dialog */}
      <Dialog open={rescheduleReqId !== null} onOpenChange={(v) => { if (!v) { setRescheduleReqId(null); setRescheduleMsg(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><RefreshCw size={16} className="text-orange-500" /> Request Reschedule</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Let your landlord know why you need a different time. They will contact you to arrange a new date.</p>
            <div>
              <Label>Message <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
              <Textarea
                value={rescheduleMsg}
                onChange={e => setRescheduleMsg(e.target.value)}
                rows={3}
                placeholder="e.g. I have work on that day — available after 5pm or any weekend."
                data-testid="textarea-reschedule-msg"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRescheduleReqId(null); setRescheduleMsg(""); }}>Cancel</Button>
            <Button
              onClick={() => { if (rescheduleReqId) rescheduleMutation.mutate({ reqId: rescheduleReqId, message: rescheduleMsg }); }}
              disabled={rescheduleMutation.isPending}
              className="bg-orange-500 hover:bg-orange-600 text-white"
              data-testid="btn-submit-reschedule"
            >
              {rescheduleMutation.isPending ? "Sending..." : "Send Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Submit dialog */}
      <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); setOpen(v); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Submit Maintenance Request</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Title / Brief Description</Label>
              <Input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Kitchen sink leaking under cabinet"
                required
                data-testid="input-req-title"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Category</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger data-testid="select-req-category"><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Location / Room</Label>
                <Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. Kitchen" data-testid="input-req-location" />
              </div>
            </div>

            <div>
              <Label>Urgency Level</Label>
              <div className="grid grid-cols-1 gap-2 mt-1">
                {URGENCIES.map(({ value, desc }) => (
                  <button
                    key={value}
                    type="button"
                    className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-colors ${form.urgency === value ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"}`}
                    onClick={() => setForm(f => ({ ...f, urgency: value }))}
                    data-testid={`urgency-${value}`}
                  >
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium mt-0.5 urgency-${value}`}>{value}</span>
                    <span className="text-xs text-muted-foreground">{desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label>Full Description</Label>
              <Textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={4}
                placeholder="Describe the issue in detail — when it started, how severe it is, anything you've already tried..."
                required
                data-testid="textarea-req-description"
              />
            </div>

            {/* ── Photo Upload Section ── */}
            <div>
              <Label>Photos <span className="text-muted-foreground font-normal text-xs">(optional — up to 5)</span></Label>
              <p className="text-xs text-muted-foreground mb-2">
                Add photos from your camera or photo library to help your landlord understand the issue.
              </p>

              {/* Hidden file input — accepts images, camera on mobile */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                capture="environment"
                className="hidden"
                onChange={handleFileSelect}
                data-testid="input-photo-upload"
              />

              {/* Photo previews grid */}
              {photos.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {photos.map((p, i) => (
                    <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-border group">
                      <img
                        src={p.previewUrl}
                        alt={`Photo ${i + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removePhoto(i)}
                        className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        data-testid={`btn-remove-photo-${i}`}
                      >
                        <X size={12} />
                      </button>
                      <div className="absolute bottom-0 left-0 right-0 bg-black/40 text-white text-xs text-center py-0.5 truncate px-1">
                        {p.file.name}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add photo buttons */}
              {photos.length < 5 && (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      if (fileInputRef.current) {
                        fileInputRef.current.removeAttribute("capture");
                        fileInputRef.current.click();
                      }
                    }}
                    data-testid="btn-add-photo-gallery"
                  >
                    <Image size={15} className="mr-1.5" />
                    Photo Library
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      if (fileInputRef.current) {
                        fileInputRef.current.setAttribute("capture", "environment");
                        fileInputRef.current.click();
                      }
                    }}
                    data-testid="btn-add-photo-camera"
                  >
                    <Camera size={15} className="mr-1.5" />
                    Take Photo
                  </Button>
                </div>
              )}
              {photos.length >= 5 && (
                <p className="text-xs text-muted-foreground text-center py-2">Maximum 5 photos reached</p>
              )}
              {photos.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">{photos.length}/5 photo{photos.length !== 1 ? "s" : ""} selected</p>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { resetForm(); setOpen(false); }}>Cancel</Button>
              <Button type="submit" disabled={isPending || !form.category} data-testid="btn-submit-request">
                {isPending ? (uploadingPhotos ? "Uploading photos..." : "Submitting...") : "Submit Request"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
