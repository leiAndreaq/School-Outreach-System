require("dotenv").config();
const nodemailer = require("nodemailer");

function canSendEmail() {
  return (
    process.env.DRAFT_MODE === "false" &&
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS &&
    process.env.COMPANY_EMAIL
  );
}

async function sendEmail({ to, subject, body }) {
  if (!canSendEmail()) {
    const reasons = [];
    if (process.env.DRAFT_MODE !== "false")   reasons.push("DRAFT_MODE is not set to false");
    if (!process.env.SMTP_HOST)               reasons.push("SMTP_HOST is missing");
    if (!process.env.SMTP_USER)               reasons.push("SMTP_USER is missing");
    if (!process.env.SMTP_PASS)               reasons.push("SMTP_PASS is missing");
    if (!process.env.COMPANY_EMAIL)           reasons.push("COMPANY_EMAIL is missing");
    return { sent: false, reason: reasons.join("; ") };
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false, // STARTTLS on port 587
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    tls: {
      rejectUnauthorized: true
    }
  });

  const senderName = process.env.COMPANY_NAME || "ThinkTANQ";
  const senderEmail = process.env.COMPANY_EMAIL;

  const info = await transporter.sendMail({
    from: `"${senderName}" <${senderEmail}>`,
    to,
    subject,
    text: body
  });

  return { sent: true, messageId: info.messageId };
}

module.exports = { sendEmail, canSendEmail };
