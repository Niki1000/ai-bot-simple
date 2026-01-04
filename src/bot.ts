import { Telegraf, Context, Markup } from 'telegraf';
import dotenv from 'dotenv';
import { User } from './models/User';
import { Character } from './models/Character';

dotenv.config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);
const isProduction = process.env.NODE_ENV === 'production';

// Команда /start с кнопкой Web App только в production
bot.start(async (ctx: Context) => {
  console.log(`👤 Пользователь ${ctx.from?.id} запустил бота`);
  
  const userId = ctx.from!.id;
  const username = ctx.from!.username;
  const firstName = ctx.from!.first_name;
  const lastName = ctx.from!.last_name;
  
  // Сохраняем/обновляем пользователя в базе
  try {
    let user = await User.findOne({ telegramId: userId });
    
    if (!user) {
      user = new User({
        telegramId: userId,
        username: username,
        firstName: firstName,
        lastName: lastName,
        trustLevel: 0,
        photoRequests: 0,
        totalMessages: 0,
        createdAt: new Date()
      });
      await user.save();
      console.log(`👤 Новый пользователь: ${firstName} (${userId})`);
    }
  } catch (error) {
    console.error('Ошибка сохранения пользователя:', error);
  }
  
  // Создаем кнопки - только основные, без Web App локально
  const menuButtons = Markup.keyboard([
    ['👥 Персонажи', '👤 Профиль'],
    ['💬 Начать чат', '🖼️ Запросить фото']
  ]).resize();
  
  let welcomeMessage = `Привет, ${firstName}! 👋\n` +
    'Я - AI Dating Bot с виртуальными персонажами!\n\n' +
    '📋 Используй меню ниже или команды:\n' +
    '/girls - Посмотреть персонажей\n' +
    '/profile - Мой профиль\n' +
    '/help - Помощь\n';
  
  // Добавляем информацию о Web App только в production
  if (isProduction && process.env.WEBAPP_URL) {
    welcomeMessage += '\n🌐 **Новая функция:** Откройте Web App для расширенного интерфейса!';
  }
  
  ctx.reply(welcomeMessage, menuButtons);
});

// Команда для открытия Web App (только в production)
bot.command('webapp', (ctx: Context) => {
  if (isProduction && process.env.WEBAPP_URL) {
    ctx.reply(
      '🌐 Откройте Web App для расширенного интерфейса:',
      Markup.inlineKeyboard([
        Markup.button.webApp('🚀 Открыть Web App', process.env.WEBAPP_URL)
      ])
    );
  } else {
    ctx.reply(
      '🌐 Web App доступен только в production режиме.\n' +
      'Для локального тестирования откройте в браузере: http://localhost:3000'
    );
  }
});

// Команда /girls - список персонажей
bot.command('girls', async (ctx: Context) => {
  try {
    const characters = await Character.find({ isActive: true })
      .select('name age description')
      .limit(10);
    
    if (characters.length === 0) {
      return ctx.reply('Пока нет доступных персонажей. Скоро добавлю!');
    }
    
    let message = '👥 **Доступные персонажи:**\n\n';
    
    characters.forEach((character, index) => {
      message += `${index + 1}. **${character.name}**, ${character.age}\n`;
      message += `   ${character.description}\n\n`;
    });
    
    message += '💡 Напишите "Выбрать [имя]" чтобы начать общение\n';
    message += 'Например: "Выбрать Анна"';
    
    ctx.reply(message, { parse_mode: 'Markdown' });
    
  } catch (error) {
    console.error('Ошибка команды /girls:', error);
    ctx.reply('Произошла ошибка при загрузке персонажей');
  }
});

// Команда /profile
bot.command('profile', async (ctx: Context) => {
  try {
    const user = await User.findOne({ telegramId: ctx.from!.id });
    
    if (!user) {
      return ctx.reply('Сначала нажмите /start');
    }
    
    let characterName = 'Не выбран';
    if (user.characterId) {
      const character = await Character.findById(user.characterId);
      if (character) characterName = character.name;
    }
    
    const profileMessage = 
      `👤 **Ваш профиль:**\n\n` +
      `**Имя:** ${user.firstName}\n` +
      `**Уровень доверия:** ${user.trustLevel}/100\n` +
      `**Запросов фото:** ${user.photoRequests}\n` +
      `**Сообщений:** ${user.totalMessages || 0}\n` +
      `**Персонаж:** ${characterName}\n` +
      `**В системе с:** ${user.createdAt.toLocaleDateString('ru-RU')}`;
    
    ctx.reply(profileMessage, { parse_mode: 'Markdown' });
    
  } catch (error) {
    console.error('Ошибка команды /profile:', error);
    ctx.reply('Произошла ошибка при загрузке профиля');
  }
});

