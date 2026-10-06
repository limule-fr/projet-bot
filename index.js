require("dotenv").config();

const http = require("http");
const {
    Client,
    GatewayIntentBits,
    Events
} = require("discord.js");

const db = require("./database/database");

// ─────────────────────────────
// Serveur HTTP
// ─────────────────────────────

const PORT = process.env.PORT || 3000;

http.createServer((req, res) => {
    res.writeHead(200);
    res.end("Bot online");
}).listen(PORT, () => {
    console.log(`🌐 Serveur HTTP lancé sur le port ${PORT}`);
});


// ─────────────────────────────
// Bot Discord
// ─────────────────────────────

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.once(Events.ClientReady, (client) => {
    console.log(`✅ Connecté en tant que ${client.user.tag}`);
});

client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;

    if (message.content === "!ping") {
        await message.reply("🏓 Pong !");
    }
});

client.login(process.env.DISCORD_TOKEN);