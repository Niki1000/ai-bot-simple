import express from 'express';
import { bot } from './bot';
import { connectDB } from './db';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Подключаем базу данных
connectDB().then(() => {
  console.log('✅ База данных подключена');
});

// Тестовый маршрут
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>AI Dating Bot</title>
        <style>
          body { font-family: Arial; padding: 40px; text-align: center; }
          .status { color: green; font-weight: bold; }
        </style>
      </head>
      <body>
        <h1>🤖 AI Dating Bot</h1>
        <p class="status">✅ Сервер работает</p>
        <p><a href="/health">Проверить здоровье</a></p>
      </body>
    </html>
  `);
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Webhook для Telegram
app.post('/telegram-webhook', (req, res) => {
  bot.handleUpdate(req.body, res);
});

// Экспорт для Vercel
export default app;

// Локальный запуск (только для разработки)
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`📡 http://localhost:${PORT}`);
    console.log(`🏥 http://localhost:${PORT}/health`);
  });
}