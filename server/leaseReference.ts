/**
 * Texas Residential Lease (Revised 2026) — Structured Reference Map
 * Used to look up which contract section/page governs a given repair or condition.
 * Each entry maps a repair category or situation to the relevant contract clause.
 */

export interface LeaseClause {
  state: "TX" | "NJ" | "Both";
  section: string;          // e.g. "8.2"
  sectionTitle: string;     // e.g. "Tenant-Caused Damage"
  page: string;             // approximate page range in document
  relevantText: string;     // key sentence(s) from the clause
  responsibilityGuide: "Tenant" | "Landlord" | "Depends";
  keywords: string[];       // for search/match
}

export const TEXAS_LEASE_CLAUSES: LeaseClause[] = [
  // ─── SECTION 4: SECURITY DEPOSIT ───────────────────────────────────────────
  {
    state: "TX",
    section: "4.4",
    sectionTitle: "Lawful Deductions from Security Deposit",
    page: "4",
    relevantText: "Landlord may deduct from the deposit any damages and charges for which Tenant is legally liable under this Lease or as a result of breaching this Lease, but not for normal wear and tear.",
    responsibilityGuide: "Tenant",
    keywords: ["deduction", "deposit deduction", "security deposit", "normal wear and tear", "damage deduction", "repair charge"],
  },
  {
    state: "TX",
    section: "4.4(c)",
    sectionTitle: "Repair/Replacement — Damage Beyond Normal Wear",
    page: "4",
    relevantText: "Cost of labor and materials to repair or replace property damage beyond normal wear and tear caused by Tenant, Tenant's household, guests, invitees, pets, or assistance animals, including holes or gouges in walls; broken doors, locks, hardware; broken windows or torn screens; damaged blinds; damaged cabinets, countertops, fixtures, trim; damaged flooring or carpet (rips, burns, excessive stains, or pet urine damage); damaged or missing appliances; damage caused by improper use of plumbing, garbage disposals, or other systems.",
    responsibilityGuide: "Tenant",
    keywords: ["wall damage", "holes in wall", "broken door", "broken lock", "broken window", "torn screen", "damaged blind", "damaged cabinet", "damaged countertop", "damaged flooring", "carpet damage", "carpet stain", "pet damage", "urine damage", "appliance damage", "plumbing misuse", "disposal misuse"],
  },
  {
    state: "TX",
    section: "4.4(d)",
    sectionTitle: "Cleaning Costs",
    page: "4",
    relevantText: "Cleaning costs reasonably necessary to return the Property to the same level of cleanliness as at move-in, including removal of excessive grease, soap scum, mildew, trash, personal property, food spills, pet hair, and other excessive dirt or debris left by Tenant.",
    responsibilityGuide: "Tenant",
    keywords: ["cleaning", "dirty", "grease", "soap scum", "mildew", "trash left", "food spill", "pet hair", "excessive dirt", "move-out cleaning"],
  },
  {
    state: "TX",
    section: "4.4(e)",
    sectionTitle: "Pest Treatment — Tenant-Caused",
    page: "4",
    relevantText: "Pest treatment and related remediation when an infestation is attributable to Tenant's housekeeping, pets or assistance animals, trash handling, or failure to comply with the pest and cleanliness obligations in this Lease.",
    responsibilityGuide: "Tenant",
    keywords: ["pest treatment tenant", "roach infestation", "flea treatment", "rodent tenant", "pest from pet", "infestation housekeeping", "bug treatment"],
  },
  {
    state: "TX",
    section: "4.4(f)",
    sectionTitle: "Rekey / Access Devices",
    page: "4",
    relevantText: "Rekeying or replacement of locks, keys, garage remotes, mailbox keys, gate fobs, or other access devices that are lost, not returned, or damaged by Tenant.",
    responsibilityGuide: "Tenant",
    keywords: ["rekey", "lock replacement", "lost key", "garage remote", "mailbox key", "gate fob", "access device"],
  },
  {
    state: "TX",
    section: "4.4(g)",
    sectionTitle: "Lawn / Landscaping Failure",
    page: "4",
    relevantText: "Lawn, landscaping, and exterior remediation required because Tenant failed to maintain the yard, trees, or landscaping as required by this Lease, including costs to replace dead grass, plants, or trees caused by lack of watering or neglect.",
    responsibilityGuide: "Tenant",
    keywords: ["lawn damage", "dead grass", "landscaping damage", "tree neglect", "yard neglect", "plant death"],
  },
  {
    state: "TX",
    section: "4.4(h)",
    sectionTitle: "Unauthorized Alterations / Removal",
    page: "4–5",
    relevantText: "Costs to remove or reverse unauthorized alterations or installations, including repainting dark or non-approved colors, patching excessive or oversized wall anchors, removing unauthorized fixtures, shelves, satellite equipment, or flooring.",
    responsibilityGuide: "Tenant",
    keywords: ["unauthorized alteration", "unapproved paint", "wall anchor", "unauthorized fixture", "satellite dish", "unauthorized flooring"],
  },
  // ─── SECTION 8: TENANT REPAIR, CLEANING, AND MAINTENANCE DUTIES ─────────────
  {
    state: "TX",
    section: "8.1",
    sectionTitle: "General Tenant Maintenance Duties",
    page: "7",
    relevantText: "Tenant shall keep the Property reasonably clean, sanitary, orderly, and free from conditions that attract pests or create health or safety concerns. Tenant shall use all appliances, fixtures, and systems in a reasonable and proper manner. Promptly notify Landlord in writing of any condition requiring repair. Replace HVAC filters every 30 days.",
    responsibilityGuide: "Tenant",
    keywords: ["hvac filter", "filter replacement", "cleanliness", "sanitary", "proper use", "notify repair"],
  },
  {
    state: "TX",
    section: "8.2",
    sectionTitle: "Tenant-Caused Damage",
    page: "7",
    relevantText: "Tenant is responsible for the reasonable cost of repairs for any damage beyond normal wear and tear caused by Tenant, household members, guests, invitees, or anyone under Tenant's control. This includes damage caused by pets and assistance animals.",
    responsibilityGuide: "Tenant",
    keywords: ["tenant damage", "guest damage", "beyond normal wear", "repair cost tenant", "pet damage", "animal damage"],
  },
  {
    state: "TX",
    section: "8.3",
    sectionTitle: "Plumbing Misuse Prohibited",
    page: "7–8",
    relevantText: "Tenant shall not flush or place into any toilet, drain, or disposal any grease, oil, fats, bones, fibrous vegetables, coffee grounds, rice, pasta, eggshells, paper towels, wipes, diapers, hygiene products, cotton swabs, cat litter, hair, or any foreign object. If a clog or backup is caused by Tenant's misuse, Tenant shall be responsible for the cost of diagnosis, clearing the clog, repairs, and any resulting damage.",
    responsibilityGuide: "Depends",
    keywords: ["clog", "drain clog", "toilet clog", "plumbing backup", "sewage backup", "drain backup", "disposal clog", "grease drain", "wipes clog", "plumbing misuse", "blocked drain"],
  },
  {
    state: "TX",
    section: "8.4",
    sectionTitle: "Appliance Care & Timely Reporting",
    page: "8",
    relevantText: "Tenant shall operate appliances only per manufacturer's intended use, keep them reasonably clean, and report problems within 24 hours after discovering any leak, unusual noise, drainage issue, failure to operate, or visible damage. Failure to give timely written notice may make Tenant responsible for additional damage.",
    responsibilityGuide: "Depends",
    keywords: ["appliance", "refrigerator", "dishwasher", "range", "oven", "microwave", "washer", "dryer", "appliance leak", "appliance failure", "appliance noise", "late reporting", "timely notice"],
  },
  {
    state: "TX",
    section: "8.5",
    sectionTitle: "Glass, Screens, Doors, Locks, Keys",
    page: "8",
    relevantText: "Tenant is responsible for damage to glass, screens, doors, locks, garage remotes, and keys caused by Tenant or Tenant's guests, and for replacement of lost keys or devices.",
    responsibilityGuide: "Depends",
    keywords: ["broken glass", "broken screen", "screen door", "window screen", "broken window glass", "door damage", "lock damage", "lost remote"],
  },
  {
    state: "TX",
    section: "8.6",
    sectionTitle: "Rekey Charge",
    page: "8",
    relevantText: "If keys, garage remotes, gate remotes, mailbox keys, or access devices are not returned at move-out, or are lost during the term, Tenant shall pay a rekey/replacement charge of $150.00 or actual reasonable cost, whichever is greater.",
    responsibilityGuide: "Tenant",
    keywords: ["rekey charge", "$150", "lost key charge", "key not returned", "remote not returned"],
  },
  // ─── SECTION 9: LANDLORD REPAIR DUTIES ────────────────────────────────────
  {
    state: "TX",
    section: "9.1",
    sectionTitle: "Landlord's Duty to Repair (Health & Safety)",
    page: "8–9",
    relevantText: "Landlord shall make a diligent effort to repair or remedy conditions that materially affect the physical health or safety of an ordinary tenant after proper written notice and subject to applicable statutory conditions (Texas Property Code § 92.052). Nothing in this Lease waives Landlord's duties under non-waivable law.",
    responsibilityGuide: "Landlord",
    keywords: ["landlord repair", "health safety repair", "habitability", "material defect", "landlord duty", "statutory repair", "texas property code 92.052", "landlord responsible"],
  },
  {
    state: "TX",
    section: "9.2",
    sectionTitle: "Written Repair Request Required",
    page: "9",
    relevantText: "All repair requests must be submitted in writing and delivered to Landlord using the contact information in Section 20. Verbal requests, text messages not acknowledged in writing by Landlord, or communications directed to maintenance contractors do not constitute a valid repair request under Texas Property Code § 92.052.",
    responsibilityGuide: "Landlord",
    keywords: ["written repair request", "repair request procedure", "notice to repair", "written notice"],
  },
  {
    state: "TX",
    section: "9.4",
    sectionTitle: "Emergency Repairs",
    page: "9",
    relevantText: "Emergencies include active fire, major water leak, sewage backup, gas odor, total loss of essential electrical service, dangerous sparking, loss of heat when legally required, or another condition posing immediate danger. Tenant shall use reasonable efforts to mitigate damage and notify Landlord immediately.",
    responsibilityGuide: "Landlord",
    keywords: ["emergency repair", "major leak", "sewage emergency", "gas leak", "electrical emergency", "loss of heat", "no power", "fire damage", "water emergency"],
  },
  // ─── SECTION 13: YARD AND TREES ────────────────────────────────────────────
  {
    state: "TX",
    section: "13.1–13.2",
    sectionTitle: "Tenant's Lawn & Exterior Maintenance Duty",
    page: "11",
    relevantText: "Unless Landlord agrees in writing to provide lawn service, Tenant shall maintain all lawns, landscaped areas, beds, shrubs, trees, leaves, and exterior areas in a neat, healthy, code-compliant condition. Tenant shall edge and trim along sidewalks, curbs, fences, driveways, HVAC pads. Maintain drainage so water does not pond due to Tenant's neglect.",
    responsibilityGuide: "Tenant",
    keywords: ["lawn maintenance", "grass cutting", "mowing", "edging", "landscaping", "exterior maintenance", "yard maintenance", "shrub trimming", "drainage neglect"],
  },
  {
    state: "TX",
    section: "13.4",
    sectionTitle: "Trees and HVAC Clearance",
    page: "11–12",
    relevantText: "Tenant shall keep all branches, shrubs, vines, and other vegetation trimmed back from the house, roof, gutters, fences, and HVAC equipment, so that limbs do not touch or rub on the structure. Keep vegetation from touching or blocking AC condensers, gas or electric meters, electrical panels. If Tenant fails to maintain vegetation and trees or shrubs die or limbs damage the structure, HVAC, roof, or fencing, Tenant will be responsible for the reasonable cost of repair or replacement.",
    responsibilityGuide: "Tenant",
    keywords: ["tree trimming", "branch on roof", "vegetation hvac", "overgrown tree", "limb damage", "shrub overgrowth", "tree damage roof", "branch on ac unit"],
  },
  {
    state: "TX",
    section: "13.5",
    sectionTitle: "Landlord May Cure Yard Failure and Charge Tenant",
    page: "12",
    relevantText: "If Tenant fails to maintain the yard after written notice and reasonable opportunity to cure, Landlord may perform or contract the work and charge Tenant as additional rent.",
    responsibilityGuide: "Tenant",
    keywords: ["landlord charges yard work", "yard cure", "lawn charge", "additional rent yard"],
  },
  // ─── SECTION 14: PEST CONTROL ──────────────────────────────────────────────
  {
    state: "TX",
    section: "14.10",
    sectionTitle: "Pest Responsibility Allocation",
    page: "13",
    relevantText: "Tenant responsibility: routine prevention; minor interior infestations arising from housekeeping, trash accumulation, food residue, pet activity, standing water, misuse of plumbing or appliances, or failure to report promptly. Landlord responsibility: structural conditions, entry-point repairs, and other conditions for which Landlord has a legal duty under applicable law, including conditions materially affecting health or safety after proper notice.",
    responsibilityGuide: "Depends",
    keywords: ["pest responsibility", "roach", "ant", "rodent", "termite", "bed bug", "flea", "pest allocation", "insect treatment", "pest control cost"],
  },
  {
    state: "TX",
    section: "14.11",
    sectionTitle: "Bed Bugs, Fleas, Termites",
    page: "13–14",
    relevantText: "Bed bugs and fleas must be reported immediately. Tenant is responsible for treatment if caused or introduced by Tenant, occupants, guests, or pets. Tenant shall not self-treat termites; report mud tubes, swarms, frass, or damaged wood immediately.",
    responsibilityGuide: "Depends",
    keywords: ["bed bug", "flea infestation", "termite", "termite treatment", "bed bug treatment", "flea treatment tenant"],
  },
  {
    state: "TX",
    section: "14.12",
    sectionTitle: "Pest Treatment Charges",
    page: "14",
    relevantText: "Reasonable costs of treatment, re-inspections, appliance/plumbing service calls caused by misuse, hauling trash, removal of contaminated food or refuse, extra cleaning required by unsanitary conditions, or repeated service calls caused by Tenant's failure to comply with this addendum may be charged to Tenant as additional rent.",
    responsibilityGuide: "Tenant",
    keywords: ["pest charge", "treatment charge", "repeated service call", "pest additional rent", "pest cost tenant"],
  },
  // ─── SECTION 15: ALTERATIONS ───────────────────────────────────────────────
  {
    state: "TX",
    section: "15.1–15.3",
    sectionTitle: "No Unauthorized Alterations or Installations",
    page: "14",
    relevantText: "Tenant shall not make any alterations, improvements, or installations without Landlord's prior written consent. This includes ceiling fans, light fixtures, switches, outlets, plumbing fixtures, appliances, garbage disposals, dishwashers. Even a licensed professional does not make unauthorized work permissible.",
    responsibilityGuide: "Tenant",
    keywords: ["unauthorized work", "unauthorized installation", "unapproved alteration", "tenant installed", "unauthorized electrical", "unauthorized plumbing", "unapproved fixture"],
  },
  {
    state: "TX",
    section: "15.5",
    sectionTitle: "Costs for Unauthorized Work",
    page: "15",
    relevantText: "Tenant is responsible for all reasonable costs arising from unauthorized work, including inspection fees, professional evaluations, permits, labor, materials, and the cost of any licensed contractor needed to inspect, correct, remove, or replace the work. These costs are due as additional rent and may be deducted from the security deposit.",
    responsibilityGuide: "Tenant",
    keywords: ["cost unauthorized work", "repair unauthorized", "deduct unauthorized alteration", "fix unauthorized"],
  },
  {
    state: "TX",
    section: "15.7",
    sectionTitle: "Water Heaters, Panels, HVAC — No Tenant Tampering",
    page: "15",
    relevantText: "Tenant may not open, remove covers from, adjust, repair, or otherwise tamper with any water heater, electrical panel or breakers, gas valves or gas-fired equipment, or HVAC equipment and disconnects. Tenant must promptly report problems and allow Landlord or Landlord's contractors to perform any needed repairs. Unauthorized tampering is a material default.",
    responsibilityGuide: "Depends",
    keywords: ["water heater tamper", "electrical panel tamper", "hvac tamper", "gas valve tamper", "tamper water heater", "breaker tamper", "tenant tampers"],
  },
  // ─── SECTION 18: DEFAULTS ──────────────────────────────────────────────────
  {
    state: "TX",
    section: "18.1",
    sectionTitle: "Tenant Default — Property Damage",
    page: "16",
    relevantText: "Tenant is in default if Tenant causes or permits substantial damage to the Property or its systems, including walls, doors, locks, windows, flooring, cabinets, fixtures, appliances, yard, trees, shrubs, or irrigation, beyond normal wear and tear, and fails to repair or pay for such damage after written notice.",
    responsibilityGuide: "Tenant",
    keywords: ["tenant default damage", "substantial damage", "default damage", "repair demand letter"],
  },
  {
    state: "TX",
    section: "18.2",
    sectionTitle: "Landlord Remedies — Perform Work and Charge",
    page: "17",
    relevantText: "If Tenant is in default, Landlord may perform Tenant's obligations (including yard work, cleaning, pest treatment, repairs, or cure of unsafe conditions) and charge Tenant for the reasonable cost of such work as additional rent. Landlord may also deduct lawful amounts from the security deposit and pursue Tenant for any deficiency.",
    responsibilityGuide: "Tenant",
    keywords: ["landlord performs repair", "landlord charges repair", "additional rent repair", "landlord remedy", "deduct repair cost"],
  },
];

