require('dotenv').config();
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve the static website files
app.use(express.static(path.join(__dirname)));

// ─── In-Memory Store (replace with DB in production) ─────────────────────────
const submissions = [];
const subscribers = [];

// ─── Email Transporter (configured via .env) ─────────────────────────────────
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
});

// ─── Helper: send admin notification email ────────────────────────────────────
async function sendAdminEmail(subject, htmlBody) {
  if (!process.env.SMTP_USER) return; // Skip if not configured
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

// ─── Helper: send confirmation email to client ───────────────────────────────
async function sendClientConfirmation(to, firstName) {
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

// ─── API: Contact / Consultation Form ────────────────────────────────────────
app.post('/api/contact', async (req, res) => {
  const { firstName, lastName, email, phone, interest, message } = req.body;

  if (!firstName || !email) {
    return res.status(400).json({
      success: false,
      message: 'First name and email are required.',
    });
  }

  // Basic email validation
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

  // Send emails (non-blocking)
  await sendAdminEmail(
    `New Consultation Request — ${firstName} ${lastName}`,
    `
    <div style="font-family: sans-serif; color: #0A2C47;">
      <h2>New Consultation Request</h2>
      <table cellpadding="8" cellspacing="0" style="border-collapse:collapse; width:100%;">
        <tr><td><strong>Name</strong></td><td>${firstName} ${lastName}</td></tr>
        <tr><td><strong>Email</strong></td><td>${email}</td></tr>
        <tr><td><strong>Phone</strong></td><td>${phone || '—'}</td></tr>
        <tr><td><strong>Interest</strong></td><td>${interest || '—'}</td></tr>
        <tr><td><strong>Message</strong></td><td>${message || '—'}</td></tr>
        <tr><td><strong>Submitted</strong></td><td>${submission.submittedAt}</td></tr>
      </table>
    </div>
    `
  );
  await sendClientConfirmation(email, firstName);

  return res.status(200).json({
    success: true,
    message: 'Thank you. We will be in touch within 24–48 hours.',
    id: submission.id,
  });
});

// ─── API: Newsletter Subscription ─────────────────────────────────────────────
app.post('/api/subscribe', async (req, res) => {
  const { email, firstName } = req.body;

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

  // Prevent duplicates
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

  await sendAdminEmail(
    `New Journal Subscriber — ${email}`,
    `<div style="font-family:sans-serif;"><p>New subscriber: <strong>${email}</strong></p><p>Subscribed at: ${subscriber.subscribedAt}</p></div>`
  );

  // Send welcome email to subscriber
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
});

// ─── API: Get submissions (admin — protect in production) ─────────────────────
app.get('/api/admin/submissions', (req, res) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.ADMIN_API_KEY && process.env.ADMIN_API_KEY) {
    return res.status(401).json({ success: false, message: 'Unauthorized.' });
  }
  res.json({ success: true, count: submissions.length, data: submissions });
});

app.get('/api/admin/subscribers', (req, res) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.ADMIN_API_KEY && process.env.ADMIN_API_KEY) {
    return res.status(401).json({ success: false, message: 'Unauthorized.' });
  }
  res.json({ success: true, count: subscribers.length, data: subscribers });
});

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// ─── SPA fallback — serve index.html for any unknown route ───────────────────
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n✦ Perfect Finish server running at http://localhost:${PORT}`);
  console.log(`  API endpoints:`);
  console.log(`  POST /api/contact       — consultation form`);
  console.log(`  POST /api/subscribe     — newsletter`);
  console.log(`  GET  /api/health        — health check\n`);
});
