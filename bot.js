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
        currentChannel: user.currentChannel || null, // <-- запятая тут
        banned: user.banned || false
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

// Проверка, забанен ли пользователь
function checkBanned(ctx, userId) {
    const user = users.get(userId);
    if (user && user.banned) {
        ctx.answerCbQuery('🚫 Вы забанены и не можете пользоваться ботом.', { show_alert: true });
        return true; // пользователь забанен
    }
    return false; // пользователь не забанен
}

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
        if (!url.startsWith('http')) {
            url = 'https://' + url; // добавляем https если юзер забыл
        }
        const parsed = new URL(url.trim());
        const hostnameValid =
            parsed.hostname === 'www.twitch.tv' ||
            parsed.hostname === 'twitch.tv' ||
            parsed.hostname === 'm.twitch.tv';
        const pathSegments = parsed.pathname.split('/').filter(Boolean); // убираем пустые сегменты
        const pathValid = pathSegments.length === 1; // только один сегмент — ник
        return hostnameValid && pathValid;
    } catch {
        return false;
    }
}

// Обработчик текста
    bot.on('text', async (ctx) => {
    const userId = ctx.from.id;
    const message = ctx.message.text.trim();

        // --- Команды админа ---
    if (message.startsWith('/broadcast')) {
        if (ctx.from.id !== OWNER_ID) return ctx.reply('❌ У вас нет прав для этой команды.');

        const text = message.replace('/broadcast', '').trim();
        if (!text) return ctx.reply('⚠️ Используйте: /broadcast <текст>');

        const allUsers = [...users.keys()];
        let success = 0, failed = 0;
        await ctx.reply(`📢 Рассылка началась, получателей: ${allUsers.length}`);

        for (const uid of allUsers) {
            try {
                await ctx.telegram.sendMessage(uid, text);
                success++;
            } catch {
                failed++;
            }
        }

        return ctx.reply(`✅ Рассылка завершена.\nУспешно: ${success}\nОшибок: ${failed}`);
    }

    if (message.startsWith('/reset_user')) {
    if (ctx.from.id !== OWNER_ID) return ctx.reply('❌ У вас нет прав для этой команды.');

    const parts = message.split(' ');
    const targetId = Number(parts[1]);
    if (!targetId) return ctx.reply('⚠️ Используйте: /reset_user <user_id>');

    const user = users.get(targetId);
    if (!user) return ctx.reply(`⚠️ Пользователь с ID ${targetId} не найден.`);

    // Удаляем канал пользователя из списка
    const channelIndex = channels.findIndex(ch => ch.ownerId === targetId);
    if (channelIndex !== -1) channels.splice(channelIndex, 1);

    // Удаляем самого пользователя
    users.delete(targetId);
    saveData();

    try {
        await ctx.telegram.sendMessage(
            targetId,
            '♻️ Ваш профиль был сброшен администратором. Отправьте ссылку на ваш Twitch канал 📺'
        );
    } catch {}

    return ctx.reply(`✅ Профиль пользователя ${targetId} полностью сброшен.`);
}

// --- Команды /ban и /unban ---
if (message.startsWith('/ban')) {
    if (ctx.from.id !== OWNER_ID) return ctx.reply('❌ У вас нет прав для этой команды.');

    const parts = message.split(' ').filter(Boolean);
    if (parts.length < 2) return ctx.reply('⚠️ Используйте: /ban <user_id>');

    const targetId = Number(parts[1]);
    if (!targetId) return ctx.reply('⚠️ Неверный ID. Используйте: /ban <user_id>');

    let targetUser = users.get(targetId);
    if (!targetUser) {
        targetUser = {
            twitch: null,
            subscribed: [],
            step: 0,
            subscribersCount: 0,
            viewsCount: 0,
            currentChannel: null,
            banned: true
        };
        users.set(targetId, targetUser);
    } else {
        targetUser.banned = true;
        targetUser.step = 0;
    }

    saveData();

    try {
        await ctx.telegram.sendMessage(targetId, '🚫 Вы забанены администратором и не можете пользоваться ботом.');
    } catch {}

    return ctx.reply(`✅ Пользователь ${targetId} забанен.`);
}

if (message.startsWith('/unban')) {
    if (ctx.from.id !== OWNER_ID) return ctx.reply('❌ У вас нет прав для этой команды.');

    const parts = message.split(' ').filter(Boolean);
    if (parts.length < 2) return ctx.reply('⚠️ Используйте: /unban <user_id>');

    const targetId = Number(parts[1]);
    if (!targetId) return ctx.reply('⚠️ Неверный ID. Используйте: /unban <user_id>');

    const targetUser = users.get(targetId);
    if (!targetUser) return ctx.reply(`⚠️ Пользователь с ID ${targetId} не найден.`);

    targetUser.banned = false;
    saveData();

    try {
        await ctx.telegram.sendMessage(targetId, '✅ Вас разбанил администратор. Можете продолжать пользоваться ботом.');
    } catch {}

    return ctx.reply(`✅ Пользователь ${targetId} разбанен.`);
}
        
    const user = users.get(userId);
    if (user && user.banned) {
        return ctx.reply('🚫 Вы забанены и не можете пользоваться ботом.');
    }

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
                Markup.button.url('Подписаться 💜', 'https://www.twitch.tv/k1miwo'), 
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
                Markup.button.url('Подписаться 💜', 'https://www.twitch.tv/k1miwo'),
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

    if (!user) return ctx.reply('⚠️ Ваши данные не найдены. Отправьте /start чтобы начать заново.');
    if (checkBanned(ctx, userId)) return; // проверяем бан


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
        if (!user) return;

        // 🚫 Проверяем бан
        if (checkBanned(ctx, userId)) return;

        if (user.step !== 1) return;

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

        // Убираем кнопки в админском сообщении
    try {
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
} catch (err) {
    if (err.description && err.description.includes('message is not modified')) {
        // кнопки уже были убраны — не критично
    } else {
        console.error('Ошибка при удалении кнопок:', err);
    }
}

// ✅ Если это первая подписка — на канал админа
if (!user.currentChannel) {
    await ctx.telegram.sendMessage(
        userId,
        `✅ Подписка подтверждена! Теперь вы можете подписываться на других пользователей.`,
        Markup.inlineKeyboard([
            Markup.button.callback('Начать подписываться 🚀', 'subscribe_more')
        ])
    );

    await ctx.telegram.sendMessage(
        ADMIN_CHAT_ID,
        `✅ Пользователь @${ctx.from.username || 'без ника'} (ID: ${userId}) подтвердил подписку на канал администратора.`
    );
    try {
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
} catch (err) {
    if (err.description && err.description.includes('message is not modified')) {
        // кнопки уже были убраны — не критично
    } else {
        console.error('Ошибка при удалении кнопок:', err);
    }
}

    user.step = 0;
    saveData();
    return; // выходим, чтобы дальше код не выполнялся
}

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

bot.action(/reject_(\d+)/, async (ctx) => {
    const userId = Number(ctx.match[1]);
    const user = users.get(userId);

    // Убираем кнопки сразу
    try {
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
} catch (err) {
    if (err.description && err.description.includes('message is not modified')) {
        // кнопки уже были убраны — не критично
    } else {
        console.error('Ошибка при удалении кнопок:', err);
    }
}

    if (user) {
        await ctx.telegram.sendMessage(userId, '❌ Подписка не подтверждена, пожалуйста, отправьте скриншот снова 📸');
        user.step = 1; // Возврат к ожиданию скриншота
        await ctx.reply('Подписка отклонена.');
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
    
    if (checkBanned(ctx, userId)) return;

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
    if (checkBanned(ctx, userId)) return; // проверка бана

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

// Команда /reset_user — сбрасывает данные конкретного пользователя
bot.command('reset_user', async (ctx) => {
    console.log('COMMAND /reset_user от ID:', ctx.from.id);
    await ctx.reply(`Ваш ID: ${ctx.from.id}`); // Временно выводим ID
    // Проверяем, что команду вызвал владелец бота (админ)
    if (ctx.from.id !== OWNER_ID) {
        return ctx.reply('❌ У вас нет прав для этой команды.');
    }

    const args = ctx.message.text.split(' ');
    if (args.length < 2) {
        return ctx.reply('⚠️ Используйте команду так:\n/reset_user <user_id>');
    }

    const userId = Number(args[1]);
    const user = users.get(userId);

    if (!user) {
        return ctx.reply(`⚠️ Пользователь с ID ${userId} не найден.`);
    }

    // Удаляем его канал из списка каналов
    const channelIndex = channels.findIndex(ch => ch.ownerId === userId);
    if (channelIndex !== -1) {
        channels.splice(channelIndex, 1);
    }

   // Полностью удаляем пользователя
users.delete(userId);

    // Сохраняем изменения
    saveData();

    // Уведомляем пользователя
    try {
        await ctx.telegram.sendMessage(
            userId,
            '♻️ Ваш профиль был сброшен администратором. Начните заново, отправив ссылку на ваш Twitch канал 📺'
        );
    } catch (err) {
        console.error(`Ошибка при уведомлении пользователя ${userId}:`, err.message);
    }

    ctx.reply(`✅ Профиль пользователя ${userId} успешно сброшен.`);
});

// --- НАЧАЛО: команды /ban и /unban (только для администратора) ---
/*
  /ban <user_id>   — поставить бан пользователю (сохраняется в users и на диск)
  /unban <user_id> — снять бан у пользователя
  Если пользователь не зарегистрирован — создаётся заглушка в users с banned: true/false
*/
bot.command('ban', async (ctx) => {
    if (ctx.from.id !== OWNER_ID) return ctx.reply('❌ У вас нет прав для этой команды.');

    const parts = ctx.message.text.split(' ').filter(Boolean);
    if (parts.length < 2) return ctx.reply('⚠️ Используйте: /ban <user_id>');

    const targetId = Number(parts[1]);
    if (!targetId) return ctx.reply('⚠️ Неверный ID. Используйте: /ban <user_id>');

    // Если у пользователя ещё нет записи — создаём базовую
    let targetUser = users.get(targetId);
    if (!targetUser) {
        targetUser = {
            twitch: null,
            subscribed: [],
            step: 0,
            subscribersCount: 0,
            viewsCount: 0,
            currentChannel: null,
            banned: true
        };
        users.set(targetId, targetUser);
    } else {
        targetUser.banned = true;
        targetUser.step = 0;
    }

    saveData();

    try {
        await ctx.telegram.sendMessage(targetId, '🚫 Вы забанены администратором и не можете пользоваться ботом.');
    } catch (err) {
        // пользователь мог заблокировать бота — игнорируем ошибку
    }

    return ctx.reply(`✅ Пользователь ${targetId} забанен.`);
});

bot.command('unban', async (ctx) => {
    if (ctx.from.id !== OWNER_ID) return ctx.reply('❌ У вас нет прав для этой команды.');

    const parts = ctx.message.text.split(' ').filter(Boolean);
    if (parts.length < 2) return ctx.reply('⚠️ Используйте: /unban <user_id>');

    const targetId = Number(parts[1]);
    if (!targetId) return ctx.reply('⚠️ Неверный ID. Используйте: /unban <user_id>');

    const targetUser = users.get(targetId);
    if (!targetUser) {
        return ctx.reply(`⚠️ Пользователь с ID ${targetId} не найден.`);
    }

    targetUser.banned = false;
    saveData();

    try {
        await ctx.telegram.sendMessage(targetId, '✅ Вас разбанил администратор. Можете продолжать пользоваться ботом.');
    } catch (err) {
        // игнорируем ошибки отправки
    }

    return ctx.reply(`✅ Пользователь ${targetId} разбанен.`);
});
// --- КОНЕЦ: команды /ban и /unban ---


// Команда /broadcast — рассылка всем пользователям (только админ)
bot.command('broadcast', async (ctx) => {
    console.log('COMMAND /broadcast от ID:', ctx.from.id);
    await ctx.reply(`Ваш ID: ${ctx.from.id}`); // Временно выводим ID
    if (ctx.from.id !== OWNER_ID) {
        return ctx.reply('❌ У вас нет прав для этой команды.');
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
    // Убираем кнопки в админском сообщении
    try {
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
} catch (err) {
    if (err.description && err.description.includes('message is not modified')) {
        // кнопки уже были убраны — не критично
    } else {
        console.error('Ошибка при удалении кнопок:', err);
    }
}

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

    // Безопасное удаление кнопок из админского сообщения
    try {
        await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
    } catch (err) {
        if (err.description && err.description.includes('message is not modified')) {
            // кнопки уже были убраны — не критично
        } else {
            console.error('Ошибка при удалении кнопок:', err);
        }
    }
});

// Автосохранение данных каждые 5 минут
setInterval(saveData, 5 * 60 * 1000);

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
