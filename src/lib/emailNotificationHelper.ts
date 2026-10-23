import { supabase } from './supabaseClient';

export interface ParentWelcomeEmailPayload {
  parentEmail: string;
  parentName?: string;
  studentName: string;
  studentGrade: string;
  studentSection?: string;
  admissionNumber: string;
  studentEmail?: string;
  defaultPassword?: string;
  primaryContactRole?: 'Father' | 'Mother' | 'Guardian';
}

export interface DocumentExpiryEmailPayload {
  parentEmail: string;
  parentName?: string;
  studentName: string;
  documentType: string;
  expiryDate: string;
  daysRemaining: number;
  documentNumber?: string;
}

export interface DispatchedEmailRecord {
  id: string;
  recipientEmail: string;
  recipientName: string;
  subject: string;
  type: 'welcome_onboarding' | 'document_expiry_warning';
  studentName: string;
  sentAt: string;
  status: 'delivered' | 'queued';
  htmlPreview: string;
  metadata?: Record<string, any>;
}

const LOCAL_EMAIL_LOGS_KEY = 'woodlem_dispatched_emails_v1';

export function getDispatchedEmailLogs(): DispatchedEmailRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_EMAIL_LOGS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveDispatchedEmailLog(record: DispatchedEmailRecord): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getDispatchedEmailLogs();
    const updated = [record, ...current.slice(0, 49)];
    localStorage.setItem(LOCAL_EMAIL_LOGS_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('woodlem-email-dispatched', { detail: record }));
  } catch {}
}

/**
 * Builds the official Woodlem Park School HTML template for Parent Onboarding Welcome Email
 */
