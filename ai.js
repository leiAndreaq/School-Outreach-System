require("dotenv").config();
const OpenAI = require("openai");
const { proposalTemplate, followUpTemplate, meetingInviteTemplate } = require("./emailTemplates");

function hasApiKey() {
  return process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim().length > 10;
}

async function generateWithOpenAI(school, emailType) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const prompt = `
You are the AI Sales Assistant of ThinkTANQ Business Creation & Management OPC.

Write a professional outreach email for a private school in the Philippines.

Email type: ${emailType}

Company details:
Name: ${process.env.COMPANY_NAME}
Address: ${process.env.COMPANY_ADDRESS}
Email: ${process.env.COMPANY_EMAIL}
Phone: ${process.env.COMPANY_PHONE}

School details:
School name: ${school.school_name}
Contact person: ${school.contact_person || "School Administrator"}
Location: ${school.city_province || school.region || school.address || "Philippines"}
School type: ${school.school_type || "Private School"}
Level offered: ${school.level_offered || "Not specified"}
Estimated students: ${school.estimated_students || "Not specified"}

Product:
AI-assisted School Management System and Learning Management System for private schools.

Features to mention:
enrollment, admissions, student records, attendance, grading, report cards, LMS, course content, assessments, AI teacher assistance, lesson planning, item analysis, e-library, ID generation, school inventory, parent/student portal, analytics dashboard, multi-campus monitoring, year-round support.

Rules:
- Respectful, warm, professional.
- Do not sound spammy.
- Do not make false DepEd accreditation claims.
- Invite them to a 20-30 minute online or onsite presentation.
- Include opt-out/unsubscribe sentence.
- Return only valid JSON with "subject" and "body".
`;

  const response = await client.responses.create({
    model: "gpt-5.2",
    input: prompt
  });

  const text = response.output_text.trim();

  try {
    return JSON.parse(text);
  } catch (err) {
    return {
      subject: `Invitation for School Management and Learning Management System Presentation`,
      body: text
    };
  }
}

async function generateEmail(school, emailType) {
  if (!hasApiKey()) {
    if (emailType === "FOLLOW_UP") return followUpTemplate(school);
    if (emailType === "MEETING_INVITE") return meetingInviteTemplate(school);
    return proposalTemplate(school); // PROPOSAL and PROMOTIONAL both use this
  }

  return await generateWithOpenAI(school, emailType);
}

module.exports = { generateEmail, hasApiKey };
