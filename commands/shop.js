const {
    EmbedBuilder,
    PermissionsBitField
} = require("discord.js");

const { db } = require("../database/database");

const {
    getBalance,
    removeBalance,
    addBalance
} = require("../database/users");

// =====================================================
// AFFICHER LA BOUTIQUE
// =====================================================

async function handleShop(message) {
    if (!message.guild) return;

    const result = await db.execute({
        sql: `
            SELECT *
            FROM shop_items
            WHERE guild_id = ?
            ORDER BY id ASC
        `,
        args: [message.guild.id]
    });

    const items = result.rows;

    if (items.length === 0) {
        return message.reply(
            "🛒 La boutique est actuellement vide."
        );
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

    const result = await db.execute({
        sql: `
            SELECT *
            FROM shop_items
            WHERE id = ?
              AND guild_id = ?
        `,
        args: [
            itemId,
            message.guild.id
        ]
    });

    const item = result.rows[0];

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

    const balance = await getBalance(
        message.author.id,
        message.guild.id
    );

    if (balance < Number(item.price)) {
        return message.reply(
            `❌ Tu n'as pas assez de pièces.\n` +
            `💰 Prix : **${item.price}**\n` +
            `💳 Ton solde : **${balance}**`
        );
    }

    const removed = await removeBalance(
        message.author.id,
        message.guild.id,
        Number(item.price),
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

        await db.execute({
            sql: `
                INSERT INTO purchases (
                    user_id,
                    guild_id,
                    item_id,
                    price,
                    created_at
                )
                VALUES (?, ?, ?, ?, ?)
            `,
            args: [
                message.author.id,
                message.guild.id,
                Number(item.id),
                Number(item.price),
                Date.now()
            ]
        });

        const newBalance = await getBalance(
            message.author.id,
            message.guild.id
        );

        return message.reply(
            `🛍️ Achat effectué !\n\n` +
            `🎁 **${item.name}**\n` +
            `💰 Prix : **${item.price} pièces**\n` +
            `💳 Nouveau solde : **${newBalance} pièces**`
        );

    } catch (error) {
        console.error(
            "Erreur attribution rôle :",
            error
        );

        // Remboursement automatique
        await addBalance(
            message.author.id,
            message.guild.id,
            Number(item.price),
            "shop_refund",
            `Remboursement : ${item.name}`
        );

        return message.reply(
            "❌ Le rôle n'a pas pu être attribué.\n" +
            `💰 **${item.price} pièces** ont été remboursées.`
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

    await db.execute({
        sql: `
            INSERT INTO shop_items (
                guild_id,
                role_id,
                name,
                price,
                created_at
            )
            VALUES (?, ?, ?, ?, ?)
        `,
        args: [
            message.guild.id,
            role.id,
            name,
            price,
            Date.now()
        ]
    });

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

    const result = await db.execute({
        sql: `
            DELETE FROM shop_items
            WHERE id = ?
              AND guild_id = ?
        `,
        args: [
            itemId,
            message.guild.id
        ]
    });

    if (result.rowsAffected === 0) {
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