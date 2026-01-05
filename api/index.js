const express = require('express');
const { Telegraf } = require('telegraf');
require('dotenv').config();

const app = express();

// Middleware
app.use(express.json());

// Проверка токена
if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN не установлен!');
  process.exit(1);
}

console.log('🤖 Инициализация бота...');
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Простые команды для теста
bot.start((ctx) => {
  console.log(`🚀 /start от ${ctx.from.id} (${ctx.from.first_name})`);
  return ctx.reply(
    `Привет, ${ctx.from.first_name}! 👋\n` +
    'Бот успешно работает на Vercel!\n\n' +
    '📋 Команды:\n' +
    '/girls - Персонажи\n' +
    '/profile - Профиль\n' +
    '/help - Помощь'
  );
});

bot.command('help', (ctx) => {
  return ctx.reply(
    '📚 Доступные команды:\n' +
    '/start - Начать диалог\n' +
    '/girls - Список персонажей\n' +
    '/profile - Ваш профиль\n' +
    '/help - Эта справка\n\n' +
    'Просто напишите сообщение для общения!'
  );
});

bot.on('text', (ctx) => {
  console.log(`📨 Сообщение от ${ctx.from.id}: ${ctx.message.text}`);
  return ctx.reply(`Вы сказали: "${ctx.message.text}"`);
});

// Обработчик ошибок бота
bot.catch((err, ctx) => {
  console.error(`❌ Ошибка в боте:`, err);
  if (ctx && ctx.reply) {
    ctx.reply('Произошла ошибка. Попробуйте позже.');
  }
});

// Вебхук обработчик
app.post('/telegram-webhook', async (req, res) => {
  console.log('🌐 Вебхук получен, update_id:', req.body?.update_id);
  
  try {
    // Важно: не вызываем next() и не отправляем ответ сами
    await bot.handleUpdate(req.body, res);
  } catch (error) {
    console.error('❌ Ошибка обработки вебхука:', error);
    
    // Если бот не отправил ответ, отправляем успешный
    if (!res.headersSent) {
      res.status(200).json({ ok: true });
    }
  }
});

// API маршруты
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'Telegram Bot API',
    timestamp: new Date().toISOString(),
    bot: 'ready'
  });
});

app.get('/api/test', (req, res) => {
  res.json({ message: 'API работает!' });
});

// Экспортируем для Vercel
module.exports = app;