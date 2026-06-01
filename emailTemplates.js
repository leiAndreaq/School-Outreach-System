function formatTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

function companyBlock() {
  return `${process.env.COMPANY_NAME}
${process.env.COMPANY_ADDRESS}
Email: ${process.env.COMPANY_EMAIL}
Phone: ${process.env.COMPANY_PHONE}`;
}

function proposalTemplate(school) {
  const contact = school.contact_person || "School Administrator";
  const area = school.city_province || school.region || "your area";

  return {
    subject: `Invitation for School Management and Learning Management System Presentation`,
    body: `Dear ${contact},

Good day.

I hope this message finds you well. We are respectfully reaching out to ${school.school_name} to introduce ThinkTANQ's School Management System and Learning Management System designed for private schools in the Philippines.

Our system is created to help schools simplify daily operations and support teachers through technology. The platform may assist with enrollment, student records, attendance, grading, report cards, learning modules, assessments, e-library, ID generation, school inventory, parent/student portal, and analytics.

We also offer AI-assisted support for teachers, including lesson preparation, assessment creation, item analysis, and learning support tools. Our goal is to help schools become more future-ready while reducing manual administrative work.

We would like to invite your school to a short 20 to 30-minute online or onsite presentation so we can show how the system may support your school operations and academic delivery.

Please reply to this email with your preferred date and time, and we will arrange a schedule that works best for you.

We currently have an introductory presentation and possible pilot/promo arrangement for qualified schools.

If this is not the proper office or person to contact, we would appreciate being referred to the appropriate administrator. If you prefer not to receive further messages from us, kindly reply "unsubscribe" and we will respectfully remove your contact from our outreach list.

Respectfully,

${companyBlock()}`
  };
}

function followUpTemplate(school) {
  const contact = school.contact_person || "School Administrator";

  return {
    subject: `Follow-up: School System Presentation Invitation`,
    body: `Dear ${contact},

Good day.

May we respectfully follow up on our invitation to present ThinkTANQ's School Management System and Learning Management System to ${school.school_name}?

The system is designed to help private schools manage enrollment, attendance, grading, records, learning content, assessments, parent/student access, analytics, and teacher support in one platform.

We would be glad to schedule a short presentation at your most convenient time.

Simply reply to this email with your preferred date and time.

Thank you and we hope to have the opportunity to present to your school.

Respectfully,

${companyBlock()}`
  };
}

function meetingInviteTemplate(school) {
  const contact = school.contact_person || "School Administrator";
  return {
    subject: `Proposed Presentation Schedule for ThinkTANQ School System`,
    body: `Dear ${contact},

Good day.

Thank you for your interest in ThinkTANQ's School Management System and Learning Management System.

May we propose a 20 to 30-minute presentation to show the features of the system and how it can help your school administration, teachers, students, and parents?

Please reply to this email with your preferred date and time and we will confirm the schedule promptly.

We may conduct the presentation online or onsite, depending on your preference.

Respectfully,

${companyBlock()}`
  };
}

