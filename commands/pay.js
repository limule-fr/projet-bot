const {
    getBalance,
    removeBalance,
    addBalance
} = require("../database/users");

async function handlePay(message, args) {
    if (!message.guild) return;

    // Vérification de la mention
    const target = message.mentions.users.first();

    if (!target) {
        return message.reply(
            "❌ Utilisation : `!pay @utilisateur <montant>`"
        );
    }

    // Impossible de se payer soi-même
    if (target.id === message.author.id) {
        return message.reply(
            "❌ Tu ne peux pas te transférer des pièces à toi-même."
        );
    }

    // Impossible de payer un bot
    if (target.bot) {
        return message.reply(
            "❌ Tu ne peux pas transférer des pièces à un bot."
        );
    }

    const amount = Number(args[1]);

    if (!Number.isInteger(amount) || amount <= 0) {
        return message.reply(
            "❌ Le montant doit être un nombre entier positif."
        );
    }

    const guildId = message.guild.id;
    const senderId = message.author.id;
    const receiverId = target.id;

    // Récupération du solde
    const senderBalance = await getBalance(
        senderId,
        guildId
    );

    if (senderBalance < amount) {
        return message.reply(
            `❌ Tu n'as pas assez de pièces.\n` +
            `💰 Ton solde : **${senderBalance}**\n` +
            `💸 Montant demandé : **${amount}**`
        );
    }

    // Retrait chez l'expéditeur
    const removed = await removeBalance(
        senderId,
        guildId,
        amount,
        "transfer_sent",
        `Transfert vers ${receiverId}`
    );

    if (!removed) {
        return message.reply(
            "❌ Le transfert a échoué."
        );
    }

    // Ajout chez le destinataire
    await addBalance(
        receiverId,
        guildId,
        amount,
        "transfer_received",
        `Transfert de ${senderId}`
    );

    // Nouveau solde
    const newBalance = await getBalance(
        senderId,
        guildId
    );

    return message.reply(
        `💸 Transfert effectué !\n\n` +
        `👤 Destinataire : **${target.username}**\n` +
        `💰 Montant : **${amount} pièces**\n` +
        `💳 Ton nouveau solde : **${newBalance} pièces**`
    );
}

module.exports = {
    handlePay
};