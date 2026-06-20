const nodemailer = require('nodemailer');

// ─── In-Memory Store (resets per cold start — replace with DB in production) ──
const subscribers = [];

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

  const { email, firstName } = req.body;

  // Validation
  if (!email) {
    return res.status(400).json({
      success: false,
      message: 'Email address is required.',
    });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a valid email address.',
    });
  }

  // Prevent duplicates (within this instance's memory)
  const already = subscribers.find(s => s.email === email);
  if (already) {
    return res.status(200).json({
      success: true,
      message: 'You are already subscribed. Thank you.',
    });
  }

  const subscriber = {
    id: Date.now(),
    email,
    firstName: firstName || '',
    subscribedAt: new Date().toISOString(),
  };
  subscribers.push(subscriber);
  console.log('[Newsletter] New subscriber:', email);

  const transporter = createTransporter();

  // Admin notification
  await sendAdminEmail(
    transporter,
    `New Journal Subscriber — ${email}`,
    `<div style="font-family:sans-serif;"><p>New subscriber: <strong>${email}</strong></p><p>Subscribed at: ${subscriber.subscribedAt}</p></div>`
  );

  // Welcome email to subscriber
  if (process.env.SMTP_USER) {
    try {
      await transporter.sendMail({
        from: `"The Refined Life Journal" <${process.env.SMTP_USER}>`,
        to: email,
        subject: 'Welcome to The Refined Life Journal',
        html: `
          <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; color: #0A2C47; padding: 40px 20px;">
            <p style="font-size: 11px; letter-spacing: 3px; text-transform: uppercase; color: #C9A14A;">THE REFINED LIFE JOURNAL</p>
            <h1 style="font-size: 26px; font-weight: 400;">Welcome${firstName ? ', ' + firstName : ''}.</h1>
            <p style="font-size: 15px; line-height: 1.8; color: #545454;">
              You have joined a community of individuals committed to a more elegant, confident, and refined way of living. Expect thoughtful insights on etiquette, social intelligence, professional presence, and the art of modern elegance — delivered with intention, never overwhelm.
            </p>
            <p style="font-size: 13px; color: #545454; font-style: italic; border-left: 2px solid #C9A14A; padding-left: 16px; margin-top: 24px;">
              "The world notices refinement. Invest in yours."
            </p>
            <p style="font-size: 13px; margin-top: 32px; color: #545454;">Warmly,<br><strong style="color:#0A2C47;">The Perfect Finish Team</strong></p>
          </div>
        `,
      });
    } catch (e) {
      console.error('Welcome email error:', e.message);
    }
  }

  return res.status(200).json({
    success: true,
    message: 'Welcome. You are now part of The Refined Life Journal.',
  });
};
