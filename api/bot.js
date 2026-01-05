const { Telegraf, Markup } = require('telegraf');
require('dotenv').config();

// Инициализация бота
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Подключаем MongoDB (только если URI есть)
let User, Character;
if (process.env.MONGODB_URI) {
  const mongoose = require('mongoose');
  mongoose.connect(process.env.MONGODB_URI).catch(() => {});
  User = require('../src/models/User');
  Character = require('../src/models/Character');
}

// Команда /start
bot.start(async (ctx) => {
  console.log(`🚀 /start от ${ctx.from.id} (${ctx.from.first_name})`);
  
  // Сохраняем пользователя в БД если подключена
  if (User) {
    try {
      let user = await User.findOne({ telegramId: ctx.from.id });
      if (!user) {
        user = new User({
          telegramId: ctx.from.id,
          username: ctx.from.username,
          firstName: ctx.from.first_name,
          lastName: ctx.from.last_name
        });
        await user.save();
      }
    } catch (error) {
      console.error('Ошибка сохранения пользователя:', error);
    }
  }
  
  // URL для Web App
  const webAppUrl = process.env.WEBAPP_URL || 
                   process.env.VERCEL_URL ? 
                   `https://${process.env.VERCEL_URL}` : 
                   'https://ваш-проект.vercel.app';
  
  // Создаём клавиатуру
  const keyboard = Markup.keyboard([
    ['👥 Персонажи', '👤 Профиль'],
    ['💬 Начать чат', '❓ Помощь'],
    [Markup.button.webApp('🌐 Открыть Web App', webAppUrl)]
  ]).resize();
  
  ctx.reply(
    `Привет, ${ctx.from.first_name}! 👋\n` +
    'Я - AI Dating Bot с виртуальными персонажами!\n\n' +
    '📋 Используй меню ниже или команды:\n' +
    '/girls - Посмотреть персонажей\n' +
    '/profile - Мой профиль\n' +
    '/help - Помощь\n\n' +
    '🌐 Нажми "Открыть Web App" для расширенного интерфейса!',
    keyboard
  );
});

// Команда /girls
bot.command('girls', async (ctx) => {
  let message = '👥 **Доступные персонажи:**\n\n';
  
  if (Character) {
    try {
      const characters = await Character.find({ isActive: true }).limit(5);
      
      if (characters.length === 0) {
        message = 'Пока нет доступных персонажей. Администратор скоро их добавит!';
      } else {
        characters.forEach((char, i) => {
          message += `${i + 1}. **${char.name}**, ${char.age}\n`;
          message += `   ${char.description}\n\n`;
        });
        
        message += '💡 Напишите "Выбрать [имя]" чтобы начать общение\n';
        message += 'Пример: "Выбрать Анна"';
      }
    } catch (error) {
      message = 'Произошла ошибка при загрузке персонажей';
    }
  } else {
    message = '1. **Анна**, 25 лет - Романтичная дизайнер\n';
    message += '2. **Мария**, 27 лет - Бизнес-леди\n';
    message += '3. **София**, 23 лет - Энергичная студентка\n\n';
    message += '💡 Напишите "Выбрать [имя]" чтобы начать общение';
  }
  
  ctx.reply(message, { parse_mode: 'Markdown' });
});

// Команда /profile
bot.command('profile', async (ctx) => {
  let message = '';
  
  if (User) {
    try {
      const user = await User.findOne({ telegramId: ctx.from.id });
      
      if (user) {
        let characterName = 'Не выбран';
        if (user.characterId && Character) {
          const character = await Character.findById(user.characterId);
          if (character) characterName = character.name;
        }
        
        message = `👤 **Ваш профиль:**\n\n` +
                 `**Имя:** ${user.firstName}\n` +
                 `**Уровень доверия:** ${user.trustLevel}/100\n` +
                 `**Сообщений:** ${user.totalMessages || 0}\n` +
                 `**Персонаж:** ${characterName}\n` +
                 `**В системе с:** ${user.createdAt.toLocaleDateString('ru-RU')}`;
      } else {
        message = 'Сначала нажмите /start';
      }
    } catch (error) {
      message = 'Произошла ошибка при загрузке профиля';
    }
  } else {
    message = `👤 **Ваш профиль:**\n\n` +
             `**Имя:** ${ctx.from.first_name}\n` +
             `**Уровень доверия:** 25/100\n` +
             `**Сообщений:** 15\n` +
             `**Персонаж:** Анна\n` +
             `**В системе с:** ${new Date().toLocaleDateString('ru-RU')}`;
  }
  
  ctx.reply(message, { parse_mode: 'Markdown' });
});

