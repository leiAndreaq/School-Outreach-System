require("dotenv").config();

// ── .ENV VALIDATION ──
(function validateEnv() {
  // These must be set — server cannot function safely without them
  const required = [
    { key: "SESSION_SECRET", hint: "Set a long random string (e.g. run: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\")" },
  ];

  // These are optional now but should be filled before go-live
  const recommended = [
    { key: "COMPANY_NAME",  hint: "Your company name shown in email templates" },
    { key: "COMPANY_EMAIL", hint: "Your business email address — needed for sending emails" },
    { key: "COMPANY_PHONE", hint: "Your contact number shown in email templates" },
    { key: "SMTP_HOST",     hint: "Brevo SMTP host — required for sending emails (smtp-relay.brevo.com)" },
    { key: "SMTP_USER",     hint: "Brevo SMTP username (your Brevo account email)" },
    { key: "SMTP_PASS",     hint: "Brevo SMTP password/API key" },
    // CRM_PASSWORD is only needed if the database is wiped and needs re-seeding.
    // Once the hash is stored in the DB, this can stay blank.
  ];

  const missing = required.filter(v => !process.env[v.key]?.trim());

  if (missing.length > 0) {
    console.error("\n╔══════════════════════════════════════════════════════════╗");
    console.error("║           STARTUP FAILED — MISSING REQUIRED .ENV        ║");
    console.error("╚══════════════════════════════════════════════════════════╝");
    missing.forEach(v => {
      console.error(`\n  ✖ ${v.key} is not set`);
      console.error(`    → ${v.hint}`);
    });
    console.error("\n  Fix the above in your .env file and restart the server.\n");
    process.exit(1);
  }

  const unset = recommended.filter(v => !process.env[v.key]?.trim());

  if (unset.length > 0) {
    console.warn("\n┌──────────────────────────────────────────────────────────┐");
    console.warn("│        WARNING — RECOMMENDED .ENV VALUES NOT SET         │");
    console.warn("└──────────────────────────────────────────────────────────┘");
    unset.forEach(v => {
      console.warn(`\n  ⚠  ${v.key} is not set`);
      console.warn(`     → ${v.hint}`);
    });
    console.warn("\n  Server is starting, but some features will not work correctly.");
    console.warn("  Fill these in .env before going live.\n");
  }
})();

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const multer = require("multer");
const fs = require("fs");
const csv = require("csv-parser");

const rateLimit = require("express-rate-limit");

const { body, validationResult } = require("express-validator");

const cron = require("node-cron");
const path = require("path");

const session = require("express-session");
const bcrypt  = require("bcryptjs");

// ── RATE LIMITERS ──

// Inquiry form — max 3 submissions per hour per IP
const inquiryLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: {
    error: "Too many inquiries submitted from your connection. Please try again after 1 hour.",
    code: "RATE_LIMITED"
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// General API protection — max 100 requests per 15 minutes per IP
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: {
    error: "Too many requests. Please slow down.",
    code: "RATE_LIMITED"
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const db = require("./database");
const { generateEmail, hasApiKey } = require("./ai");
const { chat: claudeChat, hasApiKey: hasClaudeKey } = require("./claude-chat");
const { sendEmail, canSendEmail } = require("./mailer");
const {
  meetingDayReminderTemplate,
  meetingHourReminderTemplate,
  postMeetingFollowUpTemplate
} = require("./emailTemplates");

const app = express();
const upload = multer({ dest: "uploads/" });

app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public"));

// ── SESSION SETUP ──
const SESSION_MAX_MS = 8 * 60 * 60 * 1000; // 8 hours absolute limit

app.use(session({
  secret:            process.env.SESSION_SECRET,
  resave:            false,
  saveUninitialized: false,
  cookie: {
    maxAge:   SESSION_MAX_MS,
    httpOnly: true,
    sameSite: "strict"
  }
}));

// ── AUTH MIDDLEWARE ──
// Protects all /api routes except login, session, availability, and public inquiry POST
function requireAuth(req, res, next) {
  const publicPaths = [
    "/login",
    "/logout",
    "/availability",
    "/session"
  ];

  // Only the inquiry submission endpoint is public — GET /api/inquiries requires auth
  const isPublicInquiryPost = req.method === 'POST' && req.path === '/inquiries';

  const isPublic = isPublicInquiryPost || publicPaths.some(route =>
    req.path.startsWith(route)
  );

  if (isPublic) return next();

  if (!req.session.authenticated) {
    return res.status(401).json({
      error: "Unauthorized. Please log in.",
      code:  "UNAUTHORIZED"
    });
  }

  // Enforce 8-hour absolute limit server-side
  if (Date.now() - req.session.loginTime > SESSION_MAX_MS) {
    req.session.destroy(() => {});
    return res.status(401).json({
      error: "Session expired. Please log in again.",
      code:  "SESSION_EXPIRED"
    });
  }

  next();
}

app.use("/api", requireAuth);

function logActivity(schoolId, activityType, details) {
  db.run(
    `INSERT INTO activity_logs (school_id, activity_type, details) VALUES (?, ?, ?)`,
    [schoolId, activityType, details]
  );
}

// ── LOGIN RATE LIMITER ──
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // max 5 attempts
  message: {
    error: "Too many login attempts. Please wait 15 minutes.",
    code:  "RATE_LIMITED"
  }
});

// ── LOGIN ──
app.post("/api/login", loginLimiter, (req, res) => {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ error: "Password is required" });
  }

  db.get(`SELECT * FROM auth LIMIT 1`, [], (err, row) => {
    if (err || !row) {
      return res.status(500).json({ error: "Auth not configured" });
    }

    const valid = bcrypt.compareSync(password, row.password_hash);

    if (!valid) {
      return res.status(401).json({
        error: "Incorrect password. Please try again.",
        code:  "WRONG_PASSWORD"
      });
    }

    // Set session
    req.session.authenticated = true;
    req.session.loginTime     = Date.now();
    req.session.ip            = req.ip;

    res.json({ message: "Login successful" });
  });
});

// ── LOGOUT ──
app.post("/api/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ message: "Logged out successfully" });
  });
});