// Команда /help
bot.command('help', (ctx: Context) => {
  const helpMessage = 
    '📚 **Доступные команды:**\n\n' +
    '`/start` - Начать работу с ботом\n' +
    '`/girls` - Посмотреть доступных персонажей\n' +
    '`/profile` - Посмотреть свой профиль\n' +
    '`/help` - Получить справку\n\n' +
    '💡 **Как выбрать персонажа:**\n' +
    '1. Нажмите `/girls` чтобы увидеть список\n' +
    '2. Напишите "Выбрать [имя персонажа]"\n' +
    '3. Начните общение!';
  
  ctx.reply(helpMessage, { parse_mode: 'Markdown' });
});

// Обработка текстовых сообщений
bot.on('text', async (ctx: Context) => {
  const message = ctx.message && 'text' in ctx.message ? (ctx.message as { text: string }).text : undefined;
  const userId = ctx.from!.id;
  
  console.log(`✉️ Получено сообщение от ${userId}: ${message}`);
  
  // Проверяем команду "Выбрать [имя]"
  if (message && message.toLowerCase().startsWith('выбрать')) {
    const characterName = message.split(' ')[1];
    
    if (!characterName) {
      return ctx.reply('Пожалуйста, укажите имя персонажа. Например: "Выбрать Анна"');
    }
    
    try {
      const character = await Character.findOne({ 
        name: new RegExp(`^${characterName}$`, 'i') 
      });
      
      if (!character) {
        return ctx.reply(`Персонаж "${characterName}" не найден. Используйте /girls чтобы увидеть список.`);
      }
      
      // Обновляем выбор персонажа у пользователя
      await User.updateOne(
        { telegramId: userId },
        { characterId: character._id }
      );
      
      ctx.reply(
        `✅ Вы выбрали персонажа: **${character.name}**!\n\n` +
        // `Теперь вы можете общаться с ${character.name}. ${character.welcomeMessage || ''}\n\n` +
        `Просто напишите сообщение, и ${character.name} ответит вам!`,
        { parse_mode: 'Markdown' }
      );
      
    } catch (error) {
      console.error('Ошибка выбора персонажа:', error);
      ctx.reply('Произошла ошибка при выборе персонажа');
    }
    return;
  }
  
  // Обычное сообщение
  try {
    const user = await User.findOne({ telegramId: userId });
    
    if (!user) {
      return ctx.reply('Сначала нажмите /start');
    }
    
    if (!user.characterId) {
      return ctx.reply(
        'Сначала выберите персонажа! Используйте команду /girls чтобы увидеть список, затем напишите "Выбрать [имя]".'
      );
    }
    
    // Увеличиваем счетчик сообщений
    await User.updateOne(
      { telegramId: userId },
      { $inc: { totalMessages: 1 } }
    );
    
    // Получаем персонажа
    const character = await Character.findById(user.characterId);
    
    if (!character) {
      return ctx.reply('Ваш персонаж не найден. Выберите нового.');
    }
    
    // Простой ответ от имени персонажа
    const responses = [
      `О, "${message}"! Как интересно!`,
      `Хм, я думаю о том, что вы сказали... "${message}"`,
      `Спасибо за сообщение! Давайте поговорим еще.`,
      `"${message}" - это хорошая тема для разговора!`,
      `Я рада, что вы написали мне!`
    ];
    
    const randomResponse = responses[Math.floor(Math.random() * responses.length)];
    
    ctx.reply(`**${character.name}:** ${randomResponse}`, {
      parse_mode: 'Markdown'
    });
    
  } catch (error) {
    console.error('Ошибка обработки сообщения:', error);
    ctx.reply('Произошла ошибка. Попробуйте позже.');
  }
});

// Обработка ошибок
bot.catch((err: any, ctx: Context) => {
  console.error(`❌ Ошибка в боте для ${ctx.updateType}:`, err);
  ctx.reply('Произошла ошибка при обработке вашего запроса. Пожалуйста, попробуйте позже.');
});

export { bot };