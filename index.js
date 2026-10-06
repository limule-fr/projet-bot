require("dotenv").config();

const http = require("http");

const {
    Client,
    GatewayIntentBits,
    Events
} = require("discord.js");

require("./database/database");

const {
    handleMessageReward,
    handleBalance,
    handleDaily
} = require("./commands/economy");

const {
    handleBug,
    handleBugButton
} = require("./commands/bug");

// =====================================================
// SERVEUR HTTP
// =====================================================

const PORT = process.env.PORT || 3000;

http.createServer((req, res) => {
    res.writeHead(200);
    res.end("Bot online");
}).listen(PORT, () => {
    console.log(`🌐 Serveur HTTP lancé sur le port ${PORT}`);
});

// =====================================================
// CLIENT DISCORD
// =====================================================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// =====================================================
// BOT PRÊT
// =====================================================

client.once(Events.ClientReady, client => {
    console.log(`✅ Connecté en tant que ${client.user.tag}`);
});

// =====================================================
// MESSAGES
// =====================================================

client.on(Events.MessageCreate, async message => {
    if (message.author.bot) return;

    try {
        // ==========================
        // ÉCONOMIE
        // ==========================

        await handleMessageReward(message);

        // ==========================
        // COMMANDES
        // ==========================

        const content = message.content.trim();

        if (content === "!ping") {
            return message.reply("🏓 Pong !");
        }

        if (content === "!balance") {
            return handleBalance(message);
        }

        if (content === "!daily") {
            return handleDaily(message);
        }

        // ==========================
        // !bug
        // ==========================

        if (content.startsWith("!bug ")) {
            const args = content
                .slice(5)
                .trim()
                .split(/\s+/);

            return handleBug(message, args);
        }

    } catch (error) {
        console.error(
            "❌ Erreur lors du traitement du message :",
            error
        );
    }
});

// =====================================================
// BOUTONS
// =====================================================

client.on(Events.InteractionCreate, async interaction => {
    try {
        if (interaction.isButton()) {
            await handleBugButton(interaction);
        }
    } catch (error) {
        console.error(
            "❌ Erreur interaction :",
            error
        );

        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: "❌ Une erreur est survenue.",
                ephemeral: true
            }).catch(() => {});
        }
    }
});

// =====================================================
// ERREURS
// =====================================================

client.on("error", error => {
    console.error("❌ CLIENT ERROR :", error);
});

process.on("unhandledRejection", error => {
    console.error("❌ UNHANDLED REJECTION :", error);
});

process.on("uncaughtException", error => {
    console.error("❌ UNCAUGHT EXCEPTION :", error);
});

// =====================================================
// CONNEXION
// =====================================================

client.login(process.env.DISCORD_TOKEN);