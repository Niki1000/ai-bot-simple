// api/index.js
const express = require('express');
const mongoose = require('mongoose');
const { Telegraf, Markup } = require('telegraf');
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
require('dotenv').config();

const app = express();
app.use(express.json());

// Статические файлы
app.use(express.static('public'));

// MongoDB подключение
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
// Создание тестовых персонажей
app.post('/api/seed', async (req, res) => {
  try {
    await Character.deleteMany({});
    
    const characters = [
      {
        name: "Анна",
        age: 25,
        description: "Романтичная девушка с мягким характером",
        personality: "Заботливая, чувствительная",
        avatarUrl: "https://i.pravatar.cc/150?img=1",
        welcomeMessage: "Привет! Я так рада познакомиться!",
        bio: "Люблю искусство и долгие прогулки",
        trustRequired: 10,
        photoLimit: 3,
        isActive: true
      },
      // ... добавьте остальных персонажей
    ];
    
    await Character.insertMany(characters);
    res.json({ success: true, count: characters.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Команда /start
bot.start(async (ctx) => {
  const userId = ctx.from.id;
  const firstName = ctx.from.first_name;
  
  // Сохраняем пользователя в БД
  let user = await User.findOne({ telegramId: userId });
  if (!user) {
    user = new User({
      telegramId: userId,
      username: ctx.from.username,
      firstName: firstName,
      lastName: ctx.from.last_name,
      trustLevel: 0,
      photoRequests: 0,
      totalMessages: 0
    });
    await user.save();
  }
  
  // Кнопки с Web App (работает на Vercel!)
  const webAppUrl = process.env.WEBAPP_URL || 'https://ваш-проект.vercel.app';
  
  ctx.reply(
    `Привет, ${firstName}! 👋\n` +
    'Я - AI Dating Bot с виртуальными персонажами!\n\n' +
    '📋 Команды:\n' +
    '/girls - Посмотреть персонажей\n' +
    '/profile - Мой профиль\n' +
    '/help - Помощь\n\n' +
    '🌐 Нажми кнопку ниже для Web App!',
    Markup.keyboard([
      ['👥 Персонажи', '👤 Профиль'],
      ['💬 Начать чат', '❓ Помощь'],
      [Markup.button.webApp('🌐 Открыть Web App', webAppUrl)]
    ]).resize()
  );
});

// Остальные команды (добавьте аналогично)
bot.command('girls', async (ctx) => {
  // Логика команды /girls
});

bot.command('profile', async (ctx) => {
  // Логика команды /profile
});

// Вебхук маршрут
app.post('/telegram-webhook', async (req, res) => {
  try {
    console.log('📨 Получен запрос от Telegram');
    await bot.handleUpdate(req.body, res);
  } catch (error) {
    console.error('❌ Ошибка обработки вебхука:', error);
    res.status(500).send('Error');
  }
});

// Главная страница
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/../public/index.html');
});

// API эндпоинты
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'AI Dating Bot работает!',
    timestamp: new Date().toISOString()
  });
});

// Telegram Webhook
app.post('/telegram-webhook', async (req, res) => {
  // Временный заглушка
  console.log('Telegram webhook received:', req.body);
  res.json({ ok: true });
});

// Обработка 404
app.use('*', (req, res) => {
  res.sendFile(__dirname + '/../public/index.html');
});

module.exports = app;