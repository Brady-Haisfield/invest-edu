import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '../data/meridian.db');

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE REFERENCES users(id),
    profile_data TEXT,
    refine_data TEXT,
    last_cards TEXT,
    last_narrative TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS saved_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    plan_name TEXT NOT NULL,
    inputs TEXT NOT NULL,
    cards TEXT NOT NULL,
    advisor_narrative TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS portfolio_holdings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    ticker TEXT NOT NULL,
    name TEXT,
    security_type TEXT,
    amount_invested REAL NOT NULL,
    shares REAL,
    purchase_price REAL,
    purchase_month INTEGER,
    purchase_year INTEGER,
    account_type TEXT,
    added_from TEXT DEFAULT 'manual',
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Migrate existing profiles table — add any columns that were added after initial creation
for (const col of ['refine_data TEXT', 'last_cards TEXT', 'last_narrative TEXT']) {
  try { db.exec(`ALTER TABLE profiles ADD COLUMN ${col}`); } catch {}
}

export default db;
