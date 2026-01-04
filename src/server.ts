import express from 'express';
import mongoose from 'mongoose';
import { bot } from './bot';
import { User } from './models/User';
import { Character } from './models/Character';
import { connectDB } from './db';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Подключаемся к базе данных
connectDB();

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Логирование запросов
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// ==================== API ЭНДПОИНТЫ ДЛЯ FRONTEND ====================

// 1. Получение данных пользователя
app.get('/api/user/:telegramId', async (req, res) => {
  try {
    const { telegramId } = req.params;
    const user = await User.findOne({ telegramId: parseInt(telegramId) });
    
    if (!user) {
      // Создаем нового пользователя, если не найден
      const newUser = new User({
        telegramId: parseInt(telegramId),
        firstName: 'Пользователь',
        trustLevel: 0,
        photoRequests: 0,
        createdAt: new Date()
      });
      await newUser.save();
      return res.json(newUser.toObject());
    }
    
    res.json(user.toObject());
  } catch (error) {
    console.error('Ошибка API /api/user:', error);
    res.status(500).json({ error: error.message });
  }
});

// 2. Получение всех персонажей
app.get('/api/characters', async (req, res) => {
  try {
    const characters = await Character.find({ isActive: true })
      .select('name age description personality welcomeMessage trustRequired photoLimit')
      .lean();
    
    res.json(characters);
  } catch (error) {
    console.error('Ошибка API /api/characters:', error);
    res.status(500).json({ error: error.message });
  }
});

// 3. Выбор персонажа
app.post('/api/select-character', async (req, res) => {
  try {
    const { userId, characterId } = req.body;
    
    // Проверяем существование персонажа
    const character = await Character.findById(characterId);
    if (!character) {
      return res.status(404).json({ error: 'Персонаж не найден' });
    }
    
    // Обновляем пользователя
    const user = await User.findOneAndUpdate(
      { telegramId: parseInt(userId) },
      { characterId: characterId },
      { new: true, upsert: true }
    );
    
    res.json({ 
      success: true, 
      message: `Вы выбрали ${character.name}`,
      user: user.toObject()
    });
  } catch (error) {
    console.error('Ошибка API /api/select-character:', error);
    res.status(500).json({ error: error.message });
  }
});

// 4. Отправка сообщения (чат)
app.post('/api/chat', async (req, res) => {
  try {
    const { userId, message, characterId } = req.body;
    
    if (!message || message.trim() === '') {
      return res.status(400).json({ error: 'Сообщение не может быть пустым' });
    }
    
    // Получаем пользователя и персонажа
    const user = await User.findOne({ telegramId: parseInt(userId) });
    const character = characterId ? await Character.findById(characterId) : null;
    
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    // Увеличиваем счетчик сообщений
    await User.updateOne(
      { telegramId: parseInt(userId) },
      { $inc: { totalMessages: 1 } }
    );
    
    // Генерируем ответ (пока простой, потом подключим AI)
    let response;
    
    if (!character) {
      response = `Вы сказали: "${message}". Сначала выберите персонажа для общения!`;
    } else {
      // Простая имитация ответа персонажа
      const responses = [
        `О, как интересно! "${message}" - это действительно любопытно.`,
        `Я думаю о том, что вы сказали: "${message}". Давайте поговорим об этом!`,
        `Хм, "${message}"... У меня есть что сказать на эту тему!`,
        `Спасибо за сообщение! "${message}" - это заставляет задуматься.`,
        `Я рада, что вы поделились этим: "${message}". Давайте продолжим беседу!`
      ];
      
      response = `[${character.name}]: ${responses[Math.floor(Math.random() * responses.length)]}`;
      
      // Увеличиваем уровень доверия
      if (user.trustLevel < 100) {
        await User.updateOne(
          { telegramId: parseInt(userId) },
          { $inc: { trustLevel: 1 } }
        );
      }
    }
    
    res.json({ response });
  } catch (error) {
    console.error('Ошибка API /api/chat:', error);
    res.status(500).json({ error: error.message });
  }
});

// 5. Проверка подключения к БД
app.get('/api/db-check', async (req, res) => {
  try {
    const db = mongoose.connection;
    
    const stats = {
      status: db.readyState === 1 ? 'connected' : 'disconnected',
      readyState: db.readyState,
      models: mongoose.modelNames(),
      userCount: await User.countDocuments(),
      characterCount: await Character.countDocuments()
    };
    
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== TELEGRAM BOT WEBHOOK ====================

// Webhook для Telegram (только в production)
if (NODE_ENV === 'production') {
  app.post('/telegram-webhook', (req, res) => {
    console.log('📨 Тело запроса от Telegram:', JSON.stringify(req.body, null, 2));
    bot.handleUpdate(req.body, res);
  });
}

// ==================== ОСНОВНЫЕ МАРШРУТЫ ====================

// Главная страница
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Страница здоровья сервера
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    time: new Date().toLocaleTimeString('ru-RU'),
    mode: NODE_ENV,
    bot: 'Telegram bot готов к работе',
    api: 'API работает',
    mongo: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// 404 для API
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// 404 для остальных маршрутов
app.use('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ==================== ЗАПУСК СЕРВЕРА ====================

const server = app.listen(PORT, () => {
  console.log(`
🚀 Сервер запущен на порту ${PORT}
🌍 Режим работы: ${NODE_ENV}
📁 Статические файлы: ${path.join(__dirname, '../public')}
🔗 Главная страница: http://localhost:${PORT}
🔗 Проверка здоровья: http://localhost:${PORT}/health
🔗 Проверка БД: http://localhost:${PORT}/api/db-check
  `);
  
  // Локальный запуск бота в режиме polling
  if (NODE_ENV !== 'production') {
    console.log('\n🤖 Запускаю бота в режиме polling...');
    
    bot.launch().catch((error) => {
      console.error('❌ Ошибка запуска бота:', error);
    });
    
    console.log('✅ Бот запущен и готов к работе');
    console.log('📝 Отправьте команду /start вашему боту в Telegram');
    
    setTimeout(() => {
      console.log('🔄 Бот активно слушает сообщения...\n');
    }, 1000);
  } else {
    console.log('🌐 Бот работает в режиме webhook на Vercel\n');
  }
});

// Graceful shutdown
process.once('SIGINT', () => {
  console.log('\n🛑 Получен SIGINT, останавливаю бота...');
  bot.stop();
  server.close(() => {
    console.log('✅ Сервер остановлен');
    process.exit(0);
  });
});

process.once('SIGTERM', () => {
  console.log('\n🛑 Получен SIGTERM, останавливаю бота...');
  bot.stop();
  server.close(() => {
    console.log('✅ Сервер остановлен');
    process.exit(0);
  });
});

export { app };