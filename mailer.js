require("dotenv").config();
const nodemailer = require("nodemailer");

function canSendEmail() {
  return (
    process.env.DRAFT_MODE === "false" &&
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  );
}

async function sendEmail({ to, subject, body }) {
  if (!canSendEmail()) {
    return {
      sent: false,
      reason: "DRAFT_MODE is on or SMTP is not configured. Email was not sent."
    };
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  const info = await transporter.sendMail({
    from: `"ThinkTANQ" <${process.env.SMTP_USER}>`,
    to,
    subject,
    text: body
  });

  return { sent: true, messageId: info.messageId };
}

module.exports = { sendEmail, canSendEmail };
