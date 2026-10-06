const db = require("./database");

function getUser(userId, guildId) {
    let user = db.prepare(`
        SELECT *
        FROM users
        WHERE user_id = ? AND guild_id = ?
    `).get(userId, guildId);

    if (!user) {
        db.prepare(`
            INSERT INTO users (
                user_id,
                guild_id,
                balance,
                created_at
            )
            VALUES (?, ?, 0, ?)
        `).run(
            userId,
            guildId,
            Date.now()
        );

        user = db.prepare(`
            SELECT *
            FROM users
            WHERE user_id = ? AND guild_id = ?
        `).get(userId, guildId);
    }

    return user;
}

function getBalance(userId, guildId) {
    return getUser(userId, guildId).balance;
}

function addBalance(userId, guildId, amount, type, reason = null) {
    if (!Number.isInteger(amount) || amount <= 0) {
        throw new Error("Le montant doit être un entier positif.");
    }

    getUser(userId, guildId);

    const transaction = db.transaction(() => {
        db.prepare(`
            UPDATE users
            SET balance = balance + ?
            WHERE user_id = ? AND guild_id = ?
        `).run(
            amount,
            userId,
            guildId
        );

        db.prepare(`
            INSERT INTO transactions (
                user_id,
                guild_id,
                amount,
                type,
                reason,
                created_at
            )
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(
            userId,
            guildId,
            amount,
            type,
            reason,
            Date.now()
        );
    });

    transaction();
}

function removeBalance(userId, guildId, amount, type, reason = null) {
    if (!Number.isInteger(amount) || amount <= 0) {
        throw new Error("Le montant doit être un entier positif.");
    }

    const user = getUser(userId, guildId);

    if (user.balance < amount) {
        return false;
    }

    const transaction = db.transaction(() => {
        db.prepare(`
            UPDATE users
            SET balance = balance - ?
            WHERE user_id = ? AND guild_id = ?
        `).run(
            amount,
            userId,
            guildId
        );

        db.prepare(`
            INSERT INTO transactions (
                user_id,
                guild_id,
                amount,
                type,
                reason,
                created_at
            )
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(
            userId,
            guildId,
            -amount,
            type,
            reason,
            Date.now()
        );
    });

    transaction();

    return true;
}

function getRecentMessageRewards(userId, guildId, since) {
    return db.prepare(`
        SELECT COALESCE(SUM(amount), 0) AS total
        FROM transactions
        WHERE user_id = ?
          AND guild_id = ?
          AND type = 'message'
          AND created_at >= ?
    `).get(
        userId,
        guildId,
        since
    ).total;
}

function getTodayMessageRewards(userId, guildId, startOfDay) {
    return db.prepare(`
        SELECT COALESCE(SUM(amount), 0) AS total
        FROM transactions
        WHERE user_id = ?
          AND guild_id = ?
          AND type = 'message'
          AND created_at >= ?
    `).get(
        userId,
        guildId,
        startOfDay
    ).total;
}

function getLastMessageReward(userId, guildId) {
    return db.prepare(`
        SELECT created_at
        FROM transactions
        WHERE user_id = ?
          AND guild_id = ?
          AND type = 'message'
        ORDER BY created_at DESC
        LIMIT 1
    `).get(userId, guildId);
}

function getTransactionHistory(userId, guildId, limit = 10) {
    return db.prepare(`
        SELECT *
        FROM transactions
        WHERE user_id = ?
          AND guild_id = ?
        ORDER BY created_at DESC
        LIMIT ?
    `).all(
        userId,
        guildId,
        limit
    );
}

function updateDaily(userId, guildId, dailyClaimAt, streak) {
    getUser(userId, guildId);

    db.prepare(`
        UPDATE users
        SET daily_claim_at = ?,
            streak = ?
        WHERE user_id = ?
          AND guild_id = ?
    `).run(
        dailyClaimAt,
        streak,
        userId,
        guildId
    );
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