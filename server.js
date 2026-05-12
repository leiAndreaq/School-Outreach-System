require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const multer = require("multer");
const fs = require("fs");
const csv = require("csv-parser");

const db = require("./database");
const { generateEmail, hasApiKey } = require("./ai");
const { sendEmail, canSendEmail } = require("./mailer");

const app = express();
const upload = multer({ dest: "uploads/" });

app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public"));

function logActivity(schoolId, activityType, details) {
  db.run(
    `INSERT INTO activity_logs (school_id, activity_type, details) VALUES (?, ?, ?)`,
    [schoolId, activityType, details]
  );
}

app.get("/api/health", (req, res) => {
  res.json({
    app: "ThinkTANQ AI School Outreach MVP",
    status: "running",
    ai_mode: hasApiKey() ? "OPENAI_API" : "FREE_TEMPLATE_MODE",
    email_sending: canSendEmail() ? "ENABLED" : "DRAFT_ONLY"
  });
});

app.post("/api/schools", (req, res) => {
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

app.post("/api/import-csv", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "CSV file is required" });

  let imported = 0;
  const errors = [];

  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on("data", (row) => {
      if (!row.school_name) return;

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
        }
      );
    })
    .on("end", () => {
      fs.unlinkSync(req.file.path);
      res.json({ message: "CSV import completed", imported, errors });
    });
});

app.get("/api/activity-logs/:schoolId", (req, res) => {
  db.all(`SELECT * FROM activity_logs WHERE school_id = ? ORDER BY created_at DESC`, [req.params.schoolId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

const PORT = process.env.PORT || 3000;

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
        m.meeting_type || 'PRESENTATION',
        m.meeting_date,
        m.meeting_time,
        m.meeting_mode || 'ONLINE',
        m.meeting_link || '',
        m.meeting_address || '',
        m.notes || '',
        'SCHEDULED'
      ],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });

        // Update school status
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
          message: "Meeting scheduled",
          id: this.lastID
        });
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

// Delete meeting
app.delete("/api/meetings/:id", (req, res) => {
  db.get(`SELECT * FROM meetings WHERE id = ?`, [req.params.id], (err, meeting) => {
    if (err || !meeting) return res.status(404).json({ error: "Meeting not found" });

    db.run(`DELETE FROM meetings WHERE id = ?`, [req.params.id], function (err) {
      if (err) return res.status(500).json({ error: err.message });

      logActivity(
        meeting.school_id,
        'MEETING_CANCELLED',
        `Meeting on ${meeting.meeting_date} was cancelled`
      );

      res.json({ message: "Meeting deleted" });
    });
  });
});

// Get upcoming meetings (next 7 days)
app.get("/api/meetings/upcoming/week", (req, res) => {
  db.all(
    `SELECT meetings.*, schools.email as school_email
     FROM meetings
     LEFT JOIN schools ON meetings.school_id = schools.id
     WHERE meeting_date >= DATE('now')
     AND meeting_date <= DATE('now', '+7 days')
     AND meetings.status = 'SCHEDULED'
     ORDER BY meeting_date ASC, meeting_time ASC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

app.listen(PORT, () => {
  console.log(`ThinkTANQ AI School Outreach MVP running on http://localhost:${PORT}`);
});
