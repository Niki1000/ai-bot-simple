const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const webappRouter = require('./webapp');

const app = express();

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Подключаем MongoDB если есть URI
if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }).then(() => {
    console.log('✅ MongoDB connected in API');
  }).catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
  });
}

// API маршруты
app.use('/api/webapp', webappRouter);

// Статические файлы из public
app.use(express.static(path.join(__dirname, '../public')));

// Главная страница
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Для всех остальных маршрутов
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Экспортируем для Vercel
module.exports = app;