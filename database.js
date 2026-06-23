const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("./thinktanq_outreach.db");

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS schools (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_name TEXT NOT NULL,
      contact_person TEXT,
      email TEXT,
      phone TEXT,
      website TEXT,
      facebook_page TEXT,
      address TEXT,
      city_province TEXT,
      region TEXT,
      school_type TEXT,
      level_offered TEXT,
      estimated_students INTEGER,
      status TEXT DEFAULT 'NEW_LEAD',
      lead_type TEXT DEFAULT 'OFFICIAL',
      mode TEXT DEFAULT 'school',
      promo_unsubscribed INTEGER DEFAULT 0,
      assigned_to TEXT,
      notes TEXT,
      last_contacted TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS email_drafts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      email_type TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      status TEXT DEFAULT 'DRAFT',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (school_id) REFERENCES schools(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER,
      activity_type TEXT NOT NULL,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (school_id) REFERENCES schools(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS meetings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      school_name TEXT NOT NULL,
      contact_person TEXT,
      meeting_type TEXT DEFAULT 'PRESENTATION',
      meeting_date TEXT NOT NULL,
      meeting_time TEXT NOT NULL,
      meeting_mode TEXT DEFAULT 'ONLINE',
      meeting_link TEXT,
      meeting_address TEXT,
      notes TEXT,
      status TEXT DEFAULT 'SCHEDULED',
      reminder_day_sent INTEGER DEFAULT 0,
      reminder_hour_sent INTEGER DEFAULT 0,
      followup_sent INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (school_id) REFERENCES schools(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS inquiries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_name TEXT NOT NULL,
      school_type TEXT,
      level_offered TEXT,
      estimated_students INTEGER,
      city_province TEXT,
      region TEXT,
      contact_person TEXT NOT NULL,
      position TEXT,
      email TEXT NOT NULL,
      phone TEXT,
      preferred_date TEXT,
      preferred_time TEXT,
      preferred_mode TEXT DEFAULT 'ONLINE',
      heard_from TEXT,
      message TEXT,
      status TEXT DEFAULT 'PENDING',
      rejection_reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS auth (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ── SEED DEFAULT PASSWORD FROM .env ──
  const bcrypt = require("bcryptjs");
  db.get(`SELECT * FROM auth LIMIT 1`, [], (err, row) => {
    if (!row) {
      const hash = bcrypt.hashSync(
        process.env.CRM_PASSWORD || "thinktanq2026", 10
      );
      db.run(`INSERT INTO auth (password_hash) VALUES (?)`, [hash]);
      console.log("✅ Default password set from .env");
    }
  });

  db.run(`
    CREATE TABLE IF NOT EXISTS import_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT,
      imported_count INTEGER DEFAULT 0,
      error_count INTEGER DEFAULT 0,
      imported_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS deletion_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_type TEXT NOT NULL,
      record_name TEXT NOT NULL,
      reason TEXT,
      deleted_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT,
      icon TEXT DEFAULT 'bell',
      is_pinned INTEGER DEFAULT 0,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT ''
    )
  `);
  db.run(`INSERT OR IGNORE INTO app_settings (key, value) VALUES ('promo_campaign_paused', '0')`);

  db.run(`
    CREATE TABLE IF NOT EXISTS business_inquiries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_name TEXT NOT NULL,
      contact_person TEXT NOT NULL,
      email TEXT NOT NULL,
      guest_emails TEXT,
      preferred_date TEXT,
      preferred_time TEXT,
      description TEXT,
      status TEXT DEFAULT 'PENDING',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ── INDEXES for performance on commonly queried columns ──
  db.run(`CREATE INDEX IF NOT EXISTS idx_schools_lead_type ON schools(lead_type)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_schools_status ON schools(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_meetings_school_id ON meetings(school_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_meetings_date_status ON meetings(meeting_date, status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_activity_logs_school_id ON activity_logs(school_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_email_drafts_school_id ON email_drafts(school_id)`);
});

module.exports = db;
