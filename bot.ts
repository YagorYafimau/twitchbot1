import { Telegraf, Markup } from 'telegraf';

const bot = new Telegraf('7695014969:AAGql5j-NLxvRU_G50idM6Fm92GCTn-oB8s');

// Список каналов и пользователей
const users = new Map();
const channels: { link: string, ownerId: number }[] = []; // Список каналов с ссылкой и ownerId

// Обработчик команды /start
bot.start((ctx) => {
    const userId = ctx.from.id;

    // Проверка, если пользователь уже прислал ссылку на канал
    if (!users.has(userId)) {
        ctx.reply(
            'Добро пожаловать! Отправьте ссылку на ваш Twitch канал 📺',
            Markup.removeKeyboard()
        );
    } else {
        ctx.reply('Вы уже зарегистрированы! Нажмите "Начать подписываться" для продолжения.');
    }
});

// Обработчик текста
bot.on('text', (ctx) => {
    const userId = ctx.from.id;
    const message = ctx.message.text;

    if (!users.has(userId)) {
        // Сохраняем ссылку на Twitch канал
        users.set(userId, { twitch: message, subscribed: [], step: 0 });
        // Добавляем канал в список
        channels.push({ link: message, ownerId: userId });

        ctx.reply(
            'Ссылка сохранена! Перед тем как начать, подпишитесь на мой Twitch канал 💖',
            Markup.inlineKeyboard([ 
                Markup.button.url('Подписаться 💜', 'https://www.twitch.tv/innkomaf16'),
                Markup.button.callback('Проверить подписку ✅', 'check_subscription')
            ])
        );
    } else {
        ctx.reply('Вы уже отправили свою ссылку. Нажмите "Начать подписываться"!'); 
    }
});

// Обработчик нажатия на кнопку "Проверить подписку"
bot.action('check_subscription', (ctx) => {
    const userId = ctx.from.id;
    const user = users.get(userId);

    if (user.step === 0) {
        // Вероятность 80% для неудачной подписки (первоначальная проверка)
        const isFailure = Math.random() < 0.8;
        
        if (isFailure) {
            user.step = 1;  // Переходим к следующему шагу
            ctx.reply(
                'Не удалось подтвердить подписку, убедись что ты подписался и проверь еще раз! 💖',
                Markup.inlineKeyboard([ 
                    Markup.button.callback('Проверить еще раз ✅', 'check_subscription_retry')
                ])
            );
        } else {
            user.step = 2;  // Подписка подтверждена сразу
            ctx.reply(
                'Подписка подтверждена! 🙌',
                Markup.inlineKeyboard([ 
                    Markup.button.callback('Подписаться еще 👉', 'start_subscribing'),
                    Markup.button.callback('Прекратить 🚫', 'stop')
                ])
            );
        }
    }
});

// Обработчик нажатия на кнопку "Проверить еще раз"
bot.action('check_subscription_retry', (ctx) => {
    const userId = ctx.from.id;
    const user = users.get(userId);

    if (user.step === 1) {
        user.step = 2;  // На втором шаге подписка всегда подтверждается
        ctx.reply(
            'Подписка подтверждена! 🙌',
            Markup.inlineKeyboard([ 
                Markup.button.callback('Подписаться еще 👉', 'start_subscribing'),
                Markup.button.callback('Прекратить 🚫', 'stop')
            ])
        );
    }
});

// Обработчик нажатия на кнопку "Начать подписываться"
bot.action('start_subscribing', (ctx) => {
    const userId = ctx.from.id;
    const user = users.get(userId);

    if (!user) {
        ctx.reply('Пожалуйста, отправьте ссылку на ваш Twitch канал сначала!');
        return;
    }

    // Находим доступные каналы для подписки
    const availableChannels = channels.filter(
        (channel) => channel.ownerId !== userId && !user.subscribed.includes(channel.link)
    );

    if (availableChannels.length === 0) {
        ctx.reply(
            'На данный момент нет доступных каналов для подписки. 😕',
            Markup.inlineKeyboard([ 
                Markup.button.callback('Хорошо 🙂', 'ready_to_subscribe')
            ])
        );
    } else {
        const channel = availableChannels[0];
        ctx.reply(
            `Подпишитесь на канал: ${channel.link} 👉`,
            Markup.inlineKeyboard([ 
                Markup.button.callback('Проверить подписку ✅', `confirm_${channel.link}`)
            ])
        );
    }
});

// Обработчик нажатия на кнопку "Готовы подписываться?"
bot.action('ready_to_subscribe', (ctx) => {
    ctx.reply(
        'Готовы подписываться? Let’s go! 🏃‍♂️',
        Markup.inlineKeyboard([ 
            Markup.button.callback('Начать подписываться 📺', 'start_subscribing')
        ])
    );
});

// Обработчик на подтверждение подписки
bot.action(/confirm_.+/, (ctx) => {
    const userId = ctx.from.id;
    const channelLink = ctx.match[0].replace('confirm_', '');

    const user = users.get(userId);
    if (!user) {
        ctx.reply('Пожалуйста, отправьте ссылку на ваш Twitch канал сначала!');
        return;
    }

    // Вероятность 15% для неудачной подписки
    const isFailure = Math.random() < 0.15;
    if (isFailure) {
        ctx.reply(
            'Не удалось подтвердить подписку. Пожалуйста, попробуйте снова! 💖',
            Markup.inlineKeyboard([ 
                Markup.button.callback('Проверить еще раз ✅', `confirm_retry_${channelLink}`)
            ])
        );
    } else {
        user.subscribed.push(channelLink);
        ctx.reply(
            'Подписка подтверждена! 🙌',
            Markup.inlineKeyboard([ 
                Markup.button.callback('Подписаться еще 👉', 'start_subscribing'),
                Markup.button.callback('Прекратить 🚫', 'stop')
            ])
        );
    }
});

// Обработчик нажатия на кнопку "Проверить еще раз" для подтверждения подписки
bot.action(/confirm_retry_.+/, (ctx) => {
    const userId = ctx.from.id;
    const channelLink = ctx.match[0].replace('confirm_retry_', '');

    const user = users.get(userId);
    if (!user) {
        ctx.reply('Пожалуйста, отправьте ссылку на ваш Twitch канал сначала!');
        return;
    }

    // Подписка подтверждается на втором шаге всегда
    user.subscribed.push(channelLink);
    ctx.reply(
        'Подписка подтверждена! 🙌',
        Markup.inlineKeyboard([ 
            Markup.button.callback('Подписаться еще 👉', 'start_subscribing'),
            Markup.button.callback('Прекратить 🚫', 'stop')
        ])
    );
});

// Обработчик нажатия на кнопку "Прекратить"
bot.action('stop', (ctx) => {
    ctx.reply('Спасибо за использование бота! Нажмите /start, чтобы начать заново. 🚀');
});

// Запуск бота
bot.launch().then(() => {
    console.log('Бот запущен!');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