// Команда /help
bot.command('help', (ctx) => {
  const message = 
    '📚 **Доступные команды:**\n\n' +
    '`/start` - Начать работу с ботом\n' +
    '`/girls` - Посмотреть доступных персонажей\n' +
    '`/profile` - Посмотреть свой профиль\n' +
    '`/help` - Получить справку\n\n' +
    '💡 **Как выбрать персонажа:**\n' +
    '1. Нажмите `/girls` чтобы увидеть список\n' +
    '2. Напишите "Выбрать [имя персонажа]"\n' +
    '3. Начните общение!\n\n' +
    '🌐 Или откройте Web App для удобного выбора!';
  
  ctx.reply(message, { parse_mode: 'Markdown' });
});

// Обработка текстовых сообщений
bot.on('text', async (ctx) => {
  const message = ctx.message.text;
  console.log(`📨 Сообщение от ${ctx.from.id}: ${message}`);
  
  // Обработка команды "Выбрать"
  if (message.toLowerCase().startsWith('выбрать')) {
    const characterName = message.split(' ')[1];
    
    if (!characterName) {
      return ctx.reply('Пожалуйста, укажите имя персонажа. Например: "Выбрать Анна"');
    }
    
    // Обновляем пользователя в БД
    if (User && Character) {
      try {
        const character = await Character.findOne({ 
          name: new RegExp(`^${characterName}$`, 'i') 
        });
        
        if (!character) {
          return ctx.reply(`Персонаж "${characterName}" не найден. Используйте /girls чтобы увидеть список.`);
        }
        
        await User.findOneAndUpdate(
          { telegramId: ctx.from.id },
          { characterId: character._id },
          { upsert: true }
        );
        
        ctx.reply(
          `✅ Вы выбрали персонажа: **${character.name}**!\n\n` +
          `Теперь вы можете общаться с ${character.name}. ${character.welcomeMessage}\n\n` +
          `Просто напишите сообщение, и ${character.name} ответит вам!`,
          { parse_mode: 'Markdown' }
        );
        
      } catch (error) {
        ctx.reply('Произошла ошибка при выборе персонажа');
      }
    } else {
      ctx.reply(`✅ Вы выбрали персонажа: **${characterName}**!\n\nТеперь можете начать общение!`, 
                { parse_mode: 'Markdown' });
    }
    
    return;
  }
  
  // Обычное сообщение
  if (User) {
    try {
      const user = await User.findOne({ telegramId: ctx.from.id });
      if (user) {
        await User.updateOne(
          { telegramId: ctx.from.id },
          { 
            $inc: { totalMessages: 1, trustLevel: 1 },
            lastActive: new Date()
          }
        );
      }
    } catch (error) {
      console.error('Ошибка обновления пользователя:', error);
    }
  }
  
  // Простой ответ
  const responses = [
    "Очень интересно! Расскажи подробнее? 🤔",
    "Я понял тебя! Давай поговорим об этом. 💬",
    "Спасибо за сообщение! Мне нравится с тобой общаться. 😊",
    "Хм, это заставляет задуматься... Что ты об этом думаешь? 💭",
    "Я рад, что ты поделился этим со мной! 👍"
  ];
  
  const randomResponse = responses[Math.floor(Math.random() * responses.length)];
  ctx.reply(randomResponse);
});

// Обработчик для Vercel
module.exports = async (req, res) => {
  try {
    // Только POST запросы для Telegram
    if (req.method !== 'POST') {
      return res.status(200).json({ ok: true });
    }
    
    console.log('📨 Telegram webhook received:', req.body?.update_id);
    
    // Обрабатываем через бота
    await bot.handleUpdate(req.body, res);
    
  } catch (error) {
    console.error('❌ Error in bot webhook:', error);
    
    // Всегда возвращаем 200 для Telegram
    if (!res.headersSent) {
      res.status(200).json({ ok: false, error: error.message });
    }
  }
};