const {
    EmbedBuilder,
    PermissionsBitField
} = require("discord.js");

const db = require("../database/database");
const {
    getBalance,
    removeBalance
} = require("../database/users");

// =====================================================
// AFFICHER LA BOUTIQUE
// =====================================================

async function handleShop(message) {
    if (!message.guild) return;

    const items = db.prepare(`
        SELECT *
        FROM shop_items
        WHERE guild_id = ?
        ORDER BY id ASC
    `).all(message.guild.id);

    if (items.length === 0) {
        return message.reply("🛒 La boutique est actuellement vide.");
    }

    const embed = new EmbedBuilder()
        .setTitle("🛒 Boutique")
        .setDescription(
            items
                .map(item =>
                    `**${item.id}. ${item.name}** — 💰 ${item.price} pièces`
                )
                .join("\n")
        )
        .setFooter({
            text: "Utilise !buy <numéro> pour acheter un article."
        });

    return message.reply({
        embeds: [embed]
    });
}

// =====================================================
// ACHETER
// =====================================================

async function handleBuy(message, args) {
    if (!message.guild) return;

    const itemId = Number(args[0]);

    if (!Number.isInteger(itemId)) {
        return message.reply(
            "❌ Utilisation : `!buy <numéro>`"
        );
    }

    const item = db.prepare(`
        SELECT *
        FROM shop_items
        WHERE id = ?
          AND guild_id = ?
    `).get(
        itemId,
        message.guild.id
    );

    if (!item) {
        return message.reply(
            "❌ Cet article n'existe pas."
        );
    }

    const role = await message.guild.roles
        .fetch(item.role_id)
        .catch(() => null);

    if (!role) {
        return message.reply(
            "❌ Le rôle associé à cet article n'existe plus."
        );
    }

    if (message.member.roles.cache.has(role.id)) {
        return message.reply(
            "❌ Tu possèdes déjà ce rôle."
        );
    }

    const balance = getBalance(
        message.author.id,
        message.guild.id
    );

    if (balance < item.price) {
        return message.reply(
            `❌ Tu n'as pas assez de pièces.\n` +
            `💰 Prix : **${item.price}**\n` +
            `💳 Ton solde : **${balance}**`
        );
    }

    const removed = removeBalance(
        message.author.id,
        message.guild.id,
        item.price,
        "shop_purchase",
        `Achat : ${item.name}`
    );

    if (!removed) {
        return message.reply(
            "❌ Impossible de retirer les pièces."
        );
    }

    try {
        await message.member.roles.add(role);

        const newBalance = getBalance(
            message.author.id,
            message.guild.id
        );

        db.prepare(`
            INSERT INTO purchases (
                user_id,
                guild_id,
                item_id,
                price,
                created_at
            )
            VALUES (?, ?, ?, ?, ?)
        `).run(
            message.author.id,
            message.guild.id,
            item.id,
            item.price,
            Date.now()
        );

        return message.reply(
            `🛍️ Achat effectué !\n\n` +
            `🎁 **${item.name}**\n` +
            `💰 Prix : **${item.price} pièces**\n` +
            `💳 Nouveau solde : **${newBalance} pièces**`
        );

    } catch (error) {
        console.error("Erreur attribution rôle :", error);

        return message.reply(
            "❌ Le rôle n'a pas pu être attribué. Les pièces n'ont pas été remboursées automatiquement."
        );
    }
}

// =====================================================
// AJOUTER UN ARTICLE
// =====================================================

async function handleShopAdd(message, args) {
    if (!message.guild) return;

    if (!message.member.permissions.has(
        PermissionsBitField.Flags.Administrator
    )) {
        return message.reply(
            "❌ Cette commande est réservée aux administrateurs."
        );
    }

    if (args.length < 3) {
        return message.reply(
            "❌ Utilisation : `!shopadd <ID rôle> <prix> <nom>`"
        );
    }

    const roleId = args.shift();
    const price = Number(args.shift());
    const name = args.join(" ");

    if (!Number.isInteger(price) || price <= 0) {
        return message.reply(
            "❌ Le prix doit être un nombre entier positif."
        );
    }

    const role = await message.guild.roles
        .fetch(roleId)
        .catch(() => null);

    if (!role) {
        return message.reply(
            "❌ Rôle introuvable."
        );
    }

    db.prepare(`
        INSERT INTO shop_items (
            guild_id,
            role_id,
            name,
            price,
            created_at
        )
        VALUES (?, ?, ?, ?, ?)
    `).run(
        message.guild.id,
        role.id,
        name,
        price,
        Date.now()
    );

    return message.reply(
        `✅ Article ajouté à la boutique : **${name}** pour **${price} pièces**.`
    );
}

// =====================================================
// SUPPRIMER UN ARTICLE
// =====================================================

async function handleShopRemove(message, args) {
    if (!message.guild) return;

    if (!message.member.permissions.has(
        PermissionsBitField.Flags.Administrator
    )) {
        return message.reply(
            "❌ Cette commande est réservée aux administrateurs."
        );
    }

    const itemId = Number(args[0]);

    if (!Number.isInteger(itemId)) {
        return message.reply(
            "❌ Utilisation : `!shopremove <numéro>`"
        );
    }

    const result = db.prepare(`
        DELETE FROM shop_items
        WHERE id = ?
          AND guild_id = ?
    `).run(
        itemId,
        message.guild.id
    );

    if (result.changes === 0) {
        return message.reply(
            "❌ Article introuvable."
        );
    }

    return message.reply(
        "✅ Article supprimé de la boutique."
    );
}

module.exports = {
    handleShop,
    handleBuy,
    handleShopAdd,
    handleShopRemove
};