const db = require("./database");

// Récupère un utilisateur ou le crée s'il n'existe pas
function getUser(userId, guildId) {
    let user = db.prepare(`
        SELECT *
        FROM users
        WHERE user_id = ? AND guild_id = ?
    `).get(userId, guildId);

    if (!user) {
        db.prepare(`
            INSERT INTO users (user_id, guild_id, balance, created_at)
            VALUES (?, ?, 0, ?)
        `).run(userId, guildId, Date.now());

        user = db.prepare(`
            SELECT *
            FROM users
            WHERE user_id = ? AND guild_id = ?
        `).get(userId, guildId);
    }

    return user;
}

// Récupère uniquement le solde
function getBalance(userId, guildId) {
    const user = getUser(userId, guildId);
    return user.balance;
}

// Ajoute des pièces
function addBalance(userId, guildId, amount) {
    getUser(userId, guildId);

    db.prepare(`
        UPDATE users
        SET balance = balance + ?
        WHERE user_id = ? AND guild_id = ?
    `).run(amount, userId, guildId);
}

// Retire des pièces
function removeBalance(userId, guildId, amount) {
    getUser(userId, guildId);

    db.prepare(`
        UPDATE users
        SET balance = balance - ?
        WHERE user_id = ? AND guild_id = ?
    `).run(amount, userId, guildId);
}

module.exports = {
    getUser,
    getBalance,
    addBalance,
    removeBalance
};