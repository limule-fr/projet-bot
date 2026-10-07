const { db } = require("./database");

async function getUser(userId, guildId) {
    let result = await db.execute({
        sql: `
            SELECT *
            FROM users
            WHERE user_id = ? AND guild_id = ?
        `,
        args: [userId, guildId]
    });

    let user = result.rows[0];

    if (!user) {
        await db.execute({
            sql: `
                INSERT INTO users (
                    user_id,
                    guild_id,
                    balance,
                    created_at
                )
                VALUES (?, ?, 0, ?)
            `,
            args: [
                userId,
                guildId,
                Date.now()
            ]
        });

        result = await db.execute({
            sql: `
                SELECT *
                FROM users
                WHERE user_id = ? AND guild_id = ?
            `,
            args: [userId, guildId]
        });

        user = result.rows[0];
    }

    return user;
}

async function getBalance(userId, guildId) {
    const user = await getUser(userId, guildId);

    return Number(user.balance);
}

async function addBalance(
    userId,
    guildId,
    amount,
    type,
    reason = null
) {
    if (!Number.isInteger(amount) || amount <= 0) {
        throw new Error(
            "Le montant doit être un entier positif."
        );
    }

    await getUser(userId, guildId);

    await db.batch([
        {
            sql: `
                UPDATE users
                SET balance = balance + ?
                WHERE user_id = ? AND guild_id = ?
            `,
            args: [
                amount,
                userId,
                guildId
            ]
        },
        {
            sql: `
                INSERT INTO transactions (
                    user_id,
                    guild_id,
                    amount,
                    type,
                    reason,
                    created_at
                )
                VALUES (?, ?, ?, ?, ?, ?)
            `,
            args: [
                userId,
                guildId,
                amount,
                type,
                reason,
                Date.now()
            ]
        }
    ]);
}

async function removeBalance(
    userId,
    guildId,
    amount,
    type,
    reason = null
) {
    if (!Number.isInteger(amount) || amount <= 0) {
        throw new Error(
            "Le montant doit être un entier positif."
        );
    }

    const user = await getUser(userId, guildId);

    if (Number(user.balance) < amount) {
        return false;
    }

    await db.batch([
        {
            sql: `
                UPDATE users
                SET balance = balance - ?
                WHERE user_id = ? AND guild_id = ?
            `,
            args: [
                amount,
                userId,
                guildId
            ]
        },
        {
            sql: `
                INSERT INTO transactions (
                    user_id,
                    guild_id,
                    amount,
                    type,
                    reason,
                    created_at
                )
                VALUES (?, ?, ?, ?, ?, ?)
            `,
            args: [
                userId,
                guildId,
                -amount,
                type,
                reason,
                Date.now()
            ]
        }
    ]);

    return true;
}

async function getRecentMessageRewards(
    userId,
    guildId,
    since
) {
    const result = await db.execute({
        sql: `
            SELECT COALESCE(SUM(amount), 0) AS total
            FROM transactions
            WHERE user_id = ?
              AND guild_id = ?
              AND type = 'message'
              AND created_at >= ?
        `,
        args: [
            userId,
            guildId,
            since
        ]
    });

    return Number(result.rows[0].total);
}

async function getTodayMessageRewards(
    userId,
    guildId,
    startOfDay
) {
    const result = await db.execute({
        sql: `
            SELECT COALESCE(SUM(amount), 0) AS total
            FROM transactions
            WHERE user_id = ?
              AND guild_id = ?
              AND type = 'message'
              AND created_at >= ?
        `,
        args: [
            userId,
            guildId,
            startOfDay
        ]
    });

    return Number(result.rows[0].total);
}

async function getLastMessageReward(
    userId,
    guildId
) {
    const result = await db.execute({
        sql: `
            SELECT created_at
            FROM transactions
            WHERE user_id = ?
              AND guild_id = ?
              AND type = 'message'
            ORDER BY created_at DESC
            LIMIT 1
        `,
        args: [
            userId,
            guildId
        ]
    });

    return result.rows[0] || null;
}

async function getTransactionHistory(
    userId,
    guildId,
    limit = 10
) {
    const result = await db.execute({
        sql: `
            SELECT *
            FROM transactions
            WHERE user_id = ?
              AND guild_id = ?
            ORDER BY created_at DESC
            LIMIT ?
        `,
        args: [
            userId,
            guildId,
            limit
        ]
    });

    return result.rows;
}

async function updateDaily(
    userId,
    guildId,
    dailyClaimAt,
    streak
) {
    await getUser(userId, guildId);

    await db.execute({
        sql: `
            UPDATE users
            SET daily_claim_at = ?,
                streak = ?
            WHERE user_id = ?
              AND guild_id = ?
        `,
        args: [
            dailyClaimAt,
            streak,
            userId,
            guildId
        ]
    });
}

module.exports = {
    getUser,
    getBalance,
    addBalance,
    removeBalance,
    getRecentMessageRewards,
    getTodayMessageRewards,
    getLastMessageReward,
    getTransactionHistory,
    updateDaily
};