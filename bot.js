const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');  // Для работы с файловой системой

// Файл, куда бот будет сохранять данные
const DATA_FILE = 'data.json';

// Сохраняем данные пользователей и каналов в файл
function saveData() {
    const data = {
        users: Array.from(users.entries()),
        channels: channels
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Загружаем данные при запуске
function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = JSON.parse(fs.readFileSync(DATA_FILE));
            data.users.forEach(([id, user]) => users.set(Number(id), user));
            channels.push(...data.channels);
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
            viewsCount: 0 // Количество показов канала
        });
        // Добавляем канал в список
        channels.push({ 
            link: message, 
            ownerId: userId, 
            subscribersCount: 0 // Количество подписчиков канала
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

bot.on('photo', (ctx) => {
    const userId = ctx.from.id;
    const user = users.get(userId);

    if (user && user.step === 1) {
        const photo = ctx.message.photo[0].file_id;

        // Получаем ссылку на канал, на который нужно подписаться
        const targetChannelLink = user.currentChannel;

        // Пересылаем скриншот в админский чат
        ctx.telegram.sendPhoto(ADMIN_CHAT_ID, photo, {
            caption: `Пользователь @${ctx.from.username} (ID: ${userId}) отправил скриншот для подтверждения подписки.\n\nСсылка на Twitch канал пользователя: ${user.twitch}\nСсылка на Twitch канал для подписки: ${targetChannelLink}`,
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: 'Подтвердить ✅', callback_data: `approve_${userId}` },
                        { text: 'Отклонить ❌', callback_data: `reject_${userId}` }
                    ]
                ]
            }
        });

        ctx.reply('Мы проверим вашу подписку, пожалуйста, подождите! ⏳');
        user.step = 2; // Ожидание ответа от администратора
    }
});

// Обработчик подтверждения/отклонения подписки администратором
bot.action(/approve_(\d+)/, async (ctx) => {
    const userId = ctx.match[1];
    const user = users.get(Number(userId));

    if (user) {
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
                    console.error(`Ошибка при отправке уведомления владельцу канала ${targetChannel.ownerId}:`, err);
                }
            }

            // Сбрасываем текущий канал
            user.currentChannel = null;


            // Теперь показываем канал пользователя другим пользователям
            const allOtherUsers = [...users.values()].filter(u => u.twitch && u !== user);
            if (allOtherUsers.length > 0) {
                // Перемешиваем список, чтобы был случайный порядок
                for (let i = allOtherUsers.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [allOtherUsers[i], allOtherUsers[j]] = [allOtherUsers[j], allOtherUsers[i]];
                }

                // Берем столько пользователей, сколько у него подписок
                const toShow = allOtherUsers.slice(0, user.subscribed.length);

                // Отправляем им ссылку на его канал
                for (const target of toShow) {
                    try {
                        await ctx.telegram.sendMessage(
                            target.ownerId || target.id,
                            `🔥 Новый канал для подписки: ${user.twitch}`
                        );
                    } catch (err) {
                        console.error(`Ошибка при отправке пользователю ${target.ownerId || target.id}:`, err);
                    }
                }
            }
        }

        // Сообщение пользователю
        ctx.telegram.sendMessage(
            userId,
            `Подписка на канал подтверждена! 🙌`,
            Markup.inlineKeyboard([
                Markup.button.callback('Подписаться еще👉', 'subscribe_more'),
                Markup.button.callback('Прекратить 🚫', 'stop')
            ])
        );

        ctx.reply('Подписка подтверждена.');
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

    if (user && channels[channelIndex]) {
        user.currentChannel = channels[channelIndex].link; // сохраняем ссылку на текущий канал
        ctx.reply('Пожалуйста, отправьте скриншот подтверждения подписки 📸');
        user.step = 1;

        setTimeout(() => resetUserState(userId), USER_STATE_TIMEOUT);
    }
});

// Обработчик нажатия на кнопку "Прекратить"
bot.action('stop', (ctx) => {
    ctx.reply('Спасибо за использование бота! Нажмите /start, чтобы начать заново. 🚀');
});

// Загружаем данные пользователей и каналов при запуске
loadData();

// Запуск бота
bot.launch().then(() => {
    console.log('Бот запущен!');
});

// Автосохранение данных каждые 5 минут
setInterval(saveData, 5 * 60 * 1000);

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
