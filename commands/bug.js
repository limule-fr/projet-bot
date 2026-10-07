const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    PermissionsBitField
} = require("discord.js");

const { db } = require("../database/database");
const { addBalance } = require("../database/users");

const BUG_REWARD = 10;

// =====================================================
// CRÉER UN RAPPORT DE BUG
// =====================================================

async function createBugReport(message, game, description) {
    const result = await db.execute({
        sql: `
            INSERT INTO bug_reports (
                user_id,
                guild_id,
                game,
                description,
                status,
                created_at
            )
            VALUES (?, ?, ?, ?, 'pending', ?)
        `,
        args: [
            message.author.id,
            message.guild.id,
            game,
            description,
            Date.now()
        ]
    });

    return Number(result.lastInsertRowid);
}

// =====================================================
// !BUG
// =====================================================

async function handleBug(message, args) {
    if (!message.guild) return;

    if (args.length < 2) {
        return message.reply(
            "❌ Utilisation : `!bug [nom du jeu] [description du bug]`"
        );
    }

    const game = args.shift();
    const description = args.join(" ");

    if (description.length < 10) {
        return message.reply(
            "❌ Décris un peu plus précisément le bug."
        );
    }

    const channelId = process.env.BUG_CHANNEL_ID;

    if (!channelId) {
        console.error(
            "BUG_CHANNEL_ID n'est pas configuré dans .env"
        );

        return message.reply(
            "❌ Le système de bugs n'est pas correctement configuré."
        );
    }

    const channel = await message.guild.channels
        .fetch(channelId)
        .catch(() => null);

    if (!channel || !channel.isTextBased()) {
        return message.reply(
            "❌ Le salon des bugs est introuvable."
        );
    }

    const bugId = await createBugReport(
        message,
        game,
        description
    );

    const embed = new EmbedBuilder()
        .setTitle(`🐛 Bug #${bugId}`)
        .addFields(
            {
                name: "👤 Utilisateur",
                value: `<@${message.author.id}>`,
                inline: true
            },
            {
                name: "🎮 Jeu",
                value: game,
                inline: true
            },
            {
                name: "📝 Description",
                value: description
            }
        )
        .setFooter({
            text: "En attente de validation du staff"
        })
        .setTimestamp();

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`bug_validate:${bugId}`)
                .setLabel("Valider")
                .setStyle(ButtonStyle.Success),

            new ButtonBuilder()
                .setCustomId(`bug_reject:${bugId}`)
                .setLabel("Refuser")
                .setStyle(ButtonStyle.Danger),

            new ButtonBuilder()
                .setCustomId(`bug_duplicate:${bugId}`)
                .setLabel("Déjà signalé")
                .setStyle(ButtonStyle.Secondary)
        );

    await channel.send({
        embeds: [embed],
        components: [row]
    });

    return message.reply(
        "🐛 Ton bug a été transmis au staff. " +
        "Tu recevras les pièces uniquement s'il est jugé pertinent."
    );
}

// =====================================================
// BOUTONS DE VALIDATION
// =====================================================

async function handleBugButton(interaction) {
    if (!interaction.isButton()) return;

    if (!interaction.customId.startsWith("bug_")) {
        return;
    }

    if (!interaction.member.permissions.has(
        PermissionsBitField.Flags.ManageMessages
    )) {
        return interaction.reply({
            content: "❌ Tu n'as pas la permission de traiter les bugs.",
            ephemeral: true
        });
    }

    const [action, idString] =
        interaction.customId.split(":");

    const bugId = Number(idString);

    if (!Number.isInteger(bugId)) {
        return interaction.reply({
            content: "❌ Identifiant de bug invalide.",
            ephemeral: true
        });
    }

    const result = await db.execute({
        sql: `
            SELECT *
            FROM bug_reports
            WHERE id = ?
        `,
        args: [bugId]
    });

    const bug = result.rows[0];

    if (!bug) {
        return interaction.reply({
            content: "❌ Ce bug n'existe pas.",
            ephemeral: true
        });
    }

    if (bug.status !== "pending") {
        return interaction.reply({
            content:
                `❌ Ce bug a déjà été traité : **${bug.status}**.`,
            ephemeral: true
        });
    }

    // =================================================
    // EMPÊCHER L'AUTEUR DE VALIDER SON PROPRE BUG
    // =================================================

    if (
        action === "bug_validate" &&
        interaction.user.id === bug.user_id
    ) {
        return interaction.reply({
            content:
                "❌ Tu ne peux pas valider ton propre bug.",
            ephemeral: true
        });
    }

    let status;
    let responseMessage;
    let reward = 0;

    if (action === "bug_validate") {
        status = "validated";
        reward = BUG_REWARD;

        responseMessage =
            `✅ Bug validé. <@${bug.user_id}> reçoit ` +
            `**+${BUG_REWARD} pièces**.`;

    } else if (action === "bug_reject") {
        status = "rejected";

        responseMessage =
            "❌ Bug refusé.";

    } else if (action === "bug_duplicate") {
        status = "duplicate";

        responseMessage =
            "♻️ Bug marqué comme déjà signalé.";

    } else {
        return;
    }

    // =================================================
    // METTRE À JOUR LE BUG
    // =================================================

    await db.execute({
        sql: `
            UPDATE bug_reports
            SET status = ?,
                validated_by = ?,
                resolved_at = ?
            WHERE id = ?
              AND status = 'pending'
        `,
        args: [
            status,
            interaction.user.id,
            Date.now(),
            bugId
        ]
    });

    // =================================================
    // RÉCOMPENSE
    // =================================================

    if (reward > 0) {
        await addBalance(
            bug.user_id,
            bug.guild_id,
            reward,
            "bug_reward",
            `Bug #${bugId} validé`
        );
    }

    // =================================================
    // METTRE À JOUR LE MESSAGE DISCORD
    // =================================================

    const updatedEmbed = EmbedBuilder.from(
        interaction.message.embeds[0]
    )
        .setFooter({
            text:
                `Traitement : ${status} | ` +
                `Par ${interaction.user.username}`
        });

    await interaction.update({
        embeds: [updatedEmbed],
        components: []
    });

    await interaction.followUp({
        content: responseMessage,
        ephemeral: false
    });
}

module.exports = {
    handleBug,
    handleBugButton
};