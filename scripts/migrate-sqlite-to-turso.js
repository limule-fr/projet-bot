require("dotenv").config();

const Database = require("better-sqlite3");
const { createClient } = require("@libsql/client");

const sqlite = new Database("./database/database.sqlite");

const turso = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
});

async function main() {
    console.log("🚀 Début de la migration SQLite → Turso\n");

    if (!process.env.TURSO_DATABASE_URL) {
        throw new Error("TURSO_DATABASE_URL est absente.");
    }

    if (!process.env.TURSO_AUTH_TOKEN) {
        throw new Error("TURSO_AUTH_TOKEN est absent.");
    }

    // Création du schéma Turso
    await turso.batch([
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

    console.log("✅ Tables Turso vérifiées");

    // Vérifier que Turso est vide
    for (const table of [
        "users",
        "transactions",
        "bug_reports",
        "shop_items",
        "purchases",
        "tickets"
    ]) {
        const result = await turso.execute(
            `SELECT COUNT(*) AS count FROM ${table}`
        );

        const count = Number(result.rows[0].count);

        if (count > 0) {
            throw new Error(
                `La table Turso "${table}" contient déjà ${count} ligne(s). ` +
                `Migration annulée pour éviter les doublons.`
            );
        }
    }

    console.log("✅ Turso est vide, migration possible");

    // --------------------------------------------------
    // Migration de users
    // --------------------------------------------------

    const users = sqlite.prepare(`
        SELECT
            user_id,
            guild_id,
            balance,
            created_at
        FROM users
    `).all();

    console.log(`\n📦 users : ${users.length} ligne(s)`);

    for (const user of users) {
        await turso.execute({
            sql: `
                INSERT INTO users (
                    user_id,
                    guild_id,
                    balance,
                    created_at,
                    daily_claim_at,
                    streak
                )
                VALUES (?, ?, ?, ?, 0, 0)
            `,
            args: [
                user.user_id,
                user.guild_id,
                user.balance,
                user.created_at
            ]
        });
    }

    console.log("✅ users migrée");

    // --------------------------------------------------
    // Vérification finale
    // --------------------------------------------------

    const tursoResult = await turso.execute(
        "SELECT COUNT(*) AS count FROM users"
    );

    const tursoUserCount = Number(tursoResult.rows[0].count);

    console.log("\n📊 Vérification finale :");
    console.log(`SQLite users : ${users.length}`);
    console.log(`Turso users  : ${tursoUserCount}`);

    if (users.length !== tursoUserCount) {
        throw new Error(
            "Le nombre d'utilisateurs SQLite et Turso ne correspond pas."
        );
    }

    console.log("\n🎉 Migration terminée avec succès !");
    console.log("🔒 database.sqlite est conservée comme sauvegarde.");

    sqlite.close();
}

main().catch(error => {
    console.error("\n❌ Migration échouée :");
    console.error(error);

    try {
        sqlite.close();
    } catch {}

    process.exit(1);
});
