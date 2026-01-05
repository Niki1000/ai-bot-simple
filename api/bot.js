// api/bot.js - ТОЧНЫЙ РАБОЧИЙ КОД ДЛЯ VERCEL
const { Telegraf } = require('telegraf');

// Инициализируем бота
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Простейший обработчик - работает 100%
bot.start((ctx) => {
  return ctx.reply(`✅ БОТ РАБОТАЕТ НА VERCEL!\nПривет, ${ctx.from.first_name}!`);
});

bot.help((ctx) => {
  return ctx.reply('Помощь: /start, /girls, /profile');
});

bot.command('girls', (ctx) => {
  return ctx.reply('👥 Персонажи:\n1. Анна, 25\n2. Мария, 27\n3. София, 23');
});

bot.command('profile', (ctx) => {
  return ctx.reply(`👤 Профиль ${ctx.from.first_name}\nУровень: 10\nСообщений: 5`);
});

bot.on('text', (ctx) => {
  return ctx.reply(`Вы: "${ctx.message.text}"\nБот на Vercel получил!`);
});

// ВАЖНО: Для Vercel Serverless
module.exports = async (req, res) => {
  try {
    // Только POST запросы
    if (req.method !== 'POST') {
      return res.status(200).json({ ok: true });
    }
    
    console.log('📨 Telegram webhook received');
    
    // Обрабатываем через бота
    await bot.handleUpdate(req.body, res);
    
  } catch (error) {
    console.error('❌ Error:', error);
    // Всегда возвращаем 200 для Telegram
    res.status(200).json({ ok: false, error: error.message });
  }
};