/**
 * Search lease clauses by keyword(s). Returns ranked matches.
 */
export function searchLeaseClauses(
  query: string,
  state: "TX" | "NJ" | "Both" = "TX"
): LeaseClause[] {
  const q = query.toLowerCase().trim();
  const words = q.split(/\s+/).filter(w => w.length > 2);

  const scored = TEXAS_LEASE_CLAUSES
    .filter(c => c.state === state || c.state === "Both")
    .map(clause => {
      let score = 0;
      for (const word of words) {
        // Check keywords list
        score += clause.keywords.filter(k => k.includes(word)).length * 3;
        // Check section title
        if (clause.sectionTitle.toLowerCase().includes(word)) score += 2;
        // Check relevant text
        if (clause.relevantText.toLowerCase().includes(word)) score += 1;
      }
      return { clause, score };
    })
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(r => r.clause);

  return scored.slice(0, 5); // top 5 matches
}

/**
 * Get clauses most relevant to a maintenance category.
 */
export function getClausesForCategory(category: string, state: "TX" | "NJ" = "TX"): LeaseClause[] {
  const map: Record<string, string> = {
    "Plumbing":    "clog drain plumbing backup misuse",
    "HVAC":        "hvac filter tamper ac unit",
    "Electrical":  "electrical panel tamper unauthorized electrical",
    "Appliance":   "appliance refrigerator dishwasher range dryer washer",
    "Pest":        "pest roach flea rodent termite bed bug",
    "Structural":  "landlord repair health safety habitability",
    "General":     "tenant damage repair normal wear",
    "Other":       "repair maintenance duty",
  };
  return searchLeaseClauses(map[category] || category, state);
}

/** NJ clauses will be added when NJ contract is provided */
export const NJ_LEASE_CLAUSES: LeaseClause[] = [];
