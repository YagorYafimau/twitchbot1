const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');  // Для работы с файловой системой

// Файл, куда бот будет сохранять данные
const DATA_FILE = 'data.json';

// Сохраняем данные пользователей и каналов в файл
function saveData() {
    const data = {
        users: Array.from(users.entries()).map(([id, user]) => [id, {
            twitch: user.twitch,
            subscribed: user.subscribed,
            step: user.step,
            subscribersCount: user.subscribersCount,
            viewsCount: user.viewsCount,
            currentChannel: user.currentChannel || null
        }]),
        channels: channels
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Загружаем данные при запуске
function saveData() {
    const data = {
        users: Array.from(users.entries()).map(([id, user]) => [id, {
            twitch: user.twitch,
            subscribed: user.subscribed,
            step: user.step,
            subscribersCount: user.subscribersCount,
            viewsCount: user.viewsCount,
            currentChannel: user.currentChannel || null
        }]),
        channels: channels
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = JSON.parse(fs.readFileSync(DATA_FILE));

            data.users.forEach(([id, user]) => {
                users.set(Number(id), {
                    twitch: user.twitch || null,
                    subscribed: user.subscribed || [],
                    step: user.step || 0,
                    subscribersCount: user.subscribersCount || 0,
                    viewsCount: user.viewsCount || 0,
                    currentChannel: user.currentChannel || null
                });
            });

            channels.push(...(data.channels || []).map(ch => ({
    link: ch.link,
    ownerId: ch.ownerId,
    subscribersCount: ch.subscribersCount || 0,
    shownTo: ch.shownTo || []
})));
            console.log('✅ Данные успешно загружены');
        } else {
            console.log('ℹ️ Файл с данными не найден, создается новый');
        }
    } catch (err) {
        console.error('Ошибка при загрузке данных:', err);
    }
}

const bot = new Telegraf('7695014969:AAGql5j-NLxvRU_G50idM6Fm92GCTn-oB8s'); // Замените на ваш токен
const ADMIN_CHAT_ID = '@twitchvzaimadmin'; // Замените на ваш chat_id
const OWNER_ID = 356847474; // <-- замените на свой Telegram ID

// Список каналов и пользователей
const users = new Map();
const channels = []; // Список каналов с ссылкой, ownerId и количеством подписчиков

// Таймер для сброса состояния пользователя (5 минут)
const USER_STATE_TIMEOUT = 300000; // 5 минут в миллисекундах

// Функция для загрузки статистики из файла
function loadStats() {
    try {
        const data = fs.readFileSync('stats.json');
        return JSON.parse(data);
    } catch (error) {
        // Если файл не существует, создаем его с начальными значениями
        return { "users": 0, "messages": 0 };
    }
}

// Функция для сохранения статистики в файл
function saveStats(stats) {
    fs.writeFileSync('stats.json', JSON.stringify(stats, null, 2));
}

// Загрузка статистики при запуске бота
let stats = loadStats();

// Функция для поиска доступных каналов (в случайном порядке)
function getAvailableChannels(userId) {
    const user = users.get(userId);
    if (!user) return [];

    const available = channels.filter(
        (channel) => channel.ownerId !== userId && !user.subscribed.includes(channel.link)
    );

    // Перемешиваем список (рандомный порядок)
    for (let i = available.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [available[i], available[j]] = [available[j], available[i]];
    }

    return available;
}

// Функция для сброса состояния пользователя
function resetUserState(userId) {
    const user = users.get(userId);
    if (user) {
        user.step = 0; // Сбрасываем состояние
        console.log(`Состояние пользователя ${userId} сброшено.`);
    }
}

// Обработчик команды /start
bot.start((ctx) => {
    const userId = ctx.from.id;

    // Увеличиваем количество пользователей
    stats.users++;
    saveStats(stats);

    // Проверка, если пользователь уже прислал ссылку на канал
    if (!users.has(userId)) {
        ctx.reply(
    'Добро пожаловать! Отправьте ссылку на ваш Twitch канал 📺\n\n' +
    '🌟 Важно: на сколько человек вы подпишетесь, столько раз ваш канал будет показан другим пользователям! 🌟',
    Markup.removeKeyboard()
);


    } else {
    ctx.reply(
        'Вы уже зарегистрированы! Нажмите "Начать подписываться" для продолжения.',
        Markup.inlineKeyboard([
            Markup.button.callback('Начать подписываться 🚀', 'subscribe_more')
        ])
    );
}
});

// Функция для проверки ссылки на Twitch
function isTwitchLink(url) {
    try {
        const parsed = new URL(url.trim());
        const hostnameValid =
            parsed.hostname === 'www.twitch.tv' ||
            parsed.hostname === 'twitch.tv' ||
            parsed.hostname === 'm.twitch.tv'; // поддержка мобильных ссылок

        const pathValid =
            parsed.pathname.length > 1 && !parsed.pathname.includes('/', 2);

        return hostnameValid && pathValid;
    } catch {
        return false;
    }
}

// Обработчик текста
bot.on('text', (ctx) => {
    const userId = ctx.from.id;
    const message = ctx.message.text;

    // Увеличиваем количество сообщений
    stats.messages++;
    saveStats(stats);

   if (!users.has(userId)) {
    if (isTwitchLink(message)) {
        // Сохраняем ссылку на Twitch канал
        users.set(userId, { 
    twitch: message, 
    subscribed: [], 
    step: 0, 
    subscribersCount: 0, // Количество подписчиков
    viewsCount: 0, // Количество показов канала
    banned: false // Новое поле — пользователь не забанен по умолчанию
});

    // Добавляем канал в список
channels.push({ 
    link: message, 
    ownerId: userId, 
    subscribersCount: 0, // Количество подписчиков канала
    shownTo: [] // Кому уже показывали этот канал
});
        ctx.reply(
            'Ссылка сохранена! Перед тем как начать, подпишитесь на мой Twitch канал 💖',
            Markup.inlineKeyboard([ 
                Markup.button.url('Подписаться 💜', 'https://www.twitch.tv/komainn'), 
                Markup.button.callback('Проверить подписку ✅', 'check_subscription')
            ])
        );

        // Сохраняем данные на диск
        saveData();
    } else {
        ctx.reply('⚠️ Вы отправили неверную ссылку. Пожалуйста, отправьте ссылку на ваш Twitch канал, например: https://www.twitch.tv/yourchannel');
    }
} else {
    const user = users.get(userId);
    if (user.step === 0 && !isTwitchLink(message)) {
        ctx.reply('⚠️ Вы отправили неверную ссылку. Пожалуйста, отправьте ссылку на ваш Twitch канал, например: https://www.twitch.tv/yourchannel');
    } else if (user.step === 0 && isTwitchLink(message)) {
        // Обновляем ссылку на Twitch канал
        user.twitch = message;
        // Обновляем канал в списке
        const channelIndex = channels.findIndex(channel => channel.ownerId === userId);
        if (channelIndex !== -1) {
            channels[channelIndex].link = message;
        }

        ctx.reply(
            'Ссылка обновлена! Перед тем как начать, подпишитесь на мой Twitch канал 💖',
            Markup.inlineKeyboard([ 
                Markup.button.url('Подписаться 💜', 'https://www.twitch.tv/innkomaf16'),
                Markup.button.callback('Проверить подписку ✅', 'check_subscription')
            ])
        );

        // Сохраняем данные на диск после обновления ссылки
        saveData();
    } else {
        ctx.reply('Вы уже отправили свою ссылку. Нажмите "Начать подписываться"!'); 
    }
}
});

// Обработчик нажатия на кнопку "Проверить подписку" (исправленный)
bot.action('check_subscription', (ctx) => {
    const userId = ctx.from.id;
    const user = users.get(userId);

    if (!user) {
        return ctx.reply('⚠️ Ваши данные не найдены. Отправьте /start чтобы начать заново.');
    }

    if (user.step === 0) {
        ctx.reply('Пожалуйста, отправьте скриншот подтверждения подписки 📸');
        user.step = 1; // Переход к ожиданию скриншота

        // Устанавливаем таймер для сброса состояния
        setTimeout(() => resetUserState(userId), USER_STATE_TIMEOUT);
    }
});

bot.on('photo', async (ctx) => {
    try {
        const userId = ctx.from?.id;
        if (!userId) return;

        const user = users.get(userId);
        if (!user || user.step !== 1) return;

        const photo = ctx.message?.photo?.[0]?.file_id;
        if (!photo) {
            return ctx.reply('⚠️ Фото не найдено. Пожалуйста, отправьте скриншот снова.');
        }

        const targetChannelLink = user.currentChannel || 'не указано';

        // Отправляем фото в админский чат с проверкой
        try {
            await ctx.telegram.sendPhoto(ADMIN_CHAT_ID, photo, {
    caption: `Пользователь @${ctx.from.username || 'неизвестно'} (ID: ${userId}) отправил скриншот для подтверждения подписки.\n\nСсылка на Twitch канал пользователя: ${user.twitch || 'не указано'}\nСсылка на Twitch канал для подписки: ${targetChannelLink}`,
    reply_markup: {
        inline_keyboard: [
            [
                { text: 'Подтвердить ✅', callback_data: `approve_${userId}` },
                { text: 'Отклонить ❌', callback_data: `reject_${userId}` },
                { text: 'Забанить 🚫', callback_data: `ban_${userId}` } // <-- добавляем кнопку бан
            ]
        ]
    }
});

        } catch (err) {
            console.error('Ошибка при отправке фото в админский чат:', err);
            return ctx.reply('⚠️ Не удалось отправить фото администратору. Попробуйте снова.');
        }

        await ctx.reply('Мы проверим вашу подписку, пожалуйста, подождите! ⏳');
        user.step = 2; // Ожидание ответа от администратора

    } catch (err) {
        console.error('Ошибка в обработчике фото:', err);
    }
});

// Обработчик подтверждения/отклонения подписки администратором
bot.action(/approve_(\d+)/, async (ctx) => {
    const userId = Number(ctx.match[1]);
    const user = users.get(userId);

    if (!user) return;

    if (user.currentChannel) {
        // Добавляем канал, на который пользователь подписался
        user.subscribed.push(user.currentChannel);

        // Увеличиваем счетчик подписчиков у этого канала
        const targetChannel = channels.find(ch => ch.link === user.currentChannel);
        if (targetChannel) {
            targetChannel.subscribersCount++;

            // Уведомляем владельца канала, что на него кто-то подписался
            try {
                await ctx.telegram.sendMessage(targetChannel.ownerId, `🎉 На ваш канал кто-то подписался!`);
            } catch (err) {
                console.error(`Ошибка при отправке владельцу канала ${targetChannel.ownerId}:`, err);
            }
        }

        // Сбрасываем текущий канал
        user.currentChannel = null;

        // === Новый алгоритм показа канала ===
        const myChannel = channels.find(ch => ch.ownerId === userId);
        if (myChannel) {
            const alreadyShown = myChannel.shownTo.length;
            const maxShows = user.subscribed.length;

            if (alreadyShown < maxShows) {
                const allOtherUsers = [...users.entries()]
                    .filter(([id, u]) => id !== userId && u.twitch && !myChannel.shownTo.includes(id));

                // Перемешиваем случайно
                for (let i = allOtherUsers.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [allOtherUsers[i], allOtherUsers[j]] = [allOtherUsers[j], allOtherUsers[i]];
                }

                const remaining = maxShows - alreadyShown;
                const toShow = allOtherUsers.slice(0, remaining);

                for (const [id, u] of toShow) {
    // Просто отмечаем, что пользователю показали канал
    myChannel.shownTo.push(id);
}
                saveData();
            }
        }

        // Сообщение пользователю
        await ctx.telegram.sendMessage(
            userId,
            `Подписка на канал подтверждена! 🙌`,
            Markup.inlineKeyboard([
                Markup.button.callback('Подписаться еще👉', 'subscribe_more'),
                Markup.button.callback('Прекратить 🚫', 'stop')
            ])
        );

        await ctx.reply('Подписка подтверждена.');
    }
});

bot.action(/reject_(\d+)/, (ctx) => {
    const userId = ctx.match[1];
    const user = users.get(Number(userId));

    if (user) {
        ctx.telegram.sendMessage(userId, 'Подписка не подтверждена, пожалуйста, вышлите скриншот с подпиской 📸');
        user.step = 1; // Возврат к ожиданию скриншота
        ctx.reply('Подписка отклонена.');
    }
});

// Обработчик нажатия на кнопку "Подписаться еще"
bot.action('subscribe_more', (ctx) => {
    const userId = ctx.from.id;
    const user = users.get(userId);
    
    if (!user) {
        ctx.reply('Вы не зарегистрированы. Пожалуйста, отправьте ссылку на ваш Twitch канал');
        return;
    }
    // 🔒 Проверка, забанен ли пользователь
    if (user.banned) {
        return ctx.reply('🚫 Вы забанены и не можете подписываться на каналы.');
    }

    const availableChannels = getAvailableChannels(userId);

    // Функция перемешивания массива (Fisher-Yates)
    function shuffleArray(array) {
        const arr = [...array];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    if (availableChannels.length === 0) {
        ctx.reply(
            'На данный момент нет доступных каналов для подписки 😕 Попробуйте позже',
            Markup.inlineKeyboard([ 
                Markup.button.callback('Хорошо 👌', 'ready_to_subscribe')
            ])
        );
    } else {
        const shuffled = shuffleArray(availableChannels);
        const channel = shuffled[0];
        user.currentChannel = channel.link;

// Используем индекс канала как идентификатор
const channelIndex = channels.findIndex(ch => ch.link === channel.link);
if (channelIndex === -1) {
    return ctx.reply('Ошибка: канал не найден 😕 Попробуйте позже.');
}
const callbackData = `check_subscription_new_${channelIndex}`;

ctx.reply(
    `✨ Подпишитесь на канал: ${channel.link}`,
    Markup.inlineKeyboard([ 
        Markup.button.callback('Проверить подписку ✅', callbackData)
    ])
);
    }
});

// Обработчик нажатия на кнопку "Хорошо 🙂"
bot.action('ready_to_subscribe', (ctx) => {
    const userId = ctx.from.id;
    const user = users.get(userId);

    if (!user) {
        ctx.reply('Вы не зарегистрированы. Пожалуйста, отправьте ссылку на ваш Twitch канал 📺');
        return;
    }

    const availableChannels = getAvailableChannels(userId);

    if (availableChannels.length === 0) {
        ctx.reply(
            'На данный момент нет доступных каналов для подписки. Попробуйте позже ⏳',
            Markup.inlineKeyboard([ 
                Markup.button.callback('Хорошо 🙂', 'ready_to_subscribe')
            ])
        );
    } else {
        ctx.reply(
            'Готовы подписываться? Let\'s go! 🚀',
            Markup.inlineKeyboard([
                Markup.button.callback('Начать подписываться', 'subscribe_more')
            ])
        );
    }
});

// Обработчик нажатия на кнопку "Проверить подписку" для нового канала
bot.action(/check_subscription_new_(\d+)/, (ctx) => {
    const userId = ctx.from.id;
    const user = users.get(userId);
    const channelIndex = Number(ctx.match[1]);

    if (!user) return ctx.reply('Ваши данные не найдены. Отправьте /start, чтобы начать заново.');
    if (channelIndex < 0 || channelIndex >= channels.length) {
        return ctx.reply('Ошибка: канал не найден 😕 Попробуйте позже.');
    }

    const channel = channels[channelIndex];

    // Проверяем, подписан ли пользователь уже на этот канал
    if (user.subscribed.includes(channel.link)) {
        return ctx.reply('⚠️ Вы уже подписаны на этот канал, попробуйте другой!');
    }

    user.currentChannel = channel.link; // сохраняем ссылку на текущий канал
    ctx.reply('Пожалуйста, отправьте скриншот подтверждения подписки 📸');
    user.step = 1;

    // Таймер для сброса состояния
    setTimeout(() => resetUserState(userId), USER_STATE_TIMEOUT);
});

// Обработчик нажатия на кнопку "Прекратить"
bot.action('stop', (ctx) => {
    ctx.reply('Спасибо за использование бота! Нажмите /start, чтобы начать заново. 🚀');
});

// Загружаем данные пользователей и каналов при запуске
loadData();

// Команда /broadcast для рассылки всем пользователям через админский чат
bot.command('broadcast', async (ctx) => {
    // Проверяем, что команда пришла из админского чата
    if (ctx.chat.id.toString() !== ADMIN_CHAT_ID.replace('@', '')) {
        return ctx.reply('❌ Команда /broadcast доступна только в админском чате.');
    }

    const text = ctx.message.text.replace('/broadcast', '').trim();
    if (!text) {
        return ctx.reply('⚠️ Введите текст рассылки, например:\n/broadcast Привет всем!');
    }

    const allUsers = [...users.keys()];
    let success = 0;
    let failed = 0;

    ctx.reply(`📢 Рассылка началась, получателей: ${allUsers.length}`);

    for (const userId of allUsers) {
        try {
            await ctx.telegram.sendMessage(userId, text);
            success++;
        } catch (err) {
            failed++;
            console.error(`Ошибка отправки пользователю ${userId}:`, err.message);
        }
    }

    ctx.reply(`✅ Рассылка завершена.\nУспешно: ${success}\nОшибок: ${failed}`);
});

// Запуск бота
bot.launch().then(() => {
    console.log('Бот запущен!');
});

// Забанить пользователя
bot.action(/ban_(\d+)/, async (ctx) => {
    const userId = Number(ctx.match[1]);
    const user = users.get(userId);
    if (!user) return;

    user.banned = true;
    user.step = 0; 
    saveData();

    try {
        await ctx.telegram.sendMessage(userId, '🚫 Вы забанены по причине недобросовестного поведения.');
    } catch (err) {
        console.error(`Ошибка отправки бан-уведомления пользователю ${userId}:`, err);
    }

    ctx.editMessageReplyMarkup({
        inline_keyboard: [
            [{ text: 'Разбанить ✅', callback_data: `unban_${userId}` }]
        ]
    });
});

// Разбанить пользователя
bot.action(/unban_(\d+)/, async (ctx) => {
    const userId = Number(ctx.match[1]);
    const user = users.get(userId);
    if (!user) return;

    user.banned = false;
    saveData();

    try {
        await ctx.telegram.sendMessage(userId, '✅ Вы разбанены и снова можете пользоваться ботом.');
    } catch (err) {
        console.error(`Ошибка отправки разбан-уведомления пользователю ${userId}:`, err);
    }

    ctx.editMessageReplyMarkup({
        inline_keyboard: [
            [{ text: 'Забанить 🚫', callback_data: `ban_${userId}` }]
        ]
    });
});

// Автосохранение данных каждые 5 минут
setInterval(saveData, 5 * 60 * 1000);

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
