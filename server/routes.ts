import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { generateDepositTrackerXlsx } from "./excelExport";
import { searchLeaseClauses, getClausesForCategory } from "./leaseReference";
import multer from "multer";
import path from "path";
import fs from "fs";
import {
  insertPropertySchema, insertTenantSchema, insertDepositSchema,
  insertDepositEntrySchema, insertInspectionSchema, insertInspectionItemSchema,
  insertMaintenanceRequestSchema,
} from "@shared/schema";
import { z } from "zod";

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Multer config — store on disk, limit 10MB per file, images only
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
  // ---- Properties ----
  app.get("/api/properties", (_req, res) => {
    res.json(storage.getProperties());
  });
  app.get("/api/properties/:id", (req, res) => {
    const p = storage.getProperty(Number(req.params.id));
    if (!p) return res.status(404).json({ error: "Not found" });
    res.json(p);
  });
  app.post("/api/properties", (req, res) => {
    const data = insertPropertySchema.parse(req.body);
    res.json(storage.createProperty(data));
  });
  app.patch("/api/properties/:id", (req, res) => {
    const p = storage.updateProperty(Number(req.params.id), req.body);
    if (!p) return res.status(404).json({ error: "Not found" });
    res.json(p);
  });
  app.delete("/api/properties/:id", (req, res) => {
    storage.deleteProperty(Number(req.params.id));
    res.json({ ok: true });
  });

  // ---- Tenants ----
  app.get("/api/tenants", (req, res) => {
    const propertyId = req.query.propertyId ? Number(req.query.propertyId) : undefined;
    res.json(storage.getTenants(propertyId));
  });
  app.get("/api/tenants/:id", (req, res) => {
    const t = storage.getTenant(Number(req.params.id));
    if (!t) return res.status(404).json({ error: "Not found" });
    res.json(t);
  });
  app.post("/api/tenants", (req, res) => {
    const body = { ...req.body, portalCode: req.body.portalCode || randomPortalCode() };
    const data = insertTenantSchema.parse(body);
    res.json(storage.createTenant(data));
  });
  app.patch("/api/tenants/:id", (req, res) => {
    const t = storage.updateTenant(Number(req.params.id), req.body);
    if (!t) return res.status(404).json({ error: "Not found" });
    res.json(t);
  });

  // ---- Deposits ----
  app.get("/api/deposits", (req, res) => {
    const tenantId = req.query.tenantId ? Number(req.query.tenantId) : undefined;
    res.json(storage.getDeposits(tenantId));
  });
  app.get("/api/deposits/:id", (req, res) => {
    const d = storage.getDeposit(Number(req.params.id));
    if (!d) return res.status(404).json({ error: "Not found" });
    res.json(d);
  });
  app.get("/api/tenants/:tenantId/deposit", (req, res) => {
    const d = storage.getDepositByTenant(Number(req.params.tenantId));
    if (!d) return res.status(404).json({ error: "Not found" });
    res.json(d);
  });
  app.post("/api/deposits", (req, res) => {
    const data = insertDepositSchema.parse(req.body);
    const deposit = storage.createDeposit(data);
    // Auto-create initial entry
    storage.createDepositEntry({
      depositId: deposit.id,
      date: deposit.dateReceived,
      entryType: "Deposit Received",
      description: "Initial security deposit collected",
      addition: deposit.amount,
      runningBalance: deposit.amount,
    });
    res.json(deposit);
  });
  app.patch("/api/deposits/:id", (req, res) => {
    const d = storage.updateDeposit(Number(req.params.id), req.body);
    if (!d) return res.status(404).json({ error: "Not found" });
    res.json(d);
  });

  // ---- Deposit Entries ----
  app.get("/api/deposits/:depositId/entries", (req, res) => {
    res.json(storage.getDepositEntries(Number(req.params.depositId)));
  });
  app.post("/api/deposits/:depositId/entries", (req, res) => {
    const depositId = Number(req.params.depositId);
    const deposit = storage.getDeposit(depositId);
    if (!deposit) return res.status(404).json({ error: "Deposit not found" });

    const entries = storage.getDepositEntries(depositId);
    const currentBalance = entries.length > 0
      ? (entries[entries.length - 1].runningBalance ?? deposit.amount)
      : deposit.amount;

    const body = req.body;
    const deduction = body.deduction ? Number(body.deduction) : 0;
    const addition = body.addition ? Number(body.addition) : 0;
    const newBalance = currentBalance - deduction + addition;

    const data = insertDepositEntrySchema.parse({
      ...body,
      depositId,
      runningBalance: newBalance,
    });
    res.json(storage.createDepositEntry(data));
  });
  app.patch("/api/deposit-entries/:id", (req, res) => {
    const e = storage.updateDepositEntry(Number(req.params.id), req.body);
    if (!e) return res.status(404).json({ error: "Not found" });
    res.json(e);
  });
  app.delete("/api/deposit-entries/:id", (req, res) => {
    storage.deleteDepositEntry(Number(req.params.id));
    res.json({ ok: true });
  });

  // ---- Inspections ----
  app.get("/api/inspections", (req, res) => {
    const propertyId = req.query.propertyId ? Number(req.query.propertyId) : undefined;
    const tenantId = req.query.tenantId ? Number(req.query.tenantId) : undefined;
    res.json(storage.getInspections(propertyId, tenantId));
  });
  app.get("/api/inspections/:id", (req, res) => {
    const insp = storage.getInspection(Number(req.params.id));
    if (!insp) return res.status(404).json({ error: "Not found" });
    res.json(insp);
  });
  app.post("/api/inspections", (req, res) => {
    const data = insertInspectionSchema.parse(req.body);
    const insp = storage.createInspection(data);

    // If creating a fresh inspection, seed with default checklist items
    if (!req.body.skipSeed) {
      const defaultItems = getDefaultInspectionItems(insp.id);
      storage.bulkCreateInspectionItems(defaultItems);
    }
    res.json(insp);
  });
  app.patch("/api/inspections/:id", (req, res) => {
    const insp = storage.updateInspection(Number(req.params.id), req.body);
    if (!insp) return res.status(404).json({ error: "Not found" });
    // Recalculate total cost
    const items = storage.getInspectionItems(insp.id);
    const total = items.reduce((sum, i) => sum + (i.estimatedRepairCost || 0), 0);
    storage.updateInspection(insp.id, { totalEstimatedCost: total });
    res.json({ ...insp, totalEstimatedCost: total });
  });

  // RentCheck import
  app.post("/api/inspections/import-rentcheck", (req, res) => {
    const { tenantId, propertyId, type, inspectionDate, inspectorName, items } = req.body;
    if (!tenantId || !propertyId || !items?.length) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const insp = storage.createInspection({
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

    const created = storage.bulkCreateInspectionItems(mappedItems);
    const total = created.reduce((sum, i) => sum + (i.estimatedRepairCost || 0), 0);
    storage.updateInspection(insp.id, { totalEstimatedCost: total });

    res.json({ inspection: { ...insp, totalEstimatedCost: total }, items: created });
  });

  // ---- Inspection Items ----
  app.get("/api/inspections/:inspectionId/items", (req, res) => {
    res.json(storage.getInspectionItems(Number(req.params.inspectionId)));
  });
  app.post("/api/inspections/:inspectionId/items", (req, res) => {
    const data = insertInspectionItemSchema.parse({ ...req.body, inspectionId: Number(req.params.inspectionId) });
    const item = storage.createInspectionItem(data);
    // Update total on inspection
    const items = storage.getInspectionItems(item.inspectionId);
    const total = items.reduce((sum, i) => sum + (i.estimatedRepairCost || 0), 0);
    storage.updateInspection(item.inspectionId, { totalEstimatedCost: total });
    res.json(item);
  });
  app.patch("/api/inspection-items/:id", (req, res) => {
    const item = storage.updateInspectionItem(Number(req.params.id), req.body);
    if (!item) return res.status(404).json({ error: "Not found" });
    // Update total
    const items = storage.getInspectionItems(item.inspectionId);
    const total = items.reduce((sum, i) => sum + (i.estimatedRepairCost || 0), 0);
    storage.updateInspection(item.inspectionId, { totalEstimatedCost: total });
    res.json(item);
  });
  app.delete("/api/inspection-items/:id", (req, res) => {
    storage.deleteInspectionItem(Number(req.params.id));
    res.json({ ok: true });
  });

  // ---- Excel Export ----
  app.get("/api/export/deposit/:tenantId", (req, res) => {
    const tenantId = Number(req.params.tenantId);
    const tenant = storage.getTenant(tenantId);
    if (!tenant) return res.status(404).json({ error: "Tenant not found" });

    const property = storage.getProperty(tenant.propertyId);
    if (!property) return res.status(404).json({ error: "Property not found" });

    const deposit = storage.getDepositByTenant(tenantId);
    if (!deposit) return res.status(404).json({ error: "No deposit on file" });

    const entries = storage.getDepositEntries(deposit.id);
    const inspList = storage.getInspections(undefined, tenantId);
    const moveOut = inspList.find(i => i.type === "move_out");
    const items = moveOut ? storage.getInspectionItems(moveOut.id) : [];
    const maintRequests = storage.getMaintenanceRequests(undefined, tenantId);

    const buf = generateDepositTrackerXlsx(tenant, property, deposit, entries, moveOut, items, maintRequests);

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="deposit-tracker-${tenant.name.replace(/\s+/g, "-")}.xlsx"`);
    res.send(buf);
  });

  // ---- Maintenance Requests ----
  app.get("/api/maintenance", (req, res) => {
    const propertyId = req.query.propertyId ? Number(req.query.propertyId) : undefined;
    const tenantId = req.query.tenantId ? Number(req.query.tenantId) : undefined;
    res.json(storage.getMaintenanceRequests(propertyId, tenantId));
  });
  app.get("/api/maintenance/:id", (req, res) => {
    const r = storage.getMaintenanceRequest(Number(req.params.id));
    if (!r) return res.status(404).json({ error: "Not found" });
    res.json(r);
  });
  app.post("/api/maintenance", (req, res) => {
    const data = insertMaintenanceRequestSchema.parse({
      ...req.body,
      submittedAt: new Date().toISOString(),
    });
    res.json(storage.createMaintenanceRequest(data));
  });
  app.patch("/api/maintenance/:id", (req, res) => {
    const body = req.body;
    if (body.status === "resolved" && !body.resolvedAt) {
      body.resolvedAt = new Date().toISOString();
    }
    const r = storage.updateMaintenanceRequest(Number(req.params.id), body);
    if (!r) return res.status(404).json({ error: "Not found" });
    res.json(r);
  });

  // ---- Tenant Portal (public lookup by portal code) ----
  app.get("/api/portal/:code", (req, res) => {
    const tenant = storage.getTenantByPortalCode(req.params.code);
    if (!tenant) return res.status(404).json({ error: "Invalid portal code" });
    const property = storage.getProperty(tenant.propertyId);
    const requests = storage.getMaintenanceRequests(undefined, tenant.id);
    res.json({ tenant, property, requests });
  });
  app.post("/api/portal/:code/maintenance", (req, res) => {
    const tenant = storage.getTenantByPortalCode(req.params.code);
    if (!tenant) return res.status(404).json({ error: "Invalid portal code" });
    const data = insertMaintenanceRequestSchema.parse({
      ...req.body,
      tenantId: tenant.id,
      propertyId: tenant.propertyId,
      submittedAt: new Date().toISOString(),
      status: "open",
    });
    res.json(storage.createMaintenanceRequest(data));
  });

  // ---- Photo Uploads ----
  // Serve uploaded files as static assets
  app.use("/uploads", (req, res, next) => {
    // Basic path traversal protection
    const safePath = path.normalize(req.path).replace(/^\/+/, "");
    if (safePath.includes("..")) return res.status(403).send("Forbidden");
    res.sendFile(path.join(UPLOADS_DIR, safePath));
  });

  // POST /api/maintenance/:id/photos  — upload up to 5 photos
  app.post("/api/maintenance/:id/photos", upload.array("photos", 5), (req, res) => {
    const requestId = Number(req.params.id);
    const maint = storage.getMaintenanceRequest(requestId);
    if (!maint) return res.status(404).json({ error: "Request not found" });

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) return res.status(400).json({ error: "No files uploaded" });

    const saved = files.map(file => storage.createMaintenancePhoto({
      maintenanceRequestId: requestId,
      filename: file.filename,
      originalName: file.originalname,
      uploadedAt: new Date().toISOString(),
    }));
    res.json(saved);
  });

  // GET /api/maintenance/:id/photos
  app.get("/api/maintenance/:id/photos", (req, res) => {
    const requestId = Number(req.params.id);
    res.json(storage.getMaintenancePhotos(requestId));
  });

  // DELETE /api/maintenance/photos/:photoId
  app.delete("/api/maintenance/photos/:photoId", (req, res) => {
    const photoId = Number(req.params.photoId);
    const photos = storage.getMaintenancePhotos(0); // we need a way to get by id
    // Get all photos and find this one to delete the file
    try {
      storage.deleteMaintenancePhoto(photoId);
    } catch {}
    res.json({ ok: true });
  });

  // ---- Lease Reference Search ----
  // GET /api/lease/search?q=clog&state=TX  → top matching clauses
  app.get("/api/lease/search", (req, res) => {
    const q = String(req.query.q || "").trim();
    const state = (req.query.state as "TX" | "NJ") || "TX";
    if (!q) return res.json([]);
    res.json(searchLeaseClauses(q, state));
  });

  // GET /api/lease/category/:category?state=TX  → clauses for a maintenance category
  app.get("/api/lease/category/:category", (req, res) => {
    const category = req.params.category;
    const state = (req.query.state as "TX" | "NJ") || "TX";
    res.json(getClausesForCategory(category, state));
  });

  // ---- Dashboard Summary ----
  app.get("/api/dashboard", (_req, res) => {
    const allProperties = storage.getProperties();
    const allTenants = storage.getTenants();
    const allMaintenance = storage.getMaintenanceRequests();
    const allDeposits = storage.getDeposits();
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
