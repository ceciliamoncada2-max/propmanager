import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { generateDepositTrackerXlsx } from "./excelExport";
import { searchLeaseClauses, getClausesForCategory } from "./leaseReference";
import { notifyTenantNewRequest, notifyLandlordNewRequest, notifyTenantStatusUpdate, notifyTenantResolved, notifyTenantVisitScheduled, notifyLandlordVisitConfirmed, notifyLandlordRescheduleRequested } from "./sms";
import multer from "multer";
import path from "path";
import fs from "fs";
import {
  insertPropertySchema, insertTenantSchema, insertDepositSchema,
  insertDepositEntrySchema, insertInspectionSchema, insertInspectionItemSchema,
  insertMaintenanceRequestSchema,
} from "@shared/schema";

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const upload = multer({
  dest: UPLOADS_DIR,
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
    cb(null, allowed.includes(file.mimetype));
  },
});

function randomPortalCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // ---- Health check ----
  app.get("/api/health", async (_req, res) => {
    try {
      const { Pool } = await import("pg");
      const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
      await p.query("SELECT 1");
      await p.end();
      res.json({ ok: true, db: "connected", url: process.env.DATABASE_URL?.substring(0, 30) + "..." });
    } catch (e: any) {
      res.json({ ok: false, error: e.message, url: process.env.DATABASE_URL?.substring(0, 30) + "..." });
    }
  });

  // ---- Properties ----
  app.get("/api/properties", async (_req, res) => {
    res.json(await storage.getProperties());
  });
  app.get("/api/properties/:id", async (req, res) => {
    const p = await storage.getProperty(Number(req.params.id));
    if (!p) return res.status(404).json({ error: "Not found" });
    res.json(p);
  });
  app.post("/api/properties", async (req, res) => {
    const data = insertPropertySchema.parse(req.body);
    res.json(await storage.createProperty(data));
  });
  app.patch("/api/properties/:id", async (req, res) => {
    const p = await storage.updateProperty(Number(req.params.id), req.body);
    if (!p) return res.status(404).json({ error: "Not found" });
    res.json(p);
  });
  app.delete("/api/properties/:id", async (req, res) => {
    await storage.deleteProperty(Number(req.params.id));
    res.json({ ok: true });
  });

  // ---- Tenants ----
  app.get("/api/tenants", async (req, res) => {
    const propertyId = req.query.propertyId ? Number(req.query.propertyId) : undefined;
    res.json(await storage.getTenants(propertyId));
  });
  app.get("/api/tenants/:id", async (req, res) => {
    const t = await storage.getTenant(Number(req.params.id));
    if (!t) return res.status(404).json({ error: "Not found" });
    res.json(t);
  });
  app.post("/api/tenants", async (req, res) => {
    const body = { ...req.body, portalCode: req.body.portalCode || randomPortalCode() };
    const data = insertTenantSchema.parse(body);
    res.json(await storage.createTenant(data));
  });
  app.patch("/api/tenants/:id", async (req, res) => {
    const t = await storage.updateTenant(Number(req.params.id), req.body);
    if (!t) return res.status(404).json({ error: "Not found" });
    res.json(t);
  });

  // ---- Deposits ----
  app.get("/api/deposits", async (req, res) => {
    const tenantId = req.query.tenantId ? Number(req.query.tenantId) : undefined;
    res.json(await storage.getDeposits(tenantId));
  });
  app.get("/api/deposits/:id", async (req, res) => {
    const d = await storage.getDeposit(Number(req.params.id));
    if (!d) return res.status(404).json({ error: "Not found" });
    res.json(d);
  });
  app.get("/api/tenants/:tenantId/deposit", async (req, res) => {
    const d = await storage.getDepositByTenant(Number(req.params.tenantId));
    if (!d) return res.status(404).json({ error: "Not found" });
    res.json(d);
  });
  app.post("/api/deposits", async (req, res) => {
    const data = insertDepositSchema.parse(req.body);
    const deposit = await storage.createDeposit(data);
    await storage.createDepositEntry({
      depositId: deposit.id,
      date: deposit.dateReceived,
      entryType: "Deposit Received",
      description: "Initial security deposit collected",
      addition: deposit.amount,
      runningBalance: deposit.amount,
    });
    res.json(deposit);
  });
  app.patch("/api/deposits/:id", async (req, res) => {
    const d = await storage.updateDeposit(Number(req.params.id), req.body);
    if (!d) return res.status(404).json({ error: "Not found" });
    res.json(d);
  });

  // ---- Deposit Entries ----
  app.get("/api/deposits/:depositId/entries", async (req, res) => {
    res.json(await storage.getDepositEntries(Number(req.params.depositId)));
  });
  app.post("/api/deposits/:depositId/entries", async (req, res) => {
    const depositId = Number(req.params.depositId);
    const deposit = await storage.getDeposit(depositId);
    if (!deposit) return res.status(404).json({ error: "Deposit not found" });
    const entries = await storage.getDepositEntries(depositId);
    const currentBalance = entries.length > 0
      ? (entries[entries.length - 1].runningBalance ?? deposit.amount)
      : deposit.amount;
    const body = req.body;
    const deduction = body.deduction ? Number(body.deduction) : 0;
    const addition = body.addition ? Number(body.addition) : 0;
    const newBalance = currentBalance - deduction + addition;
    const data = insertDepositEntrySchema.parse({ ...body, depositId, runningBalance: newBalance });
    res.json(await storage.createDepositEntry(data));
  });
  app.patch("/api/deposit-entries/:id", async (req, res) => {
    const e = await storage.updateDepositEntry(Number(req.params.id), req.body);
    if (!e) return res.status(404).json({ error: "Not found" });
    res.json(e);
  });
  app.delete("/api/deposit-entries/:id", async (req, res) => {
    await storage.deleteDepositEntry(Number(req.params.id));
    res.json({ ok: true });
  });

  // ---- Inspections ----
  app.get("/api/inspections", async (req, res) => {
    const propertyId = req.query.propertyId ? Number(req.query.propertyId) : undefined;
    const tenantId = req.query.tenantId ? Number(req.query.tenantId) : undefined;
    res.json(await storage.getInspections(propertyId, tenantId));
  });
  app.get("/api/inspections/:id", async (req, res) => {
    const insp = await storage.getInspection(Number(req.params.id));
    if (!insp) return res.status(404).json({ error: "Not found" });
    res.json(insp);
  });
  app.post("/api/inspections", async (req, res) => {
    const data = insertInspectionSchema.parse(req.body);
    const insp = await storage.createInspection(data);
    if (!req.body.skipSeed) {
      const defaultItems = getDefaultInspectionItems(insp.id);
      await storage.bulkCreateInspectionItems(defaultItems);
    }
    res.json(insp);
  });
  app.patch("/api/inspections/:id", async (req, res) => {
    const insp = await storage.updateInspection(Number(req.params.id), req.body);
    if (!insp) return res.status(404).json({ error: "Not found" });
    const items = await storage.getInspectionItems(insp.id);
    const total = items.reduce((sum, i) => sum + (i.estimatedRepairCost || 0), 0);
    await storage.updateInspection(insp.id, { totalEstimatedCost: total });
    res.json({ ...insp, totalEstimatedCost: total });
  });

  // RentCheck import
  app.post("/api/inspections/import-rentcheck", async (req, res) => {
    const { tenantId, propertyId, type, inspectionDate, inspectorName, items } = req.body;
    if (!tenantId || !propertyId || !items?.length) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const insp = await storage.createInspection({
      tenantId: Number(tenantId),
      propertyId: Number(propertyId),
      type: type || "move_out",
      inspectionDate: inspectionDate || new Date().toISOString().split("T")[0],
      inspectorName: inspectorName || "",
      importedFrom: "rentcheck",
      rawImportData: JSON.stringify(items),
    });
    const mappedItems = items.map((item: any) => ({
      inspectionId: insp.id,
      area: item.area || item.room || "General",
      item: item.item || item.name || "Item",
      condition: item.condition || null,
      notes: item.notes || item.description || null,
      hasDamage: item.hasDamage || item.damage ? 1 : 0,
      estimatedRepairCost: Number(item.estimatedRepairCost || item.cost || 0),
      photoNotes: item.photoNotes || null,
    }));
    const created = await storage.bulkCreateInspectionItems(mappedItems);
    const total = created.reduce((sum, i) => sum + (i.estimatedRepairCost || 0), 0);
    await storage.updateInspection(insp.id, { totalEstimatedCost: total });
    res.json({ inspection: { ...insp, totalEstimatedCost: total }, items: created });
  });

  // ---- Inspection Items ----
  app.get("/api/inspections/:inspectionId/items", async (req, res) => {
    res.json(await storage.getInspectionItems(Number(req.params.inspectionId)));
  });
  app.post("/api/inspections/:inspectionId/items", async (req, res) => {
    const data = insertInspectionItemSchema.parse({ ...req.body, inspectionId: Number(req.params.inspectionId) });
    const item = await storage.createInspectionItem(data);
    const items = await storage.getInspectionItems(item.inspectionId);
    const total = items.reduce((sum, i) => sum + (i.estimatedRepairCost || 0), 0);
    await storage.updateInspection(item.inspectionId, { totalEstimatedCost: total });
    res.json(item);
  });
  app.patch("/api/inspection-items/:id", async (req, res) => {
    const item = await storage.updateInspectionItem(Number(req.params.id), req.body);
    if (!item) return res.status(404).json({ error: "Not found" });
    const items = await storage.getInspectionItems(item.inspectionId);
    const total = items.reduce((sum, i) => sum + (i.estimatedRepairCost || 0), 0);
    await storage.updateInspection(item.inspectionId, { totalEstimatedCost: total });
    res.json(item);
  });
  app.delete("/api/inspection-items/:id", async (req, res) => {
    await storage.deleteInspectionItem(Number(req.params.id));
    res.json({ ok: true });
  });

  // ---- Excel Export ----
  app.get("/api/export/deposit/:tenantId", async (req, res) => {
    const tenantId = Number(req.params.tenantId);
    const tenant = await storage.getTenant(tenantId);
    if (!tenant) return res.status(404).json({ error: "Tenant not found" });
    const property = await storage.getProperty(tenant.propertyId);
    if (!property) return res.status(404).json({ error: "Property not found" });
    const deposit = await storage.getDepositByTenant(tenantId);
    if (!deposit) return res.status(404).json({ error: "No deposit on file" });
    const entries = await storage.getDepositEntries(deposit.id);
    const inspList = await storage.getInspections(undefined, tenantId);
    const moveOut = inspList.find(i => i.type === "move_out");
    const items = moveOut ? await storage.getInspectionItems(moveOut.id) : [];
    const maintRequests = await storage.getMaintenanceRequests(undefined, tenantId);
    // Fetch receipt photos for each resolved maintenance request
    const photoMap: Record<number, any[]> = {};
    await Promise.all(maintRequests.map(async (mr) => {
      photoMap[mr.id] = await storage.getMaintenancePhotos(mr.id);
    }));
    const buf = generateDepositTrackerXlsx(tenant, property, deposit, entries, moveOut, items, maintRequests, photoMap);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="deposit-tracker-${tenant.name.replace(/\s+/g, "-")}.xlsx"`);
    res.send(buf);
  });

  // ---- Maintenance Requests ----
  app.get("/api/maintenance", async (req, res) => {
    const propertyId = req.query.propertyId ? Number(req.query.propertyId) : undefined;
    const tenantId = req.query.tenantId ? Number(req.query.tenantId) : undefined;
    res.json(await storage.getMaintenanceRequests(propertyId, tenantId));
  });
  app.get("/api/maintenance/:id", async (req, res) => {
    const r = await storage.getMaintenanceRequest(Number(req.params.id));
    if (!r) return res.status(404).json({ error: "Not found" });
    res.json(r);
  });
  app.post("/api/maintenance", async (req, res) => {
    const data = insertMaintenanceRequestSchema.parse({
      ...req.body,
      submittedAt: new Date().toISOString(),
    });
    const created = await storage.createMaintenanceRequest(data);
    // Notify landlord of new request
    const tenant = await storage.getTenant(created.tenantId);
    notifyLandlordNewRequest(created.title, tenant?.name || "Tenant", created.location).catch(console.error);
    res.json(created);
  });
  app.patch("/api/maintenance/:id", async (req, res) => {
    const body = req.body;
    const prev = await storage.getMaintenanceRequest(Number(req.params.id));
    if (body.status === "resolved" && !body.resolvedAt) {
      body.resolvedAt = new Date().toISOString();
    }
    const r = await storage.updateMaintenanceRequest(Number(req.params.id), body);
    if (!r) return res.status(404).json({ error: "Not found" });
    // Send SMS notifications
    if (prev) {
      const tenant = await storage.getTenant(r.tenantId);
      const tenantPhone = tenant?.phone || null;
      const tenantPhone2 = (tenant as any)?.phone2 || null;
      const phones = [tenantPhone, tenantPhone2].filter(Boolean);
      // Visit scheduled (or rescheduled) — reset visitConfirmed so tenant must re-confirm
      if (body.scheduledVisit && body.scheduledVisit !== prev.scheduledVisit) {
        // Clear prior confirmation when date changes
        await storage.updateMaintenanceRequest(Number(req.params.id), { visitConfirmed: null } as any);
        phones.forEach(p => notifyTenantVisitScheduled(p, r.title, body.scheduledVisit).catch(console.error));
      }
      // Status changed
      if (body.status && body.status !== prev.status) {
        if (body.status === "resolved" || body.status === "closed") {
          phones.forEach(p => notifyTenantResolved(p, r.title, body.landlordNotes || null).catch(console.error));
        } else {
          phones.forEach(p => notifyTenantStatusUpdate(p, r.title, body.status, body.landlordNotes || null, r.scheduledVisit || null).catch(console.error));
        }
      }
    }
    res.json(r);
  });

  // ---- Tenant Portal ----
  app.get("/api/portal/:code", async (req, res) => {
    const tenant = await storage.getTenantByPortalCode(req.params.code);
    if (!tenant) return res.status(404).json({ error: "Invalid portal code" });
    const property = await storage.getProperty(tenant.propertyId);
    const requests = await storage.getMaintenanceRequests(undefined, tenant.id);
    res.json({ tenant, property, requests });
  });
  app.post("/api/portal/:code/maintenance", async (req, res) => {
    const tenant = await storage.getTenantByPortalCode(req.params.code);
    if (!tenant) return res.status(404).json({ error: "Invalid portal code" });
    const data = insertMaintenanceRequestSchema.parse({
      ...req.body,
      tenantId: tenant.id,
      propertyId: tenant.propertyId,
      submittedAt: new Date().toISOString(),
      status: "open",
    });
    const created = await storage.createMaintenanceRequest(data);
    // Notify tenant that request was received
    const portalTenant = await storage.getTenantByPortalCode(req.params.code);
    if (portalTenant) {
      const phones = [portalTenant.phone, (portalTenant as any).phone2].filter(Boolean);
      phones.forEach((p: string) => notifyTenantNewRequest(p, created.title, portalTenant.portalCode).catch(console.error));
      notifyLandlordNewRequest(created.title, portalTenant.name, created.location).catch(console.error);
    }
    res.json(created);
  });

  // Portal confirm / reschedule
  app.post("/api/portal/:code/maintenance/:id/confirm", async (req, res) => {
    const tenant = await storage.getTenantByPortalCode(req.params.code);
    if (!tenant) return res.status(404).json({ error: "Invalid portal code" });
    const reqId = Number(req.params.id);
    const maint = await storage.getMaintenanceRequest(reqId);
    if (!maint || maint.tenantId !== tenant.id) return res.status(404).json({ error: "Not found" });
    const updated = await storage.updateMaintenanceRequest(reqId, { visitConfirmed: "confirmed" } as any);
    // Notify landlord
    notifyLandlordVisitConfirmed(maint.title, tenant.name, maint.scheduledVisit || "").catch(console.error);
    res.json(updated);
  });

  app.post("/api/portal/:code/maintenance/:id/reschedule", async (req, res) => {
    const tenant = await storage.getTenantByPortalCode(req.params.code);
    if (!tenant) return res.status(404).json({ error: "Invalid portal code" });
    const reqId = Number(req.params.id);
    const maint = await storage.getMaintenanceRequest(reqId);
    if (!maint || maint.tenantId !== tenant.id) return res.status(404).json({ error: "Not found" });
    const { message } = req.body;
    const updated = await storage.updateMaintenanceRequest(reqId, { visitConfirmed: `reschedule:${message || ""}` } as any);
    // Notify landlord
    notifyLandlordRescheduleRequested(maint.title, tenant.name, message || null).catch(console.error);
    res.json(updated);
  });

  // ---- Photo Uploads ----
  app.use("/uploads", (req, res) => {
    const safePath = path.normalize(req.path).replace(/^\/+/, "");
    if (safePath.includes("..")) return res.status(403).send("Forbidden");
    res.sendFile(path.join(UPLOADS_DIR, safePath));
  });

  app.post("/api/maintenance/:id/photos", upload.array("photos", 5), async (req, res) => {
    const requestId = Number(req.params.id);
    const maint = await storage.getMaintenanceRequest(requestId);
    if (!maint) return res.status(404).json({ error: "Request not found" });
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) return res.status(400).json({ error: "No files uploaded" });
    const caption = req.body?.caption || null;
    const saved = await Promise.all(files.map(file => storage.createMaintenancePhoto({
      maintenanceRequestId: requestId,
      filename: file.filename,
      originalName: file.originalname,
      uploadedAt: new Date().toISOString(),
      caption,
    })));
    res.json(saved);
  });

  app.get("/api/maintenance/:id/photos", async (req, res) => {
    res.json(await storage.getMaintenancePhotos(Number(req.params.id)));
  });

  app.delete("/api/maintenance/photos/:photoId", async (req, res) => {
    await storage.deleteMaintenancePhoto(Number(req.params.photoId));
    res.json({ ok: true });
  });

  // ---- Inspection Item Photos ----
  app.get("/api/inspection-items/:id/photos", async (req, res) => {
    res.json(await storage.getInspectionItemPhotos(Number(req.params.id)));
  });

  app.post("/api/inspection-items/:id/photos", upload.array("photos", 10), async (req, res) => {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) return res.status(400).json({ error: "No files uploaded" });
    const itemId = Number(req.params.id);
    const saved = await Promise.all(files.map(f =>
      storage.createInspectionItemPhoto({
        inspectionItemId: itemId,
        filename: f.filename,
        originalName: f.originalname,
        uploadedAt: new Date().toISOString(),
      })
    ));
    res.json(saved);
  });

  app.delete("/api/inspection-items/photos/:photoId", async (req, res) => {
    await storage.deleteInspectionItemPhoto(Number(req.params.photoId));
    res.json({ ok: true });
  });

  // ---- Lease Reference Search ----
  app.get("/api/lease/search", (req, res) => {
    const q = String(req.query.q || "").trim();
    const state = (req.query.state as "TX" | "NJ") || "TX";
    if (!q) return res.json([]);
    res.json(searchLeaseClauses(q, state));
  });
  app.get("/api/lease/category/:category", (req, res) => {
    const category = req.params.category;
    const state = (req.query.state as "TX" | "NJ") || "TX";
    res.json(getClausesForCategory(category, state));
  });

  // ---- Dashboard ----
  app.get("/api/dashboard", async (_req, res) => {
    const [allProperties, allTenants, allMaintenance, allDeposits] = await Promise.all([
      storage.getProperties(),
      storage.getTenants(),
      storage.getMaintenanceRequests(),
      storage.getDeposits(),
    ]);
    const openRequests = allMaintenance.filter(m => m.status === "open" || m.status === "in_progress");
    const emergencyRequests = allMaintenance.filter(m => m.urgency === "Emergency" && m.status === "open");
    res.json({
      propertyCount: allProperties.length,
      tenantCount: allTenants.filter(t => t.status === "active").length,
      openMaintenanceCount: openRequests.length,
      emergencyCount: emergencyRequests.length,
      depositCount: allDeposits.length,
      recentMaintenance: allMaintenance.slice(0, 5),
    });
  });

  return httpServer;
}

function getDefaultInspectionItems(inspectionId: number) {
  const areas = [
    { area: "Exterior", items: ["Front Walkway / Bricks / Steps", "Driveway / Parking Area", "Gutters & Downspouts", "Lawn / Grass Condition", "Shrubs / Bushes / Hedges", "Trees / Plantings", "Fence / Gate", "Exterior Paint / Siding", "Garage Door / Shed"] },
    { area: "Interior — Common", items: ["Entry / Foyer", "Living Room — Walls", "Living Room — Floors", "Living Room — Ceiling / Lights", "Dining Area", "Hallways"] },
    { area: "Kitchen", items: ["Kitchen — Walls / Cabinets", "Kitchen — Appliances", "Kitchen — Sink / Plumbing", "Kitchen — Floors"] },
    { area: "Bathrooms", items: ["Bathroom 1 — Fixtures / Tile", "Bathroom 1 — Walls / Floor", "Bathroom 2 — Fixtures / Tile"] },
    { area: "Bedrooms", items: ["Bedroom 1 — Walls / Floors", "Bedroom 2 — Walls / Floors", "Bedroom 3 — Walls / Floors"] },
    { area: "Systems", items: ["HVAC Filter — Replaced?", "Smoke Detectors — Working?", "CO Detectors — Working?", "Water Softener (if applicable)", "Keys / Remotes Returned"] },
  ];
  const items: any[] = [];
  areas.forEach(({ area, items: areaItems }) => {
    areaItems.forEach(item => {
      items.push({ inspectionId, area, item, condition: null, notes: null, hasDamage: 0, estimatedRepairCost: 0 });
    });
  });
  return items;
}
