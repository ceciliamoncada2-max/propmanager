import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;
const landlordPhone = process.env.LANDLORD_PHONE;

function getClient() {
  if (!accountSid || !authToken) return null;
  return twilio(accountSid, authToken);
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

async function sendSMS(to: string, body: string): Promise<void> {
  const client = getClient();
  if (!client || !fromNumber) {
    console.log(`[SMS skipped — no Twilio config] To: ${to} | ${body}`);
    return;
  }
  try {
    await client.messages.create({
      body,
      from: formatPhone(fromNumber),
      to: formatPhone(to),
    });
    console.log(`[SMS sent] To: ${to}`);
  } catch (err: any) {
    console.error(`[SMS error] ${err.message}`);
  }
}

// ── Notification triggers ────────────────────────────────────────────────────

export async function notifyTenantNewRequest(tenantPhone: string | null | undefined, title: string, portalCode: string) {
  if (!tenantPhone) return;
  await sendSMS(tenantPhone,
    `Your maintenance request "${title}" has been received. Your landlord will be in touch soon. Track updates at your tenant portal using code: ${portalCode}`
  );
}

export async function notifyLandlordNewRequest(title: string, tenantName: string, location: string | null) {
  if (!landlordPhone) return;
  await sendSMS(landlordPhone,
    `New maintenance request from ${tenantName}: "${title}"${location ? ` (${location})` : ""}. Open PropManager to review.`
  );
}

export async function notifyTenantStatusUpdate(tenantPhone: string | null | undefined, title: string, status: string, landlordNotes: string | null, scheduledVisit: string | null) {
  if (!tenantPhone) return;
  const statusLabel: Record<string, string> = {
    open: "Open",
    in_progress: "In Progress",
    resolved: "Resolved",
    closed: "Closed",
  };
  let msg = `Update on your maintenance request "${title}": Status changed to ${statusLabel[status] || status}.`;
  if (scheduledVisit) msg += ` Scheduled visit: ${scheduledVisit}.`;
  if (landlordNotes) msg += ` Note from landlord: ${landlordNotes}`;
  await sendSMS(tenantPhone, msg);
}

export async function notifyTenantVisitScheduled(tenantPhone: string | null | undefined, title: string, scheduledVisit: string) {
  if (!tenantPhone) return;
  await sendSMS(tenantPhone,
    `A visit has been scheduled for your maintenance request "${title}" on ${scheduledVisit}. Please ensure access is available.`
  );
}

export async function notifyTenantResolved(tenantPhone: string | null | undefined, title: string, notes: string | null) {
  if (!tenantPhone) return;
  let msg = `Your maintenance request "${title}" has been completed.`;
  if (notes) msg += ` Notes: ${notes}`;
  await sendSMS(tenantPhone, msg);
}

export async function notifyLandlordVisitConfirmed(title: string, tenantName: string, scheduledVisit: string) {
  if (!landlordPhone) return;
  await sendSMS(landlordPhone,
    `${tenantName} confirmed the visit for "${title}" on ${scheduledVisit}. Access will be available.`
  );
}

export async function notifyLandlordRescheduleRequested(title: string, tenantName: string, message: string | null) {
  if (!landlordPhone) return;
  let msg = `${tenantName} requested a reschedule for "${title}".`;
  if (message) msg += ` Tenant message: ${message}`;
  msg += ` Please open PropManager to set a new date.`;
  await sendSMS(landlordPhone, msg);
}
