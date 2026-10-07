require("dotenv").config();

const { createClient } = require("@libsql/client");

const db = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
});

async function initializeDatabase() {
    await db.batch([
        {
            sql: `
                CREATE TABLE IF NOT EXISTS users (
                    user_id TEXT NOT NULL,
                    guild_id TEXT NOT NULL,
                    balance INTEGER NOT NULL DEFAULT 0,
                    created_at INTEGER NOT NULL,
                    daily_claim_at INTEGER NOT NULL DEFAULT 0,
                    streak INTEGER NOT NULL DEFAULT 0,
                    PRIMARY KEY (user_id, guild_id)
                )
            `
        },
        {
            sql: `
                CREATE TABLE IF NOT EXISTS transactions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id TEXT NOT NULL,
                    guild_id TEXT NOT NULL,
                    amount INTEGER NOT NULL,
                    type TEXT NOT NULL,
                    reason TEXT,
                    created_at INTEGER NOT NULL
                )
            `
        },
        {
            sql: `
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
                )
            `
        },
        {
            sql: `
                CREATE TABLE IF NOT EXISTS shop_items (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    guild_id TEXT NOT NULL,
                    role_id TEXT NOT NULL,
                    name TEXT NOT NULL,
                    price INTEGER NOT NULL,
                    created_at INTEGER NOT NULL
                )
            `
        },
        {
            sql: `
                CREATE TABLE IF NOT EXISTS purchases (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id TEXT NOT NULL,
                    guild_id TEXT NOT NULL,
                    item_id INTEGER NOT NULL,
                    price INTEGER NOT NULL,
                    created_at INTEGER NOT NULL
                )
            `
        },
        {
            sql: `
                CREATE TABLE IF NOT EXISTS tickets (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    guild_id TEXT NOT NULL,
                    channel_id TEXT,
                    user_id TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'open',
                    created_at INTEGER NOT NULL,
                    closed_at INTEGER
                )
            `
        }
    ]);

    console.log("✅ Base de données Turso chargée");
}

module.exports = {
    db,
    initializeDatabase
};