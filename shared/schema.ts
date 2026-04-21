import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Properties
export const properties = sqliteTable("properties", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  address: text("address").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(), // "TX" | "NJ" | "Other"
  zip: text("zip").notNull(),
  unitCount: integer("unit_count").default(1),
  notes: text("notes"),
});

export const insertPropertySchema = createInsertSchema(properties).omit({ id: true });
export type InsertProperty = z.infer<typeof insertPropertySchema>;
export type Property = typeof properties.$inferSelect;

// Tenants
export const tenants = sqliteTable("tenants", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  propertyId: integer("property_id").notNull(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  unitNumber: text("unit_number"),
  leaseStart: text("lease_start"),
  leaseEnd: text("lease_end"),
  moveOutDate: text("move_out_date"),
  forwardingAddress: text("forwarding_address"),
  portalCode: text("portal_code").notNull(), // unique code for tenant portal access
  status: text("status").notNull().default("active"), // active | moved_out
});

export const insertTenantSchema = createInsertSchema(tenants).omit({ id: true });
export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type Tenant = typeof tenants.$inferSelect;

// Security Deposits
export const deposits = sqliteTable("deposits", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tenantId: integer("tenant_id").notNull(),
  propertyId: integer("property_id").notNull(),
  amount: real("amount").notNull(),
  dateReceived: text("date_received").notNull(),
  bankName: text("bank_name"),
  interestRate: real("interest_rate").default(0.01),
  state: text("state").notNull(), // TX | NJ | Other
  status: text("status").default("held"), // held | partially_returned | returned
});

export const insertDepositSchema = createInsertSchema(deposits).omit({ id: true });
export type InsertDeposit = z.infer<typeof insertDepositSchema>;
export type Deposit = typeof deposits.$inferSelect;

// Deposit Ledger Entries
export const depositEntries = sqliteTable("deposit_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  depositId: integer("deposit_id").notNull(),
  date: text("date").notNull(),
  entryType: text("entry_type").notNull(), // Deposit Received | Interest Accrued | Deduction | Replenishment
  description: text("description"),
  location: text("location"),
  deduction: real("deduction"),
  addition: real("addition"),
  runningBalance: real("running_balance"),
  receiptNotes: text("receipt_notes"),
});

export const insertDepositEntrySchema = createInsertSchema(depositEntries).omit({ id: true });
export type InsertDepositEntry = z.infer<typeof insertDepositEntrySchema>;
export type DepositEntry = typeof depositEntries.$inferSelect;

// Inspections
export const inspections = sqliteTable("inspections", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tenantId: integer("tenant_id").notNull(),
  propertyId: integer("property_id").notNull(),
  type: text("type").notNull(), // move_in | move_out
  inspectionDate: text("inspection_date").notNull(),
  inspectorName: text("inspector_name"),
  notes: text("notes"),
  totalEstimatedCost: real("total_estimated_cost").default(0),
  importedFrom: text("imported_from"), // "rentcheck" | null
  rawImportData: text("raw_import_data"), // JSON of parsed RentCheck data
});

export const insertInspectionSchema = createInsertSchema(inspections).omit({ id: true });
export type InsertInspection = z.infer<typeof insertInspectionSchema>;
export type Inspection = typeof inspections.$inferSelect;

// Inspection Items (per room/area)
export const inspectionItems = sqliteTable("inspection_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  inspectionId: integer("inspection_id").notNull(),
  area: text("area").notNull(), // e.g. "Kitchen", "Bathroom 1"
  item: text("item").notNull(), // e.g. "Walls / Cabinets"
  condition: text("condition"), // E | G | F | P | N/A
  notes: text("notes"),
  hasDamage: integer("has_damage").default(0), // 0/1 boolean
  estimatedRepairCost: real("estimated_repair_cost").default(0),
  photoNotes: text("photo_notes"),
});

export const insertInspectionItemSchema = createInsertSchema(inspectionItems).omit({ id: true });
export type InsertInspectionItem = z.infer<typeof insertInspectionItemSchema>;
export type InspectionItem = typeof inspectionItems.$inferSelect;

// Maintenance Requests (Tenant Portal)
export const maintenanceRequests = sqliteTable("maintenance_requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tenantId: integer("tenant_id").notNull(),
  propertyId: integer("property_id").notNull(),
  submittedAt: text("submitted_at").notNull(),
  category: text("category").notNull(), // Plumbing | HVAC | Electrical | Appliance | Pest | General | Other
  urgency: text("urgency").notNull(), // Emergency | High | Normal | Low
  title: text("title").notNull(),
  description: text("description").notNull(),
  location: text("location"), // room/area
  status: text("status").notNull().default("open"), // open | in_progress | resolved | closed
  landlordNotes: text("landlord_notes"),
  resolvedAt: text("resolved_at"),
  // ── Phase 2: Resolution & Contract Reference ──────────────────────────────
  completionCost: real("completion_cost"),           // actual cost of repair
  contractState: text("contract_state"),              // TX | NJ
  contractPage: text("contract_page"),                // e.g. "7"
  contractSection: text("contract_section"),          // e.g. "8.3"
  contractSubsection: text("contract_subsection"),    // e.g. "(a)"
  contractRelevantText: text("contract_relevant_text"), // excerpt from lease
  depositDecision: text("deposit_decision"),          // Tenant | Landlord | Pending | NA
  depositAmount: real("deposit_amount"),              // amount charged to deposit (if Tenant)
  qboCategory: text("qbo_category"),                  // QBO expense account/category
  qboExpenseId: text("qbo_expense_id"),               // QBO expense record ID (after sync)
  resolutionNotes: text("resolution_notes"),          // landlord's final notes
});

export const insertMaintenanceRequestSchema = createInsertSchema(maintenanceRequests).omit({ id: true });
export type InsertMaintenanceRequest = z.infer<typeof insertMaintenanceRequestSchema>;
export type MaintenanceRequest = typeof maintenanceRequests.$inferSelect;

// QBO expense categories for maintenance
export const QBO_EXPENSE_CATEGORIES = [
  "Repairs & Maintenance",
  "Plumbing",
  "HVAC",
  "Electrical",
  "Pest Control",
  "Landscaping",
  "Appliances",
  "General Maintenance",
  "Cleaning",
  "Capital Improvements",
  "Insurance Claim",
  "Other",
] as const;

export type QboCategory = typeof QBO_EXPENSE_CATEGORIES[number];

export const DEPOSIT_DECISIONS = ["Tenant", "Landlord", "Pending", "NA"] as const;
export type DepositDecision = typeof DEPOSIT_DECISIONS[number];

// Maintenance Photos
export const maintenancePhotos = sqliteTable("maintenance_photos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  maintenanceRequestId: integer("maintenance_request_id").notNull(),
  filename: text("filename").notNull(),      // stored filename on disk
  originalName: text("original_name"),       // original filename from device
  uploadedAt: text("uploaded_at").notNull(),
  caption: text("caption"),
});

export const insertMaintenancePhotoSchema = createInsertSchema(maintenancePhotos).omit({ id: true });
export type InsertMaintenancePhoto = z.infer<typeof insertMaintenancePhotoSchema>;
export type MaintenancePhoto = typeof maintenancePhotos.$inferSelect;