function htmlWrap(body) {
  const htmlBody = body
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/\n/g, '<br>');

  const name    = process.env.COMPANY_NAME    || 'ThinkTANQ';
  const address = process.env.COMPANY_ADDRESS || '';
  const email   = process.env.COMPANY_EMAIL   || '';
  const phone   = process.env.COMPANY_PHONE   || '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#0d1240;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d1240;">
    <tr><td align="center" style="padding:36px 16px;">
      <table width="580" cellpadding="0" cellspacing="0"
        style="max-width:580px;width:100%;border-radius:20px;overflow:hidden;
               box-shadow:0 40px 80px rgba(0,0,0,0.55),0 0 0 1px rgba(255,255,255,0.06);">

        <!-- HEADER — matches login left panel -->
        <tr>
          <td style="background:linear-gradient(155deg,#1e2a8a 0%,#111860 55%,#0d1240 100%);
                     padding:36px 44px 32px;text-align:center;">
            <div style="display:inline-block;background:rgba(255,255,255,0.08);
                        border:1px solid rgba(255,255,255,0.12);border-radius:40px;
                        padding:5px 16px;font-size:10px;font-weight:600;
                        letter-spacing:2px;text-transform:uppercase;
                        color:#a5b4f8;margin-bottom:18px;">
              &#9679;&nbsp;&nbsp;ThinkTANQ Platform
            </div><br>
            <span style="font-size:30px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">
              ACCOUTRE
            </span>
            <span style="font-size:30px;font-weight:800;color:#e8c56a;letter-spacing:-0.5px;">
              &nbsp;Ai
            </span><br>
            <span style="font-size:12px;color:rgba(255,255,255,0.45);letter-spacing:1px;
                         display:inline-block;margin-top:8px;">
              School Management &amp; Learning Systems
            </span>
          </td>
        </tr>

        <!-- BODY — matches login right panel -->
        <tr>
          <td style="background:#f7f8fc;padding:40px 44px 32px;
                     color:#374263;font-size:14px;line-height:1.95;">
            ${htmlBody}
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td style="background:#ffffff;border-top:1px solid #dde3f5;
                     padding:18px 44px 22px;text-align:center;
                     font-size:11px;color:#94a3b8;line-height:1.9;">
            <strong style="color:#374263;">${name}</strong><br>
            ${address}<br>
            ${email}&nbsp;&nbsp;|&nbsp;&nbsp;${phone}<br><br>
            To unsubscribe, reply with &ldquo;unsubscribe&rdquo;
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function meetingDayReminderTemplate(meeting) {
  const contact = meeting.contact_person || 'School Administrator';
  const time    = formatTime(meeting.meeting_time);
  const modeStr = meeting.meeting_mode === 'ONSITE' ? 'Onsite' : 'Online';
  const linkLine    = meeting.meeting_link    ? `\nMeeting Link : ${meeting.meeting_link}`    : '';
  const addressLine = meeting.meeting_address ? `\nVenue        : ${meeting.meeting_address}` : '';

  return {
    subject: `Reminder: Your Presentation with ThinkTANQ is Today at ${time}`,
    body: `Dear ${contact},

Good day.

This is a friendly reminder that your scheduled presentation with ThinkTANQ is happening today.

Presentation Details:
  School : ${meeting.school_name}
  Date   : Today, ${meeting.meeting_date}
  Time   : ${time}
  Mode   : ${modeStr}${linkLine}${addressLine}

We look forward to presenting ThinkTANQ's School Management System and Learning Management System to your institution. Should you need to reschedule or have any questions, please do not hesitate to reply to this email.

Respectfully,

${companyBlock()}`
  };
}

function meetingHourReminderTemplate(meeting) {
  const contact = meeting.contact_person || 'School Administrator';
  const time    = formatTime(meeting.meeting_time);
  const modeStr = meeting.meeting_mode === 'ONSITE' ? 'Onsite' : 'Online';
  const linkLine    = meeting.meeting_link    ? `\nMeeting Link : ${meeting.meeting_link}`    : '';
  const addressLine = meeting.meeting_address ? `\nVenue        : ${meeting.meeting_address}` : '';

  return {
    subject: `Starting in 1 Hour: ThinkTANQ Presentation for ${meeting.school_name}`,
    body: `Dear ${contact},

Good day.

Your ThinkTANQ presentation is starting in approximately 1 hour. Please make sure you are ready.

Presentation Details:
  School : ${meeting.school_name}
  Time   : ${time} today
  Mode   : ${modeStr}${linkLine}${addressLine}

We look forward to speaking with you shortly. If you have any last-minute concerns, please reply to this email right away.

Respectfully,

${companyBlock()}`
  };
}

function postMeetingFollowUpTemplate(meeting) {
  const contact = meeting.contact_person || 'School Administrator';
  const d = meeting.meeting_date
    ? new Date(meeting.meeting_date + 'T00:00:00').toLocaleDateString('en-PH', {
        month: 'long', day: 'numeric', year: 'numeric'
      })
    : 'recently';
  const modeStr = meeting.meeting_mode === 'ONSITE' ? 'onsite visit' : 'online presentation';

  return {
    subject: `Thank You — Follow-up After Our Presentation with ${meeting.school_name}`,
    body: `Dear ${contact},

Good day.

Thank you for taking the time to attend our ${modeStr} on ${d}. We truly appreciate the opportunity to present ThinkTANQ's School Management System and Learning Management System to ${meeting.school_name}.

We hope the presentation gave you a clearer picture of how the platform can support your school's administration, teachers, students, and parents.

If you have any questions or would like to see a more detailed walkthrough of specific features, we would be happy to arrange a follow-up session at your most convenient time.

We look forward to hearing from you and hope to have the privilege of supporting your school.

Respectfully,

${companyBlock()}`
  };
}

module.exports = {
  proposalTemplate,
  followUpTemplate,
  meetingInviteTemplate,
  meetingDayReminderTemplate,
  meetingHourReminderTemplate,
  postMeetingFollowUpTemplate,
  htmlWrap
};
