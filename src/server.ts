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
app.use(express.static('public'));

// Логирование запросов
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// ==================== ОСНОВНЫЕ МАРШРУТЫ ====================

// Главная страница (отдаем фронтенд)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// API эндпоинты
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    time: new Date().toLocaleTimeString('ru-RU'),
    mode: NODE_ENV,
    bot: 'Telegram bot готов к работе',
    mongo: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

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
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.get('/api/user/:telegramId', async (req, res) => {
  try {
    const { telegramId } = req.params;
    const user = await User.findOne({ telegramId: parseInt(telegramId) });
    
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    res.json(user.toObject());
  } catch (error) {
    console.error('Ошибка API /api/user:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.get('/api/characters', async (req, res) => {
  try {
    const characters = await Character.find({ isActive: true })
      .select('name age description personality welcomeMessage trustRequired photoLimit avatarUrl')
      .lean();
    
    res.json(characters);
  } catch (error) {
    console.error('Ошибка API /api/characters:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.post('/api/select-character', async (req, res) => {
  try {
    const { userId, characterId } = req.body;
    
    if (!userId || !characterId) {
      return res.status(400).json({ error: 'Необходимы userId и characterId' });
    }
    
    const character = await Character.findById(characterId);
    if (!character) {
      return res.status(404).json({ error: 'Персонаж не найден' });
    }
    
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
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const { userId, message } = req.body;
    
    if (!message || message.trim() === '') {
      return res.status(400).json({ error: 'Сообщение не может быть пустым' });
    }
    
    const user = await User.findOne({ telegramId: parseInt(userId) });
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    // Увеличиваем счетчик сообщений
    await User.updateOne(
      { telegramId: parseInt(userId) },
      { $inc: { totalMessages: 1, trustLevel: 1 } }
    );
    
    // Простой ответ (позже добавим AI)
    const responses = [
      `О, "${message}"! Как интересно!`,
      `Хм, я думаю о том, что вы сказали... "${message}"`,
      `Спасибо за сообщение! Давайте поговорим еще.`,
      `"${message}" - это хорошая тема для разговора!`,
      `Я рада, что вы написали мне!`
    ];
    
    const response = responses[Math.floor(Math.random() * responses.length)];
    
    res.json({ response });
  } catch (error) {
    console.error('Ошибка API /api/chat:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// ==================== TELEGRAM WEBHOOK ====================

// Webhook для Telegram
app.post('/telegram-webhook', async (req, res) => {
  try {
    console.log('📨 Получен запрос от Telegram');
    await bot.handleUpdate(req.body, res);
  } catch (error) {
    console.error('❌ Ошибка обработки вебхука:', error instanceof Error ? error.message : error);
    res.status(500).send('Error');
  }
});

// ==================== ЗАПУСК СЕРВЕРА ====================

// Для Vercel нужен экспорт app
export default app;

// Локальный запуск
if (require.main === module) {
  const server = app.listen(PORT, () => {
    console.log(`
🚀 Сервер запущен на порту ${PORT}
🌍 Режим работы: ${NODE_ENV}
🔗 Главная страница: http://localhost:${PORT}
🔗 Проверка здоровья: http://localhost:${PORT}/api/health
    `);
    
    // Локальный запуск бота
    if (NODE_ENV !== 'production') {
      console.log('\n🤖 Запускаю бота в режиме polling...');
      bot.launch().catch(console.error);
      console.log('✅ Бот запущен локально');
    }
  });
}