'use strict';

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

// Email sending is optional: without BREVO_API_KEY + MAIL_FROM the app
// falls back to the security-question reset flow.
function isEmailConfigured() {
  return Boolean(process.env.BREVO_API_KEY && process.env.MAIL_FROM);
}

async function sendEmail(to, subject, html) {
  if (!isEmailConfigured()) return false;
  try {
    const res = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: process.env.MAIL_FROM_NAME || 'StudyMate', email: process.env.MAIL_FROM },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
    });
    return res.ok;
  } catch (_) {
    return false;
  }
}

function resetCodeEmail(code) {
  return `<div style="font-family:Arial,sans-serif;max-width:440px;margin:auto">
  <h2>StudyMate password reset</h2>
  <p>Your reset code is:</p>
  <p style="font-size:34px;font-weight:bold;letter-spacing:8px;background:#f2f2f7;padding:12px 18px;border-radius:10px;display:inline-block">${code}</p>
  <p>Type this code in the app to set a new password. It expires in 15 minutes.</p>
  <p style="color:#888;font-size:13px">If you did not ask for this, you can safely ignore this email.</p>
</div>`;
}

module.exports = { isEmailConfigured, sendEmail, resetCodeEmail };
