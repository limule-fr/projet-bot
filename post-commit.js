require("dotenv").config();

const https = require("https");
const { execSync } = require("child_process");

// 1. On récupère les deux webhooks dans un tableau
const webhooks = [
    process.env.WEBHOOK_URL_1,
    process.env.WEBHOOK_URL_2
].filter(Boolean); // .filter(Boolean) permet d'ignorer une variable si elle est vide

try {
    const msg = execSync("git log -1 --pretty=%B")
        .toString()
        .trim();

    console.log(`Nombre de Webhooks détectés : ${webhooks.length}`);
    console.log("Commit :", msg);

    if (webhooks.length === 0) {
        throw new Error("Aucun WEBHOOK_URL trouvé dans le .env");
    }

    const data = JSON.stringify({
        content: `🟡 Nouveau commit : ${msg}`
    });

    // 2. On boucle sur chaque webhook pour envoyer le message
    webhooks.forEach((webhookUrl) => {
        const url = new URL(webhookUrl);

        const req = https.request({
            hostname: url.hostname,
            path: url.pathname + url.search,
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(data)
            }
        });

        req.on("error", err => {
            console.error(`Erreur webhook (${url.hostname}) :`, err);
        });

        req.write(data);
        req.end();
    });

} catch (e) {
    console.error("Erreur générale du webhook :", e);
}