// ── CHANGE PASSWORD ──
app.post("/api/change-password", (req, res) => {
  const { current_password, new_password } = req.body;

  if (!current_password || !new_password) {
    return res.status(400).json({
      error: "Current and new password are required"
    });
  }

  if (new_password.length < 8) {
    return res.status(400).json({
      error: "New password must be at least 8 characters"
    });
  }

  db.get(`SELECT * FROM auth LIMIT 1`, [], (err, row) => {
    if (err || !row) {
      return res.status(500).json({ error: "Auth not configured" });
    }

    const valid = bcrypt.compareSync(current_password, row.password_hash);
    if (!valid) {
      return res.status(401).json({
        error: "Current password is incorrect"
      });
    }

    const newHash = bcrypt.hashSync(new_password, 10);
    db.run(
      `UPDATE auth SET password_hash = ?,
       updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [newHash, row.id],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Password changed successfully" });
      }
    );
  });
});

// ── CHECK SESSION ──
app.get("/api/session", (req, res) => {
  res.json({
    authenticated: req.session.authenticated || false,
    loginTime:     req.session.loginTime     || null
  });
});

// Manual backup trigger
app.post("/api/backup", (req, res) => {
  try {
    runBackup();
    res.json({ message: "Backup created successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET COMPANY INFO ──
app.get("/api/settings/company", (req, res) => {
  res.json({
    company_name:    process.env.COMPANY_NAME    || '',
    company_email:   process.env.COMPANY_EMAIL   || '',
    company_phone:   process.env.COMPANY_PHONE   || '',
    company_address: process.env.COMPANY_ADDRESS || '',
  });
});

// ── UPDATE COMPANY INFO ──
app.patch("/api/settings/company", (req, res) => {
  const sanitize = (v) => (v || '').replace(/[\r\n]/g, ' ').trim();

  const name    = sanitize(req.body.company_name);
  const email   = sanitize(req.body.company_email);
  const phone   = sanitize(req.body.company_phone);
  const address = sanitize(req.body.company_address);

  if (!name) return res.status(400).json({ error: 'Company name is required' });

  const envPath = path.join(__dirname, '.env');

  try {
    let content = fs.readFileSync(envPath, 'utf8');

    const setKey = (key, value) => {
      const re = new RegExp(`^${key}=.*$`, 'm');
      if (re.test(content)) {
        content = content.replace(re, `${key}=${value}`);
      } else {
        content += `\n${key}=${value}`;
      }
    };

    setKey('COMPANY_NAME',    name);
    setKey('COMPANY_EMAIL',   email);
    setKey('COMPANY_PHONE',   phone);
    setKey('COMPANY_ADDRESS', address);

    fs.writeFileSync(envPath, content, 'utf8');

    // Reflect changes immediately without restart
    process.env.COMPANY_NAME    = name;
    process.env.COMPANY_EMAIL   = email;
    process.env.COMPANY_PHONE   = phone;
    process.env.COMPANY_ADDRESS = address;

    res.json({ message: 'Company info updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Could not save: ' + err.message });
  }
});

// ── AI CHAT ──
app.post("/api/chat", async (req, res) => {
  const { messages } = req.body;
  if (!Array.isArray(messages) || !messages.length)
    return res.status(400).json({ error: "No messages provided" });

  if (!hasClaudeKey())
    return res.status(503).json({ error: "AI chat is not configured." });

  try {
    const reply = await claudeChat(messages);
    res.json({ reply });
  } catch (e) {
    console.error("[CHAT]", e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/health", apiLimiter, (req, res) => {
  res.json({
    app: "ThinkTANQ AI School Outreach MVP",
    status: "running",
    ai_mode: hasApiKey() ? "OPENAI_API" : "FREE_TEMPLATE_MODE",
    email_sending: canSendEmail() ? "ENABLED" : "DRAFT_ONLY"
  });
});

app.post("/api/schools", [
  body("school_name")
    .trim()
    .notEmpty().withMessage("School name is required")
    .isLength({ max: 200 }).withMessage("School name too long")
    .escape(),
  body("email")
    .optional()
    .trim()
    .isEmail({ domain_specific_validation: false }).withMessage("Invalid email address"),
  body("phone")
    .optional()
    .trim()
    .matches(/^[\d\s\-\+\(\)]*$/)
    .withMessage("Invalid phone number format"),
  body("estimated_students")
    .optional()
    .isInt({ min: 1, max: 100000 })
    .withMessage("Invalid student count"),
  body("contact_person")
    .optional()
    .trim()
    .isLength({ max: 200 })
    .escape(),
  body("notes")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .escape(),
  body("address")
    .optional()
    .trim()
    .isLength({ max: 300 })
    .escape(),
  body("city_province")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .escape(),
  body("website")
    .optional()
    .trim()
    .isURL()
    .withMessage("Invalid website URL"),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: errors.array()[0].msg,
      code:  "VALIDATION_ERROR"
    });
  }

  const s = req.body;

  if (!s.school_name) {
    return res.status(400).json({ error: "school_name is required" });
  }

  db.run(
    `INSERT INTO schools 
    (school_name, contact_person, email, phone, website, facebook_page, address, city_province, region, school_type, level_offered, estimated_students, assigned_to, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      s.school_name, s.contact_person, s.email, s.phone, s.website, s.facebook_page,
      s.address, s.city_province, s.region, s.school_type, s.level_offered,
      s.estimated_students, s.assigned_to, s.notes
    ],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      logActivity(this.lastID, "LEAD_CREATED", "School lead manually added.");
      res.json({ message: "School lead added", id: this.lastID });
    }
  );
});

app.get("/api/schools", (req, res) => {
  db.all(`SELECT * FROM schools ORDER BY created_at DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get("/api/schools/:id", (req, res) => {
  db.get(`SELECT * FROM schools WHERE id = ?`, [req.params.id], (err, school) => {
    if (err || !school) return res.status(404).json({ error: "School not found" });
    res.json(school);
  });
});

// ── UPDATE SCHOOL DETAILS ──
app.put("/api/schools/:id", [
  body("school_name")
    .trim()
    .notEmpty().withMessage("School name is required")
    .isLength({ max: 200 }).withMessage("School name too long")
    .escape(),
  body("email")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isEmail({ domain_specific_validation: false }).withMessage("Invalid email address"),
  body("phone")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 50 }),
  body("estimated_students")
    .optional({ nullable: true, checkFalsy: true })
    .isInt({ min: 1, max: 100000 })
    .withMessage("Invalid student count"),
  body("contact_person")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 200 })
    .escape(),
  body("notes")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 1000 })
    .escape(),
  body("address")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 300 })
    .escape(),
  body("city_province")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 100 })
    .escape(),
  body("website")
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 300 }),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg, code: "VALIDATION_ERROR" });
  }

  const s = req.body;
  db.run(
    `UPDATE schools SET
      school_name = ?, contact_person = ?, email = ?, phone = ?,
      website = ?, facebook_page = ?, address = ?, city_province = ?,
      region = ?, school_type = ?, level_offered = ?, estimated_students = ?,
      assigned_to = ?, status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?`,
    [
      s.school_name,
      s.contact_person  || null, s.email           || null, s.phone        || null,
      s.website         || null, s.facebook_page   || null, s.address      || null,
      s.city_province   || null, s.region          || null, s.school_type  || null,
      s.level_offered   || null, s.estimated_students || null, s.assigned_to || null,
      s.status          || 'NEW_LEAD',
      s.notes           || null,
      req.params.id
    ],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: "School not found" });
      logActivity(req.params.id, "DETAILS_UPDATED", "School details edited by admin.");
      res.json({ message: "School updated" });
    }
  );
});

// ── BULK DELETE SCHOOLS ──
app.delete("/api/schools", (req, res) => {
  const { ids, reason } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "No school IDs provided" });
  }

  const validIds = ids.map(Number).filter(n => Number.isInteger(n) && n > 0);
  if (!validIds.length) {
    return res.status(400).json({ error: "Invalid school IDs" });
  }

  const deleteReason = (reason || '').trim() || 'Bulk delete by admin';
  let deleted = 0;
  let processed = 0;

  validIds.forEach(id => {
      db.serialize(() => {
      db.get(`SELECT * FROM schools WHERE id = ?`, [id], (err, school) => {
        if (err || !school) {
          processed++;
          if (processed === validIds.length) res.json({ deleted });
          return;
        }

        db.run(
          `INSERT INTO deletion_history (record_type, record_name, reason) VALUES (?, ?, ?)`,
          ['SCHOOL', school.school_name, deleteReason]
        );
        db.run(`DELETE FROM email_drafts WHERE school_id = ?`, [id]);
        db.run(`DELETE FROM meetings WHERE school_id = ?`, [id]);
        db.run(`DELETE FROM activity_logs WHERE school_id = ?`, [id]);

        db.run(`DELETE FROM schools WHERE id = ?`, [id], function (err) {
          if (!err) deleted++;
          processed++;
          if (processed === validIds.length) res.json({ deleted });
        });
      });
    });
  });
});

// ── DELETE SCHOOL (Right to Erasure) ──
app.delete("/api/schools/:id", (req, res) => {
  const { reason } = req.body;

  db.get(
    `SELECT * FROM schools WHERE id = ?`,
    [req.params.id],
    (err, school) => {
      if (err || !school) {
        return res.status(404).json({ error: "School not found" });
      }

      // Save to deletion history BEFORE deleting
      db.run(
        `INSERT INTO deletion_history
         (record_type, record_name, reason)
         VALUES (?, ?, ?)`,
        [
          'SCHOOL',
          school.school_name,
          reason || 'No reason provided'
        ]
      );

      // Delete all associated data
      db.run(`DELETE FROM email_drafts WHERE school_id = ?`,
        [req.params.id]);
      db.run(`DELETE FROM meetings WHERE school_id = ?`,
        [req.params.id]);
      db.run(`DELETE FROM activity_logs WHERE school_id = ?`,
        [req.params.id]);

      // Delete the school itself
      db.run(
        `DELETE FROM schools WHERE id = ?`,
        [req.params.id],
        function (err) {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          res.json({
            message: `${school.school_name} and all associated data has been permanently deleted.`
          });
        }
      );
    }
  );
});

// ── DELETE INQUIRY (Right to Erasure) ──
app.delete("/api/inquiries/:id", (req, res) => {
  const { reason } = req.body;

  db.get(
    `SELECT * FROM inquiries WHERE id = ?`,
    [req.params.id],
    (err, inquiry) => {
      if (err || !inquiry) {
        return res.status(404).json({ error: "Inquiry not found" });
      }

      // Save to deletion history BEFORE deleting
      db.run(
        `INSERT INTO deletion_history
         (record_type, record_name, reason)
         VALUES (?, ?, ?)`,
        [
          'INQUIRY',
          inquiry.school_name,
          reason || 'No reason provided'
        ]
      );

      db.run(
        `DELETE FROM inquiries WHERE id = ?`,
        [req.params.id],
        function (err) {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          res.json({
            message: `Inquiry from ${inquiry.contact_person} has been permanently deleted.`
          });
        }
      );
    }
  );
});

app.patch("/api/schools/:id/status", (req, res) => {
  const { status } = req.body;
  db.run(`UPDATE schools SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [status, req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    logActivity(req.params.id, "STATUS_UPDATED", `Status changed to ${status}`);
    res.json({ message: "Status updated" });
  });
});

app.post("/api/schools/:id/generate-email", (req, res) => {
  const emailType = req.body.email_type || "PROPOSAL";

  db.get(`SELECT * FROM schools WHERE id = ?`, [req.params.id], async (err, school) => {
    if (err || !school) return res.status(404).json({ error: "School not found" });

    try {
      const email = await generateEmail(school, emailType);

      db.run(
        `INSERT INTO email_drafts (school_id, email_type, subject, body) VALUES (?, ?, ?, ?)`,
        [school.id, emailType, email.subject, email.body],
        function (err) {
          if (err) return res.status(500).json({ error: err.message });

          db.run(`UPDATE schools SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [`${emailType}_GENERATED`, school.id]);

          logActivity(school.id, "EMAIL_GENERATED", `${emailType} email generated.`);

          res.json({
            message: "Email generated",
            draft_id: this.lastID,
            email_type: emailType,
            subject: email.subject,
            body: email.body
          });
        }
      );
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
});

app.get("/api/email-drafts", (req, res) => {
  db.all(
    `SELECT email_drafts.*, schools.school_name, schools.email
     FROM email_drafts
     LEFT JOIN schools ON email_drafts.school_id = schools.id
     ORDER BY email_drafts.created_at DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// Update email draft body (for edited emails)
app.patch("/api/email-drafts/:id/update", (req, res) => {
  const { body } = req.body;
  db.run(
    `UPDATE email_drafts SET body = ? WHERE id = ?`,
    [body, req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Draft updated" });
    }
  );
});

app.post("/api/email-drafts/:id/send", (req, res) => {
  db.get(
    `SELECT email_drafts.*, schools.email, schools.id as school_id
     FROM email_drafts
     LEFT JOIN schools ON email_drafts.school_id = schools.id
     WHERE email_drafts.id = ?`,
    [req.params.id],
    async (err, draft) => {
      if (err || !draft) return res.status(404).json({ error: "Draft not found" });
      if (!draft.email) return res.status(400).json({ error: "School has no email address." });

      try {
        const result = await sendEmail({
          to: draft.email,
          subject: draft.subject,
          body: draft.body
        });

        const newStatus = result.sent ? "SENT" : "DRAFT";
        db.run(`UPDATE email_drafts SET status = ? WHERE id = ?`, [newStatus, req.params.id]);
        if (result.sent) {
          db.run(`UPDATE schools SET status = 'EMAIL_SENT', last_contacted = DATE('now'), updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [draft.school_id]);
        }
        logActivity(draft.school_id, result.sent ? "EMAIL_SENT" : "EMAIL_NOT_SENT", JSON.stringify(result));

        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    }
  );
});

// ── CSV PREVIEW (parse only, no DB write) ──
app.post("/api/import-csv/preview", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "CSV file is required" });

  const rows = [];
  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on("data", (row) => { if (row.school_name) rows.push(row); })
    .on("end", () => {
      fs.unlinkSync(req.file.path);
      res.json({ rows, filename: req.file.originalname || 'import.csv' });
    })
    .on("error", () => {
      fs.unlinkSync(req.file.path);
      res.status(400).json({ error: "Could not parse CSV" });
    });
});

// ── CSV CONFIRM (save rows to DB, return school IDs) ──
app.post("/api/import-csv/confirm", (req, res) => {
  const { rows, filename } = req.body;
  if (!Array.isArray(rows) || !rows.length)
    return res.status(400).json({ error: "No rows to import" });

  let imported = 0;
  const errors = [];
  const schoolIds = [];
  let processed = 0;

  rows.forEach(row => {
    db.run(
      `INSERT INTO schools
       (school_name, contact_person, email, phone, website, facebook_page, address,
        city_province, region, school_type, level_offered, estimated_students, assigned_to, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [row.school_name, row.contact_person, row.email, row.phone, row.website,
       row.facebook_page, row.address, row.city_province, row.region,
       row.school_type, row.level_offered, row.estimated_students, row.assigned_to, row.notes],
      function (err) {
        if (err) { errors.push(err.message); }
        else { imported++; schoolIds.push(this.lastID); }
        processed++;
        if (processed === rows.length) {
          db.run(`INSERT INTO import_logs (filename, imported_count, error_count) VALUES (?, ?, ?)`,
            [filename || 'import.csv', imported, errors.length]);
          res.json({ imported, errors, school_ids: schoolIds });
        }
      }
    );
  });
});

// ── BULK PROMOTIONAL EMAIL ──
app.post("/api/bulk-promo-email", async (req, res) => {
  const { school_ids } = req.body;
  if (!Array.isArray(school_ids) || !school_ids.length)
    return res.status(400).json({ error: "No school IDs provided" });

  const results = { sent: 0, failed: 0, errors: [] };

  for (const id of school_ids) {
    try {
      const school = await new Promise((resolve, reject) => {
        db.get(`SELECT * FROM schools WHERE id = ?`, [id], (err, row) => {
          if (err || !row) reject(new Error('School not found'));
          else resolve(row);
        });
      });

      if (!school.email) {
        results.failed++;
        results.errors.push(`${school.school_name}: no email address`);
        continue;
      }

      const email = await generateEmail(school, 'PROMOTIONAL');

      const draftId = await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO email_drafts (school_id, email_type, subject, body) VALUES (?, ?, ?, ?)`,
          [school.id, 'PROMOTIONAL', email.subject, email.body],
          function (err) { if (err) reject(err); else resolve(this.lastID); }
        );
      });

      const result = await sendEmail({ to: school.email, subject: email.subject, body: email.body });

      if (result.sent) {
        db.run(`UPDATE email_drafts SET status = 'SENT' WHERE id = ?`, [draftId]);
        db.run(`UPDATE schools SET status = 'EMAIL_SENT', last_contacted = DATE('now'), updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [school.id]);
        logActivity(school.id, 'EMAIL_SENT', 'Bulk promotional email sent.');
        results.sent++;
      } else {
        results.failed++;
        results.errors.push(`${school.school_name}: ${result.reason || 'not sent'}`);
      }
    } catch (e) {
      results.failed++;
      results.errors.push(`ID ${id}: ${e.message}`);
    }
  }

  res.json(results);
});

app.post("/api/import-csv", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "CSV file is required" });

  const filename = req.file.originalname || 'unknown.csv';
  const rows = [];

  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on("data", (row) => {
      if (row.school_name) rows.push(row);
    })
    .on("end", () => {
      fs.unlinkSync(req.file.path);

      if (!rows.length) {
        db.run(`INSERT INTO import_logs (filename, imported_count, error_count) VALUES (?, 0, 0)`, [filename]);
        return res.json({ message: "CSV import completed", imported: 0, errors: [] });
      }

      let imported = 0;
      const errors = [];
      let processed = 0;

      rows.forEach(row => {
        db.run(
          `INSERT INTO schools
          (school_name, contact_person, email, phone, website, facebook_page, address, city_province, region, school_type, level_offered, estimated_students, assigned_to, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            row.school_name, row.contact_person, row.email, row.phone, row.website, row.facebook_page,
            row.address, row.city_province, row.region, row.school_type, row.level_offered,
            row.estimated_students, row.assigned_to, row.notes
          ],
          function (err) {
            if (err) errors.push(err.message);
            else imported++;

            processed++;
            if (processed === rows.length) {
              db.run(
                `INSERT INTO import_logs (filename, imported_count, error_count) VALUES (?, ?, ?)`,
                [filename, imported, errors.length]
              );
              res.json({ message: "CSV import completed", imported, errors });
            }
          }
        );
      });
    });
});

app.get("/api/import-logs", (_req, res) => {
  db.all(
    `SELECT * FROM import_logs ORDER BY imported_at DESC LIMIT 50`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

app.get("/api/activity-logs/:schoolId", (req, res) => {
  db.all(`SELECT * FROM activity_logs WHERE school_id = ? ORDER BY created_at DESC`, [req.params.schoolId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Check if school email already exists
app.get("/api/schools/check-email/:email", (req, res) => {
  db.get(
    `SELECT id, school_name FROM schools WHERE email = ?`,
    [req.params.email],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (row) {
        res.json({
          exists: true,
          school_name: row.school_name,
          school_id: row.id
        });
      } else {
        res.json({ exists: false });
      }
    }
  );
});

// Get meetings for a specific school
app.get("/api/schools/:id/meetings", (req, res) => {
  db.all(
    `SELECT * FROM meetings WHERE school_id = ?
     ORDER BY meeting_date DESC, meeting_time DESC`,
    [req.params.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// ── ANALYTICS ──
app.get("/api/analytics", (_req, res) => {
  const data = {};
  let pending = 6;
  const done = () => { if (--pending === 0) res.json(data); };

  db.all(
    `SELECT date(created_at) as day, COUNT(*) as count
     FROM schools WHERE date(created_at) >= date('now', '-6 days')
     GROUP BY day ORDER BY day`,
    [], (_err, rows) => { data.weekly_leads = rows || []; done(); }
  );

  db.all(
    `SELECT date(created_at) as day, COUNT(*) as count
     FROM schools WHERE date(created_at) >= date('now', '-29 days')
     GROUP BY day ORDER BY day`,
    [], (_err, rows) => { data.monthly_leads = rows || []; done(); }
  );

  db.all(
    `SELECT COALESCE(status, 'NEW_LEAD') as status, COUNT(*) as count
     FROM schools GROUP BY status ORDER BY count DESC`,
    [], (_err, rows) => { data.status_dist = rows || []; done(); }
  );

  db.get(
    `SELECT
       (SELECT COUNT(*) FROM activity_logs WHERE activity_type='EMAIL_SENT' AND date(created_at) >= date('now','-6 days'))  AS weekly_emails,
       (SELECT COUNT(*) FROM activity_logs WHERE activity_type='EMAIL_SENT' AND date(created_at) >= date('now','-29 days')) AS monthly_emails,
       (SELECT COUNT(*) FROM meetings WHERE date(meeting_date) >= date('now','-6 days')  AND date(meeting_date) <= date('now','+1 day')) AS weekly_meetings,
       (SELECT COUNT(*) FROM meetings WHERE date(meeting_date) >= date('now','-29 days') AND date(meeting_date) <= date('now','+1 day')) AS monthly_meetings`,
    [], (_err, row) => {
      data.weekly_emails    = (row && row.weekly_emails)    || 0;
      data.monthly_emails   = (row && row.monthly_emails)   || 0;
      data.weekly_meetings  = (row && row.weekly_meetings)  || 0;
      data.monthly_meetings = (row && row.monthly_meetings) || 0;
      done();
    }
  );

  db.get(
    `SELECT
       (SELECT COUNT(*) FROM inquiries WHERE date(created_at) >= date('now','-6 days'))  AS weekly_inquiries,
       (SELECT COUNT(*) FROM inquiries WHERE date(created_at) >= date('now','-29 days')) AS monthly_inquiries`,
    [], (_err, row) => {
      data.weekly_inquiries  = (row && row.weekly_inquiries)  || 0;
      data.monthly_inquiries = (row && row.monthly_inquiries) || 0;
      done();
    }
  );

  db.all(
    `SELECT heard_from as source, COUNT(*) as count
     FROM inquiries
     WHERE heard_from IS NOT NULL AND heard_from != ''
     GROUP BY heard_from ORDER BY count DESC`,
    [], (_err, rows) => { data.heard_from_dist = rows || []; done(); }
  );
});

// ── DELETION HISTORY API ──
app.get("/api/deletion-history", (req, res) => {
  db.all(
    `SELECT * FROM deletion_history ORDER BY deleted_at DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// ── INQUIRIES API ──

// Get all inquiries
app.get("/api/inquiries", (req, res) => {
  db.all(
    `SELECT * FROM inquiries ORDER BY created_at DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// Get single inquiry
app.get("/api/inquiries/:id", (req, res) => {
  db.get(
    `SELECT * FROM inquiries WHERE id = ?`,
    [req.params.id],
    (err, row) => {
      if (err || !row) return res.status(404).json({ error: "Inquiry not found" });
      res.json(row);
    }
  );
});

// Submit inquiry (public form) — rate limited + sanitized
app.post("/api/inquiries", inquiryLimiter, [
  body("school_name")
    .trim()
    .notEmpty().withMessage("School name is required")
    .isLength({ max: 200 }).withMessage("School name too long")
    .not().matches(/<[^>]*>/).withMessage("School name contains invalid characters")
    .escape(),
  body("contact_person")
    .trim()
    .notEmpty().withMessage("Contact person is required")
    .isLength({ max: 200 }).withMessage("Name too long")
    .not().matches(/<[^>]*>/).withMessage("Name contains invalid characters")
    .escape(),
  body("email")
    .trim()
    .notEmpty().withMessage("Email is required")
    .isEmail().withMessage("Invalid email address"),
  body("phone")
    .optional()
    .trim()
    .matches(/^[\d\s\-\+\(\)]+$/)
    .withMessage("Invalid phone number format"),
  body("estimated_students")
    .optional()
    .isInt({ min: 1, max: 100000 })
    .withMessage("Invalid student count"),
  body("message")
    .optional()
    .trim()
    .isLength({ max: 1000 }).withMessage("Message too long")
    .not().matches(/<[^>]*>/).withMessage("Message contains invalid characters")
    .escape(),
  body("position")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .escape(),
  body("city_province")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .escape(),
  body("school_type")
    .optional()
    .trim()
    .escape(),
  body("level_offered")
    .optional()
    .trim()
    .escape(),
  body("heard_from")
    .optional()
    .trim()
    .escape(),
  body("preferred_mode")
    .optional()
    .isIn(["ONLINE", "ONSITE"])
    .withMessage("Invalid meeting mode"),
], (req, res) => {

  // Check validation results
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: errors.array()[0].msg,
      code:  "VALIDATION_ERROR"
    });
  }

  // ── HONEYPOT CHECK ──
  // If honeypot field is filled — it's a bot
  // Silently accept but don't save to database
  if (req.body.website_url && req.body.website_url.trim() !== '') {
    return res.json({
      message: "Inquiry submitted successfully",
      id: 0
    });
  }

  const i = req.body;

  if (!i.school_name || !i.contact_person || !i.email) {
    return res.status(400).json({
      error: "School name, contact person, and email are required"
    });
  }

  db.run(
    `INSERT INTO inquiries
     (school_name, school_type, level_offered, estimated_students,
      city_province, region, contact_person, position, email, phone,
      preferred_date, preferred_time, preferred_mode,
      heard_from, message, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
    [
      i.school_name, i.school_type, i.level_offered,
      i.estimated_students || null, i.city_province, i.region,
      i.contact_person, i.position, i.email, i.phone,
      i.preferred_date, i.preferred_time, i.preferred_mode || 'ONLINE',
      i.heard_from, i.message
    ],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({
        message: "Inquiry submitted successfully",
        id: this.lastID
      });
    }
  );
});

// Approve inquiry → convert to school lead + auto-generate PROPOSAL email
app.post("/api/inquiries/:id/approve", (req, res) => {
  db.get(
    `SELECT * FROM inquiries WHERE id = ?`,
    [req.params.id],
    (err, inquiry) => {
      if (err || !inquiry) {
        return res.status(404).json({ error: "Inquiry not found" });
      }

      // Insert as new school lead
      db.run(
        `INSERT INTO schools
         (school_name, contact_person, email, phone,
          city_province, region, school_type, level_offered,
          estimated_students, notes, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'NEW_LEAD')`,
        [
          inquiry.school_name,
          inquiry.contact_person,
          inquiry.email,
          inquiry.phone,
          inquiry.city_province,
          inquiry.region,
          inquiry.school_type,
          inquiry.level_offered,
          inquiry.estimated_students,
          `Inquiry submitted on ${inquiry.created_at}.
           Preferred date: ${inquiry.preferred_date || 'Not specified'}.
           Preferred time: ${inquiry.preferred_time || 'Not specified'}.
           Preferred mode: ${inquiry.preferred_mode || 'Online'}.
           Heard from: ${inquiry.heard_from || 'Not specified'}.
           Message: ${inquiry.message || 'None'}.`
        ],
        async function (err) {
          if (err) return res.status(500).json({ error: err.message });

          const schoolId = this.lastID;

          // Update inquiry status to approved
          db.run(
            `UPDATE inquiries SET status = 'APPROVED',
             updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [req.params.id]
          );

          logActivity(
            schoolId,
            'LEAD_CREATED',
            `School lead created from public inquiry form.`
          );

          // Auto-create meeting from inquiry's preferred date/time (non-fatal)
          if (inquiry.preferred_date) {
            const meetTime = convertTimeTo24hr(inquiry.preferred_time) || '09:00';
            db.run(
              `INSERT INTO meetings
               (school_id, school_name, contact_person, meeting_type,
                meeting_date, meeting_time, meeting_mode, status)
               VALUES (?, ?, ?, ?, ?, ?, ?, 'SCHEDULED')`,
              [
                schoolId,
                inquiry.school_name,
                inquiry.contact_person,
                'PRESENTATION',
                inquiry.preferred_date,
                meetTime,
                inquiry.preferred_mode || 'ONLINE'
              ],
              function (meetErr) {
                if (!meetErr) {
                  logActivity(
                    schoolId,
                    'MEETING_SCHEDULED',
                    `Presentation auto-scheduled on ${inquiry.preferred_date} at ${meetTime} from inquiry preferred date.`
                  );
                }
              }
            );
          }

          // Auto-generate PROPOSAL email immediately
          const school = {
            id: schoolId,
            school_name:        inquiry.school_name,
            contact_person:     inquiry.contact_person,
            email:              inquiry.email,
            phone:              inquiry.phone,
            city_province:      inquiry.city_province,
            region:             inquiry.region,
            school_type:        inquiry.school_type,
            level_offered:      inquiry.level_offered,
            estimated_students: inquiry.estimated_students,
            status:             'NEW_LEAD'
          };

          try {
            const email = await generateEmail(school, 'PROPOSAL');

            db.run(
              `INSERT INTO email_drafts (school_id, email_type, subject, body)
               VALUES (?, ?, ?, ?)`,
              [schoolId, 'PROPOSAL', email.subject, email.body],
              function (draftErr) {
                if (draftErr) {
                  return res.json({
                    message:   "Inquiry approved and converted to school lead",
                    school_id: schoolId
                  });
                }

                db.run(
                  `UPDATE schools SET status = 'PROPOSAL_GENERATED',
                   updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                  [schoolId]
                );

                logActivity(
                  schoolId,
                  'EMAIL_GENERATED',
                  'PROPOSAL email generated after inquiry approval.'
                );

                res.json({
                  message:   "Inquiry approved and converted to school lead",
                  school_id: schoolId,
                  draft_id:  this.lastID,
                  subject:   email.subject,
                  body:      email.body
                });
              }
            );
          } catch (emailErr) {
            // Email generation failed — still return school creation success
            res.json({
              message:   "Inquiry approved and converted to school lead",
              school_id: schoolId
            });
          }
        }
      );
    }
  );
});

// Dismiss inquiry
app.patch("/api/inquiries/:id/dismiss", (req, res) => {
  const { reason } = req.body;
  db.run(
    `UPDATE inquiries SET
     status = 'DISMISSED',
     rejection_reason = ?,
     updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [reason || '', req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Inquiry dismissed" });
    }
  );
});

// Get pending inquiries count
app.get("/api/inquiries/count/pending", (req, res) => {
  db.get(
    `SELECT COUNT(*) as count FROM inquiries WHERE status = 'PENDING'`,
    [],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ count: row.count });
    }
  );
});

// ── MEETINGS API ──

// Get all meetings
app.get("/api/meetings", (req, res) => {
  db.all(
    `SELECT meetings.*, schools.email as school_email
     FROM meetings
     LEFT JOIN schools ON meetings.school_id = schools.id
     ORDER BY meeting_date ASC, meeting_time ASC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// Get today's meetings — must be registered BEFORE /:id to avoid route collision
app.get("/api/meetings/today", (req, res) => {
  db.all(
    `SELECT meetings.*, schools.email as school_email
     FROM meetings
     LEFT JOIN schools ON meetings.school_id = schools.id
     WHERE meeting_date = DATE('now', '+8 hours')
     AND meetings.status IN ('SCHEDULED', 'RESCHEDULED')
     ORDER BY meeting_time ASC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// Past meetings still SCHEDULED/RESCHEDULED — need status update
app.get("/api/meetings/past-unupdated", (req, res) => {
  db.all(
    `SELECT meetings.*, schools.email as school_email
     FROM meetings
     LEFT JOIN schools ON meetings.school_id = schools.id
     WHERE meeting_date < DATE('now', '+8 hours')
     AND status IN ('SCHEDULED', 'RESCHEDULED')
     ORDER BY meeting_date DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// Mark all past unupdated meetings as DONE
app.post("/api/meetings/mark-past-done", (req, res) => {
  db.all(
    `SELECT id, school_id, meeting_date, meeting_time FROM meetings
     WHERE meeting_date < DATE('now', '+8 hours')
     AND status IN ('SCHEDULED', 'RESCHEDULED')`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!rows.length) return res.json({ updated: 0 });

      db.run(
        `UPDATE meetings SET status = 'DONE', updated_at = CURRENT_TIMESTAMP
         WHERE meeting_date < DATE('now', '+8 hours')
         AND status IN ('SCHEDULED', 'RESCHEDULED')`,
        function(err) {
          if (err) return res.status(500).json({ error: err.message });
          rows.forEach(m => {
            logActivity(m.school_id, 'MEETING_AUTO_DONE',
              `Past meeting on ${m.meeting_date} auto-marked as Done.`);
          });
          res.json({ updated: this.changes });
        }
      );
    }
  );
});

// Get single meeting
app.get("/api/meetings/:id", (req, res) => {
  db.get(
    `SELECT meetings.*, schools.email as school_email
     FROM meetings
     LEFT JOIN schools ON meetings.school_id = schools.id
     WHERE meetings.id = ?`,
    [req.params.id],
    (err, row) => {
      if (err || !row) return res.status(404).json({ error: "Meeting not found" });
      res.json(row);
    }
  );
});

// Get meetings by month
app.get("/api/meetings/month/:year/:month", (req, res) => {
  const { year, month } = req.params;
  const pad = month.toString().padStart(2, '0');
  db.all(
    `SELECT meetings.*, schools.email as school_email
     FROM meetings
     LEFT JOIN schools ON meetings.school_id = schools.id
     WHERE strftime('%Y', meeting_date) = ?
     AND strftime('%m', meeting_date) = ?
     ORDER BY meeting_date ASC, meeting_time ASC`,
    [year, pad],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// ── HELPER: Convert 12-hour time string (e.g. "2:00 PM") to 24-hour "HH:MM" ──
function convertTimeTo24hr(timeStr) {
  if (!timeStr) return null;
  if (/^\d{2}:\d{2}$/.test(timeStr)) {
    const [h, m] = timeStr.split(':').map(Number);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) return timeStr;
    return null;
  }
  const match = timeStr.match(/^(\d+):(\d+)\s*(AM|PM)$/i);
  if (!match) return null;
  let hours = parseInt(match[1]);
  const mins = parseInt(match[2]);
  const period = match[3].toUpperCase();
  if (hours < 1 || hours > 12 || mins < 0 || mins > 59) return null;
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  return String(hours).padStart(2, '0') + ':' + String(mins).padStart(2, '0');
}

// ── HELPER: Convert time string to minutes ──
function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

// Create meeting
app.post("/api/meetings", (req, res) => {
  const m = req.body;

  if (!m.school_id || !m.meeting_date || !m.meeting_time) {
    return res.status(400).json({
      error: "school_id, meeting_date, and meeting_time are required"
    });
  }

  db.get(`SELECT * FROM schools WHERE id = ?`, [m.school_id], (err, school) => {
    if (err || !school) return res.status(404).json({ error: "School not found" });

    // ── CHECK 1: School already has an active meeting ──
    db.get(
      `SELECT * FROM meetings
       WHERE school_id = ?
       AND status IN ('SCHEDULED', 'RESCHEDULED')`,
      [m.school_id],
      (err, existingSchoolMeeting) => {
        if (existingSchoolMeeting) {
          return res.status(400).json({
            error: `${school.school_name} already has an active meeting scheduled on ${existingSchoolMeeting.meeting_date} at ${existingSchoolMeeting.meeting_time}. Please cancel or reschedule it first.`,
            conflict_type: 'SCHOOL_ALREADY_HAS_MEETING'
          });
        }

        // ── CHECK 2: Max 3 meetings per day ──
        db.get(
          `SELECT COUNT(*) as count FROM meetings
           WHERE meeting_date = ?
           AND status IN ('SCHEDULED', 'RESCHEDULED')`,
          [m.meeting_date],
          (err, dayCount) => {
            if (dayCount.count >= 3) {
              return res.status(400).json({
                error: `Maximum of 3 meetings per day reached for ${m.meeting_date}. Please choose a different date.`,
                conflict_type: 'MAX_MEETINGS_REACHED'
              });
            }

            // ── CHECK 3: Time slot overlap (within 30 minutes) ──
            db.all(
              `SELECT * FROM meetings
               WHERE meeting_date = ?
               AND status IN ('SCHEDULED', 'RESCHEDULED')`,
              [m.meeting_date],
              (err, sameDayMeetings) => {
                const newTime = timeToMinutes(m.meeting_time);

                const overlap = sameDayMeetings.find(existing => {
                  const existingTime = timeToMinutes(existing.meeting_time);
                  return Math.abs(newTime - existingTime) < 30;
                });

                if (overlap) {
                  return res.status(400).json({
                    error: `Time slot conflict. There is already a meeting at ${overlap.meeting_time} with ${overlap.school_name}. Please choose a time at least 30 minutes apart.`,
                    conflict_type: 'TIME_SLOT_TAKEN'
                  });
                }

                // ── CHECK 4: Onsite + outside Metro Manila warning ──
                if (m.meeting_mode === 'ONSITE') {
                  const metroManila = [
                    'manila', 'quezon city', 'makati', 'pasig',
                    'taguig', 'mandaluyong', 'marikina', 'pasay',
                    'caloocan', 'malabon', 'navotas', 'valenzuela',
                    'las pinas', 'muntinlupa', 'paranaque', 'parañaque',
                    'pateros', 'san juan', 'ncr'
                  ];
                  const location = (
                    m.meeting_address || school.city_province || ''
                  ).toLowerCase();
                  const isMetroManila = metroManila.some(city =>
                    location.includes(city)
                  );

                  if (!isMetroManila && location.length > 0) {
                    return res.status(400).json({
                      error: `Onsite meetings are only available within Metro Manila. This school appears to be outside Metro Manila. Please switch to Online or contact your partner for this area.`,
                      conflict_type: 'OUTSIDE_METRO_MANILA'
                    });
                  }
                }

                // ── ALL CHECKS PASSED — Create the meeting ──
                db.run(
                  `INSERT INTO meetings
                   (school_id, school_name, contact_person, meeting_type,
                    meeting_date, meeting_time, meeting_mode, meeting_link,
                    meeting_address, notes, status)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                  [
                    m.school_id,
                    school.school_name,
                    school.contact_person || m.contact_person,
                    m.meeting_type     || 'PRESENTATION',
                    m.meeting_date,
                    m.meeting_time,
                    m.meeting_mode     || 'ONLINE',
                    m.meeting_link     || '',
                    m.meeting_address  || '',
                    m.notes            || '',
                    'SCHEDULED'
                  ],
                  function (err) {
                    if (err) return res.status(500).json({ error: err.message });

                    db.run(
                      `UPDATE schools SET status = 'PRESENTATION_SCHEDULED',
                       updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                      [m.school_id]
                    );

                    logActivity(
                      m.school_id,
                      'MEETING_SCHEDULED',
                      `Presentation scheduled on ${m.meeting_date} at ${m.meeting_time}`
                    );

                    res.json({
                      message: "Meeting scheduled successfully",
                      id: this.lastID
                    });
                  }
                );
              }
            );
          }
        );
      }
    );
  });
});

// Update meeting status
app.patch("/api/meetings/:id/status", (req, res) => {
  const { status } = req.body;
  db.run(
    `UPDATE meetings SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [status, req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Meeting status updated" });
    }
  );
});

// Cancel meeting (no longer deletes — just marks as cancelled)
app.patch("/api/meetings/:id/cancel", (req, res) => {
  const { reason } = req.body;
  db.get(`SELECT * FROM meetings WHERE id = ?`, [req.params.id], (err, meeting) => {
    if (err || !meeting) return res.status(404).json({ error: "Meeting not found" });

    db.run(
      `UPDATE meetings SET status = 'CANCELLED',
       notes = CASE WHEN ? != '' THEN ? ELSE notes END,
       updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [reason || '', reason ? `[CANCELLED] Reason: ${reason}` : '', req.params.id],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });

        logActivity(
          meeting.school_id,
          'MEETING_CANCELLED',
          `Meeting on ${meeting.meeting_date} cancelled. ${reason ? 'Reason: ' + reason : ''}`
        );

        res.json({ message: "Meeting cancelled" });
      }
    );
  });
});

// Reschedule meeting
app.patch("/api/meetings/:id/reschedule", (req, res) => {
  const { meeting_date, meeting_time, notes } = req.body;

  if (!meeting_date || !meeting_time) {
    return res.status(400).json({ error: "New date and time are required" });
  }

  db.get(`SELECT * FROM meetings WHERE id = ?`, [req.params.id], (err, meeting) => {
    if (err || !meeting) return res.status(404).json({ error: "Meeting not found" });

    db.run(
      `UPDATE meetings SET
       meeting_date = ?,
       meeting_time = ?,
       status = 'RESCHEDULED',
       notes = ?,
       updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        meeting_date,
        meeting_time,
        notes || meeting.notes,
        req.params.id
      ],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });

        logActivity(
          meeting.school_id,
          'MEETING_RESCHEDULED',
          `Meeting rescheduled from ${meeting.meeting_date} to ${meeting_date} at ${meeting_time}`
        );

        res.json({ message: "Meeting rescheduled" });
      }
    );
  });
});

// Generate post-meeting follow-up email draft
app.post("/api/meetings/:id/follow-up", (req, res) => {
  db.get(
    `SELECT meetings.*, schools.email as school_email
     FROM meetings
     LEFT JOIN schools ON meetings.school_id = schools.id
     WHERE meetings.id = ?`,
    [req.params.id],
    (err, meeting) => {
      if (err || !meeting) return res.status(404).json({ error: "Meeting not found" });

      const email = postMeetingFollowUpTemplate(meeting);

      db.run(
        `INSERT INTO email_drafts (school_id, email_type, subject, body) VALUES (?, ?, ?, ?)`,
        [meeting.school_id, 'FOLLOW_UP', email.subject, email.body],
        function (err) {
          if (err) return res.status(500).json({ error: err.message });

          logActivity(meeting.school_id, 'EMAIL_GENERATED', 'Post-meeting follow-up email generated.');

          res.json({
            message:  "Follow-up email generated",
            draft_id: this.lastID,
            subject:  email.subject,
            body:     email.body
          });
        }
      );
    }
  );
});

// Public time slot availability for a specific date
app.get("/api/availability/slots/:date", (req, res) => {
  const { date } = req.params;

  // All possible time slots
  const allSlots = [
    '08:00', '09:00', '10:00', '11:00',
    '13:00', '14:00', '15:00', '16:00'
  ];

  db.all(
    `SELECT meeting_time FROM meetings
     WHERE meeting_date = ?
     AND status IN ('SCHEDULED', 'RESCHEDULED')`,
    [date],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });

      const bookedTimes = rows.map(r => r.meeting_time.substring(0, 5));

      const slots = allSlots.map(slot => ({
        time:      slot,
        available: !bookedTimes.includes(slot)
      }));

      res.json({ date, slots });
    }
  );
});

// Public availability endpoint (no school names exposed)
app.get("/api/availability/:year/:month", (req, res) => {
  const { year, month } = req.params;
  const pad = month.toString().padStart(2, '0');

  db.all(
    `SELECT meeting_date, COUNT(*) as count
     FROM meetings
     WHERE strftime('%Y', meeting_date) = ?
     AND strftime('%m', meeting_date) = ?
     AND status IN ('SCHEDULED', 'RESCHEDULED')
     GROUP BY meeting_date`,
    [year, pad],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });

      // Only return date and availability status — no school info
      const availability = {};
      rows.forEach(row => {
        availability[row.meeting_date] = {
          count: row.count,
          is_full: row.count >= 3,
          slots_remaining: 3 - row.count
        };
      });

      res.json(availability);
    }
  );
});

// Check meetings count for a specific date
app.get("/api/meetings/check/:date", (req, res) => {
  db.all(
    `SELECT * FROM meetings
     WHERE meeting_date = ?
     AND status IN ('SCHEDULED', 'RESCHEDULED')
     ORDER BY meeting_time ASC`,
    [req.params.date],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({
        date: req.params.date,
        count: rows.length,
        meetings: rows,
        is_full: rows.length >= 3
      });
    }
  );
});

// Get upcoming meetings (next 7 days)
app.get("/api/meetings/upcoming/week", (req, res) => {
  db.all(
    `SELECT meetings.*, schools.email as school_email
     FROM meetings
     LEFT JOIN schools ON meetings.school_id = schools.id
     WHERE meeting_date >= DATE('now', '+8 hours')
     AND meeting_date <= DATE('now', '+8 hours', '+7 days')
     AND meetings.status IN ('SCHEDULED', 'RESCHEDULED')
     ORDER BY meeting_date ASC, meeting_time ASC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// ── MEETING REMINDER COLUMNS (migration guard) ──
db.run(`ALTER TABLE meetings ADD COLUMN reminder_day_sent  INTEGER DEFAULT 0`, () => {});
db.run(`ALTER TABLE meetings ADD COLUMN reminder_hour_sent INTEGER DEFAULT 0`, () => {});

// ── MEETING REMINDERS ──

// 6 AM PHT — send day-of reminder to every meeting today
cron.schedule("0 6 * * *", () => {
  const phtNow = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const phtStr = phtNow.toISOString().replace('T', ' ').substring(0, 16) + ' PHT';
  console.log(`[6AM REMINDER] ${phtStr} — checking for meetings today...`);

  db.all(
    `SELECT meetings.*, schools.email as school_email
     FROM meetings
     LEFT JOIN schools ON meetings.school_id = schools.id
     WHERE meeting_date = DATE('now', '+8 hours')
       AND meetings.status IN ('SCHEDULED','RESCHEDULED')
       AND reminder_day_sent = 0`,
    [],
    async (err, meetings) => {
      if (err) { console.error('[6AM REMINDER] DB error:', err.message); return; }
      if (!meetings || !meetings.length) {
        console.log(`[6AM REMINDER] ${phtStr} — no meetings scheduled today`);
        return;
      }

      console.log(`[6AM REMINDER] ${phtStr} — found ${meetings.length} meeting(s) today`);
      for (const meeting of meetings) {
        if (!meeting.school_email) {
          console.warn(`[6AM REMINDER] Skipped ${meeting.school_name} — no school email set`);
          continue;
        }
        try {
          const email  = meetingDayReminderTemplate(meeting);
          const result = await sendEmail({ to: meeting.school_email, subject: email.subject, body: email.body });
          if (result.sent) {
            db.run(`UPDATE meetings SET reminder_day_sent = 1 WHERE id = ?`, [meeting.id]);
            logActivity(meeting.school_id, 'REMINDER_SENT',
              `Day-of reminder sent for meeting on ${meeting.meeting_date} at ${meeting.meeting_time}.`);
            console.log(`✅ [6AM REMINDER] Sent → ${meeting.school_name} (${meeting.school_email})`);
          } else {
            console.warn(`[6AM REMINDER] Not sent for ${meeting.school_name}: ${result.reason}`);
          }
        } catch (e) {
          console.error(`❌ [6AM REMINDER] Failed for ${meeting.school_name}:`, e.message);
        }
      }
    }
  );
}, { timezone: "Asia/Manila" });

// Every 5 minutes — send 1-hour-before reminder when meeting is 55–65 min away (PHT)
cron.schedule("*/5 * * * *", () => {
  const phtNow = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const phtStr = phtNow.toISOString().replace('T', ' ').substring(0, 16) + ' PHT';

  db.all(
    `SELECT meetings.*, schools.email as school_email
     FROM meetings
     LEFT JOIN schools ON meetings.school_id = schools.id
     WHERE meeting_date = DATE('now', '+8 hours')
       AND meetings.status IN ('SCHEDULED','RESCHEDULED')
       AND reminder_hour_sent = 0
       AND (
         CAST(strftime('%H', meeting_time) AS INTEGER) * 60 +
         CAST(strftime('%M', meeting_time) AS INTEGER)
       ) BETWEEN (
         CAST(strftime('%H', TIME('now', '+8 hours')) AS INTEGER) * 60 +
         CAST(strftime('%M', TIME('now', '+8 hours')) AS INTEGER) + 55
       ) AND (
         CAST(strftime('%H', TIME('now', '+8 hours')) AS INTEGER) * 60 +
         CAST(strftime('%M', TIME('now', '+8 hours')) AS INTEGER) + 65
       )`,
    [],
    async (err, meetings) => {
      if (err) { console.error('[1-HR REMINDER] DB error:', err.message); return; }
      if (!meetings || !meetings.length) {
        console.log(`[1-HR REMINDER] ${phtStr} — no meetings in 55–65 min window`);
        return;
      }

      console.log(`[1-HR REMINDER] ${phtStr} — found ${meetings.length} meeting(s) in window`);
      for (const meeting of meetings) {
        if (!meeting.school_email) {
          console.warn(`[1-HR REMINDER] Skipped ${meeting.school_name} — no school email set`);
          continue;
        }
        try {
          const email  = meetingHourReminderTemplate(meeting);
          const result = await sendEmail({ to: meeting.school_email, subject: email.subject, body: email.body });
          if (result.sent) {
            db.run(`UPDATE meetings SET reminder_hour_sent = 1 WHERE id = ?`, [meeting.id]);
            logActivity(meeting.school_id, 'REMINDER_SENT',
              `1-hour reminder sent for meeting at ${meeting.meeting_time}.`);
            console.log(`✅ 1-hour reminder sent → ${meeting.school_name} (${meeting.school_email})`);
          } else {
            console.warn(`[1-HR REMINDER] Not sent for ${meeting.school_name}: ${result.reason}`);
          }
        } catch (e) {
          console.error(`❌ 1-hour reminder failed for ${meeting.school_name}:`, e.message);
        }
      }
    }
  );
});

console.log("✅ Meeting reminder scheduler started — day reminder at 6 AM PHT, 1-hour check every 5 min");

// ── AUTO-MARK PAST MEETINGS AS DONE (midnight PHT + 2 min) ──
cron.schedule("2 0 * * *", () => {
  db.all(
    `SELECT id, school_id, meeting_date FROM meetings
     WHERE meeting_date < DATE('now', '+8 hours')
     AND status IN ('SCHEDULED', 'RESCHEDULED')`,
    [],
    (err, rows) => {
      if (err || !rows.length) return;
      db.run(
        `UPDATE meetings SET status = 'DONE', updated_at = CURRENT_TIMESTAMP
         WHERE meeting_date < DATE('now', '+8 hours')
         AND status IN ('SCHEDULED', 'RESCHEDULED')`,
        function(err) {
          if (err) return;
          rows.forEach(m => logActivity(m.school_id, 'MEETING_AUTO_DONE',
            `Past meeting on ${m.meeting_date} auto-marked as Done by nightly job.`));
          console.log(`✅ Auto-marked ${rows.length} past meeting(s) as Done`);
        }
      );
    }
  );
}, { timezone: "Asia/Manila" });

// ── DATABASE BACKUP SYSTEM ──

const BACKUP_DIR     = path.join(__dirname, "backups");
const DB_FILE        = path.join(__dirname, "thinktanq_outreach.db");
const KEEP_DAYS      = 30;

// Create backups folder if it doesn't exist
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR);
  console.log("✅ Backups folder created");
}

function runBackup() {
  try {
    const today    = new Date();
    const dateStr  = today.toISOString().split("T")[0];
    const backupFile = path.join(
      BACKUP_DIR,
      `thinktanq_backup_${dateStr}.db`
    );

    // Copy database file
    fs.copyFileSync(DB_FILE, backupFile);
    console.log(`✅ Backup created: thinktanq_backup_${dateStr}.db`);

    // Delete backups older than 30 days
    const files = fs.readdirSync(BACKUP_DIR);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - KEEP_DAYS);

    let deleted = 0;
    files.forEach(file => {
      if (!file.startsWith("thinktanq_backup_")) return;

      const filePath = path.join(BACKUP_DIR, file);
      const fileStat = fs.statSync(filePath);

      if (fileStat.mtime < cutoff) {
        fs.unlinkSync(filePath);
        deleted++;
        console.log(`🗑 Old backup deleted: ${file}`);
      }
    });

    if (deleted === 0) {
      console.log("ℹ️ No old backups to delete");
    }

  } catch (err) {
    console.error("❌ Backup failed:", err.message);
  }
}

// Run backup every day at midnight Philippine time (UTC+8)
// Midnight PHT = 4:00 PM UTC = cron "0 16 * * *"
cron.schedule("0 16 * * *", () => {
  console.log("⏰ Running scheduled database backup...");
  runBackup();
});

console.log("✅ Backup scheduler started — runs daily at midnight PHT");

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`ThinkTANQ AI School Outreach MVP running on http://localhost:${PORT}`);
});
