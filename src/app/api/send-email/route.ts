import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function GET() {
  const hasResend = Boolean(process.env.RESEND_API_KEY);
  const hasSmtp = Boolean(
    (process.env.SMTP_USER && process.env.SMTP_PASS) ||
    (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD)
  );

  return NextResponse.json({
    configured: hasResend || hasSmtp,
    provider: hasResend ? 'resend' : hasSmtp ? 'smtp' : 'simulated',
    fromAddress: process.env.EMAIL_FROM || (hasResend ? 'onboarding@resend.dev' : 'admissions@woodlempark.ae'),
    help: hasResend || hasSmtp
      ? 'Live email delivery active.'
      : 'No external email provider configured. Add RESEND_API_KEY or SMTP_USER/SMTP_PASS in .env.local to send to real parent inboxes.',
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { to, toName, subject, html, text, type, studentName, metadata } = body;

    if (!to || !subject) {
      return NextResponse.json({ error: 'Missing required email fields (to, subject)' }, { status: 400 });
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    const smtpUser = process.env.SMTP_USER || process.env.GMAIL_USER;
    const smtpPass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD;
    const smtpHost = process.env.SMTP_HOST || (process.env.GMAIL_USER ? 'smtp.gmail.com' : '');
    const smtpPort = Number(process.env.SMTP_PORT) || 465;

    // 1. Try Resend if configured
    if (resendApiKey) {
      try {
        const fromAddress = process.env.EMAIL_FROM || 'Woodlem Park School <onboarding@resend.dev>';
        const resendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: fromAddress,
            to: [to],
            subject,
            html,
            text,
          }),
        });

        const resendData = await resendRes.json();
        if (resendRes.ok) {
          console.log(`[EMAIL DISPATCH - RESEND SUCCESS] To: ${to} | ID: ${resendData.id}`);
          return NextResponse.json({
            success: true,
            provider: 'resend',
            messageId: resendData.id,
            status: 'sent',
            recipient: to,
          });
        } else {
          console.error('[EMAIL DISPATCH - RESEND ERROR]', resendData);
          return NextResponse.json({
            success: false,
            provider: 'resend',
            error: resendData.message || 'Resend email delivery rejected. Please check your Resend dashboard.',
            statusCode: resendRes.status,
            details: resendData,
          }, { status: 400 });
        }
      } catch (resendErr: any) {
        console.warn('External Resend dispatch exception, attempting SMTP fallback:', resendErr);
      }
    }

    // 2. Try Nodemailer / SMTP (Gmail or custom SMTP server) if configured
    if (smtpUser && smtpPass && smtpHost) {
      try {
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465,
          auth: {
            user: smtpUser,
            pass: smtpPass,
          },
        });

        const fromAddress = process.env.EMAIL_FROM || `Woodlem Park School <${smtpUser}>`;
        const info = await transporter.sendMail({
          from: fromAddress,
          to,
          subject,
          text,
          html,
        });

        console.log(`[EMAIL DISPATCH - SMTP SUCCESS] To: ${to} | MessageId: ${info.messageId}`);
        return NextResponse.json({
          success: true,
          provider: 'smtp',
          messageId: info.messageId,
          status: 'sent',
          recipient: to,
        });
      } catch (smtpErr: any) {
        console.error('[EMAIL DISPATCH - SMTP ERROR]', smtpErr);
      }
    }

    // 3. Fallback: Internal Development / Simulated Delivery
    console.log(`\n======================================================================`);
    console.log(`[EMAIL DISPATCH - SIMULATED DELIVERY (No external SMTP / Resend API key)]`);
    console.log(`To: ${to} (${toName || 'Parent'})`);
    console.log(`Subject: ${subject}`);
    console.log(`Student: ${studentName || 'N/A'}`);
    console.log(`Notice: To deliver to real recipient inboxes, add RESEND_API_KEY or SMTP credentials to .env.local`);
    console.log(`======================================================================\n`);

    return NextResponse.json({
      success: true,
      provider: 'simulated',
      status: 'simulated',
      warning: 'Email simulated in development mode. To send to real parent inboxes, add RESEND_API_KEY or SMTP credentials in .env.local.',
      recipient: to,
      recipientName: toName,
      subject,
      timestamp: new Date().toISOString(),
      metadata,
    });
  } catch (error: any) {
    console.error('send-email route error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to dispatch email' }, { status: 500 });
  }
}
