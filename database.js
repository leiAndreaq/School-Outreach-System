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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
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
});

module.exports = db;
