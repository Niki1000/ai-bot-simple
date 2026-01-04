import { Telegraf, Context, Markup } from 'telegraf';
import dotenv from 'dotenv';
import { User } from './models/User';
import { Character } from './models/Character';

dotenv.config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);
const isProduction = process.env.NODE_ENV === 'production';
const webAppUrl = process.env.WEBAPP_URL || 'https://ваш-проект.vercel.app';

// Команда /start
bot.start(async (ctx: Context) => {
  console.log(`👤 Пользователь ${ctx.from?.id} запустил бота`);
  
  const userId = ctx.from!.id;
  const firstName = ctx.from!.first_name;
  
  // Сохраняем пользователя
  try {
    let user = await User.findOne({ telegramId: userId });
    
    if (!user) {
      user = new User({
        telegramId: userId,
        username: ctx.from!.username,
        firstName: firstName,
        lastName: ctx.from!.last_name,
        trustLevel: 0,
        photoRequests: 0,
        totalMessages: 0
      });
      await user.save();
    }
  } catch (error) {
    console.error('Ошибка сохранения пользователя:', error);
  }
  
  // Создаем меню
  const menuButtons = Markup.keyboard([
    ['👥 Персонажи', '👤 Профиль'],
    ['💬 Начать чат', '❓ Помощь']
  ]).resize();
  
  let welcomeMessage = `Привет, ${firstName}! 👋\n` +
    'Я - AI Dating Bot с виртуальными персонажами!\n\n' +
    '📋 Используй меню ниже или команды:\n' +
    '/girls - Посмотреть персонажей\n' +
    '/profile - Мой профиль\n' +
    '/help - Помощь\n';
  
  // Добавляем Web App кнопку только в production
  if (isProduction) {
    welcomeMessage += '\n🌐 **Новая функция:** Нажми кнопку ниже для расширенного Web App!';
    
    ctx.reply(welcomeMessage, {
      ...Markup.keyboard([
        ['👥 Персонажи', '👤 Профиль'],
        ['💬 Начать чат', '❓ Помощь'],
        [Markup.button.webApp('🌐 Открыть Web App', webAppUrl)]
      ]).resize(),
      parse_mode: 'Markdown'
    });
  } else {
    ctx.reply(welcomeMessage, menuButtons);
  }
});

// Команда /girls
bot.command('girls', async (ctx: Context) => {
  try {
    const characters = await Character.find({ isActive: true })
      .select('name age description')
      .limit(5);
    
    if (characters.length === 0) {
      return ctx.reply('Пока нет доступных персонажей.');
    }
    
    let message = '👥 **Доступные персонажи:**\n\n';
    characters.forEach((char, i) => {
      message += `${i+1}. **${char.name}**, ${char.age}\n   ${char.description}\n\n`;
    });
    
    message += '💡 Напишите "Выбрать [имя]" чтобы начать общение';
    
    if (isProduction) {
      message += '\n🌐 Или откройте Web App для удобного выбора!';
      ctx.reply(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          Markup.button.webApp('🌐 Выбрать в Web App', webAppUrl)
        ])
      });
    } else {
      ctx.reply(message, { parse_mode: 'Markdown' });
    }
    
  } catch (error) {
    console.error('Ошибка /girls:', error);
    ctx.reply('Произошла ошибка');
  }
});

// Команда /profile
bot.command('profile', async (ctx: Context) => {
  try {
    const user = await User.findOne({ telegramId: ctx.from!.id });
    
    if (!user) return ctx.reply('Сначала нажмите /start');
    
    let characterName = 'Не выбран';
    if (user.characterId) {
      const character = await Character.findById(user.characterId);
      if (character) characterName = character.name;
    }
    
    const message = 
      `👤 **Ваш профиль:**\n\n` +
      `**Имя:** ${user.firstName}\n` +
      `**Уровень доверия:** ${user.trustLevel}/100\n` +
      `**Сообщений:** ${user.totalMessages || 0}\n` +
      `**Персонаж:** ${characterName}\n` +
      `**В системе с:** ${user.createdAt.toLocaleDateString('ru-RU')}`;
    
    if (isProduction) {
      ctx.reply(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          Markup.button.webApp('🌐 Подробнее в Web App', webAppUrl)
        ])
      });
    } else {
      ctx.reply(message, { parse_mode: 'Markdown' });
    }
    
  } catch (error) {
    console.error('Ошибка /profile:', error);
    ctx.reply('Произошла ошибка');
  }
});

// Остальной код бота (обработка сообщений) остается таким же

export { bot };