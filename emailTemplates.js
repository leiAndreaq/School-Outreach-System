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
  const contact  = meeting.contact_person || 'School Administrator';
  const school   = meeting.school_name    || 'your school';
  const d = meeting.meeting_date
    ? new Date(meeting.meeting_date + 'T00:00:00').toLocaleDateString('en-PH', {
        month: 'long', day: 'numeric', year: 'numeric'
      })
    : 'recently';
  const modeStr = meeting.meeting_mode === 'ONSITE' ? 'onsite visit' : 'online presentation';

  const compName    = process.env.COMPANY_NAME    || 'Accoutre AI';
  const compEmail   = process.env.COMPANY_EMAIL   || 'accoutre.ai.ph@gmail.com';
  const compPhone   = process.env.COMPANY_PHONE   || '(+63) 921 696 4799';
  const compAddress = process.env.COMPANY_ADDRESS || 'Unit 201, #61 Saudi Arabia St, Don Bosco, Parañaque City';

  const body = `Dear ${contact},

Good day.

Thank you for taking the time to attend our ${modeStr} on ${d}. We truly appreciate the opportunity to present ThinkTANQ's School Management System and Learning Management System to ${school}.

We hope the presentation gave you a clearer picture of how our platform can support your school's administration, teachers, students, and parents.

Should you have any questions, concerns, or would like to discuss further — whether about features, pricing, or a possible pilot arrangement — please feel free to reply directly to this email. We are always happy to assist.

We look forward to hearing from you and hope to have the privilege of supporting ${school}.

Respectfully,

${companyBlock()}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f0f2f8;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f8;padding:32px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0"
  style="max-width:600px;width:100%;border-radius:16px;overflow:hidden;
         box-shadow:0 4px 24px rgba(27,31,107,0.10);">

  <!-- HEADER -->
  <tr>
    <td style="background:linear-gradient(135deg,#07092b 0%,#1B1F6B 100%);
               padding:32px 44px 28px;text-align:center;">
      <div style="font-size:22px;font-weight:800;color:#fff;letter-spacing:1px;">
        Path<span style="color:#e63946;">Finder</span>
      </div>
      <div style="font-size:11px;color:#a5b4fc;letter-spacing:2px;
                  text-transform:uppercase;margin-top:4px;">
        by ${compName}
      </div>
    </td>
  </tr>

  <!-- THANK YOU BANNER -->
  <tr>
    <td style="background:#1B1F6B;padding:0 44px 28px;text-align:center;">
      <div style="background:#fff;border-radius:12px;padding:20px 24px;">
        <div style="width:52px;height:52px;background:#dcfce7;border-radius:50%;
                    margin:0 auto 12px;display:flex;align-items:center;justify-content:center;">
          <span style="font-size:26px;">&#10003;</span>
        </div>
        <div style="font-size:18px;font-weight:800;color:#1B1F6B;margin-bottom:4px;">
          Thank You for Attending!
        </div>
        <div style="font-size:13px;color:#6b7280;">
          We appreciate the time you gave us on ${d}.
        </div>
      </div>
    </td>
  </tr>

  <!-- BODY -->
  <tr>
    <td style="background:#ffffff;padding:32px 44px 8px;">
      <p style="font-size:14px;color:#374151;margin:0 0 16px;">Dear <strong>${contact}</strong>,</p>
      <p style="font-size:14px;color:#374151;line-height:1.7;margin:0 0 16px;">
        Good day. Thank you for taking the time to attend our <strong>${modeStr}</strong> on <strong>${d}</strong>.
        We truly appreciate the opportunity to present our School Management System and
        Learning Management System to <strong>${school}</strong>.
      </p>
      <p style="font-size:14px;color:#374151;line-height:1.7;margin:0 0 24px;">
        We hope the presentation gave you a clear picture of how ThinkTANQ can help simplify
        your school's daily operations, support your teachers, and deliver a better experience
        for your students and parents.
      </p>
    </td>
  </tr>

  <!-- WHAT'S NEXT -->
  <tr>
    <td style="background:#ffffff;padding:0 44px 28px;">
      <p style="font-size:11px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;
                color:#9ca3af;margin:0 0 14px;">What You Can Do Next</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${[
          ['&#x2709;', 'Have Questions?',
           'Reply directly to this email and our team will get back to you as soon as possible.'],
          ['&#128172;', 'Want to Discuss Further?',
           'Whether it is about specific features, pricing, or a pilot arrangement — we are open to any conversation.'],
          ['&#128197;', 'Ready for a Follow-Up?',
           'If you would like another session with more of your team or a deeper walkthrough, just reply and we will set it up.'],
        ].map(([icon, title, desc]) => `
        <tr>
          <td style="padding:10px 14px 10px 0;vertical-align:top;width:36px;">
            <div style="width:36px;height:36px;background:#f0f2ff;border-radius:8px;
                        text-align:center;line-height:36px;font-size:18px;">
              ${icon}
            </div>
          </td>
          <td style="padding:10px 0;">
            <div style="font-size:13px;font-weight:700;color:#1B1F6B;margin-bottom:3px;">${title}</div>
            <div style="font-size:13px;color:#6b7280;line-height:1.6;">${desc}</div>
          </td>
        </tr>`).join('')}
      </table>
    </td>
  </tr>

  <!-- CTA -->
  <tr>
    <td style="background:#ffffff;padding:0 44px 32px;text-align:center;">
      <div style="background:#fdf2f2;border-radius:12px;padding:20px 24px;">
        <p style="font-size:14px;color:#374151;margin:0 0 14px;line-height:1.7;">
          We look forward to hearing from you and hope to have the privilege of
          supporting <strong>${school}</strong> on its journey toward a more modern and
          efficient school system.
        </p>
        <a href="mailto:${compEmail}?subject=Re: ThinkTANQ Presentation — ${school}"
          style="display:inline-block;background:#8b0000;color:#fff;
                 font-size:13px;font-weight:700;padding:12px 28px;
                 border-radius:8px;text-decoration:none;letter-spacing:0.3px;">
          Reply to This Email
        </a>
      </div>
    </td>
  </tr>

  <!-- FOOTER -->
  <tr>
    <td style="background:#ffffff;border-top:1px solid #dde3f5;
               padding:20px 44px 24px;text-align:center;
               font-size:11px;color:#94a3b8;line-height:2;">
      <strong style="color:#374263;">${compName}</strong><br>
      ${compAddress}<br>
      <a href="mailto:${compEmail}" style="color:#9ca3af;text-decoration:none;">${compEmail}</a>
      &nbsp;|&nbsp; ${compPhone}<br><br>
      To unsubscribe, reply with &ldquo;unsubscribe&rdquo;
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`;

  return {
    subject: `Thank You for Attending — ${school}`,
    body,
    html
  };
}

