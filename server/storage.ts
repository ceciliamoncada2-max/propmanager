import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, and, desc } from "drizzle-orm";
import {
  properties, tenants, deposits, depositEntries,
  inspections, inspectionItems, maintenanceRequests, maintenancePhotos,
  type Property, type InsertProperty,
  type Tenant, type InsertTenant,
  type Deposit, type InsertDeposit,
  type DepositEntry, type InsertDepositEntry,
  type Inspection, type InsertInspection,
  type InspectionItem, type InsertInspectionItem,
  type MaintenanceRequest, type InsertMaintenanceRequest,
  type MaintenancePhoto, type InsertMaintenancePhoto,
} from "@shared/schema";

const sqlite = new Database("propmanager.db");
const db = drizzle(sqlite);

// Run migrations inline
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS properties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    zip TEXT NOT NULL,
    unit_count INTEGER DEFAULT 1,
    notes TEXT
  );
  CREATE TABLE IF NOT EXISTS tenants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    property_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    unit_number TEXT,
    lease_start TEXT,
    lease_end TEXT,
    move_out_date TEXT,
    forwarding_address TEXT,
    portal_code TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active'
  );
  CREATE TABLE IF NOT EXISTS deposits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    property_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    date_received TEXT NOT NULL,
    bank_name TEXT,
    interest_rate REAL DEFAULT 0.01,
    state TEXT NOT NULL,
    status TEXT DEFAULT 'held'
  );
  CREATE TABLE IF NOT EXISTS deposit_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    deposit_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    entry_type TEXT NOT NULL,
    description TEXT,
    location TEXT,
    deduction REAL,
    addition REAL,
    running_balance REAL,
    receipt_notes TEXT
  );
  CREATE TABLE IF NOT EXISTS inspections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    property_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    inspection_date TEXT NOT NULL,
    inspector_name TEXT,
    notes TEXT,
    total_estimated_cost REAL DEFAULT 0,
    imported_from TEXT,
    raw_import_data TEXT
  );
  CREATE TABLE IF NOT EXISTS inspection_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    inspection_id INTEGER NOT NULL,
    area TEXT NOT NULL,
    item TEXT NOT NULL,
    condition TEXT,
    notes TEXT,
    has_damage INTEGER DEFAULT 0,
    estimated_repair_cost REAL DEFAULT 0,
    photo_notes TEXT
  );
  CREATE TABLE IF NOT EXISTS maintenance_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    property_id INTEGER NOT NULL,
    submitted_at TEXT NOT NULL,
    category TEXT NOT NULL,
    urgency TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    location TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    landlord_notes TEXT,
    resolved_at TEXT
  );
`);

// Photos table
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS maintenance_photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    maintenance_request_id INTEGER NOT NULL,
    filename TEXT NOT NULL,
    original_name TEXT,
    uploaded_at TEXT NOT NULL,
    caption TEXT
  );
`);

// Phase 2 migrations — add new resolution columns if not already present
const existingCols = sqlite.prepare(`PRAGMA table_info(maintenance_requests)`).all() as { name: string }[];
const existingColNames = existingCols.map(c => c.name);
const phase2Cols: [string, string][] = [
  ["completion_cost", "REAL"],
  ["contract_state", "TEXT"],
  ["contract_page", "TEXT"],
  ["contract_section", "TEXT"],
  ["contract_subsection", "TEXT"],
  ["contract_relevant_text", "TEXT"],
  ["deposit_decision", "TEXT"],
  ["deposit_amount", "REAL"],
  ["qbo_category", "TEXT"],
  ["qbo_expense_id", "TEXT"],
  ["resolution_notes", "TEXT"],
];
for (const [col, type] of phase2Cols) {
  if (!existingColNames.includes(col)) {
    sqlite.exec(`ALTER TABLE maintenance_requests ADD COLUMN ${col} ${type}`);
  }
}

export interface IStorage {
  // Properties
  getProperties(): Property[];
  getProperty(id: number): Property | undefined;
  createProperty(data: InsertProperty): Property;
  updateProperty(id: number, data: Partial<InsertProperty>): Property | undefined;
  deleteProperty(id: number): void;

  // Tenants
  getTenants(propertyId?: number): Tenant[];
  getTenant(id: number): Tenant | undefined;
  getTenantByPortalCode(code: string): Tenant | undefined;
  createTenant(data: InsertTenant): Tenant;
  updateTenant(id: number, data: Partial<InsertTenant>): Tenant | undefined;

