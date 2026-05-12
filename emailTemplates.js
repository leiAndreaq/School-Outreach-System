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

You may choose a convenient schedule here:
${process.env.CALENDLY_LINK}

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

Schedule link:
${process.env.CALENDLY_LINK}

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

You may select your preferred schedule here:
${process.env.CALENDLY_LINK}

We may conduct the presentation online or onsite, depending on your preference.

Respectfully,

${companyBlock()}`
  };
}

module.exports = {
  proposalTemplate,
  followUpTemplate,
  meetingInviteTemplate
};
