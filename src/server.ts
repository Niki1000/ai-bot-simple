import express from 'express';
import { bot } from './bot';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

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
    time: new Date().toLocaleTimeString(),
    bot: 'Telegram bot готов к работе'
  });
});

// Webhook для Telegram
app.post('/telegram-webhook', (req, res) => {
  bot.handleUpdate(req.body, res);
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(`📡 http://localhost:${PORT}`);
  console.log(`🏥 http://localhost:${PORT}/health`);
});