  // Deposits
  getDeposits(tenantId?: number): Deposit[];
  getDeposit(id: number): Deposit | undefined;
  getDepositByTenant(tenantId: number): Deposit | undefined;
  createDeposit(data: InsertDeposit): Deposit;
  updateDeposit(id: number, data: Partial<InsertDeposit>): Deposit | undefined;

  // Deposit Entries
  getDepositEntries(depositId: number): DepositEntry[];
  createDepositEntry(data: InsertDepositEntry): DepositEntry;
  updateDepositEntry(id: number, data: Partial<InsertDepositEntry>): DepositEntry | undefined;
  deleteDepositEntry(id: number): void;

  // Inspections
  getInspections(propertyId?: number, tenantId?: number): Inspection[];
  getInspection(id: number): Inspection | undefined;
  createInspection(data: InsertInspection): Inspection;
  updateInspection(id: number, data: Partial<InsertInspection>): Inspection | undefined;

  // Inspection Items
  getInspectionItems(inspectionId: number): InspectionItem[];
  createInspectionItem(data: InsertInspectionItem): InspectionItem;
  updateInspectionItem(id: number, data: Partial<InsertInspectionItem>): InspectionItem | undefined;
  deleteInspectionItem(id: number): void;
  bulkCreateInspectionItems(items: InsertInspectionItem[]): InspectionItem[];

  // Maintenance Requests
  getMaintenanceRequests(propertyId?: number, tenantId?: number): MaintenanceRequest[];
  getMaintenanceRequest(id: number): MaintenanceRequest | undefined;
  createMaintenanceRequest(data: InsertMaintenanceRequest): MaintenanceRequest;
  updateMaintenanceRequest(id: number, data: Partial<InsertMaintenanceRequest>): MaintenanceRequest | undefined;

  // Maintenance Photos
  getMaintenancePhotos(maintenanceRequestId: number): MaintenancePhoto[];
  createMaintenancePhoto(data: InsertMaintenancePhoto): MaintenancePhoto;
  deleteMaintenancePhoto(id: number): void;
}

export class SqliteStorage implements IStorage {
  getProperties(): Property[] {
    return db.select().from(properties).all();
  }
  getProperty(id: number): Property | undefined {
    return db.select().from(properties).where(eq(properties.id, id)).get();
  }
  createProperty(data: InsertProperty): Property {
    return db.insert(properties).values(data).returning().get();
  }
  updateProperty(id: number, data: Partial<InsertProperty>): Property | undefined {
    return db.update(properties).set(data).where(eq(properties.id, id)).returning().get();
  }
  deleteProperty(id: number): void {
    db.delete(properties).where(eq(properties.id, id)).run();
  }

  getTenants(propertyId?: number): Tenant[] {
    if (propertyId) {
      return db.select().from(tenants).where(eq(tenants.propertyId, propertyId)).all();
    }
    return db.select().from(tenants).all();
  }
  getTenant(id: number): Tenant | undefined {
    return db.select().from(tenants).where(eq(tenants.id, id)).get();
  }
  getTenantByPortalCode(code: string): Tenant | undefined {
    return db.select().from(tenants).where(eq(tenants.portalCode, code)).get();
  }
  createTenant(data: InsertTenant): Tenant {
    return db.insert(tenants).values(data).returning().get();
  }
  updateTenant(id: number, data: Partial<InsertTenant>): Tenant | undefined {
    return db.update(tenants).set(data).where(eq(tenants.id, id)).returning().get();
  }

  getDeposits(tenantId?: number): Deposit[] {
    if (tenantId) {
      return db.select().from(deposits).where(eq(deposits.tenantId, tenantId)).all();
    }
    return db.select().from(deposits).all();
  }
  getDeposit(id: number): Deposit | undefined {
    return db.select().from(deposits).where(eq(deposits.id, id)).get();
  }
  getDepositByTenant(tenantId: number): Deposit | undefined {
    return db.select().from(deposits).where(eq(deposits.tenantId, tenantId)).get();
  }
  createDeposit(data: InsertDeposit): Deposit {
    return db.insert(deposits).values(data).returning().get();
  }
  updateDeposit(id: number, data: Partial<InsertDeposit>): Deposit | undefined {
    return db.update(deposits).set(data).where(eq(deposits.id, id)).returning().get();
  }

