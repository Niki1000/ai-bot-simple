// test-local.js - локальный тест
require('dotenv').config();

// Простая проверка переменных
console.log('🔧 Проверка окружения:');
console.log('TELEGRAM_BOT_TOKEN:', process.env.TELEGRAM_BOT_TOKEN ? '✅ Установлен' : '❌ Нет');
console.log('NODE_ENV:', process.env.NODE_ENV || 'development');

// Проверка простого бота
const { Telegraf } = require('telegraf');

if (process.env.TELEGRAM_BOT_TOKEN) {
  const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
  
  bot.start(ctx => ctx.reply('Локальный тест: Бот работает!'));
  bot.on('text', ctx => ctx.reply(`Тест: ${ctx.message.text}`));
  
  console.log('🤖 Запускаю локального бота...');
  bot.launch();
  
  console.log('✅ Локальный бот запущен! Отправьте /start в Telegram');
} else {
  console.log('❌ Не могу запустить бота без токена');
}