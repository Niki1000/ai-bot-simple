// api/index.js
const express = require('express');
const mongoose = require('mongoose');
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