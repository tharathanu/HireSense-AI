// Sends email through any SMTP service (Gmail app password, Brevo, etc.).
// If SMTP is not configured, emails are skipped and only logged.
const nodemailer = require('nodemailer');
const prisma = require('./prisma');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return transporter;
}

function wrapHtml(title, message, link) {
  const appUrl = (process.env.CLIENT_URL || '').split(',')[0];
  const button = link && appUrl
    ? `<p style="margin:24px 0"><a href="${appUrl}${link}" style="background:#14213D;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Open HireSense AI</a></p>`
    : '';
  return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#14213D">
    <h2 style="margin:0 0 12px">${title}</h2>
    <p style="font-size:15px;line-height:1.6;color:#374151">${message}</p>
    ${button}
    <p style="font-size:12px;color:#6B7280">This message was sent by HireSense AI.</p>
  </div>`;
}

async function sendEmail({ userId, to, subject, message, link }) {
  const tx = getTransporter();
  if (!tx) {
    await prisma.emailLog.create({ data: { userId, toEmail: to, subject, status: 'SKIPPED', error: 'SMTP not configured' } });
    return false;
  }
  try {
    await tx.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to,
      subject,
      text: message,
      html: wrapHtml(subject, message, link),
    });
    await prisma.emailLog.create({ data: { userId, toEmail: to, subject, status: 'SENT' } });
    return true;
  } catch (err) {
    await prisma.emailLog.create({ data: { userId, toEmail: to, subject, status: 'FAILED', error: err.message.slice(0, 500) } });
    return false;
  }
}

module.exports = { sendEmail };
