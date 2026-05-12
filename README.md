# ThinkTANQ — School Outreach CRM

A custom CRM system for managing private school leads, generating outreach email drafts, and tracking sales pipeline status.

Built during internship at ThinkTANQ Business Creation & Management OPC.

---

## Tech Stack

- **Backend:** Node.js, Express.js
- **Database:** SQLite (via sqlite3)
- **Email:** Nodemailer (SMTP)
- **AI Email Generation:** OpenAI API (optional) or Free Template Mode
- **Frontend:** HTML, Tailwind CSS, Vanilla JavaScript

---

## Features

- Add and manage school leads
- Import school leads via CSV
- Generate proposal, follow-up, and meeting invite emails
- Track lead status through the sales pipeline
- Store email drafts for approval before sending
- Activity logs per school
- Free template mode (no API key needed)
- Optional OpenAI upgrade for AI-generated emails

---

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/leiAndreaq/School-Outreach-System.git
cd School-Outreach-System
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up your environment variables

**Windows:**
```bash
copy .env.example .env
```

**Mac/Linux:**
```bash
cp .env.example .env
```

Then open `.env` and fill in your details:
- `COMPANY_NAME`, `COMPANY_EMAIL`, `COMPANY_PHONE`
- `CALENDLY_LINK`
- Leave `OPENAI_API_KEY` blank to use free template mode

### 4. Start the server

```bash
npm start
```

### 5. Open in browser

```
http://localhost:3000
```

---

## Environment Variables

| Variable | Description | Required |
|---|---|---|
| `PORT` | Server port (default 3000) | No |
| `OPENAI_API_KEY` | OpenAI API key for AI emails | No |
| `COMPANY_NAME` | Your company name | Yes |
| `COMPANY_ADDRESS` | Your company address | Yes |
| `COMPANY_EMAIL` | Your company email | Yes |
| `COMPANY_PHONE` | Your company phone | Yes |
| `CALENDLY_LINK` | Booking link for school demos | Yes |
| `DRAFT_MODE` | Keep `true` during testing | Yes |
| `SMTP_HOST` | SMTP server host | Optional |
| `SMTP_USER` | SMTP email address | Optional |
| `SMTP_PASS` | SMTP email password | Optional |

---

## Project Structure

```
├── public/             # Frontend HTML, CSS, JS
├── uploads/            # Temporary CSV upload folder (auto-created)
├── server.js           # Main server and API routes
├── database.js         # SQLite database setup
├── ai.js               # Email generation logic
├── emailTemplates.js   # Free email templates
├── mailer.js           # Email sending logic
├── package.json        # Project dependencies
├── .env.example        # Environment variable template
└── .env                # Your private settings (never upload this)
```

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Check server status |
| GET | `/api/schools` | Get all school leads |
| POST | `/api/schools` | Add a new school lead |
| GET | `/api/schools/:id` | Get a single school |
| PATCH | `/api/schools/:id/status` | Update school status |
| POST | `/api/schools/:id/generate-email` | Generate email draft |
| GET | `/api/email-drafts` | Get all email drafts |
| POST | `/api/email-drafts/:id/send` | Send an email draft |
| POST | `/api/import-csv` | Import schools from CSV |
| GET | `/api/activity-logs/:schoolId` | Get activity logs |

---

## Lead Status Flow

```
NEW_LEAD → PROPOSAL_GENERATED → FOR_APPROVAL → EMAIL_SENT
→ FOLLOW_UP_1 → INTERESTED → PRESENTATION_SCHEDULED
→ PRESENTED → NEGOTIATION → CLOSED_WON / CLOSED_LOST
```

---

## Important Notes

- **Never** upload your `.env` file to GitHub
- Keep `DRAFT_MODE=true` until emails are approved by management
- The `uploads/` folder is temporary and not tracked by Git
- Always run `npm install` after cloning — never upload `node_modules/`
- The database file `*.db` is not tracked by Git — each developer has their own local database

---

## For New Team Members

1. Clone the repo
2. Run `npm install`
3. Copy `.env.example` to `.env` and fill in your details
4. Run `npm start`
5. Open `http://localhost:3000`

That's it! Ask the project lead for the actual `.env` values.

---

## Internship Context

This system was built as part of a BSIT internship at ThinkTANQ Business Creation & Management OPC, Parañaque City, Philippines.

This is a private repository. Do not share or redistribute without permission.