  getDepositEntries(depositId: number): DepositEntry[] {
    return db.select().from(depositEntries).where(eq(depositEntries.depositId, depositId)).all();
  }
  createDepositEntry(data: InsertDepositEntry): DepositEntry {
    return db.insert(depositEntries).values(data).returning().get();
  }
  updateDepositEntry(id: number, data: Partial<InsertDepositEntry>): DepositEntry | undefined {
    return db.update(depositEntries).set(data).where(eq(depositEntries.id, id)).returning().get();
  }
  deleteDepositEntry(id: number): void {
    db.delete(depositEntries).where(eq(depositEntries.id, id)).run();
  }

  getInspections(propertyId?: number, tenantId?: number): Inspection[] {
    if (propertyId && tenantId) {
      return db.select().from(inspections).where(and(eq(inspections.propertyId, propertyId), eq(inspections.tenantId, tenantId))).all();
    }
    if (propertyId) return db.select().from(inspections).where(eq(inspections.propertyId, propertyId)).all();
    if (tenantId) return db.select().from(inspections).where(eq(inspections.tenantId, tenantId)).all();
    return db.select().from(inspections).all();
  }
  getInspection(id: number): Inspection | undefined {
    return db.select().from(inspections).where(eq(inspections.id, id)).get();
  }
  createInspection(data: InsertInspection): Inspection {
    return db.insert(inspections).values(data).returning().get();
  }
  updateInspection(id: number, data: Partial<InsertInspection>): Inspection | undefined {
    return db.update(inspections).set(data).where(eq(inspections.id, id)).returning().get();
  }

  getInspectionItems(inspectionId: number): InspectionItem[] {
    return db.select().from(inspectionItems).where(eq(inspectionItems.inspectionId, inspectionId)).all();
  }
  createInspectionItem(data: InsertInspectionItem): InspectionItem {
    return db.insert(inspectionItems).values(data).returning().get();
  }
  updateInspectionItem(id: number, data: Partial<InsertInspectionItem>): InspectionItem | undefined {
    return db.update(inspectionItems).set(data).where(eq(inspectionItems.id, id)).returning().get();
  }
  deleteInspectionItem(id: number): void {
    db.delete(inspectionItems).where(eq(inspectionItems.id, id)).run();
  }
  bulkCreateInspectionItems(items: InsertInspectionItem[]): InspectionItem[] {
    return items.map(item => db.insert(inspectionItems).values(item).returning().get());
  }

  getMaintenanceRequests(propertyId?: number, tenantId?: number): MaintenanceRequest[] {
    if (propertyId && tenantId) {
      return db.select().from(maintenanceRequests).where(and(eq(maintenanceRequests.propertyId, propertyId), eq(maintenanceRequests.tenantId, tenantId))).orderBy(desc(maintenanceRequests.submittedAt)).all();
    }
    if (propertyId) return db.select().from(maintenanceRequests).where(eq(maintenanceRequests.propertyId, propertyId)).orderBy(desc(maintenanceRequests.submittedAt)).all();
    if (tenantId) return db.select().from(maintenanceRequests).where(eq(maintenanceRequests.tenantId, tenantId)).orderBy(desc(maintenanceRequests.submittedAt)).all();
    return db.select().from(maintenanceRequests).orderBy(desc(maintenanceRequests.submittedAt)).all();
  }
  getMaintenanceRequest(id: number): MaintenanceRequest | undefined {
    return db.select().from(maintenanceRequests).where(eq(maintenanceRequests.id, id)).get();
  }
  createMaintenanceRequest(data: InsertMaintenanceRequest): MaintenanceRequest {
    return db.insert(maintenanceRequests).values(data).returning().get();
  }
  updateMaintenanceRequest(id: number, data: Partial<InsertMaintenanceRequest>): MaintenanceRequest | undefined {
    return db.update(maintenanceRequests).set(data).where(eq(maintenanceRequests.id, id)).returning().get();
  }

  getMaintenancePhotos(maintenanceRequestId: number): MaintenancePhoto[] {
    return db.select().from(maintenancePhotos).where(eq(maintenancePhotos.maintenanceRequestId, maintenanceRequestId)).all();
  }
  createMaintenancePhoto(data: InsertMaintenancePhoto): MaintenancePhoto {
    return db.insert(maintenancePhotos).values(data).returning().get();
  }
  deleteMaintenancePhoto(id: number): void {
    db.delete(maintenancePhotos).where(eq(maintenancePhotos.id, id)).run();
  }
}

export const storage = new SqliteStorage();