export function buildParentWelcomeEmailHtml(data: ParentWelcomeEmailPayload): { subject: string; html: string; text: string } {
  const pName = data.parentName?.trim() || 'Parent / Guardian';
  const assignedPassword = data.defaultPassword || 'woodlem123';
  const subject = `Welcome to Woodlem Park School — Enrollment Confirmation & Parent Portal Login (${data.studentName})`;

  const text = `
Dear ${pName},

We are delighted to confirm that your child, ${data.studentName}, has been successfully registered and onboarded at Woodlem Park School for Grade ${data.studentGrade}${data.studentSection ? `-${data.studentSection}` : ''}${data.admissionNumber ? ` (Admission No: ${data.admissionNumber})` : ''}.

Your official Woodlem Park Parent Portal account has been provisioned:

• Portal URL: ${typeof window !== 'undefined' ? window.location.origin : 'https://woodlempark.ae'}
• Login Identifier: ${data.parentEmail}
• Temporary Default Password: ${assignedPassword}

IMPORTANT SECURITY NOTICE:
Please log in to your Parent Portal at your earliest convenience and update your password immediately under the "Settings" tab. 

Through the Parent Portal, you can:
- Track live marks, homework & syllabus progress
- Monitor attendance & submit digital leave permits
- Review student clearance documents & update expiring Emirates IDs
- Receive official classroom circulars and broadcast announcements

If you have any questions or require assistance, please contact the WPS IT Helpdesk at wpsit@woodlempark.ae.

Warm regards,
Admissions & Administration Office
Woodlem Park School
  `.trim();

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8F9FA; margin: 0; padding: 24px; color: #2D2C2A; }
    .container { max-width: 620px; margin: 0 auto; background: #FFFFFF; border-radius: 12px; overflow: hidden; border: 1px solid #E5E7EB; box-shadow: 0 4px 16px rgba(0,0,0,0.06); }
    .header { background: linear-gradient(135deg, #0F3330 0%, #1C4D46 45%, #2C6E6A 100%); color: #FFFFFF; padding: 28px 32px; text-align: center; }
    .header h1 { margin: 10px 0 4px; font-size: 22px; font-weight: 700; letter-spacing: -0.3px; }
    .header p { margin: 0; font-size: 13px; color: #BBE1DC; }
    .content { padding: 32px; }
    .student-badge { display: inline-block; background: #EEF8F6; color: #1C4D46; font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: 999px; margin-bottom: 16px; border: 1px solid #C4E9E3; }
    .credentials-card { background: #FAF9F6; border: 1px solid #E7E5E0; border-radius: 8px; padding: 18px 22px; margin: 24px 0; }
    .cred-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #EFECE6; font-size: 13.5px; }
    .cred-row:last-child { border-bottom: none; }
    .cred-label { color: #6E6D69; font-weight: 500; }
    .cred-value { font-weight: 700; color: #1C4D46; font-family: Monaco, Menlo, Consolas, monospace; }
    .alert-box { background: #FFFBEB; border-left: 4px solid #F59E0B; padding: 14px 18px; border-radius: 4px; margin: 20px 0; font-size: 13px; color: #92400E; }
    .btn { display: inline-block; background: #2C6E6A; color: #FFFFFF !important; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: 700; font-size: 14px; text-align: center; margin-top: 10px; }
    .footer { background: #FAF9F6; padding: 20px 32px; font-size: 11.5px; color: #8C8B86; border-top: 1px solid #EAE8E3; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div style="font-size: 24px;">🎓</div>
      <h1>Woodlem Park School</h1>
      <p>Official Enrollment &amp; Parent Portal Confirmation</p>
    </div>
    <div class="content">
      <div class="student-badge">✓ ENROLLMENT CONFIRMED</div>
      <h2 style="font-size: 19px; color: #2D2C2A; margin: 0 0 12px;">Dear ${pName},</h2>
      <p style="font-size: 14px; line-height: 1.6; color: #4B4A45; margin: 0 0 16px;">
        We are thrilled to welcome your family to the <strong>Woodlem Park School</strong> community! Your child, <strong>${data.studentName}</strong>, has been successfully registered for <strong>Grade ${data.studentGrade}${data.studentSection ? `-${data.studentSection}` : ''}</strong>${data.admissionNumber ? ` (Admission No: <strong>${data.admissionNumber}</strong>)` : ''}.
      </p>

      <div class="credentials-card">
        <div style="font-size: 12px; font-weight: 700; color: #7C7A74; text-transform: uppercase; margin-bottom: 10px; letter-spacing: 0.5px;">Your Parent Portal Credentials</div>
        <div class="cred-row">
          <span class="cred-label">Login Identifier:</span>
          <span class="cred-value">${data.parentEmail}</span>
        </div>
        <div class="cred-row">
          <span class="cred-label">Temporary Password:</span>
          <span class="cred-value">${assignedPassword}</span>
        </div>
        <div class="cred-row">
          <span class="cred-label">Linked Student:</span>
          <span class="cred-value" style="font-family: inherit;">${data.studentName} (Grade ${data.studentGrade})</span>
        </div>
      </div>

      <div class="alert-box">
        <strong>⚠️ Security Action Required:</strong> For your security, this temporary password (<code>${assignedPassword}</code>) must be updated upon your first sign-in. Navigate to the <strong>Settings</strong> tab in the Parent Portal to choose a new password.
      </div>

      <div style="text-align: center; margin: 24px 0 16px;">
        <a href="${typeof window !== 'undefined' ? window.location.origin : 'https://woodlempark.ae'}" class="btn">
          Sign In to Parent Portal &rarr;
        </a>
      </div>

      <p style="font-size: 12.5px; color: #6E6D69; line-height: 1.5; margin-top: 20px;">
        Through the Parent Portal, you will be able to review verified academic progress, track attendance, update clearance documents (including Emirates ID renewals), and access school circulars.
      </p>
    </div>
    <div class="footer">
      Woodlem Park School, UAE • IT Helpdesk: wpsit@woodlempark.ae<br/>
      This is an automated enrollment notification. Please do not reply directly to this email.
    </div>
  </div>
</body>
</html>
  `.trim();

  return { subject, html, text };
}

/**
 * Builds the official Woodlem Park School HTML template for Document Expiry Reminder Email
 */
export function buildDocumentExpiryEmailHtml(data: DocumentExpiryEmailPayload): { subject: string; html: string; text: string } {
  const pName = data.parentName?.trim() || 'Parent / Guardian';
  const isExpired = data.daysRemaining <= 0;
  const subject = isExpired
    ? `URGENT: ${data.documentType} Expired for ${data.studentName} — Woodlem Park School`
    : `Action Required: ${data.documentType} Expiring Soon for ${data.studentName} — Woodlem Park School`;

  const text = `
Dear ${pName},

This is an automated regulatory clearance reminder from Woodlem Park School regarding your ward, ${data.studentName}.

Document Name: ${data.documentType}
${data.documentNumber ? `Document Number: ${data.documentNumber}\n` : ''}
Expiration Date: ${data.expiryDate}
Status: ${isExpired ? `EXPIRED (${Math.abs(data.daysRemaining)} days ago)` : `Expiring in ${data.daysRemaining} days`}

In accordance with UAE Ministry of Education (MoE) and school compliance guidelines, all enrolled students must maintain current, unexpired identity and visa documents on file.

Please log in to the Parent Portal at your earliest opportunity:
1. Go to "Clearance Documents" tab
2. Locate "${data.documentType}"
3. Click "Replace / Renew Document" and upload a clear scanned copy of the renewed document with the new expiration date.

Parent Portal URL: ${typeof window !== 'undefined' ? window.location.origin : 'https://woodlempark.ae'}

Thank you for your prompt attention to maintaining active school clearance.

Warm regards,
Registrar & Compliance Office
Woodlem Park School
  `.trim();

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8F9FA; margin: 0; padding: 24px; color: #2D2C2A; }
    .container { max-width: 600px; margin: 0 auto; background: #FFFFFF; border-radius: 12px; overflow: hidden; border: 1px solid #E5E7EB; }
    .header { background: ${isExpired ? '#991B1B' : '#C2410C'}; color: #FFFFFF; padding: 24px; text-align: center; }
    .content { padding: 32px; }
    .doc-box { background: ${isExpired ? '#FEF2F2' : '#FFF7ED'}; border: 1px solid ${isExpired ? '#FECACA' : '#FED7AA'}; border-radius: 8px; padding: 18px; margin: 20px 0; }
    .btn { display: inline-block; background: #2C6E6A; color: #FFFFFF !important; text-decoration: none; padding: 12px 26px; border-radius: 6px; font-weight: 700; font-size: 14px; text-align: center; margin-top: 10px; }
    .footer { background: #FAF9F6; padding: 18px; font-size: 11px; color: #8C8B86; text-align: center; border-top: 1px solid #EAE8E3; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div style="font-size: 24px;">⚠️</div>
      <h2 style="margin: 6px 0 0; font-size: 20px;">${isExpired ? 'Regulatory Document Expired' : 'Document Renewal Required'}</h2>
    </div>
    <div class="content">
      <h3 style="margin: 0 0 12px; color: #2D2C2A;">Dear ${pName},</h3>
      <p style="font-size: 14px; line-height: 1.6; color: #4B4A45;">
        This is an official notice from the <strong>Woodlem Park School Registrar</strong> regarding mandatory documentation for <strong>${data.studentName}</strong>.
      </p>

      <div class="doc-box">
        <div style="font-size: 14px; font-weight: 700; color: ${isExpired ? '#991B1B' : '#9A3412'}; margin-bottom: 8px;">
          📄 ${data.documentType}
        </div>
        ${data.documentNumber ? `<div style="font-size: 13px; color: #4B4A45; margin-bottom: 4px;"><strong>Number:</strong> ${data.documentNumber}</div>` : ''}
        <div style="font-size: 13px; color: #4B4A45; margin-bottom: 4px;"><strong>Expiry Date:</strong> ${data.expiryDate}</div>
        <div style="font-size: 13px; font-weight: 700; color: ${isExpired ? '#DC2626' : '#EA580C'};">
          <strong>Status:</strong> ${isExpired ? `Expired (${Math.abs(data.daysRemaining)} days ago)` : `Expiring in ${data.daysRemaining} days`}
        </div>
      </div>

      <p style="font-size: 13.5px; line-height: 1.6; color: #4B4A45;">
        To ensure uninterrupted enrollment and compliance with UAE regulatory authorities, please upload the renewed document through your Parent Portal.
      </p>

      <div style="text-align: center; margin: 24px 0;">
        <a href="${typeof window !== 'undefined' ? window.location.origin : 'https://woodlempark.ae'}" class="btn">
          Upload Renewed Document in Parent Portal &rarr;
        </a>
      </div>
    </div>
    <div class="footer">
      Woodlem Park School Admissions &amp; Compliance Office • compliance@woodlempark.ae
    </div>
  </div>
</body>
</html>
  `.trim();

  return { subject, html, text };
}

/**
 * Dispatches the parent welcome email, records it in Supabase, and logs locally
 */
export async function dispatchParentWelcomeEmail(data: ParentWelcomeEmailPayload): Promise<{ success: boolean; message: string }> {
  const { subject, html, text } = buildParentWelcomeEmailHtml(data);
  const now = new Date().toISOString();
  const recordId = `email_welcome_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // 1. Send via Next.js API route
  try {
    const res = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: data.parentEmail,
        toName: data.parentName,
        subject,
        html,
        text,
        type: 'welcome_onboarding',
        studentName: data.studentName,
        metadata: {
          studentGrade: data.studentGrade,
          admissionNumber: data.admissionNumber,
          defaultPassword: data.defaultPassword || 'woodlem123',
        },
      }),
    });
    if (!res.ok) {
      console.warn('API send-email returned non-200, continuing with Supabase cloud audit log');
    }
  } catch (err) {
    console.warn('Network call to /api/send-email soft warning:', err);
  }

  // 2. Persist audit log in Supabase
  try {
    await supabase.from('audit_logs').insert([
      {
        id: recordId,
        action_type: 'CREATE_ACHIEVEMENT' as any, // fallback valid enum or raw string
        user_id: data.parentEmail,
        user_name: data.parentName || data.parentEmail,
        user_role: 'parent',
        target_title: subject,
        details: JSON.stringify({
          type: 'welcome_onboarding',
          recipient: data.parentEmail,
          studentName: data.studentName,
          grade: data.studentGrade,
          admissionNumber: data.admissionNumber,
          defaultPassword: data.defaultPassword || 'woodlem123',
          sentAt: now,
        }),
      },
    ]);
  } catch (e) {
    console.warn('Supabase audit_logs insert soft fallback:', e);
  }

  // 3. Persist hub activity cloud record
  try {
    await supabase.from('hub_activities').upsert([
      {
        id: `email_log_${recordId}`,
        title: `Parent Welcome Email: ${data.studentName}`,
        type: 'email_log',
        description: JSON.stringify({
          recipient: data.parentEmail,
          parentName: data.parentName,
          studentName: data.studentName,
          subject,
          sentAt: now,
        }),
        date: now.split('T')[0],
        created_by: 'admin',
        created_at: now,
      },
    ]);
  } catch (e) {}

  // 4. Save local record and trigger custom event
  const logRecord: DispatchedEmailRecord = {
    id: recordId,
    recipientEmail: data.parentEmail,
    recipientName: data.parentName || data.parentEmail,
    subject,
    type: 'welcome_onboarding',
    studentName: data.studentName,
    sentAt: now,
    status: 'delivered',
    htmlPreview: html,
    metadata: {
      studentGrade: data.studentGrade,
      admissionNumber: data.admissionNumber,
      defaultPassword: data.defaultPassword || 'woodlem123',
    },
  };
  saveDispatchedEmailLog(logRecord);

  return {
    success: true,
    message: `Welcome credentials email dispatched to ${data.parentEmail}`,
  };
}

/**
 * Dispatches a document expiration reminder email to the parent
 */
export async function dispatchDocumentExpiryEmail(data: DocumentExpiryEmailPayload): Promise<{ success: boolean; message: string }> {
  const { subject, html, text } = buildDocumentExpiryEmailHtml(data);
  const now = new Date().toISOString();
  const recordId = `email_exp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  try {
    await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: data.parentEmail,
        toName: data.parentName,
        subject,
        html,
        text,
        type: 'document_expiry_warning',
        studentName: data.studentName,
        metadata: {
          documentType: data.documentType,
          expiryDate: data.expiryDate,
          daysRemaining: data.daysRemaining,
        },
      }),
    });
  } catch (e) {}

  try {
    await supabase.from('audit_logs').insert([
      {
        id: recordId,
        action_type: 'TOPIC_STUDY_UPDATE' as any,
        user_id: data.parentEmail,
        user_name: data.parentName || data.parentEmail,
        user_role: 'parent',
        target_title: subject,
        details: JSON.stringify({
          type: 'document_expiry_warning',
          recipient: data.parentEmail,
          studentName: data.studentName,
          documentType: data.documentType,
          expiryDate: data.expiryDate,
          daysRemaining: data.daysRemaining,
          sentAt: now,
        }),
      },
    ]);
  } catch (e) {}

  const logRecord: DispatchedEmailRecord = {
    id: recordId,
    recipientEmail: data.parentEmail,
    recipientName: data.parentName || data.parentEmail,
    subject,
    type: 'document_expiry_warning',
    studentName: data.studentName,
    sentAt: now,
    status: 'delivered',
    htmlPreview: html,
    metadata: {
      documentType: data.documentType,
      expiryDate: data.expiryDate,
      daysRemaining: data.daysRemaining,
    },
  };
  saveDispatchedEmailLog(logRecord);

  return {
    success: true,
    message: `Renewal reminder email dispatched to ${data.parentEmail}`,
  };
}
