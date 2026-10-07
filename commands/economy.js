const {
    getUser,
    getBalance,
    addBalance,
    getRecentMessageRewards,
    getTodayMessageRewards,
    getLastMessageReward,
    updateDaily
} = require("../database/users");

const ECONOMY = {
    MESSAGE_REWARD: 1,
    MESSAGE_COOLDOWN: 30 * 1000,
    MESSAGE_HOURLY_LIMIT: 120,
    MESSAGE_DAILY_LIMIT: 200,

    DAILY_REWARD: 50,
    DAILY_STREAK_BONUS: 10,
    DAILY_STREAK_MAX: 6
};

function getStartOfDay() {
    const now = new Date();

    now.setHours(0, 0, 0, 0);

    return now.getTime();
}

async function handleMessageReward(message) {
    if (!message.guild) return;

    const userId = message.author.id;
    const guildId = message.guild.id;

    const lastReward = await getLastMessageReward(
        userId,
        guildId
    );

    const now = Date.now();

    if (
        lastReward &&
        now - Number(lastReward.created_at) < ECONOMY.MESSAGE_COOLDOWN
    ) {
        return;
    }

    const hourlyRewards = await getRecentMessageRewards(
        userId,
        guildId,
        now - 60 * 60 * 1000
    );

    if (hourlyRewards >= ECONOMY.MESSAGE_HOURLY_LIMIT) {
        return;
    }

    const todayRewards = await getTodayMessageRewards(
        userId,
        guildId,
        getStartOfDay()
    );

    if (todayRewards >= ECONOMY.MESSAGE_DAILY_LIMIT) {
        return;
    }

    await addBalance(
        userId,
        guildId,
        ECONOMY.MESSAGE_REWARD,
        "message",
        "Message"
    );
}

async function handleBalance(message) {
    if (!message.guild) return;

    const balance = await getBalance(
        message.author.id,
        message.guild.id
    );

    return message.reply(
        `💰 Tu possèdes **${balance} pièces**.`
    );
}

async function handleDaily(message) {
    if (!message.guild) return;

    const userId = message.author.id;
    const guildId = message.guild.id;

    const user = await getUser(
        userId,
        guildId
    );

    const now = new Date();
    const today = new Date();

    today.setHours(0, 0, 0, 0);

    const todayTimestamp = today.getTime();

    if (Number(user.daily_claim_at) >= todayTimestamp) {
        return message.reply(
            "❌ Tu as déjà récupéré ton bonus quotidien aujourd'hui."
        );
    }

    let streak = Number(user.streak) || 0;

    if (Number(user.daily_claim_at) > 0) {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (
            Number(user.daily_claim_at) === yesterday.getTime()
        ) {
            streak++;
        } else {
            streak = 0;
        }
    }

    streak = Math.min(
        streak,
        ECONOMY.DAILY_STREAK_MAX
    );

    const reward =
        ECONOMY.DAILY_REWARD +
        streak * ECONOMY.DAILY_STREAK_BONUS;

    await addBalance(
        userId,
        guildId,
        reward,
        "daily",
        `Bonus quotidien, streak ${streak + 1}`
    );

    await updateDaily(
        userId,
        guildId,
        todayTimestamp,
        streak + 1
    );

    return message.reply(
        `🎁 Bonus quotidien récupéré !\n` +
        `💰 **+${reward} pièces**\n` +
        `🔥 Streak : **${streak + 1} jour(s)**`
    );
}

module.exports = {
    ECONOMY,
    handleMessageReward,
    handleBalance,
    handleDaily
};