import { pgTable, text, integer, real, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Properties
export const properties = pgTable("properties", {
  id: serial("id").primaryKey(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  zip: text("zip").notNull(),
  unitCount: integer("unit_count").default(1),
  notes: text("notes"),
});

export const insertPropertySchema = createInsertSchema(properties).omit({ id: true });
export type InsertProperty = z.infer<typeof insertPropertySchema>;
export type Property = typeof properties.$inferSelect;

// Tenants
export const tenants = pgTable("tenants", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").notNull(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  unitNumber: text("unit_number"),
  leaseStart: text("lease_start"),
  leaseEnd: text("lease_end"),
  moveOutDate: text("move_out_date"),
  forwardingAddress: text("forwarding_address"),
  portalCode: text("portal_code").notNull(),
  status: text("status").notNull().default("active"),
});

export const insertTenantSchema = createInsertSchema(tenants).omit({ id: true });
export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type Tenant = typeof tenants.$inferSelect;

// Security Deposits
export const deposits = pgTable("deposits", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  propertyId: integer("property_id").notNull(),
  amount: real("amount").notNull(),
  dateReceived: text("date_received").notNull(),
  bankName: text("bank_name"),
  interestRate: real("interest_rate").default(0.01),
  state: text("state").notNull(),
  status: text("status").default("held"),
});

export const insertDepositSchema = createInsertSchema(deposits).omit({ id: true });
export type InsertDeposit = z.infer<typeof insertDepositSchema>;
export type Deposit = typeof deposits.$inferSelect;

// Deposit Ledger Entries
export const depositEntries = pgTable("deposit_entries", {
  id: serial("id").primaryKey(),
  depositId: integer("deposit_id").notNull(),
  date: text("date").notNull(),
  entryType: text("entry_type").notNull(),
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
export const inspections = pgTable("inspections", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  propertyId: integer("property_id").notNull(),
  type: text("type").notNull(),
  inspectionDate: text("inspection_date").notNull(),
  inspectorName: text("inspector_name"),
  notes: text("notes"),
  totalEstimatedCost: real("total_estimated_cost").default(0),
  importedFrom: text("imported_from"),
  rawImportData: text("raw_import_data"),
});

export const insertInspectionSchema = createInsertSchema(inspections).omit({ id: true });
export type InsertInspection = z.infer<typeof insertInspectionSchema>;
export type Inspection = typeof inspections.$inferSelect;

// Inspection Items
export const inspectionItems = pgTable("inspection_items", {
  id: serial("id").primaryKey(),
  inspectionId: integer("inspection_id").notNull(),
  area: text("area").notNull(),
  item: text("item").notNull(),
  condition: text("condition"),
  notes: text("notes"),
  hasDamage: integer("has_damage").default(0),
  estimatedRepairCost: real("estimated_repair_cost").default(0),
  photoNotes: text("photo_notes"),
});

export const insertInspectionItemSchema = createInsertSchema(inspectionItems).omit({ id: true });
export type InsertInspectionItem = z.infer<typeof insertInspectionItemSchema>;
export type InspectionItem = typeof inspectionItems.$inferSelect;

// Maintenance Requests
export const maintenanceRequests = pgTable("maintenance_requests", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  propertyId: integer("property_id").notNull(),
  submittedAt: text("submitted_at").notNull(),
  category: text("category").notNull(),
  urgency: text("urgency").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  location: text("location"),
  status: text("status").notNull().default("open"),
  landlordNotes: text("landlord_notes"),
  resolvedAt: text("resolved_at"),
  completionCost: real("completion_cost"),
  contractState: text("contract_state"),
  contractPage: text("contract_page"),
  contractSection: text("contract_section"),
  contractSubsection: text("contract_subsection"),
  contractRelevantText: text("contract_relevant_text"),
  depositDecision: text("deposit_decision"),
  depositAmount: real("deposit_amount"),
  qboCategory: text("qbo_category"),
  qboExpenseId: text("qbo_expense_id"),
  resolutionNotes: text("resolution_notes"),
});

export const insertMaintenanceRequestSchema = createInsertSchema(maintenanceRequests).omit({ id: true });
export type InsertMaintenanceRequest = z.infer<typeof insertMaintenanceRequestSchema>;
export type MaintenanceRequest = typeof maintenanceRequests.$inferSelect;

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
export const maintenancePhotos = pgTable("maintenance_photos", {
  id: serial("id").primaryKey(),
  maintenanceRequestId: integer("maintenance_request_id").notNull(),
  filename: text("filename").notNull(),
  originalName: text("original_name"),
  uploadedAt: text("uploaded_at").notNull(),
  caption: text("caption"),
});

export const insertMaintenancePhotoSchema = createInsertSchema(maintenancePhotos).omit({ id: true });
export type InsertMaintenancePhoto = z.infer<typeof insertMaintenancePhotoSchema>;
export type MaintenancePhoto = typeof maintenancePhotos.$inferSelect;
