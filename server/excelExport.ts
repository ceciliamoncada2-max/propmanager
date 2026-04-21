import * as XLSX from "xlsx";
import type { Deposit, DepositEntry, Tenant, Property, Inspection, InspectionItem, MaintenanceRequest } from "@shared/schema";

export function generateDepositTrackerXlsx(
  tenant: Tenant,
  property: Property,
  deposit: Deposit,
  entries: DepositEntry[],
  inspection: Inspection | undefined,
  inspectionItems: InspectionItem[],
  maintenanceRequests: MaintenanceRequest[] = [],
  maintenancePhotos: Record<number, any[]> = {}
): Buffer {
  const wb = XLSX.utils.book_new();

  // ---- TAB 1: Deposit Ledger ----
  const ledgerData: any[][] = [
    ["SECURITY DEPOSIT RUNNING LEDGER"],
    [`Applies to: ${deposit.state === "NJ" ? "New Jersey (N.J.S.A. 46:8-19 et seq.)" : "Texas (Tex. Prop. Code §92.101+)"}`],
    [],
    ["TENANT & PROPERTY INFORMATION"],
    ["Tenant Name:", tenant.name],
    ["Property Address:", `${property.address}, ${property.city}, ${property.state} ${property.zip}`],
    ["State:", deposit.state],
    ["Lease Start Date:", tenant.leaseStart || ""],
    ["Move-Out Date:", tenant.moveOutDate || ""],
    ["Forwarding Address:", tenant.forwardingAddress || ""],
    [],
    ["INITIAL DEPOSIT SETUP"],
    ["Deposit Amount Received ($):", deposit.amount],
    ["Date Deposit Received:", deposit.dateReceived],
    ["Bank / Account Name:", deposit.bankName || ""],
    ["Interest Rate (APY %):", deposit.interestRate || 0],
    [],
    ["RUNNING BALANCE LEDGER"],
    ["Date", "Entry Type", "Description / Location", "Deduction (−)", "Addition (+)", "Running Balance", "Receipt / Notes"],
  ];

  entries.forEach(entry => {
    ledgerData.push([
      entry.date,
      entry.entryType,
      `${entry.description || ""}${entry.location ? " — " + entry.location : ""}`,
      entry.deduction || "",
      entry.addition || "",
      entry.runningBalance || "",
      entry.receiptNotes || "",
    ]);
  });

  // Calculate final balance
  const lastEntry = entries[entries.length - 1];
  const finalBalance = lastEntry?.runningBalance ?? deposit.amount;
  ledgerData.push([]);
  ledgerData.push(["CURRENT / FINAL DEPOSIT BALANCE:", "", "", "", "", finalBalance, ""]);

  const wsLedger = XLSX.utils.aoa_to_sheet(ledgerData);
  wsLedger["!cols"] = [{ wch: 25 }, { wch: 22 }, { wch: 35 }, { wch: 16 }, { wch: 14 }, { wch: 18 }, { wch: 25 }];
  XLSX.utils.book_append_sheet(wb, wsLedger, "Deposit Ledger");

  // ---- TAB 2: Annual Notice & Deductions ----
  const deductions = entries.filter(e => e.entryType === "Deduction");
  const totalDeductions = deductions.reduce((sum, e) => sum + (e.deduction || 0), 0);
  const interestEarned = entries.filter(e => e.entryType === "Interest Accrued").reduce((sum, e) => sum + (e.addition || 0), 0);

  const noticeData: any[][] = [
    ["SECURITY DEPOSIT ANNUAL NOTICE & ITEMIZED DEDUCTION STATEMENT"],
    [`State: ${deposit.state === "NJ" ? "New Jersey (N.J.S.A. 46:8-19 et seq.)" : "Texas (Tex. Prop. Code §92.101+)"}`],
    [],
    ["TENANT & PROPERTY INFORMATION"],
    ["To (Tenant Name):", tenant.name],
    ["Rental Address:", `${property.address}, ${property.city}, ${property.state} ${property.zip}`],
    ["Forwarding Address:", tenant.forwardingAddress || ""],
    ["Move-Out Date:", tenant.moveOutDate || ""],
    [],
    ["DEPOSIT ACCOUNT SUMMARY"],
    ["Security Deposit Received ($):", deposit.amount],
    ["Date Deposit Received:", deposit.dateReceived],
    ["Bank Name & Account Type:", deposit.bankName || ""],
    ["Interest Rate (APY):", deposit.interestRate || 0],
    ["Interest Earned This Period ($):", interestEarned],
    ["Total Deposit + Interest ($):", deposit.amount + interestEarned],
    ["Balance Before This Statement:", deposit.amount + interestEarned],
    [],
    ["ITEMIZED DEDUCTIONS — THIS NOTICE PERIOD"],
    ["#", "Item / Location", "Date of Expense", "Description of Damage or Expense", "Receipt/Doc", "Cost ($)"],
  ];

  deductions.forEach((entry, i) => {
    noticeData.push([
      i + 1,
      entry.location || "",
      entry.date,
      entry.description || "",
      entry.receiptNotes || "",
      entry.deduction || 0,
    ]);
  });

  noticeData.push([]);
  noticeData.push(["TOTAL DEDUCTIONS THIS PERIOD:", "", "", "", "", totalDeductions]);
  noticeData.push([]);
  noticeData.push(["FINAL DEPOSIT CALCULATION"]);
  noticeData.push(["Balance Before This Statement:", deposit.amount + interestEarned]);
  noticeData.push(["Less: Total Deductions This Period:", totalDeductions]);
  noticeData.push(["BALANCE / AMOUNT TO BE RETURNED TO TENANT:", (deposit.amount + interestEarned) - totalDeductions]);
  noticeData.push([]);
  noticeData.push(["SIGNATURES"]);
  noticeData.push(["Landlord/Agent Name:", ""]);
  noticeData.push(["Signature:", ""]);
  noticeData.push(["Date Sent:", ""]);

  const wsNotice = XLSX.utils.aoa_to_sheet(noticeData);
  wsNotice["!cols"] = [{ wch: 5 }, { wch: 28 }, { wch: 18 }, { wch: 40 }, { wch: 20 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, wsNotice, "Annual Notice & Deductions");

  // ---- TAB 3: Inspection Log ----
  const inspData: any[][] = [
    ["MOVE-IN / MOVE-OUT PROPERTY INSPECTION LOG"],
    [],
    ["PROPERTY & INSPECTION DETAILS"],
    ["Tenant Name:", tenant.name],
    ["Property Address:", `${property.address}, ${property.city}, ${property.state} ${property.zip}`],
    ["Inspection Date:", inspection?.inspectionDate || ""],
    ["Type:", inspection?.type === "move_in" ? "Move-In" : inspection?.type === "move_out" ? "Move-Out" : ""],
    ["Inspector:", inspection?.inspectorName || ""],
    [],
    ["CONDITION KEY: E=Excellent  G=Good  F=Fair  P=Poor  N/A=Not Applicable"],
    [],
    ["Area / Item", "Condition", "Notes / Photos", "Damage? (Y/N)", "Est. Repair Cost ($)"],
  ];

  if (inspectionItems.length > 0) {
    let currentArea = "";
    inspectionItems.forEach(item => {
      if (item.area !== currentArea) {
        currentArea = item.area;
        inspData.push([item.area.toUpperCase()]);
      }
      inspData.push([
        item.item,
        item.condition || "",
        item.notes || "",
        item.hasDamage ? "Y" : "N",
        item.estimatedRepairCost || 0,
      ]);
    });
  }

  const totalCost = inspectionItems.reduce((sum, i) => sum + (i.estimatedRepairCost || 0), 0);
  inspData.push([]);
  inspData.push(["TOTAL ESTIMATED REPAIR COSTS:", "", "", "", totalCost]);
  inspData.push([]);
  inspData.push(["SIGNATURES"]);
  inspData.push(["Landlord Signature:", "", "", "Date:", ""]);
  inspData.push(["Tenant Signature:", "", "", "Date:", ""]);

  const wsInsp = XLSX.utils.aoa_to_sheet(inspData);
  wsInsp["!cols"] = [{ wch: 35 }, { wch: 14 }, { wch: 35 }, { wch: 14 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsInsp, "Inspection Log");

  // ---- TAB 4: Instructions & Checklist ----
  const instrData: any[][] = [
    ["LANDLORD INSTRUCTIONS & COMPLIANCE CHECKLIST"],
    ["Reference guide for New Jersey and Texas security deposit compliance"],
    [],
    ["Task / Note", "Reference", "Done"],
    ["NEW JERSEY KEY DEADLINES"],
    ["Within 30 days of move-in: Notify tenant of bank name, address, account type.", "30 Days", ""],
    ["Every year (lease anniversary): Send annual notice by certified mail.", "Annual", ""],
    ["Within 30 days of move-out: Return deposit + interest OR send itemized deductions.", "30 Days", ""],
    ["Within 5 days (emergency): Fire/flood/condemnation — return deposit within 5 business days.", "5 Days", ""],
    ["Penalty if you miss deadline: Tenant can sue for DOUBLE + attorney's fees.", "N.J.S.A. 46:8-21.1", "⚠️"],
    [],
    ["TEXAS KEY DEADLINES"],
    ["No annual notice required. No interest required. No cap on deposit amount.", "TX", ""],
    ["Within 30 days of move-out: Return deposit OR send itemized deductions by certified mail.", "30 Days", ""],
    ["Penalty if you miss deadline: Tenant can sue for 3x + $100 + attorney's fees.", "Tex. §92.109", "⚠️"],
    [],
    ["DOCUMENTATION BEST PRACTICES"],
    ["Use the Inspection Log at every move-in and move-out. Both parties sign.", "Best Practice", ""],
    ["Take a timestamped video walkthrough at move-in. Upload immediately.", "Best Practice", ""],
    ["Send ALL notices by certified mail. Keep tracking receipt.", "Best Practice", ""],
    ["Get contractor invoices for ALL deductions.", "Best Practice", ""],
    ["Retain all records for a minimum of 5 years.", "5 Years", ""],
  ];

  const wsInstr = XLSX.utils.aoa_to_sheet(instrData);
  wsInstr["!cols"] = [{ wch: 65 }, { wch: 20 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, wsInstr, "Instructions & Checklist");

  // ---- TAB 5: Maintenance Resolution Log ----
  const resolved = maintenanceRequests.filter(
    r => r.status === "resolved" || r.status === "closed"
  );

  const maintData: any[][] = [
    ["MAINTENANCE REPAIR — CONTRACT RESOLUTION LOG"],
    [`Tenant: ${tenant.name} | Property: ${property.address}, ${property.city}, ${property.state} ${property.zip}`],
    [],
    [
      "#", "Title", "Category", "Location", "Urgency",
      "Submitted", "Resolved",
      "Parts / Materials ($)", "Labor ($)", "Total Cost ($)", "QBO Category",
      "Contract State", "Page", "Section", "Sub-Section",
      "Relevant Contract Text",
      "Deposit Decision", "Amount Charged to Deposit ($)",
      "Receipt / Invoice Evidence",
      "Resolution Notes"
    ],
  ];

  resolved.forEach((r: any, i) => {
    const parts = r.partsCost != null ? r.partsCost : "";
    const labor = r.laborCost != null ? r.laborCost : "";
    const total = r.completionCost != null ? r.completionCost : "";
    const photos = maintenancePhotos[r.id] || [];
    const receipts = photos
      .filter((p: any) => p.caption === "receipt")
      .map((p: any) => p.originalName || p.filename)
      .join(", ");
    maintData.push([
      i + 1,
      r.title,
      r.category,
      r.location || "",
      r.urgency,
      r.submittedAt ? r.submittedAt.split("T")[0] : "",
      r.resolvedAt ? r.resolvedAt.split("T")[0] : "",
      parts,
      labor,
      total,
      r.qboCategory || "",
      r.contractState || "",
      r.contractPage || "",
      r.contractSection || "",
      r.contractSubsection || "",
      r.contractRelevantText || "",
      r.depositDecision || "Pending",
      r.depositAmount != null ? r.depositAmount : "",
      receipts || "No receipts uploaded",
      r.resolutionNotes || "",
    ]);
  });

  if (resolved.length === 0) {
    maintData.push(["No resolved maintenance requests."]);
  } else {
    const totalCost = resolved.reduce((sum, r: any) => sum + (r.completionCost || 0), 0);
    const totalParts = resolved.reduce((sum, r: any) => sum + (r.partsCost || 0), 0);
    const totalLabor = resolved.reduce((sum, r: any) => sum + (r.laborCost || 0), 0);
    const tenantCharges = resolved
      .filter((r: any) => r.depositDecision === "Tenant")
      .reduce((sum, r: any) => sum + (r.depositAmount || 0), 0);
    const landlordCost = resolved
      .filter((r: any) => r.depositDecision === "Landlord")
      .reduce((sum, r: any) => sum + (r.completionCost || 0), 0);

    maintData.push([]);
    maintData.push(["SUMMARY"]);
    maintData.push(["Total Resolved Requests:", resolved.length]);
    maintData.push(["Total Parts / Materials ($):", "", "", "", "", "", "", totalParts]);
    maintData.push(["Total Labor ($):", "", "", "", "", "", "", "", totalLabor]);
    maintData.push(["Total Repair Costs ($):", "", "", "", "", "", "", "", "", totalCost]);
    maintData.push(["Tenant-Charged Deposit Deductions ($):", tenantCharges]);
    maintData.push(["Landlord-Absorbed Costs ($):", landlordCost]);
    maintData.push(["Pending Decisions:", resolved.filter((r: any) => !r.depositDecision || r.depositDecision === "Pending").length]);
  }

  const wsMaint = XLSX.utils.aoa_to_sheet(maintData);
  wsMaint["!cols"] = [
    { wch: 4 }, { wch: 28 }, { wch: 14 }, { wch: 16 }, { wch: 10 },
    { wch: 13 }, { wch: 13 },
    { wch: 20 }, { wch: 12 }, { wch: 14 }, { wch: 22 },
    { wch: 14 }, { wch: 8 }, { wch: 12 }, { wch: 14 },
    { wch: 50 },
    { wch: 18 }, { wch: 24 },
    { wch: 40 },
  ];
  XLSX.utils.book_append_sheet(wb, wsMaint, "Maintenance Resolution Log");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return buf;
}
