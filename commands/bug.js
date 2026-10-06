const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    PermissionsBitField
} = require("discord.js");

const db = require("../database/database");
const { addBalance } = require("../database/users");

const BUG_REWARD = 10;

function createBugReport(message, game, description) {
    return db.prepare(`
        INSERT INTO bug_reports (
            user_id,
            guild_id,
            game,
            description,
            status,
            created_at
        )
        VALUES (?, ?, ?, ?, 'pending', ?)
    `).run(
        message.author.id,
        message.guild.id,
        game,
        description,
        Date.now()
    ).lastInsertRowid;
}

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

    const bugId = createBugReport(
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

    const bug = db.prepare(`
        SELECT *
        FROM bug_reports
        WHERE id = ?
    `).get(bugId);

    if (!bug) {
        return interaction.reply({
            content: "❌ Ce bug n'existe pas.",
            ephemeral: true
        });
    }

    if (bug.status !== "pending") {
        return interaction.reply({
            content: `❌ Ce bug a déjà été traité : **${bug.status}**.`,
            ephemeral: true
        });
    }

    let status;
    let message;
    let reward = 0;

    if (action === "bug_validate") {
        status = "validated";
        reward = BUG_REWARD;
        message = `✅ Bug validé. <@${bug.user_id}> reçoit **+${BUG_REWARD} pièces**.`;
    } else if (action === "bug_reject") {
        status = "rejected";
        message = "❌ Bug refusé.";
    } else if (action === "bug_duplicate") {
        status = "duplicate";
        message = "♻️ Bug marqué comme déjà signalé.";
    } else {
        return;
    }

    const transaction = db.transaction(() => {
        db.prepare(`
            UPDATE bug_reports
            SET status = ?,
                validated_by = ?,
                resolved_at = ?
            WHERE id = ?
              AND status = 'pending'
        `).run(
            status,
            interaction.user.id,
            Date.now(),
            bugId
        );

        if (reward > 0) {
            addBalance(
                bug.user_id,
                bug.guild_id,
                reward,
                "bug_validated",
                `Bug #${bugId} validé`
            );
        }
    });

    transaction();

    const updatedEmbed = EmbedBuilder.from(
        interaction.message.embeds[0]
    )
        .setFooter({
            text: `Traitement : ${status} | Par ${interaction.user.username}`
        });

    await interaction.update({
        embeds: [updatedEmbed],
        components: []
    });

    await interaction.followUp({
        content: message,
        ephemeral: false
    });
}

module.exports = {
    handleBug,
    handleBugButton
};