const nodemailer = require('nodemailer');

// ─── In-Memory Store (resets per cold start — replace with DB in production) ──
const submissions = [];

// ─── Email Transporter (configured via process.env) ──────────────────────────
function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
    },
  });
}

// ─── Helper: send admin notification email ───────────────────────────────────
async function sendAdminEmail(transporter, subject, htmlBody) {
  if (!process.env.SMTP_USER) return;
  try {
    await transporter.sendMail({
      from: `"Perfect Finish" <${process.env.SMTP_USER}>`,
      to: process.env.ADMIN_EMAIL || process.env.SMTP_USER,
      subject,
      html: htmlBody,
    });
  } catch (err) {
    console.error('Email send error:', err.message);
  }
}

// ─── Helper: send confirmation email to client ──────────────────────────────
async function sendClientConfirmation(transporter, to, firstName) {
  if (!process.env.SMTP_USER) return;
  try {
    await transporter.sendMail({
      from: `"Perfect Finish School of Etiquette" <${process.env.SMTP_USER}>`,
      to,
      subject: 'Thank you for reaching out — Perfect Finish',
      html: `
        <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; color: #0A2C47; padding: 40px 20px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <p style="font-size: 11px; letter-spacing: 3px; text-transform: uppercase; color: #C9A14A; margin: 0;">PERFECT FINISH</p>
            <p style="font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: #545454; margin: 4px 0 0;">SCHOOL OF ETIQUETTE</p>
          </div>
          <h1 style="font-size: 28px; font-weight: 400; color: #0A2C47; margin-bottom: 16px;">
            Dear ${firstName},
          </h1>
          <p style="font-size: 16px; line-height: 1.7; color: #545454;">
            Thank you for reaching out to Perfect Finish School of Etiquette. We have received your enquiry and a member of our team will be in touch within 24 to 48 hours to arrange your complimentary discovery call.
          </p>
          <p style="font-size: 16px; line-height: 1.7; color: #545454;">
            We look forward to learning more about your goals and discussing how we can help you cultivate the confidence, elegance, and social intelligence that will transform every room you enter.
          </p>
          <div style="border-top: 1px solid #C9A14A; margin: 32px 0;"></div>
          <p style="font-size: 13px; color: #545454; font-style: italic;">
            "The world notices refinement. Invest in yours."
          </p>
          <p style="font-size: 13px; color: #545454; margin-top: 24px;">
            Warmly,<br>
            <strong style="color: #0A2C47;">The Perfect Finish Team</strong>
          </p>
        </div>
      `,
    });
  } catch (err) {
    console.error('Confirmation email error:', err.message);
  }
}

// ─── CORS helper ─────────────────────────────────────────────────────────────
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// ─── Serverless Handler ─────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  setCorsHeaders(res);

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed.' });
  }

  const { firstName, lastName, email, phone, interest, message } = req.body;

  // Validation
  if (!firstName || !email) {
    return res.status(400).json({
      success: false,
      message: 'First name and email are required.',
    });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a valid email address.',
    });
  }

  const submission = {
    id: Date.now(),
    firstName,
    lastName: lastName || '',
    email,
    phone: phone || '',
    interest: interest || 'Not specified',
    message: message || '',
    submittedAt: new Date().toISOString(),
  };

  submissions.push(submission);
  console.log('[Contact] New submission:', submission.id, email);

  const transporter = createTransporter();

  // Send admin notification
  await sendAdminEmail(
    transporter,
    `New Consultation Request — ${firstName} ${lastName || ''}`,
    `
    <div style="font-family: sans-serif; color: #0A2C47;">
      <h2>New Consultation Request</h2>
      <table cellpadding="8" cellspacing="0" style="border-collapse:collapse; width:100%;">
        <tr><td><strong>Name</strong></td><td>${firstName} ${lastName || ''}</td></tr>
        <tr><td><strong>Email</strong></td><td>${email}</td></tr>
        <tr><td><strong>Phone</strong></td><td>${phone || '—'}</td></tr>
        <tr><td><strong>Interest</strong></td><td>${interest || '—'}</td></tr>
        <tr><td><strong>Message</strong></td><td>${message || '—'}</td></tr>
        <tr><td><strong>Submitted</strong></td><td>${submission.submittedAt}</td></tr>
      </table>
    </div>
    `
  );

  // Send confirmation to client
  await sendClientConfirmation(transporter, email, firstName);

  return res.status(200).json({
    success: true,
    message: 'Thank you. We will be in touch within 24–48 hours.',
    id: submission.id,
  });
};
