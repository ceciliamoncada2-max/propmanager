import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
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

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("railway") ? { rejectUnauthorized: false } : false,
});

const db = drizzle(pool);

// Create all tables on startup
async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS properties (
      id SERIAL PRIMARY KEY,
      address TEXT NOT NULL,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      zip TEXT NOT NULL,
      unit_count INTEGER DEFAULT 1,
      notes TEXT
    );
    CREATE TABLE IF NOT EXISTS tenants (
      id SERIAL PRIMARY KEY,
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
      id SERIAL PRIMARY KEY,
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
      id SERIAL PRIMARY KEY,
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
      id SERIAL PRIMARY KEY,
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
      id SERIAL PRIMARY KEY,
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
      id SERIAL PRIMARY KEY,
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
      resolved_at TEXT,
      completion_cost REAL,
      contract_state TEXT,
      contract_page TEXT,
      contract_section TEXT,
      contract_subsection TEXT,
      contract_relevant_text TEXT,
      deposit_decision TEXT,
      deposit_amount REAL,
      qbo_category TEXT,
      qbo_expense_id TEXT,
      resolution_notes TEXT
    );
    CREATE TABLE IF NOT EXISTS maintenance_photos (
      id SERIAL PRIMARY KEY,
      maintenance_request_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      original_name TEXT,
      uploaded_at TEXT NOT NULL,
      caption TEXT
    );
  `);
}

// Initialize on load
initDb().catch(console.error);

export interface IStorage {
  getProperties(): Promise<Property[]>;
  getProperty(id: number): Promise<Property | undefined>;
  createProperty(data: InsertProperty): Promise<Property>;
  updateProperty(id: number, data: Partial<InsertProperty>): Promise<Property | undefined>;
  deleteProperty(id: number): Promise<void>;

  getTenants(propertyId?: number): Promise<Tenant[]>;
  getTenant(id: number): Promise<Tenant | undefined>;
  getTenantByPortalCode(code: string): Promise<Tenant | undefined>;
  createTenant(data: InsertTenant): Promise<Tenant>;
  updateTenant(id: number, data: Partial<InsertTenant>): Promise<Tenant | undefined>;

  getDeposits(tenantId?: number): Promise<Deposit[]>;
  getDeposit(id: number): Promise<Deposit | undefined>;
  getDepositByTenant(tenantId: number): Promise<Deposit | undefined>;
  createDeposit(data: InsertDeposit): Promise<Deposit>;
  updateDeposit(id: number, data: Partial<InsertDeposit>): Promise<Deposit | undefined>;

  getDepositEntries(depositId: number): Promise<DepositEntry[]>;
  createDepositEntry(data: InsertDepositEntry): Promise<DepositEntry>;
  updateDepositEntry(id: number, data: Partial<InsertDepositEntry>): Promise<DepositEntry | undefined>;
  deleteDepositEntry(id: number): Promise<void>;

  getInspections(propertyId?: number, tenantId?: number): Promise<Inspection[]>;
  getInspection(id: number): Promise<Inspection | undefined>;
  createInspection(data: InsertInspection): Promise<Inspection>;
  updateInspection(id: number, data: Partial<InsertInspection>): Promise<Inspection | undefined>;

  getInspectionItems(inspectionId: number): Promise<InspectionItem[]>;
  createInspectionItem(data: InsertInspectionItem): Promise<InspectionItem>;
  updateInspectionItem(id: number, data: Partial<InsertInspectionItem>): Promise<InspectionItem | undefined>;
  deleteInspectionItem(id: number): Promise<void>;
  bulkCreateInspectionItems(items: InsertInspectionItem[]): Promise<InspectionItem[]>;

  getMaintenanceRequests(propertyId?: number, tenantId?: number): Promise<MaintenanceRequest[]>;
  getMaintenanceRequest(id: number): Promise<MaintenanceRequest | undefined>;
  createMaintenanceRequest(data: InsertMaintenanceRequest): Promise<MaintenanceRequest>;
  updateMaintenanceRequest(id: number, data: Partial<InsertMaintenanceRequest>): Promise<MaintenanceRequest | undefined>;

  getMaintenancePhotos(maintenanceRequestId: number): Promise<MaintenancePhoto[]>;
  createMaintenancePhoto(data: InsertMaintenancePhoto): Promise<MaintenancePhoto>;
  deleteMaintenancePhoto(id: number): Promise<void>;
}

export class PgStorage implements IStorage {
  async getProperties(): Promise<Property[]> {
    return db.select().from(properties);
  }
  async getProperty(id: number): Promise<Property | undefined> {
    return db.select().from(properties).where(eq(properties.id, id)).then(r => r[0]);
  }
  async createProperty(data: InsertProperty): Promise<Property> {
    return db.insert(properties).values(data).returning().then(r => r[0]);
  }
  async updateProperty(id: number, data: Partial<InsertProperty>): Promise<Property | undefined> {
    return db.update(properties).set(data).where(eq(properties.id, id)).returning().then(r => r[0]);
  }
  async deleteProperty(id: number): Promise<void> {
    await db.delete(properties).where(eq(properties.id, id));
  }

  async getTenants(propertyId?: number): Promise<Tenant[]> {
    if (propertyId) return db.select().from(tenants).where(eq(tenants.propertyId, propertyId));
    return db.select().from(tenants);
  }
  async getTenant(id: number): Promise<Tenant | undefined> {
    return db.select().from(tenants).where(eq(tenants.id, id)).then(r => r[0]);
  }
  async getTenantByPortalCode(code: string): Promise<Tenant | undefined> {
    return db.select().from(tenants).where(eq(tenants.portalCode, code)).then(r => r[0]);
  }
  async createTenant(data: InsertTenant): Promise<Tenant> {
    return db.insert(tenants).values(data).returning().then(r => r[0]);
  }
  async updateTenant(id: number, data: Partial<InsertTenant>): Promise<Tenant | undefined> {
    return db.update(tenants).set(data).where(eq(tenants.id, id)).returning().then(r => r[0]);
  }

  async getDeposits(tenantId?: number): Promise<Deposit[]> {
    if (tenantId) return db.select().from(deposits).where(eq(deposits.tenantId, tenantId));
    return db.select().from(deposits);
  }
  async getDeposit(id: number): Promise<Deposit | undefined> {
    return db.select().from(deposits).where(eq(deposits.id, id)).then(r => r[0]);
  }
  async getDepositByTenant(tenantId: number): Promise<Deposit | undefined> {
    return db.select().from(deposits).where(eq(deposits.tenantId, tenantId)).then(r => r[0]);
  }
  async createDeposit(data: InsertDeposit): Promise<Deposit> {
    return db.insert(deposits).values(data).returning().then(r => r[0]);
  }
  async updateDeposit(id: number, data: Partial<InsertDeposit>): Promise<Deposit | undefined> {
    return db.update(deposits).set(data).where(eq(deposits.id, id)).returning().then(r => r[0]);
  }

  async getDepositEntries(depositId: number): Promise<DepositEntry[]> {
    return db.select().from(depositEntries).where(eq(depositEntries.depositId, depositId));
  }
  async createDepositEntry(data: InsertDepositEntry): Promise<DepositEntry> {
    return db.insert(depositEntries).values(data).returning().then(r => r[0]);
  }
  async updateDepositEntry(id: number, data: Partial<InsertDepositEntry>): Promise<DepositEntry | undefined> {
    return db.update(depositEntries).set(data).where(eq(depositEntries.id, id)).returning().then(r => r[0]);
  }
  async deleteDepositEntry(id: number): Promise<void> {
    await db.delete(depositEntries).where(eq(depositEntries.id, id));
  }

  async getInspections(propertyId?: number, tenantId?: number): Promise<Inspection[]> {
    if (propertyId && tenantId) {
      return db.select().from(inspections).where(and(eq(inspections.propertyId, propertyId), eq(inspections.tenantId, tenantId)));
    }
    if (propertyId) return db.select().from(inspections).where(eq(inspections.propertyId, propertyId));
    if (tenantId) return db.select().from(inspections).where(eq(inspections.tenantId, tenantId));
    return db.select().from(inspections);
  }
  async getInspection(id: number): Promise<Inspection | undefined> {
    return db.select().from(inspections).where(eq(inspections.id, id)).then(r => r[0]);
  }
  async createInspection(data: InsertInspection): Promise<Inspection> {
    return db.insert(inspections).values(data).returning().then(r => r[0]);
  }
  async updateInspection(id: number, data: Partial<InsertInspection>): Promise<Inspection | undefined> {
    return db.update(inspections).set(data).where(eq(inspections.id, id)).returning().then(r => r[0]);
  }

  async getInspectionItems(inspectionId: number): Promise<InspectionItem[]> {
    return db.select().from(inspectionItems).where(eq(inspectionItems.inspectionId, inspectionId));
  }
  async createInspectionItem(data: InsertInspectionItem): Promise<InspectionItem> {
    return db.insert(inspectionItems).values(data).returning().then(r => r[0]);
  }
  async updateInspectionItem(id: number, data: Partial<InsertInspectionItem>): Promise<InspectionItem | undefined> {
    return db.update(inspectionItems).set(data).where(eq(inspectionItems.id, id)).returning().then(r => r[0]);
  }
  async deleteInspectionItem(id: number): Promise<void> {
    await db.delete(inspectionItems).where(eq(inspectionItems.id, id));
  }
  async bulkCreateInspectionItems(items: InsertInspectionItem[]): Promise<InspectionItem[]> {
    if (!items.length) return [];
    return db.insert(inspectionItems).values(items).returning();
  }

  async getMaintenanceRequests(propertyId?: number, tenantId?: number): Promise<MaintenanceRequest[]> {
    if (propertyId && tenantId) {
      return db.select().from(maintenanceRequests).where(and(eq(maintenanceRequests.propertyId, propertyId), eq(maintenanceRequests.tenantId, tenantId))).orderBy(desc(maintenanceRequests.submittedAt));
    }
    if (propertyId) return db.select().from(maintenanceRequests).where(eq(maintenanceRequests.propertyId, propertyId)).orderBy(desc(maintenanceRequests.submittedAt));
    if (tenantId) return db.select().from(maintenanceRequests).where(eq(maintenanceRequests.tenantId, tenantId)).orderBy(desc(maintenanceRequests.submittedAt));
    return db.select().from(maintenanceRequests).orderBy(desc(maintenanceRequests.submittedAt));
  }
  async getMaintenanceRequest(id: number): Promise<MaintenanceRequest | undefined> {
    return db.select().from(maintenanceRequests).where(eq(maintenanceRequests.id, id)).then(r => r[0]);
  }
  async createMaintenanceRequest(data: InsertMaintenanceRequest): Promise<MaintenanceRequest> {
    return db.insert(maintenanceRequests).values(data).returning().then(r => r[0]);
  }
  async updateMaintenanceRequest(id: number, data: Partial<InsertMaintenanceRequest>): Promise<MaintenanceRequest | undefined> {
    return db.update(maintenanceRequests).set(data).where(eq(maintenanceRequests.id, id)).returning().then(r => r[0]);
  }

  async getMaintenancePhotos(maintenanceRequestId: number): Promise<MaintenancePhoto[]> {
    return db.select().from(maintenancePhotos).where(eq(maintenancePhotos.maintenanceRequestId, maintenanceRequestId));
  }
  async createMaintenancePhoto(data: InsertMaintenancePhoto): Promise<MaintenancePhoto> {
    return db.insert(maintenancePhotos).values(data).returning().then(r => r[0]);
  }
  async deleteMaintenancePhoto(id: number): Promise<void> {
    await db.delete(maintenancePhotos).where(eq(maintenancePhotos.id, id));
  }
}

export const storage = new PgStorage();
