import { Telegraf, Context } from 'telegraf';
import dotenv from 'dotenv';
import mongoose from './db';
import { User } from './models/User';
import { Character } from './models/Character';

dotenv.config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========

// Сохраняем или находим пользователя
const getOrCreateUser = async (ctx: Context) => {
  try {
    if (!ctx.from) {
      console.error('❌ ctx.from is undefined');
      return null;
    }

    const telegramId = ctx.from.id;
    const username = ctx.from.username;
    const firstName = ctx.from.first_name;
    const lastName = ctx.from.last_name || '';

    let user = await User.findOne({ telegramId });

    if (!user) {
      user = new User({
        telegramId,
        username,
        firstName,
        lastName,
        trustLevel: 10,
        photoRequests: 0
      });
      await user.save();
      console.log(`👤 Новый пользователь: ${firstName} (ID: ${telegramId})`);
    }

    return user;
  } catch (error) {
    console.error('❌ Ошибка в getOrCreateUser:', error);
    return null;
  }
};

// Формируем прогресс-бар
const createProgressBar = (level: number): string => {
  const filled = '█'.repeat(Math.floor(level / 10));
  const empty = '░'.repeat(10 - Math.floor(level / 10));
  return `[${filled}${empty}] ${level}%`;
};

// ========== КОМАНДЫ БОТА ==========

// Команда /start
bot.start(async (ctx) => {
  try {
    const user = await getOrCreateUser(ctx);
    if (!user) return;

    await ctx.reply(
      `Привет, ${user.firstName}! 👋\n\n` +
      'Добро пожаловать в мир AI Dating!\n\n' +
      '🎭 Здесь ты можешь общаться с виртуальными персонажами,\n' +
      'развивать отношения и получать эксклюзивные фото!\n\n' +
      '📋 Основные команды:\n' +
      '/girls - Посмотреть всех персонажей\n' +
      '/profile - Мой профиль и прогресс\n' +
      '/startchat - Начать общение\n' +
      '/help - Помощь и инструкции\n\n' +
      'Просто напиши сообщение, и я помогу тебе начать!'
    );
  } catch (error) {
    console.error('❌ Ошибка в команде /start:', error);
    ctx.reply('Произошла ошибка. Попробуйте позже.');
  }
});

