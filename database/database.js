const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "database.sqlite");

const db = new Database(dbPath);

db.pragma("foreign_keys = ON");

db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        user_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        balance INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        daily_claim_at INTEGER NOT NULL DEFAULT 0,
        streak INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (user_id, guild_id)
    );

    CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        amount INTEGER NOT NULL,
        type TEXT NOT NULL,
        reason TEXT,
        created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bug_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        game TEXT NOT NULL,
        description TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        validated_by TEXT,
        created_at INTEGER NOT NULL,
        resolved_at INTEGER
    );
`);

console.log("✅ Base de données SQLite chargée");

module.exports = db;