function formatDateLong(d) {
  if (!d) return 'To be confirmed';
  const date = new Date(d + 'T00:00:00');
  return date.toLocaleDateString('en-PH', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
}

function thankYouInquiryTemplate(inquiry) {
  const contact  = inquiry.contact_person || 'Valued Partner';
  const school   = inquiry.school_name    || '';
  const date     = formatDateLong(inquiry.preferred_date);
  const time     = inquiry.preferred_time || 'To be confirmed';
  const mode     = inquiry.preferred_mode === 'ONSITE'
    ? 'Onsite — At your school'
    : 'Online — Google Meet / Zoom';

  const compName    = process.env.COMPANY_NAME    || 'Accoutre AI';
  const compEmail   = process.env.COMPANY_EMAIL   || 'accoutre.ai.ph@gmail.com';
  const compPhone   = process.env.COMPANY_PHONE   || '(+63) 921 696 4799';
  const compAddress = process.env.COMPANY_ADDRESS || 'Unit 201, #61 Saudi Arabia St, Don Bosco, Parañaque City';

  const videoLink  = 'https://drive.google.com/file/d/1gSNqSGe0LIHJ-h3BFfnShDFvzdfK3-Ae/view?usp=sharing';
  const videoThumb = 'https://drive.google.com/thumbnail?id=1gSNqSGe0LIHJ-h3BFfnShDFvzdfK3-Ae&sz=w640';

  const infoRow = (label, value) => value ? `
    <tr>
      <td style="padding:9px 14px;font-size:13px;color:#6b7280;font-weight:600;
                 width:40%;border-bottom:1px solid #f0f0f5;">${label}</td>
      <td style="padding:9px 14px;font-size:13px;color:#1e2a5e;font-weight:500;
                 border-bottom:1px solid #f0f0f5;">${value}</td>
    </tr>` : '';

  return {
    subject: `Inquiry Received — Thank you, ${contact}!`,
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#07092b;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#07092b;">
<tr><td align="center" style="padding:36px 16px;">
<table width="580" cellpadding="0" cellspacing="0"
  style="max-width:580px;width:100%;border-radius:20px;overflow:hidden;
         box-shadow:0 40px 80px rgba(0,0,0,0.6),0 0 0 1px rgba(255,255,255,0.06);">

  <!-- HEADER -->
  <tr>
    <td style="background:linear-gradient(155deg,#1e2a8a 0%,#111860 55%,#0d1240 100%);
               padding:36px 44px 30px;text-align:center;">
      <div style="display:inline-block;background:rgba(255,255,255,0.08);
                  border:1px solid rgba(255,255,255,0.14);border-radius:40px;
                  padding:5px 18px;font-size:10px;font-weight:700;
                  letter-spacing:2.5px;text-transform:uppercase;
                  color:#a5b4f8;margin-bottom:16px;">
        &#9679;&nbsp;&nbsp;ThinkTANQ PathFinder
      </div><br>
      <span style="font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">ACCOUTRE</span>
      <span style="font-size:28px;font-weight:800;color:#e8c56a;letter-spacing:-0.5px;">&nbsp;Ai</span><br>
      <span style="font-size:11px;color:rgba(255,255,255,0.45);letter-spacing:1.2px;
                   display:inline-block;margin-top:8px;">
        School Management &amp; Learning Systems
      </span>
    </td>
  </tr>

  <!-- SUCCESS BANNER -->
  <tr>
    <td style="background:#1a3a1a;padding:14px 44px;text-align:center;
               border-bottom:2px solid #22c55e;">
      <span style="font-size:13px;font-weight:700;color:#86efac;letter-spacing:0.5px;">
        &#10003;&nbsp;&nbsp;Inquiry Received Successfully
      </span>
    </td>
  </tr>

  <!-- BODY -->
  <tr>
    <td style="background:#f7f8fc;padding:36px 44px 28px;">

      <!-- Greeting -->
      <p style="font-size:20px;font-weight:800;color:#0d1240;margin:0 0 6px;">
        Thank you, ${contact}!
      </p>
      <p style="font-size:14px;color:#4b5563;line-height:1.8;margin:0 0 28px;">
        We have received your inquiry from <strong style="color:#1e2a8a;">${school}</strong>.
        Our team will review your submission and reach out within <strong>24 hours</strong>
        to confirm your presentation schedule.
      </p>

      <!-- Submitted Info -->
      <p style="font-size:11px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;
                color:#9ca3af;margin:0 0 10px;">Submitted Information</p>
      <table width="100%" cellpadding="0" cellspacing="0"
        style="border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;margin-bottom:28px;">
        ${infoRow('School Name',    school)}
        ${infoRow('School Type',    inquiry.school_type)}
        ${infoRow('Level Offered',  inquiry.level_offered)}
        ${infoRow('Location',       inquiry.city_province)}
        ${infoRow('Contact Person', contact)}
        ${infoRow('Position',       inquiry.position)}
        ${infoRow('Phone',          inquiry.phone)}
      </table>

      <!-- SCHEDULE HIGHLIGHT -->
      <table width="100%" cellpadding="0" cellspacing="0"
        style="background:linear-gradient(135deg,#fff0f0 0%,#fff5f5 100%);
               border:2px solid #C0191A;border-radius:14px;overflow:hidden;margin-bottom:28px;">
        <tr>
          <td style="background:linear-gradient(135deg,#8b0000 0%,#C0191A 100%);
                     padding:12px 22px;">
            <span style="font-size:11px;font-weight:700;letter-spacing:2px;
                         text-transform:uppercase;color:#fff;">
              &#128197;&nbsp; Your Demo Schedule
            </span>
          </td>
        </tr>
        <tr>
          <td style="padding:22px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="width:50%;padding-right:12px;">
                  <div style="font-size:10px;font-weight:700;letter-spacing:1.5px;
                               text-transform:uppercase;color:#9b1c1c;margin-bottom:6px;">Date</div>
                  <div style="font-size:15px;font-weight:800;color:#1e2a5e;line-height:1.4;">
                    ${date}
                  </div>
                </td>
                <td style="width:25%;padding-right:12px;border-left:1px solid #fca5a5;padding-left:12px;">
                  <div style="font-size:10px;font-weight:700;letter-spacing:1.5px;
                               text-transform:uppercase;color:#9b1c1c;margin-bottom:6px;">Time</div>
                  <div style="font-size:15px;font-weight:800;color:#1e2a5e;">
                    ${time}
                  </div>
                </td>
                <td style="width:25%;border-left:1px solid #fca5a5;padding-left:12px;">
                  <div style="font-size:10px;font-weight:700;letter-spacing:1.5px;
                               text-transform:uppercase;color:#9b1c1c;margin-bottom:6px;">Mode</div>
                  <div style="font-size:13px;font-weight:700;color:#1e2a5e;">
                    ${mode}
                  </div>
                </td>
              </tr>
            </table>
            <p style="font-size:12px;color:#6b7280;margin:14px 0 0;font-style:italic;">
              This schedule is subject to confirmation. Our team will send you a final confirmation email shortly.
            </p>
          </td>
        </tr>
      </table>

      <!-- VIDEO SECTION -->
      <p style="font-size:11px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;
                color:#9ca3af;margin:0 0 12px;">About Us</p>
      <a href="${videoLink}" target="_blank" style="display:block;text-decoration:none;margin-bottom:28px;">
        <img src="${videoThumb}" alt="Accoutre AI Company Profile"
          width="100%" style="display:block;width:100%;border-radius:12px;border:2px solid #e5e7eb;"/>
      </a>

      <!-- NEXT STEPS -->
      <p style="font-size:11px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;
                color:#9ca3af;margin:0 0 14px;">What Happens Next</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
        ${[
          ['1', 'Our team reviews your inquiry and verifies your school details.'],
          ['2', 'We send you a confirmation email with the final meeting details.'],
          ['3', 'We present the ThinkTANQ School Management System to your team.'],
          ['4', 'You decide if it\'s a good fit — absolutely no pressure!']
        ].map(([n, t]) => `
        <tr>
          <td style="width:36px;vertical-align:top;padding:0 12px 14px 0;">
            <div style="width:28px;height:28px;background:linear-gradient(135deg,#1e2a8a,#111860);
                        border-radius:50%;text-align:center;line-height:28px;
                        font-size:12px;font-weight:800;color:#fff;">${n}</div>
          </td>
          <td style="font-size:13px;color:#374151;line-height:1.7;padding-bottom:14px;
                     border-bottom:1px solid #f3f4f6;vertical-align:top;padding-top:4px;">
            ${t}
          </td>
        </tr>`).join('')}
      </table>

      <!-- QUESTIONS -->
      <div style="background:#f0f4ff;border-radius:10px;padding:16px 20px;
                  border-left:3px solid #1e2a8a;">
        <p style="font-size:13px;color:#1e2a8a;font-weight:700;margin:0 0 4px;">
          Questions?
        </p>
        <p style="font-size:13px;color:#4b5563;margin:0;line-height:1.7;">
          Reply to this email or contact us at
          <a href="mailto:${compEmail}" style="color:#C0191A;font-weight:600;
             text-decoration:none;">${compEmail}</a>
        </p>
      </div>

    </td>
  </tr>

  <!-- FOOTER -->
  <tr>
    <td style="background:#ffffff;border-top:1px solid #dde3f5;
               padding:20px 44px 24px;text-align:center;
               font-size:11px;color:#94a3b8;line-height:2;">
      <strong style="color:#374263;">${compName}</strong><br>
      ${compAddress}<br>
      <a href="mailto:${compEmail}" style="color:#9ca3af;text-decoration:none;">${compEmail}</a>
      &nbsp;|&nbsp; ${compPhone}<br><br>
      To unsubscribe, reply with &ldquo;unsubscribe&rdquo;
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`
  };
}

// ── PROMOTIONAL EMAIL TEMPLATES ──
// Shared header/footer builders for promo emails
function promoHeader(compName) {
  return `
  <tr>
    <td style="background:linear-gradient(135deg,#07092b 0%,#1B1F6B 100%);
               padding:32px 44px 28px;text-align:center;">
      <div style="font-size:22px;font-weight:800;color:#fff;letter-spacing:1px;">
        Path<span style="color:#e63946;">Finder</span>
      </div>
      <div style="font-size:11px;color:#a5b4fc;letter-spacing:2px;
                  text-transform:uppercase;margin-top:4px;">by ${compName}</div>
    </td>
  </tr>`;
}

function promoFooter(compName, compAddress, compEmail, compPhone, unsubLink) {
  return `
  <tr>
    <td style="background:#fff;border-top:1px solid #dde3f5;
               padding:20px 44px 24px;text-align:center;
               font-size:11px;color:#94a3b8;line-height:2;">
      <strong style="color:#374263;">${compName}</strong><br>
      ${compAddress}<br>
      <a href="mailto:${compEmail}" style="color:#9ca3af;text-decoration:none;">${compEmail}</a>
      &nbsp;|&nbsp; ${compPhone}<br><br>
      You are receiving this because your school was listed in our outreach database.<br>
      <a href="${unsubLink}" style="color:#e63946;text-decoration:underline;">Unsubscribe</a>
    </td>
  </tr>`;
}

function promoWrapper(rows) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f0f2f8;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f8;padding:32px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0"
  style="max-width:600px;width:100%;border-radius:16px;overflow:hidden;
         box-shadow:0 4px 24px rgba(27,31,107,0.10);">
  ${rows}
</table>
</td></tr>
</table>
</body>
</html>`;
}

// Template 1 — Introduction: Who we are and what we do
function promoTemplate1(school, trackInquireUrl, unsubUrl) {
  const compName    = process.env.COMPANY_NAME    || 'Accoutre AI';
  const compEmail   = process.env.COMPANY_EMAIL   || 'accoutre.ai.ph@gmail.com';
  const compPhone   = process.env.COMPANY_PHONE   || '(+63) 921 696 4799';
  const compAddress = process.env.COMPANY_ADDRESS || 'Unit 201, #61 Saudi Arabia St, Don Bosco, Parañaque City';
  const contact     = school.contact_person || 'School Administrator';
  const schoolName  = school.school_name    || 'your school';

  const html = promoWrapper(`
  ${promoHeader(compName)}
  <tr>
    <td style="background:#1B1F6B;padding:28px 44px;text-align:center;">
      <div style="font-size:24px;font-weight:800;color:#fff;line-height:1.3;">
        A Smarter Way to Run<br/>Your School
      </div>
      <div style="font-size:14px;color:#a5b4fc;margin-top:10px;">
        Introducing ThinkTANQ PathFinder — built for Philippine private schools
      </div>
    </td>
  </tr>
  <tr>
    <td style="background:#fff;padding:32px 44px;">
      <p style="font-size:14px;color:#374151;margin:0 0 16px;">Dear <strong>${contact}</strong>,</p>
      <p style="font-size:14px;color:#374151;line-height:1.8;margin:0 0 16px;">
        Good day. We are <strong>ThinkTANQ</strong>, a Philippine-based technology company that builds
        School Management and Learning Management Systems specifically designed for private schools
        across the country.
      </p>
      <p style="font-size:14px;color:#374151;line-height:1.8;margin:0 0 24px;">
        We built <strong>PathFinder</strong> to help schools like <strong>${schoolName}</strong> simplify
        daily operations — from enrollment and attendance to grading, report cards, and parent communication
        — all in one platform.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
        ${[
          ['📋', 'School Management', 'Enrollment, attendance, student records, report cards, and more.'],
          ['📚', 'Learning Management', 'Modules, assessments, e-library, and AI-assisted teacher tools.'],
          ['👨‍👩‍👧', 'Parent & Student Portal', 'Real-time access for parents and students on any device.'],
        ].map(([icon, title, desc]) => `
        <tr>
          <td style="padding:8px 12px 8px 0;vertical-align:top;width:36px;font-size:22px;">${icon}</td>
          <td style="padding:8px 0;">
            <div style="font-size:13px;font-weight:700;color:#1B1F6B;">${title}</div>
            <div style="font-size:13px;color:#6b7280;line-height:1.6;">${desc}</div>
          </td>
        </tr>`).join('')}
      </table>
      <div style="text-align:center;margin-bottom:8px;">
        <a href="${trackInquireUrl}" style="display:inline-block;background:#8b0000;color:#fff;
           font-size:13px;font-weight:700;padding:13px 32px;border-radius:8px;
           text-decoration:none;letter-spacing:0.3px;">
          Book a Free Demo
        </a>
      </div>
      <p style="font-size:12px;color:#9ca3af;text-align:center;margin:8px 0 0;">
        No commitment required. Just a short 20–30 minute presentation.
      </p>
    </td>
  </tr>
  ${promoFooter(compName, compAddress, compEmail, compPhone, unsubUrl)}`);

  return {
    subject: `Introducing ThinkTANQ — A Smarter Way to Run ${schoolName}`,
    html
  };
}

// Template 2 — Features & Benefits: What the system can do
function promoTemplate2(school, trackInquireUrl, unsubUrl) {
  const compName    = process.env.COMPANY_NAME    || 'Accoutre AI';
  const compEmail   = process.env.COMPANY_EMAIL   || 'accoutre.ai.ph@gmail.com';
  const compPhone   = process.env.COMPANY_PHONE   || '(+63) 921 696 4799';
  const compAddress = process.env.COMPANY_ADDRESS || 'Unit 201, #61 Saudi Arabia St, Don Bosco, Parañaque City';
  const contact     = school.contact_person || 'School Administrator';
  const schoolName  = school.school_name    || 'your school';

  const features = [
    ['Enrollment & Admission',    'Paperless enrollment with automated student ID generation.'],
    ['Attendance Monitoring',     'Daily attendance tracking with parent notifications.'],
    ['Grading & Report Cards',    'Automated computation and digital report card generation.'],
    ['AI Teacher Assistant',      'Lesson planning, assessment creation, and item analysis powered by AI.'],
    ['E-Library',                 'Digital library accessible to students and teachers anytime.'],
    ['School Inventory',          'Track school assets and supplies in one place.'],
  ];

  const html = promoWrapper(`
  ${promoHeader(compName)}
  <tr>
    <td style="background:#1B1F6B;padding:28px 44px;text-align:center;">
      <div style="font-size:24px;font-weight:800;color:#fff;line-height:1.3;">
        Everything Your School Needs.<br/>One Platform.
      </div>
      <div style="font-size:14px;color:#a5b4fc;margin-top:10px;">
        See what ThinkTANQ PathFinder can do for ${schoolName}
      </div>
    </td>
  </tr>
  <tr>
    <td style="background:#fff;padding:32px 44px;">
      <p style="font-size:14px;color:#374151;margin:0 0 20px;">Dear <strong>${contact}</strong>,</p>
      <p style="font-size:14px;color:#374151;line-height:1.8;margin:0 0 24px;">
        Managing a school involves hundreds of moving parts every single day. ThinkTANQ PathFinder
        brings all of them together so your staff spends less time on paperwork and more time on
        what matters — your students.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0"
        style="border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;margin-bottom:24px;">
        ${features.map(([title, desc], i) => `
        <tr style="background:${i % 2 === 0 ? '#f9fafb' : '#fff'};">
          <td style="padding:12px 16px;border-bottom:1px solid #f0f0f5;">
            <div style="font-size:13px;font-weight:700;color:#1B1F6B;">${title}</div>
            <div style="font-size:12px;color:#6b7280;margin-top:2px;">${desc}</div>
          </td>
        </tr>`).join('')}
      </table>
      <div style="text-align:center;margin-bottom:8px;">
        <a href="${trackInquireUrl}" style="display:inline-block;background:#8b0000;color:#fff;
           font-size:13px;font-weight:700;padding:13px 32px;border-radius:8px;text-decoration:none;">
          See It In Action — Book a Demo
        </a>
      </div>
      <p style="font-size:12px;color:#9ca3af;text-align:center;margin:8px 0 0;">
        Reply to this email if you have questions. We respond within 24 hours.
      </p>
    </td>
  </tr>
  ${promoFooter(compName, compAddress, compEmail, compPhone, unsubUrl)}`);

  return {
    subject: `${schoolName} — Here's What ThinkTANQ PathFinder Can Do For You`,
    html
  };
}

// Template 3 — Problem & Solution: Pain points schools face
function promoTemplate3(school, trackInquireUrl, unsubUrl) {
  const compName    = process.env.COMPANY_NAME    || 'Accoutre AI';
  const compEmail   = process.env.COMPANY_EMAIL   || 'accoutre.ai.ph@gmail.com';
  const compPhone   = process.env.COMPANY_PHONE   || '(+63) 921 696 4799';
  const compAddress = process.env.COMPANY_ADDRESS || 'Unit 201, #61 Saudi Arabia St, Don Bosco, Parañaque City';
  const contact     = school.contact_person || 'School Administrator';
  const schoolName  = school.school_name    || 'your school';

  const problems = [
    ['Still encoding grades manually on Excel?',       'PathFinder automates grade computation and generates report cards instantly.'],
    ['Enrollment forms still done on paper?',          'Go fully paperless with digital enrollment, e-signatures, and automated ID generation.'],
    ['Parents always calling to check on their child?','Give parents real-time access through the student and parent portal.'],
    ['Teachers spending hours preparing lesson plans?', 'Our AI assistant helps teachers create lesson plans and assessments in minutes.'],
  ];

  const html = promoWrapper(`
  ${promoHeader(compName)}
  <tr>
    <td style="background:#1B1F6B;padding:28px 44px;text-align:center;">
      <div style="font-size:24px;font-weight:800;color:#fff;line-height:1.3;">
        Still Doing This Manually?
      </div>
      <div style="font-size:14px;color:#a5b4fc;margin-top:10px;">
        There is a better way — and we'd like to show you.
      </div>
    </td>
  </tr>
  <tr>
    <td style="background:#fff;padding:32px 44px;">
      <p style="font-size:14px;color:#374151;margin:0 0 16px;">Dear <strong>${contact}</strong>,</p>
      <p style="font-size:14px;color:#374151;line-height:1.8;margin:0 0 24px;">
        Many private schools in the Philippines are still running on manual processes — spreadsheets,
        paper forms, and disconnected tools. It works, but it costs your team time, energy, and
        accuracy every single day. ThinkTANQ PathFinder was built to solve exactly these problems.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
        ${problems.map(([problem, solution]) => `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #f0f0f5;vertical-align:top;">
            <div style="font-size:13px;font-weight:700;color:#8b0000;margin-bottom:4px;">❌ ${problem}</div>
            <div style="font-size:13px;color:#374151;line-height:1.6;">✅ ${solution}</div>
          </td>
        </tr>`).join('')}
      </table>
      <div style="background:#fdf2f2;border-radius:12px;padding:20px 24px;text-align:center;margin-bottom:0;">
        <p style="font-size:14px;color:#374151;margin:0 0 14px;">
          We would love to show <strong>${schoolName}</strong> how much time your team can save.
        </p>
        <a href="${trackInquireUrl}" style="display:inline-block;background:#8b0000;color:#fff;
           font-size:13px;font-weight:700;padding:13px 32px;border-radius:8px;text-decoration:none;">
          Book a Free 30-Minute Demo
        </a>
      </div>
    </td>
  </tr>
  ${promoFooter(compName, compAddress, compEmail, compPhone, unsubUrl)}`);

  return {
    subject: `Is ${schoolName} Still Doing These Things Manually?`,
    html
  };
}

// Template 4 — Call to Action / Limited Pilot Slots
function promoTemplate4(school, trackInquireUrl, unsubUrl) {
  const compName    = process.env.COMPANY_NAME    || 'Accoutre AI';
  const compEmail   = process.env.COMPANY_EMAIL   || 'accoutre.ai.ph@gmail.com';
  const compPhone   = process.env.COMPANY_PHONE   || '(+63) 921 696 4799';
  const compAddress = process.env.COMPANY_ADDRESS || 'Unit 201, #61 Saudi Arabia St, Don Bosco, Parañaque City';
  const contact     = school.contact_person || 'School Administrator';
  const schoolName  = school.school_name    || 'your school';

  const html = promoWrapper(`
  ${promoHeader(compName)}
  <tr>
    <td style="background:#8b0000;padding:28px 44px;text-align:center;">
      <div style="font-size:13px;font-weight:700;color:#fca5a5;letter-spacing:2px;
                  text-transform:uppercase;margin-bottom:10px;">Limited Pilot Slots Available</div>
      <div style="font-size:24px;font-weight:800;color:#fff;line-height:1.3;">
        Be One of the First Schools<br/>to Go Digital with ThinkTANQ
      </div>
    </td>
  </tr>
  <tr>
    <td style="background:#fff;padding:32px 44px;">
      <p style="font-size:14px;color:#374151;margin:0 0 16px;">Dear <strong>${contact}</strong>,</p>
      <p style="font-size:14px;color:#374151;line-height:1.8;margin:0 0 16px;">
        We have been reaching out to select private schools across the Philippines to join our
        <strong>pilot program</strong> for ThinkTANQ PathFinder — our complete School Management
        and Learning Management System.
      </p>
      <p style="font-size:14px;color:#374151;line-height:1.8;margin:0 0 24px;">
        Pilot schools receive <strong>priority onboarding, dedicated support, and introductory
        pricing</strong> not available to schools that join later. We only have a limited number
        of slots open this quarter, and we would love for <strong>${schoolName}</strong> to be part of it.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0"
        style="background:#f9fafb;border-radius:12px;padding:0;margin-bottom:24px;overflow:hidden;">
        ${[
          ['Priority Onboarding',      'Your school gets set up first with full team training.'],
          ['Dedicated Support Line',   'Direct access to our technical support team.'],
          ['Introductory Pricing',     'Special rates locked in for pilot schools.'],
          ['Feedback-Driven Updates',  'Your suggestions directly shape the next version.'],
        ].map(([title, desc]) => `
        <tr>
          <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;">
            <span style="font-size:13px;font-weight:700;color:#1B1F6B;">✦ ${title}</span>
            <span style="font-size:13px;color:#6b7280;"> — ${desc}</span>
          </td>
        </tr>`).join('')}
      </table>
      <div style="text-align:center;margin-bottom:8px;">
        <a href="${trackInquireUrl}" style="display:inline-block;background:#8b0000;color:#fff;
           font-size:14px;font-weight:800;padding:14px 36px;border-radius:8px;text-decoration:none;">
          Reserve Our Slot Now
        </a>
      </div>
      <p style="font-size:12px;color:#9ca3af;text-align:center;margin:8px 0 0;">
        Slots are limited. No payment required to book a demo.
      </p>
    </td>
  </tr>
  ${promoFooter(compName, compAddress, compEmail, compPhone, unsubUrl)}`);

  return {
    subject: `[Limited Slots] ${schoolName} — Join the ThinkTANQ Pilot Program`,
    html
  };
}

function getPromoTemplate(weekNumber, school, trackInquireUrl, unsubUrl) {
  const templates = [promoTemplate1, promoTemplate2, promoTemplate3, promoTemplate4];
  const fn = templates[(weekNumber - 1) % templates.length];
  return fn(school, trackInquireUrl, unsubUrl);
}

module.exports = {
  proposalTemplate,
  followUpTemplate,
  meetingInviteTemplate,
  meetingDayReminderTemplate,
  meetingHourReminderTemplate,
  postMeetingFollowUpTemplate,
  thankYouInquiryTemplate,
  promoTemplate1,
  promoTemplate2,
  promoTemplate3,
  promoTemplate4,
  getPromoTemplate,
  htmlWrap
};