// Команда /profile
bot.command('profile', async (ctx) => {
  try {
    const user = await getOrCreateUser(ctx);
    if (!user) return;

    const progressBar = createProgressBar(user.trustLevel);

    await ctx.reply(
      `👤 *Твой профиль*\n\n` +
      `Имя: ${user.firstName}\n` +
      `Уровень доверия: ${progressBar}\n` +
      `Получено фото: ${user.photoRequests}\n` +
      `В системе с: ${user.createdAt.toLocaleDateString('ru-RU')}\n\n` +
      `💡 *Совет*: Чем больше общаешься, тем выше уровень доверия!\n` +
      `При 50%+ можно запрашивать фото персонажей.`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    console.error('❌ Ошибка в команде /profile:', error);
    ctx.reply('Произошла ошибка при загрузке профиля.');
  }
});

// Команда /girls - показать персонажей
bot.command('girls', async (ctx) => {
  try {
    const characters = await Character.find({ isActive: true }).limit(5);

    if (characters.length === 0) {
      await ctx.reply('Пока нет доступных персонажей. Загляните позже!');
      return;
    }

    let response = '🎭 *Доступные персонажи:*\n\n';

    characters.forEach((char, index) => {
      response += `*${index + 1}. ${char.name}* (${char.age})\n`;
      response += `📝 ${char.bio.substring(0, 80)}...\n`;
      response += `🎯 Характер: ${char.personality}\n`;
      response += `💬 Начать общение: /chat_${char._id}\n\n`;
    });

    response += '👉 Чтобы начать общение, нажми на команду /chat_...';

    await ctx.reply(response, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('❌ Ошибка в команде /girls:', error);
    ctx.reply('Произошла ошибка при загрузке персонажей.');
  }
});

// Команда /startchat - выбрать персонажа
bot.command('startchat', async (ctx) => {
  try {
    const characters = await Character.find({ isActive: true }).limit(3);

    if (characters.length === 0) {
      await ctx.reply('Пока нет доступных персонажей.');
      return;
    }

    let response = '🤔 *С кем хочешь пообщаться?*\n\n';

    characters.forEach((char) => {
      response += `*${char.name}* - ${char.bio.substring(0, 60)}...\n`;
      response += `Выбрать: /chat_${char._id}\n\n`;
    });

    await ctx.reply(response, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('❌ Ошибка в команде /startchat:', error);
    ctx.reply('Произошла ошибка.');
  }
});

// Обработка выбора персонажа (например /chat_12345)
bot.hears(/^\/chat_/, async (ctx) => {
  try {
    const user = await getOrCreateUser(ctx);
    if (!user) return;

    const command = ctx.message?.text;
    if (!command) return;

    const characterId = command.split('_')[1];

    if (!characterId) {
      await ctx.reply('Не указан ID персонажа. Используйте /girls для выбора.');
      return;
    }

    const character = await Character.findById(characterId);

    if (!character) {
      await ctx.reply('❌ Персонаж не найден. Попробуй выбрать другого через /girls');
      return;
    }

    // Сохраняем выбранного персонажа
    user.currentCharacterId = characterId;
    await user.save();

    await ctx.reply(
      `🎉 *Ты выбрал ${character.name}!*\n\n` +
      `Приятно познакомиться! ${character.openingLine}\n\n` +
      `Теперь можешь просто писать сообщения, и я буду отвечать от имени ${character.name}.\n\n` +
      `💡 *Подсказка:* Будь собой, задавай вопросы, и уровень доверия будет расти!`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    console.error('❌ Ошибка при выборе персонажа:', error);
    ctx.reply('Произошла ошибка при выборе персонажа.');
  }
});

// Команда /requestphoto - запрос фото
bot.command('requestphoto', async (ctx) => {
  try {
    const user = await getOrCreateUser(ctx);
    if (!user) return;

    if (!user.currentCharacterId) {
      await ctx.reply('Сначала выбери персонажа через /girls!');
      return;
    }

    if (user.trustLevel < 50) {
      await ctx.reply(
        `❌ *Ещё рано!*\n\n` +
        `Твой уровень доверия: ${user.trustLevel}% (нужно минимум 50%)\n` +
        `Продолжай общаться, задавай вопросы, будь искренним!\n` +
        `Ещё нужно: ${50 - user.trustLevel}% до первого фото.`,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    const character = await Character.findById(user.currentCharacterId);

    if (!character) {
      await ctx.reply('Персонаж не найден. Выбери нового через /girls.');
      return;
    }

    if (character.photoUrls.length === 0) {
      await ctx.reply('У этого персонажа пока нет фото 😔');
      return;
    }

    // Выбираем случайное фото
    const randomIndex = Math.floor(Math.random() * character.photoUrls.length);
    const randomPhoto = character.photoUrls[randomIndex];

    // Обновляем статистику пользователя
    user.photoRequests += 1;
    user.trustLevel = Math.max(0, user.trustLevel - 10);
    await user.save();

    try {
      await ctx.replyWithPhoto(randomPhoto, {
        caption: `📸 *${character.name} делится с тобой фото!*\n\n` +
                 `"Это специально для тебя... 💖"\n\n` +
                 `Осталось запросов сегодня: ${Math.floor(user.trustLevel / 10)}\n` +
                 `Следующее фото доступно при: ${user.trustLevel + 10}% доверия`,
        parse_mode: 'Markdown'
      });
    } catch (photoError) {
      await ctx.reply(
        `📸 *${character.name} хотела отправить тебе фото, но...*\n\n` +
        `Вот ссылка: ${randomPhoto}\n\n` +
        `Следующий раз получится лучше! Продолжай общаться! 💬`,
        { parse_mode: 'Markdown' }
      );
    }
  } catch (error) {
    console.error('❌ Ошибка в команде /requestphoto:', error);
    ctx.reply('Произошла ошибка при запросе фото.');
  }
});

// Обработка обычных сообщений
bot.on('text', async (ctx) => {
  try {
    // Пропускаем команды
    if (ctx.message.text.startsWith('/')) {
      return;
    }

    const user = await getOrCreateUser(ctx);
    if (!user) return;

    // Если пользователь не выбрал персонажа
    if (!user.currentCharacterId) {
      await ctx.reply(
        'Сначала выбери персонажа командой /girls или /startchat 😊\n' +
        'После выбора просто пиши сообщения!'
      );
      return;
    }

    const character = await Character.findById(user.currentCharacterId);

    if (!character) {
      user.currentCharacterId = undefined;
      await user.save();
      await ctx.reply(
        'Похоже, выбранный персонаж больше не доступен 😔\n' +
        'Выбери нового через /girls'
      );
      return;
    }

    const userMessage = ctx.message.text;

    // Увеличиваем уровень доверия за активность
    user.trustLevel = Math.min(100, user.trustLevel + 1);
    await user.save();

    // Простые ответы в зависимости от уровня доверия
    const responses = {
      low: [
        `*${character.name}:* "Интересно... расскажи больше о себе! 🤔"`,
        `*${character.name}:* "Я только начинаю тебя узнавать, но уже интересно! 😊"`,
        `*${character.name}:* "${character.personality.split(',')[0]}, как ты думаешь...?"`
      ],
      medium: [
        `*${character.name}:* "Знаешь, мне нравится с тобой общаться! 💬"`,
        `*${character.name}:* "Ты действительно интересный собеседник! ✨"`,
        `*${character.name}:* "Расскажи, что тебя волнует? Я слушаю внимательно... 👂"`
      ],
      high: [
        `*${character.name}:* "Я начинаю тебе доверять всё больше... 😌"`,
        `*${character.name}:* "Могу я показать тебе что-то личное? /requestphoto"`,
        `*${character.name}:* "С тобой я чувствую себя особенным... 💕"`
      ]
    };

    // Определяем категорию ответа
    let responseCategory: 'low' | 'medium' | 'high' = 'low';
    if (user.trustLevel > 50) {
      responseCategory = 'high';
    } else if (user.trustLevel > 25) {
      responseCategory = 'medium';
    }

    const categoryResponses = responses[responseCategory];
    const randomResponse = categoryResponses[Math.floor(Math.random() * categoryResponses.length)];

    await ctx.reply(randomResponse, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('❌ Ошибка обработки сообщения:', error);
    ctx.reply('Произошла ошибка при обработке сообщения.');
  }
});

// Команда /help
bot.help((ctx) => {
  ctx.reply(
    '📚 *Помощь по боту*\n\n' +
    '*Основные команды:*\n' +
    '/start - Начало работы\n' +
    '/girls - Список персонажей\n' +
    '/profile - Мой профиль\n' +
    '/startchat - Начать общение\n' +
    '/requestphoto - Запросить фото (от 50% доверия)\n\n' +
    '*Как это работает:*\n' +
    '1. Выбери персонажа через /girls\n' +
    '2. Начни общение обычными сообщениями\n' +
    '3. Уровень доверия растёт при общении\n' +
    '4. При 50%+ можешь запрашивать фото\n\n' +
    '*Советы:*\n' +
    '• Будь собой, задавай вопросы\n' +
    '• Чем дольше общение, тем выше доверие\n' +
    '• После запроса фото доверие временно снижается\n\n' +
    'Вопросы? Напиши разработчику!',
    { parse_mode: 'Markdown' }
  );
});

// Обработка ошибок
bot.catch((error: any, ctx: Context) => {
  console.error('❌ Глобальная ошибка бота:', error);
  ctx.reply('Упс! Произошла критическая ошибка. Попробуйте позже или нажмите /start');
});

// Экспорт бота
export { bot };