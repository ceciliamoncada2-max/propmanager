import { Pool } from "pg";
import {
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

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS properties (
      id SERIAL PRIMARY KEY, address TEXT NOT NULL, city TEXT NOT NULL,
      state TEXT NOT NULL, zip TEXT NOT NULL, unit_count INTEGER DEFAULT 1, notes TEXT
    );
    CREATE TABLE IF NOT EXISTS tenants (
      id SERIAL PRIMARY KEY, property_id INTEGER NOT NULL, name TEXT NOT NULL,
      email TEXT, phone TEXT, unit_number TEXT, lease_start TEXT, lease_end TEXT,
      move_out_date TEXT, forwarding_address TEXT, portal_code TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active'
    );
    CREATE TABLE IF NOT EXISTS deposits (
      id SERIAL PRIMARY KEY, tenant_id INTEGER NOT NULL, property_id INTEGER NOT NULL,
      amount REAL NOT NULL, date_received TEXT NOT NULL, bank_name TEXT,
      interest_rate REAL DEFAULT 0.01, state TEXT NOT NULL, status TEXT DEFAULT 'held'
    );
    CREATE TABLE IF NOT EXISTS deposit_entries (
      id SERIAL PRIMARY KEY, deposit_id INTEGER NOT NULL, date TEXT NOT NULL,
      entry_type TEXT NOT NULL, description TEXT, location TEXT,
      deduction REAL, addition REAL, running_balance REAL, receipt_notes TEXT
    );
    CREATE TABLE IF NOT EXISTS inspections (
      id SERIAL PRIMARY KEY, tenant_id INTEGER NOT NULL, property_id INTEGER NOT NULL,
      type TEXT NOT NULL, inspection_date TEXT NOT NULL, inspector_name TEXT, notes TEXT,
      total_estimated_cost REAL DEFAULT 0, imported_from TEXT, raw_import_data TEXT
    );
    CREATE TABLE IF NOT EXISTS inspection_items (
      id SERIAL PRIMARY KEY, inspection_id INTEGER NOT NULL, area TEXT NOT NULL,
      item TEXT NOT NULL, condition TEXT, notes TEXT,
      has_damage INTEGER DEFAULT 0, estimated_repair_cost REAL DEFAULT 0, photo_notes TEXT
    );
    CREATE TABLE IF NOT EXISTS maintenance_requests (
      id SERIAL PRIMARY KEY, tenant_id INTEGER NOT NULL, property_id INTEGER NOT NULL,
      submitted_at TEXT NOT NULL, category TEXT NOT NULL, urgency TEXT NOT NULL,
      title TEXT NOT NULL, description TEXT NOT NULL, location TEXT,
      status TEXT NOT NULL DEFAULT 'open', landlord_notes TEXT, resolved_at TEXT,
      completion_cost REAL, contract_state TEXT, contract_page TEXT,
      contract_section TEXT, contract_subsection TEXT, contract_relevant_text TEXT,
      deposit_decision TEXT, deposit_amount REAL, qbo_category TEXT,
      qbo_expense_id TEXT, resolution_notes TEXT
    );
    CREATE TABLE IF NOT EXISTS maintenance_photos (
      id SERIAL PRIMARY KEY, maintenance_request_id INTEGER NOT NULL,
      filename TEXT NOT NULL, original_name TEXT, uploaded_at TEXT NOT NULL, caption TEXT
    );
  `);
}

initDb().catch(console.error);

// ── Mappers (snake_case DB → camelCase TS) ──────────────────────────────────
function mapProp(r: any): Property {
  return { id: r.id, address: r.address, city: r.city, state: r.state, zip: r.zip, unitCount: r.unit_count, notes: r.notes };
}
function mapTenant(r: any): Tenant {
  return { id: r.id, propertyId: r.property_id, name: r.name, email: r.email, phone: r.phone,
    unitNumber: r.unit_number, leaseStart: r.lease_start, leaseEnd: r.lease_end,
    moveOutDate: r.move_out_date, forwardingAddress: r.forwarding_address,
    portalCode: r.portal_code, status: r.status };
}
function mapDeposit(r: any): Deposit {
  return { id: r.id, tenantId: r.tenant_id, propertyId: r.property_id, amount: r.amount,
    dateReceived: r.date_received, bankName: r.bank_name, interestRate: r.interest_rate,
    state: r.state, status: r.status };
}
function mapEntry(r: any): DepositEntry {
  return { id: r.id, depositId: r.deposit_id, date: r.date, entryType: r.entry_type,
    description: r.description, location: r.location, deduction: r.deduction,
    addition: r.addition, runningBalance: r.running_balance, receiptNotes: r.receipt_notes };
}
function mapInspection(r: any): Inspection {
  return { id: r.id, tenantId: r.tenant_id, propertyId: r.property_id, type: r.type,
    inspectionDate: r.inspection_date, inspectorName: r.inspector_name, notes: r.notes,
    totalEstimatedCost: r.total_estimated_cost, importedFrom: r.imported_from,
    rawImportData: r.raw_import_data };
}
function mapItem(r: any): InspectionItem {
  return { id: r.id, inspectionId: r.inspection_id, area: r.area, item: r.item,
    condition: r.condition, notes: r.notes, hasDamage: r.has_damage,
    estimatedRepairCost: r.estimated_repair_cost, photoNotes: r.photo_notes };
}
function mapMaint(r: any): MaintenanceRequest {
  return { id: r.id, tenantId: r.tenant_id, propertyId: r.property_id,
    submittedAt: r.submitted_at, category: r.category, urgency: r.urgency,
    title: r.title, description: r.description, location: r.location, status: r.status,
    landlordNotes: r.landlord_notes, resolvedAt: r.resolved_at,
    completionCost: r.completion_cost, contractState: r.contract_state,
    contractPage: r.contract_page, contractSection: r.contract_section,
    contractSubsection: r.contract_subsection, contractRelevantText: r.contract_relevant_text,
    depositDecision: r.deposit_decision, depositAmount: r.deposit_amount,
    qboCategory: r.qbo_category, qboExpenseId: r.qbo_expense_id,
    resolutionNotes: r.resolution_notes };
}
function mapPhoto(r: any): MaintenancePhoto {
  return { id: r.id, maintenanceRequestId: r.maintenance_request_id, filename: r.filename,
    originalName: r.original_name, uploadedAt: r.uploaded_at, caption: r.caption };
}

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
  // Properties
  async getProperties() { return (await pool.query(`SELECT * FROM properties ORDER BY id`)).rows.map(mapProp); }
  async getProperty(id: number) { const r = await pool.query(`SELECT * FROM properties WHERE id=$1`,[id]); return r.rows[0] ? mapProp(r.rows[0]) : undefined; }
  async createProperty(d: InsertProperty) { const r = await pool.query(`INSERT INTO properties (address,city,state,zip,unit_count,notes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,[d.address,d.city,d.state,d.zip,d.unitCount??1,d.notes??null]); return mapProp(r.rows[0]); }
  async updateProperty(id: number, d: Partial<InsertProperty>) { const r = await pool.query(`UPDATE properties SET address=COALESCE($1,address),city=COALESCE($2,city),state=COALESCE($3,state),zip=COALESCE($4,zip),unit_count=COALESCE($5,unit_count),notes=COALESCE($6,notes) WHERE id=$7 RETURNING *`,[d.address,d.city,d.state,d.zip,d.unitCount,d.notes,id]); return r.rows[0] ? mapProp(r.rows[0]) : undefined; }
  async deleteProperty(id: number) { await pool.query(`DELETE FROM properties WHERE id=$1`,[id]); }

  // Tenants
  async getTenants(propertyId?: number) { const r = propertyId ? await pool.query(`SELECT * FROM tenants WHERE property_id=$1 ORDER BY id`,[propertyId]) : await pool.query(`SELECT * FROM tenants ORDER BY id`); return r.rows.map(mapTenant); }
  async getTenant(id: number) { const r = await pool.query(`SELECT * FROM tenants WHERE id=$1`,[id]); return r.rows[0] ? mapTenant(r.rows[0]) : undefined; }
  async getTenantByPortalCode(code: string) { const r = await pool.query(`SELECT * FROM tenants WHERE portal_code=$1`,[code]); return r.rows[0] ? mapTenant(r.rows[0]) : undefined; }
  async createTenant(d: InsertTenant) { const r = await pool.query(`INSERT INTO tenants (property_id,name,email,phone,unit_number,lease_start,lease_end,move_out_date,forwarding_address,portal_code,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,[d.propertyId,d.name,d.email??null,d.phone??null,d.unitNumber??null,d.leaseStart??null,d.leaseEnd??null,d.moveOutDate??null,d.forwardingAddress??null,d.portalCode,d.status??'active']); return mapTenant(r.rows[0]); }
  async updateTenant(id: number, d: Partial<InsertTenant>) { const r = await pool.query(`UPDATE tenants SET property_id=COALESCE($1,property_id),name=COALESCE($2,name),email=COALESCE($3,email),phone=COALESCE($4,phone),unit_number=COALESCE($5,unit_number),lease_start=COALESCE($6,lease_start),lease_end=COALESCE($7,lease_end),move_out_date=COALESCE($8,move_out_date),forwarding_address=COALESCE($9,forwarding_address),portal_code=COALESCE($10,portal_code),status=COALESCE($11,status) WHERE id=$12 RETURNING *`,[d.propertyId,d.name,d.email,d.phone,d.unitNumber,d.leaseStart,d.leaseEnd,d.moveOutDate,d.forwardingAddress,d.portalCode,d.status,id]); return r.rows[0] ? mapTenant(r.rows[0]) : undefined; }

  // Deposits
  async getDeposits(tenantId?: number) { const r = tenantId ? await pool.query(`SELECT * FROM deposits WHERE tenant_id=$1`,[tenantId]) : await pool.query(`SELECT * FROM deposits`); return r.rows.map(mapDeposit); }
  async getDeposit(id: number) { const r = await pool.query(`SELECT * FROM deposits WHERE id=$1`,[id]); return r.rows[0] ? mapDeposit(r.rows[0]) : undefined; }
  async getDepositByTenant(tenantId: number) { const r = await pool.query(`SELECT * FROM deposits WHERE tenant_id=$1 LIMIT 1`,[tenantId]); return r.rows[0] ? mapDeposit(r.rows[0]) : undefined; }
  async createDeposit(d: InsertDeposit) { const r = await pool.query(`INSERT INTO deposits (tenant_id,property_id,amount,date_received,bank_name,interest_rate,state,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,[d.tenantId,d.propertyId,d.amount,d.dateReceived,d.bankName??null,d.interestRate??0.01,d.state,d.status??'held']); return mapDeposit(r.rows[0]); }
  async updateDeposit(id: number, d: Partial<InsertDeposit>) { const r = await pool.query(`UPDATE deposits SET amount=COALESCE($1,amount),bank_name=COALESCE($2,bank_name),status=COALESCE($3,status),interest_rate=COALESCE($4,interest_rate) WHERE id=$5 RETURNING *`,[d.amount,d.bankName,d.status,d.interestRate,id]); return r.rows[0] ? mapDeposit(r.rows[0]) : undefined; }

  // Deposit Entries
  async getDepositEntries(depositId: number) { const r = await pool.query(`SELECT * FROM deposit_entries WHERE deposit_id=$1 ORDER BY id`,[depositId]); return r.rows.map(mapEntry); }
  async createDepositEntry(d: InsertDepositEntry) { const r = await pool.query(`INSERT INTO deposit_entries (deposit_id,date,entry_type,description,location,deduction,addition,running_balance,receipt_notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,[d.depositId,d.date,d.entryType,d.description??null,d.location??null,d.deduction??null,d.addition??null,d.runningBalance??null,d.receiptNotes??null]); return mapEntry(r.rows[0]); }
  async updateDepositEntry(id: number, d: Partial<InsertDepositEntry>) { const r = await pool.query(`UPDATE deposit_entries SET date=COALESCE($1,date),entry_type=COALESCE($2,entry_type),description=COALESCE($3,description),deduction=COALESCE($4,deduction),addition=COALESCE($5,addition),running_balance=COALESCE($6,running_balance),receipt_notes=COALESCE($7,receipt_notes) WHERE id=$8 RETURNING *`,[d.date,d.entryType,d.description,d.deduction,d.addition,d.runningBalance,d.receiptNotes,id]); return r.rows[0] ? mapEntry(r.rows[0]) : undefined; }
  async deleteDepositEntry(id: number) { await pool.query(`DELETE FROM deposit_entries WHERE id=$1`,[id]); }

  // Inspections
  async getInspections(propertyId?: number, tenantId?: number) {
    let q = `SELECT * FROM inspections`; const p: any[] = [];
    if (propertyId && tenantId) { q += ` WHERE property_id=$1 AND tenant_id=$2`; p.push(propertyId,tenantId); }
    else if (propertyId) { q += ` WHERE property_id=$1`; p.push(propertyId); }
    else if (tenantId) { q += ` WHERE tenant_id=$1`; p.push(tenantId); }
    const r = await pool.query(q + ` ORDER BY id DESC`, p); return r.rows.map(mapInspection);
  }
  async getInspection(id: number) { const r = await pool.query(`SELECT * FROM inspections WHERE id=$1`,[id]); return r.rows[0] ? mapInspection(r.rows[0]) : undefined; }
  async createInspection(d: InsertInspection) { const r = await pool.query(`INSERT INTO inspections (tenant_id,property_id,type,inspection_date,inspector_name,notes,total_estimated_cost,imported_from,raw_import_data) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,[d.tenantId,d.propertyId,d.type,d.inspectionDate,d.inspectorName??null,d.notes??null,d.totalEstimatedCost??0,d.importedFrom??null,d.rawImportData??null]); return mapInspection(r.rows[0]); }
  async updateInspection(id: number, d: Partial<InsertInspection>) { const r = await pool.query(`UPDATE inspections SET type=COALESCE($1,type),inspection_date=COALESCE($2,inspection_date),inspector_name=COALESCE($3,inspector_name),notes=COALESCE($4,notes),total_estimated_cost=COALESCE($5,total_estimated_cost),imported_from=COALESCE($6,imported_from) WHERE id=$7 RETURNING *`,[d.type,d.inspectionDate,d.inspectorName,d.notes,d.totalEstimatedCost,d.importedFrom,id]); return r.rows[0] ? mapInspection(r.rows[0]) : undefined; }

  // Inspection Items
  async getInspectionItems(inspectionId: number) { const r = await pool.query(`SELECT * FROM inspection_items WHERE inspection_id=$1 ORDER BY id`,[inspectionId]); return r.rows.map(mapItem); }
  async createInspectionItem(d: InsertInspectionItem) { const r = await pool.query(`INSERT INTO inspection_items (inspection_id,area,item,condition,notes,has_damage,estimated_repair_cost,photo_notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,[d.inspectionId,d.area,d.item,d.condition??null,d.notes??null,d.hasDamage??0,d.estimatedRepairCost??0,d.photoNotes??null]); return mapItem(r.rows[0]); }
  async updateInspectionItem(id: number, d: Partial<InsertInspectionItem>) { const r = await pool.query(`UPDATE inspection_items SET area=COALESCE($1,area),item=COALESCE($2,item),condition=COALESCE($3,condition),notes=COALESCE($4,notes),has_damage=COALESCE($5,has_damage),estimated_repair_cost=COALESCE($6,estimated_repair_cost),photo_notes=COALESCE($7,photo_notes) WHERE id=$8 RETURNING *`,[d.area,d.item,d.condition,d.notes,d.hasDamage,d.estimatedRepairCost,d.photoNotes,id]); return r.rows[0] ? mapItem(r.rows[0]) : undefined; }
  async deleteInspectionItem(id: number) { await pool.query(`DELETE FROM inspection_items WHERE id=$1`,[id]); }
  async bulkCreateInspectionItems(items: InsertInspectionItem[]) {
    if (!items.length) return [];
    return Promise.all(items.map(d => this.createInspectionItem(d)));
  }

  // Maintenance Requests
  async getMaintenanceRequests(propertyId?: number, tenantId?: number) {
    let q = `SELECT * FROM maintenance_requests`; const p: any[] = [];
    if (propertyId && tenantId) { q += ` WHERE property_id=$1 AND tenant_id=$2`; p.push(propertyId,tenantId); }
    else if (propertyId) { q += ` WHERE property_id=$1`; p.push(propertyId); }
    else if (tenantId) { q += ` WHERE tenant_id=$1`; p.push(tenantId); }
    const r = await pool.query(q + ` ORDER BY submitted_at DESC`, p); return r.rows.map(mapMaint);
  }
  async getMaintenanceRequest(id: number) { const r = await pool.query(`SELECT * FROM maintenance_requests WHERE id=$1`,[id]); return r.rows[0] ? mapMaint(r.rows[0]) : undefined; }
  async createMaintenanceRequest(d: InsertMaintenanceRequest) { const r = await pool.query(`INSERT INTO maintenance_requests (tenant_id,property_id,submitted_at,category,urgency,title,description,location,status,landlord_notes,resolved_at,completion_cost,contract_state,contract_page,contract_section,contract_subsection,contract_relevant_text,deposit_decision,deposit_amount,qbo_category,qbo_expense_id,resolution_notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22) RETURNING *`,[d.tenantId,d.propertyId,d.submittedAt,d.category,d.urgency,d.title,d.description,d.location??null,d.status??'open',d.landlordNotes??null,d.resolvedAt??null,d.completionCost??null,d.contractState??null,d.contractPage??null,d.contractSection??null,d.contractSubsection??null,d.contractRelevantText??null,d.depositDecision??null,d.depositAmount??null,d.qboCategory??null,d.qboExpenseId??null,d.resolutionNotes??null]); return mapMaint(r.rows[0]); }
  async updateMaintenanceRequest(id: number, d: Partial<InsertMaintenanceRequest>) { const r = await pool.query(`UPDATE maintenance_requests SET status=COALESCE($1,status),landlord_notes=COALESCE($2,landlord_notes),resolved_at=COALESCE($3,resolved_at),completion_cost=COALESCE($4,completion_cost),contract_state=COALESCE($5,contract_state),contract_page=COALESCE($6,contract_page),contract_section=COALESCE($7,contract_section),contract_subsection=COALESCE($8,contract_subsection),contract_relevant_text=COALESCE($9,contract_relevant_text),deposit_decision=COALESCE($10,deposit_decision),deposit_amount=COALESCE($11,deposit_amount),qbo_category=COALESCE($12,qbo_category),qbo_expense_id=COALESCE($13,qbo_expense_id),resolution_notes=COALESCE($14,resolution_notes),urgency=COALESCE($15,urgency),title=COALESCE($16,title),description=COALESCE($17,description),location=COALESCE($18,location),category=COALESCE($19,category) WHERE id=$20 RETURNING *`,[d.status,d.landlordNotes,d.resolvedAt,d.completionCost,d.contractState,d.contractPage,d.contractSection,d.contractSubsection,d.contractRelevantText,d.depositDecision,d.depositAmount,d.qboCategory,d.qboExpenseId,d.resolutionNotes,d.urgency,d.title,d.description,d.location,d.category,id]); return r.rows[0] ? mapMaint(r.rows[0]) : undefined; }

  // Maintenance Photos
  async getMaintenancePhotos(maintenanceRequestId: number) { const r = await pool.query(`SELECT * FROM maintenance_photos WHERE maintenance_request_id=$1 ORDER BY id`,[maintenanceRequestId]); return r.rows.map(mapPhoto); }
  async createMaintenancePhoto(d: InsertMaintenancePhoto) { const r = await pool.query(`INSERT INTO maintenance_photos (maintenance_request_id,filename,original_name,uploaded_at,caption) VALUES ($1,$2,$3,$4,$5) RETURNING *`,[d.maintenanceRequestId,d.filename,d.originalName??null,d.uploadedAt,d.caption??null]); return mapPhoto(r.rows[0]); }
  async deleteMaintenancePhoto(id: number) { await pool.query(`DELETE FROM maintenance_photos WHERE id=$1`,[id]); }
}

export const storage = new PgStorage();
