const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "database.sqlite");

const db = new Database(dbPath);

// Active les clés étrangères
db.pragma("foreign_keys = ON");

// Création des tables
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        guild_id TEXT NOT NULL,
        balance INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
    );
`);

console.log("✅ Base de données SQLite chargée");

module.exports = db;